/**
 * Phase 3: Grouped Temporal / Walk-Forward Evaluator
 * 
 * Strict Evaluation Rules:
 * 1. Temporal Cutoff: T_train < T_split < T_eval. Training data precedes evaluation data.
 * 2. Group Leakage Protection: Grouping unit is canonicalId (canonical flight instance). All predictions
 *    for a given flight lifecycle belong strictly to train OR eval split — never both.
 * 3. Real-Time Flight Trajectory vs Evaluation Leakage:
 *    - Point-in-time prior observations of the current flight (t <= T_pred) ARE permitted as prediction features.
 *    - Future observations or outcome labels of the held-out flight lifecycle are strictly forbidden from training.
 * 4. Coverage Guard: UNKNOWN_DUE_TO_COVERAGE outcomes are strictly excluded from drop classification targets.
 * 5. Synthetic Guard: ISOLATED_TEST_FIXTURE predictions are strictly rejected.
 */

import {
  PredictionAuditRecord,
  HorizonPeriod,
  ModelTaskEvaluationResults
} from './types/mlPipeline';

export interface TrainEvalSplitResult {
  trainRecords: PredictionAuditRecord[];
  evalRecords: PredictionAuditRecord[];
  uniqueTrainFlights: number;
  uniqueEvalFlights: number;
}

export class GroupedTemporalEvaluator {
  /**
   * Performs grouped temporal split on prediction records
   */
  public performGroupedTemporalSplit(
    allRecords: PredictionAuditRecord[],
    splitTimestampISO: string,
    allowTestFixtures = false
  ): TrainEvalSplitResult {
    const splitTimeMs = new Date(splitTimestampISO).getTime();

    // 1. Group records by canonical flight instance (canonicalId)
    const flightGroupMap = new Map<string, PredictionAuditRecord[]>();
    for (const rec of allRecords) {
      if (rec.provenance === 'ISOLATED_TEST_FIXTURE' || (rec.provenance as any) === 'CONFIRMED_TEST_ARTIFACT') {
        if (!allowTestFixtures) {
          throw new Error(`Data Integrity Violation: Isolated test fixture prediction rejected by GroupedTemporalEvaluator.`);
        }
      }
      const list = flightGroupMap.get(rec.canonicalId) || [];
      list.push(rec);
      flightGroupMap.set(rec.canonicalId, list);
    }

    const trainRecords: PredictionAuditRecord[] = [];
    const evalRecords: PredictionAuditRecord[] = [];
    const trainFlights = new Set<string>();
    const evalFlights = new Set<string>();

    // 2. Assign entire flight group based on the flight's earliest prediction timestamp
    for (const [canonicalId, group] of flightGroupMap.entries()) {
      const earliestPredTimeMs = Math.min(...group.map(r => new Date(r.createdAt).getTime()));

      if (earliestPredTimeMs <= splitTimeMs) {
        // Belongs to train split
        trainRecords.push(...group);
        trainFlights.add(canonicalId);
      } else {
        // Belongs to eval split
        evalRecords.push(...group);
        evalFlights.add(canonicalId);
      }
    }

    return {
      trainRecords,
      evalRecords,
      uniqueTrainFlights: trainFlights.size,
      uniqueEvalFlights: evalFlights.size
    };
  }

  /**
   * Evaluates price forecasting performance for a model against persistence baseline
   */
  public evaluatePriceForecastingTask(
    evalRecords: PredictionAuditRecord[],
    horizon: HorizonPeriod,
    modelForecastGetter: (pred: PredictionAuditRecord, h: HorizonPeriod) => number | null,
    datasetManifestId: string
  ): ModelTaskEvaluationResults {
    const validErrors: number[] = [];
    const persistenceErrors: number[] = [];

    for (const rec of evalRecords) {
      const outcome = rec.horizonOutcomes?.[horizon];
      if (!outcome || !outcome.isSufficientCoverage || outcome.priceAtExpiryINR === null) {
        continue; // Skip undercovered or missing expiry fare
      }

      const actualFare = outcome.priceAtExpiryINR;
      const spotFare = rec.currentFareINR;
      const modelForecast = modelForecastGetter(rec, horizon);

      if (modelForecast !== null) {
        validErrors.push(Math.abs(modelForecast - actualFare));
        persistenceErrors.push(Math.abs(spotFare - actualFare));
      }
    }

    if (validErrors.length === 0) {
      return {
        evaluatorVersion: 'v1.0-grouped-temporal',
        evaluatedAt: new Date().toISOString(),
        datasetManifestId,
        maeINR: null,
        medianAbsoluteErrorINR: null,
        rmseINR: null,
        maeImprovementVsPersistenceRatio: null,
        statusRationale: 'UNPOWERED_INSUFFICIENT_SAMPLE: 0 valid resolved evaluation outcomes available.'
      };
    }

    const mae = validErrors.reduce((a, b) => a + b, 0) / validErrors.length;
    const sortedErrors = [...validErrors].sort((a, b) => a - b);
    const medianAE = sortedErrors[Math.floor(sortedErrors.length / 2)];
    const rmse = Math.sqrt(validErrors.reduce((a, b) => a + b * b, 0) / validErrors.length);

    const persistenceMAE = persistenceErrors.reduce((a, b) => a + b, 0) / persistenceErrors.length;
    const improvementRatio = persistenceMAE > 0 ? Number(((persistenceMAE - mae) / persistenceMAE).toFixed(4)) : 0;

    return {
      evaluatorVersion: 'v1.0-grouped-temporal',
      evaluatedAt: new Date().toISOString(),
      datasetManifestId,
      maeINR: Number(mae.toFixed(2)),
      medianAbsoluteErrorINR: Number(medianAE.toFixed(2)),
      rmseINR: Number(rmse.toFixed(2)),
      maeImprovementVsPersistenceRatio: improvementRatio,
      statusRationale: `Evaluated on ${validErrors.length} held-out resolved outcomes across candidate horizon ${horizon}.`
    };
  }
}

export const groupedTemporalEvaluator = new GroupedTemporalEvaluator();
