/**
 * Phase 3: Calibration Analyzer
 * 
 * Strict Probability Calibration Rules:
 * 1. Probability calibration is computed on held-out evaluation datasets.
 * 2. Unconfirmed or UNKNOWN_DUE_TO_COVERAGE labels are strictly excluded.
 * 3. With zero or insufficient confirmed labels, returns status = 'INSUFFICIENT_EVIDENCE'.
 * 4. Never exposes uncalibrated heuristic scores as probabilities.
 */

import {
  EvaluationDatasetRow,
  CalibrationAnalysisReport
} from './types/mlPipeline';

export class CalibrationAnalyzerService {
  /**
   * Evaluates probability calibration for a predicted drop probability model
   */
  public evaluateCalibration(
    rows: EvaluationDatasetRow[],
    probabilityGetter: (row: EvaluationDatasetRow) => number | null
  ): CalibrationAnalysisReport {
    // 1. Filter rows with confirmed labels
    const confirmedRows = rows.filter(r => 
      r.labelMeaningfulSaving === 'CONFIRMED_TRUE' || r.labelMeaningfulSaving === 'CONFIRMED_FALSE'
    );

    const sampleCount = confirmedRows.length;
    const confirmedTrueCount = confirmedRows.filter(r => r.labelMeaningfulSaving === 'CONFIRMED_TRUE').length;
    const confirmedFalseCount = sampleCount - confirmedTrueCount;

    // 2. Check for sufficient sample support
    if (sampleCount < 10 || confirmedTrueCount === 0 || confirmedFalseCount === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        sampleCount,
        confirmedTrueCount,
        confirmedFalseCount,
        brierScore: null,
        logLoss: null,
        reliabilityBins: [],
        rationale: `INSUFFICIENT_EVIDENCE: Only ${sampleCount} confirmed labels available (True=${confirmedTrueCount}, False=${confirmedFalseCount}). Minimum 10 confirmed samples required for calibration analysis.`
      };
    }

    // 3. Compute Brier score and log loss for valid probabilities
    let squaredErrorSum = 0;
    let logLossSum = 0;
    let validProbCount = 0;

    for (const r of confirmedRows) {
      const prob = probabilityGetter(r);
      if (prob === null || prob < 0 || prob > 1) continue;

      const y = r.labelMeaningfulSaving === 'CONFIRMED_TRUE' ? 1 : 0;
      squaredErrorSum += Math.pow(prob - y, 2);
      
      const eps = 1e-15;
      const pBounded = Math.max(eps, Math.min(1 - eps, prob));
      logLossSum += -(y * Math.log(pBounded) + (1 - y) * Math.log(1 - pBounded));
      validProbCount++;
    }

    if (validProbCount === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        sampleCount,
        confirmedTrueCount,
        confirmedFalseCount,
        brierScore: null,
        logLoss: null,
        reliabilityBins: [],
        rationale: 'INSUFFICIENT_EVIDENCE: Model outputs null/uncalibrated probabilities.'
      };
    }

    const brierScore = Number((squaredErrorSum / validProbCount).toFixed(4));
    const logLoss = Number((logLossSum / validProbCount).toFixed(4));

    return {
      status: brierScore <= 0.20 ? 'CALIBRATED' : 'UNCALIBRATED',
      sampleCount,
      confirmedTrueCount,
      confirmedFalseCount,
      brierScore,
      logLoss,
      reliabilityBins: [],
      rationale: `Evaluated calibration across ${validProbCount} confirmed samples. Brier Score = ${brierScore}.`
    };
  }
}

export const calibrationAnalyzerService = new CalibrationAnalyzerService();
