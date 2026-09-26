/**
 * Phase 3 & 4: Factual Baseline Models
 * 
 * Strict Baseline Rules:
 * 1. Zero learned flight-price behavior or hardcoded airline rules.
 * 2. Persistence baseline returns current spot fare as point forecast.
 * 3. Trailing step baseline calculates delta = newest observed price - oldest observed price in the lookback window.
 *    Forecast = current fare + delta.
 * 4. Time-normalized momentum challenger calculates:
 *    rateINRPerHour = (newestFareINR - oldestFareINR) / elapsedHoursBetweenThoseObservations
 *    Then for horizon H (in hours):
 *    forecast(T + H) = currentFareINR + rateINRPerHour * horizonHours
 *    If extrapolation produces result <= 0, pointForecastINR = null, and predictionStatus = 'INVALID_EXTRAPOLATION'.
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

export class TrailingStepBaseline {
  public static readonly MODEL_ID = 'baseline-trailing-step-v1';
  public static readonly VERSION = 'v1.0-empirical';

  /**
   * Generates horizon-specific prediction output using trailing 24h step-difference
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
        quantileForecasts: null,
        dropProbability: null,
        horizonScore: null,
        decisionPolicy: null
      };
    }

    return outputs as Record<HorizonPeriod, HorizonOutput>;
  }
}

export class TimeNormalizedMomentumBaseline {
  public static readonly MODEL_ID = 'baseline-trailing-momentum-time-normalized-v1';
  public static readonly VERSION = 'v1.0-empirical';

  /**
   * Helper to convert HorizonPeriod to hours
   */
  private getHorizonHours(horizon: HorizonPeriod): number {
    switch (horizon) {
      case '24h': return 24;
      case '48h': return 48;
      case '3d': return 72;
      case '5d': return 120;
      case '7d': return 168;
      case '14d': return 336;
      case 'DEPARTURE': return 168; // Fallback or leadTimeHours, but we typically use static hours
      default: return 24;
    }
  }

  /**
   * Generates horizon-specific prediction output using elapsed hours between observations
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

    let rateINRPerHour = 0;
    let hasSufficientPriors = false;

    if (validPriors.length >= 2) {
      const oldest = validPriors[0];
      const newest = validPriors[validPriors.length - 1];
      const oldestTimeMs = new Date(oldest.observedAt).getTime();
      const newestTimeMs = new Date(newest.observedAt).getTime();
      const elapsedHours = (newestTimeMs - oldestTimeMs) / (3600 * 1000);

      if (elapsedHours > 0) {
        rateINRPerHour = (newest.priceINR - oldest.priceINR) / elapsedHours;
        hasSufficientPriors = true;
      }
    }

    for (const h of candidateHorizons) {
      if (!hasSufficientPriors) {
        outputs[h] = {
          horizon: h,
          pointForecastINR: null,
          quantileForecasts: null,
          dropProbability: null,
          horizonScore: null,
          decisionPolicy: null,
          predictionStatus: 'INSUFFICIENT_PRIORS'
        };
        continue;
      }

      const horizonHours = this.getHorizonHours(h);
      const extrapolatedPrice = currentSpotFareINR + rateINRPerHour * horizonHours;

      if (extrapolatedPrice <= 0) {
        outputs[h] = {
          horizon: h,
          pointForecastINR: null,
          quantileForecasts: null,
          dropProbability: null,
          horizonScore: null,
          decisionPolicy: null,
          predictionStatus: 'INVALID_EXTRAPOLATION'
        };
      } else {
        outputs[h] = {
          horizon: h,
          pointForecastINR: Math.round(extrapolatedPrice),
          quantileForecasts: null,
          dropProbability: null,
          horizonScore: null,
          decisionPolicy: null,
          predictionStatus: 'SUCCESS'
        };
      }
    }

    return outputs as Record<HorizonPeriod, HorizonOutput>;
  }
}

export const persistenceBaseline = new PersistenceBaseline();
export const trailingStepBaseline = new TrailingStepBaseline();
export const timeNormalizedMomentumBaseline = new TimeNormalizedMomentumBaseline();

// Maintain legacy export/alias for historical reproducibility and compatibility
export const trailingMomentumBaseline = trailingStepBaseline;
