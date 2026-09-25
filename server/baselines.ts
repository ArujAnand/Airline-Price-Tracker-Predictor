/**
 * Phase 3: Factual Baseline Models
 * 
 * Strict Baseline Rules:
 * 1. Zero learned flight-price behavior or hardcoded airline rules.
 * 2. Persistence baseline returns current spot fare as point forecast; strictly NO fabricated quantiles or drop probabilities.
 * 3. Trailing momentum baseline calculates trend from genuinely observed prior snapshots (t <= T_pred).
 *    If < 2 observations exist in lookback window, outputs pointForecastINR = null (unavailable).
 */

import {
  HorizonPeriod,
  HorizonOutput,
  LongitudinalObservation
} from './types/mlPipeline';

export class PersistenceBaseline {
  public static readonly MODEL_ID = 'baseline-fare-persistence';
  public static readonly VERSION = 'v1.0-empirical';

  /**
   * Generates horizon-specific prediction output using current spot fare
   */
  public generateHorizonOutputs(
    currentSpotFareINR: number,
    candidateHorizons: HorizonPeriod[]
  ): Record<HorizonPeriod, HorizonOutput> {
    const outputs: Partial<Record<HorizonPeriod, HorizonOutput>> = {};

    for (const h of candidateHorizons) {
      outputs[h] = {
        horizon: h,
        pointForecastINR: currentSpotFareINR, // Current spot fare
        quantileForecasts: null,              // Strictly NO fabricated quantiles!
        dropProbability: null,                // Strictly NO fabricated drop probability!
        horizonScore: null,
        decisionPolicy: null
      };
    }

    return outputs as Record<HorizonPeriod, HorizonOutput>;
  }
}

export class TrailingMomentumBaseline {
  public static readonly MODEL_ID = 'baseline-trailing-momentum';
  public static readonly VERSION = 'v1.0-empirical';

  /**
   * Generates horizon-specific prediction output using trailing 24h momentum
   */
  public generateHorizonOutputs(
    currentSpotFareINR: number,
    candidateHorizons: HorizonPeriod[],
    priorSnapshots: LongitudinalObservation[],
    predictionTimestampISO: string,
    lookbackHours = 24
  ): Record<HorizonPeriod, HorizonOutput> {
    const outputs: Partial<Record<HorizonPeriod, HorizonOutput>> = {};
    const predTimeMs = new Date(predictionTimestampISO).getTime();
    const lookbackStartMs = predTimeMs - lookbackHours * 3600 * 1000;

    // Filter prior snapshots strictly in [T_pred - lookback, T_pred]
    const validPriors = priorSnapshots
      .filter(s => {
        const t = new Date(s.observedAt).getTime();
        return t >= lookbackStartMs && t <= predTimeMs;
      })
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    // If < 2 prior observations exist in lookback window, momentum output is UNAVAILABLE
    let pointForecast: number | null = null;
    if (validPriors.length >= 2) {
      const oldestPrice = validPriors[0].priceINR;
      const newestPrice = validPriors[validPriors.length - 1].priceINR;
      const trailingDelta = newestPrice - oldestPrice;
      pointForecast = Math.max(1000, currentSpotFareINR + trailingDelta);
    } else {
      pointForecast = null; // Unavailable due to insufficient prior trajectory
    }

    for (const h of candidateHorizons) {
      outputs[h] = {
        horizon: h,
        pointForecastINR: pointForecast,
        quantileForecasts: null, // Strictly NO fabricated quantiles!
        dropProbability: null,   // Strictly NO fabricated drop probability!
        horizonScore: null,
        decisionPolicy: null
      };
    }

    return outputs as Record<HorizonPeriod, HorizonOutput>;
  }
}

export const persistenceBaseline = new PersistenceBaseline();
export const trailingMomentumBaseline = new TrailingMomentumBaseline();
