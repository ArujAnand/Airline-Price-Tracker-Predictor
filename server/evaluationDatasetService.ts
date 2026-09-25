/**
 * Phase 2: Evaluation Dataset Interface
 * 
 * Provides clean, queryable evaluation datasets for future Phase 3 model training/validation.
 * 
 * STRICT INVARIANTS:
 * 1. Only genuine, sufficiently-covered real outcomes are returned.
 * 2. Features are strictly point-in-time (t <= T_pred).
 * 3. Synthetic test fixtures are strictly excluded unless explicitly requested for unit tests.
 * 4. Zero predictive model training occurs inside this service.
 */

import { firestoreDB } from './firestoreService';
import {
  EvaluationDatasetFilter,
  EvaluationDatasetRow,
  PredictionAuditRecord
} from './types/mlPipeline';

export class EvaluationDatasetService {
  /**
   * Retrieves clean evaluation dataset rows matching the specified filter criteria
   */
  public async getEvaluationDataset(filter: EvaluationDatasetFilter): Promise<EvaluationDatasetRow[]> {
    const allPredictions = await firestoreDB.getPredictionRecords();
    const rows: EvaluationDatasetRow[] = [];

    const targetHorizon = filter.horizon;
    const minCoverage = filter.minCoverageRatio ?? 0.50;
    const requireSufficiency = filter.requireSufficientCoverage ?? true;
    const allowedProvenances = filter.provenances || ['REAL_OBSERVATION'];

    for (const rawPred of allPredictions) {
      const pred = rawPred as unknown as PredictionAuditRecord;

      // 1. Provenance Guard
      if (!allowedProvenances.includes(pred.provenance)) continue;

      // 2. Route & Origin Filter
      if (filter.routeId && pred.routeId.toUpperCase() !== filter.routeId.toUpperCase()) continue;
      if (filter.originType && pred.originType !== filter.originType) continue;

      // 3. Inspect target horizon outcome
      const horizonOutcome = pred.horizonOutcomes?.[targetHorizon];
      if (!horizonOutcome) continue;

      // 4. Coverage Sufficiency Check
      if (requireSufficiency && !horizonOutcome.isSufficientCoverage) continue;
      if (horizonOutcome.observationCoverageRatio < minCoverage) continue;

      // 5. Construct Clean Evaluation Row
      rows.push({
        predictionId: pred.predictionId,
        canonicalId: pred.canonicalId,
        originType: pred.originType,
        predictionTimestamp: pred.createdAt,
        departureDate: pred.departureDate,
        leadTimeHours: pred.leadTimeHours,
        leadTimeDays: pred.leadTimeDays,
        initialFareINR: pred.currentFareINR,
        features: pred.features,
        horizon: targetHorizon,
        outcome: horizonOutcome,
        labelMeaningfulSaving: horizonOutcome.hasMeaningfulSavingEvent,
        labelMaxAchievableSavingINR: horizonOutcome.maxAchievableSavingINR,
        labelMaxDownsideSurgeINR: horizonOutcome.maxDownsideSurgeINR,
        labelExpiryPriceDeltaINR: horizonOutcome.expiryPriceDeltaINR
      });
    }

    return rows;
  }
}

export const evaluationDatasetService = new EvaluationDatasetService();
