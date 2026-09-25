/**
 * Phase 2: Real Multi-Horizon Outcome Resolution Engine
 * 
 * Objective:
 * Transforms prospective predictions plus subsequently observed REAL fares into trustworthy,
 * immutable ground-truth horizon outcomes.
 * 
 * STRICT INVARIANTS:
 * 1. Zero synthetic fare data. Zero assumed multipliers.
 * 2. Point-in-Time purity: feature vectors are never mutated.
 * 3. Each candidate horizon (24h, 48h, 3d, 5d, 7d, 14d) is resolved independently as soon as its window elapses.
 * 4. Expiry fare requires an observation within 240 minutes (4 hours); otherwise priceAtExpiryINR = null.
 * 5. Coverage sufficiency is enforced via explicit ratios; undercovered missing drops yield 'UNKNOWN_DUE_TO_COVERAGE'.
 */

import {
  PredictionAuditRecord,
  LongitudinalObservation,
  HorizonPeriod,
  HorizonOutcome,
  SavingEventState,
  HorizonResolutionState,
  UnresolvedReason
} from './types/mlPipeline';

/**
 * Configurable & Versioned Data-Quality Engineering Safeguards
 * 
 * NOTE: expiryObservationToleranceMinutes = 240 is a preliminary engineering threshold based on
 * the 3-hour collection interval + 1-hour network buffer. It is NOT learned or tuned for model metrics.
 * Raw actualExpiryObservationTimestamp and expiryObservationDistanceMinutes are strictly preserved
 * to allow future sensitivity analysis.
 */
export const EXPIRY_OBSERVATION_TOLERANCE_MINUTES = 240;

export const HORIZON_HOURS: Record<HorizonPeriod, number> = {
  '24h': 24,
  '48h': 48,
  '3d': 72,
  '5d': 120,
  '7d': 168,
  '14d': 336,
  'DEPARTURE': 0 // Dynamic based on lead time
};

export class OutcomeResolverEngine {
  /**
   * Evaluates and resolves a specific candidate horizon for a prediction record
   */
  public resolveCandidateHorizon(
    prediction: PredictionAuditRecord,
    horizon: HorizonPeriod,
    allObservations: LongitudinalObservation[],
    nowTimestampISO: string = new Date().toISOString()
  ): {
    outcome: HorizonOutcome | null;
    state: HorizonResolutionState;
    unresolvedReason?: UnresolvedReason;
  } {
    // 1. Strict Data Purity Guard
    if (prediction.provenance === 'ISOLATED_TEST_FIXTURE') {
      throw new Error(`Data Integrity Violation: Isolated test fixture prediction rejected by production Outcome Resolver Engine.`);
    }

    const predTimeMs = new Date(prediction.createdAt).getTime();
    const depTimeMs = new Date(prediction.departureTimestampAtPrediction || `${prediction.departureDate}T10:00:00.000Z`).getTime();
    const nowMs = new Date(nowTimestampISO).getTime();

    // Calculate target expiry timestamp T + H
    const horizonHours = horizon === 'DEPARTURE' 
      ? Math.max(1, prediction.leadTimeHours)
      : HORIZON_HOURS[horizon];

    const targetExpiryMs = predTimeMs + horizonHours * 3600 * 1000;
    
    // Boundary rule: Truncate horizon end at scheduled departure
    const wasTruncated = targetExpiryMs > depTimeMs;
    const effectiveEndMs = Math.min(targetExpiryMs, depTimeMs);

    // Check if horizon has actually elapsed yet
    if (nowMs < effectiveEndMs) {
      return { outcome: null, state: 'PENDING' };
    }

    const targetExpiryISO = new Date(targetExpiryMs).toISOString();
    const effectiveEndISO = new Date(effectiveEndMs).toISOString();

    // 2. Filter canonical observations in window [T_pred, T_effEnd]
    const flightObs = allObservations
      .filter(o => o.canonicalId === prediction.canonicalId && o.provenance !== 'ISOLATED_TEST_FIXTURE')
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    const windowObs = flightObs.filter(o => {
      const t = new Date(o.observedAt).getTime();
      return t >= predTimeMs - 5 * 60 * 1000 && t <= effectiveEndMs + 5 * 60 * 1000;
    });

    const actualCount = windowObs.length;
    const effectiveHours = Math.max(1, (effectiveEndMs - predTimeMs) / (3600 * 1000));
    
    // Configured collection cadence: approximately 1 snapshot every 3 hours
    const expectedCount = Math.max(1, Math.round(effectiveHours / 3.0));
    const coverageRatio = Number((actualCount / expectedCount).toFixed(2));

    // Calculate largest observation gap in hours inside the window
    let largestGapHours = 0;
    if (actualCount >= 2) {
      for (let i = 1; i < actualCount; i++) {
        const gap = (new Date(windowObs[i].observedAt).getTime() - new Date(windowObs[i - 1].observedAt).getTime()) / (3600 * 1000);
        if (gap > largestGapHours) largestGapHours = gap;
      }
    } else if (actualCount === 1) {
      largestGapHours = effectiveHours;
    } else {
      largestGapHours = effectiveHours;
    }

    // Engineering Coverage Sufficiency Safeguard (Threshold: >= 50% ratio, gap <= 12h, count >= 2 if effectiveHours >= 6)
    const isSufficientCoverage = effectiveHours < 6
      ? actualCount >= 1
      : (coverageRatio >= 0.50 && actualCount >= 2 && largestGapHours <= 12.0);

    const initialPrice = prediction.currentFareINR;
    let minPrice: number | null = null;
    let maxPrice: number | null = null;
    let savingObs: LongitudinalObservation[] = [];

    if (actualCount > 0) {
      minPrice = Math.min(...windowObs.map(o => o.priceINR));
      maxPrice = Math.max(...windowObs.map(o => o.priceINR));
      savingObs = windowObs.filter(o => o.priceINR < initialPrice - 50); // Strictly > ₹50 saving
    }

    // 3. Meaningful Saving Asymmetric Observability State
    let savingState: SavingEventState = 'UNKNOWN_DUE_TO_COVERAGE';
    let timeToFirstSavingHours: number | null = null;

    if (savingObs.length > 0) {
      // Confirmed True: observed at least one snapshot with > ₹50 drop (regardless of overall coverage ratio!)
      savingState = 'CONFIRMED_TRUE';
      const firstSavingTimeMs = new Date(savingObs[0].observedAt).getTime();
      timeToFirstSavingHours = Number(((firstSavingTimeMs - predTimeMs) / (3600 * 1000)).toFixed(2));
    } else if (isSufficientCoverage) {
      // Confirmed False: adequate coverage and zero drop observed
      savingState = 'CONFIRMED_FALSE';
    } else {
      // Unknown due to coverage: poor coverage and zero drop observed
      savingState = 'UNKNOWN_DUE_TO_COVERAGE';
    }

    // 4. Calculate Economic Trajectory & Persistence Metrics
    const maxAchievableSavingINR = minPrice !== null ? Math.max(0, initialPrice - minPrice) : null;
    const maxDownsideSurgeINR = maxPrice !== null ? Math.max(0, maxPrice - initialPrice) : null;
    const meaningfulSavingObservationCount = savingObs.length;

    // Estimate persistence duration using step-interval duration
    let savingDurationHours: number | null = null;
    let durationMethod: string | null = null;

    if (savingObs.length > 0) {
      durationMethod = 'DISCRETE_SNAPSHOT_STEP_INTERVAL';
      // Each snapshot represents 3 hours of bookability window
      savingDurationHours = Number((savingObs.length * 3.0).toFixed(1));
    }

    // 5. Expiry Fare Measurement (Strict 4-Hour / 240-Minute Window Rule)
    let priceAtExpiryINR: number | null = null;
    let actualExpiryObsTimestamp: string | null = null;
    let expiryDistanceMinutes: number | null = null;

    if (flightObs.length > 0) {
      // Find snapshot in trajectory closest to effectiveEndMs
      let closestObs: LongitudinalObservation | null = null;
      let minDistanceMs = Infinity;

      for (const obs of flightObs) {
        const obsMs = new Date(obs.observedAt).getTime();
        const distMs = Math.abs(obsMs - effectiveEndMs);
        if (distMs < minDistanceMs) {
          minDistanceMs = distMs;
          closestObs = obs;
        }
      }

      if (closestObs) {
        const distMinutes = Math.round(minDistanceMs / (60 * 1000));
        if (distMinutes <= EXPIRY_OBSERVATION_TOLERANCE_MINUTES) {
          priceAtExpiryINR = closestObs.priceINR;
          actualExpiryObsTimestamp = closestObs.observedAt;
          expiryDistanceMinutes = distMinutes;
        }
      }
    }

    const expiryPriceDeltaINR = priceAtExpiryINR !== null ? priceAtExpiryINR - initialPrice : null;

    // 6. Assemble Immutable Raw Horizon Outcome
    const outcome: HorizonOutcome = {
      horizon,
      predictionTimestamp: prediction.createdAt,
      targetExpiryTimestamp: targetExpiryISO,
      effectiveHorizonEndTimestamp: effectiveEndISO,
      wasHorizonTruncatedByDeparture: wasTruncated,
      expectedObservationCount: expectedCount,
      actualObservationCount: actualCount,
      observationCoverageRatio: coverageRatio,
      largestObservationGapHours: Number(largestGapHours.toFixed(1)),
      isSufficientCoverage,
      firstObservationTimestamp: windowObs.length > 0 ? windowObs[0].observedAt : null,
      lastObservationTimestamp: windowObs.length > 0 ? windowObs[windowObs.length - 1].observedAt : null,
      initialPriceINR: initialPrice,
      minimumPriceObservedINR: minPrice,
      maximumPriceObservedINR: maxPrice,
      priceAtExpiryINR,
      actualExpiryObservationTimestamp: actualExpiryObsTimestamp,
      expiryObservationDistanceMinutes: expiryDistanceMinutes,
      hasMeaningfulSavingEvent: savingState,
      timeToFirstMeaningfulSavingHours: timeToFirstSavingHours,
      maxAchievableSavingINR,
      maxDownsideSurgeINR,
      expiryPriceDeltaINR,
      meaningfulSavingObservationCount,
      meaningfulSavingObservedAtTimestamps: savingObs.map(o => o.observedAt),
      meaningfulSavingDurationHours: savingDurationHours,
      durationEstimationMethod: durationMethod,
      observedTrajectorySnapshotIds: windowObs.map(o => o.observationId),
      resolutionTimestamp: nowTimestampISO,
      resolutionVersion: 'v1.0-raw-factual-measurement'
    };

    return {
      outcome,
      state: 'RESOLVED'
    };
  }
}

export const outcomeResolverEngine = new OutcomeResolverEngine();
