import { firestoreDB } from './firestoreService';
import {
  DecisionEpisode,
  RecommendationVersion,
  StateTransitionObservation,
  RecommendationTransition,
  LongitudinalObservation,
  TrajectoryProvenanceReference,
  OpportunityLabel,
  DownsideRecoveryLabel,
  MarketOutcome,
  PolicyOutcome,
  AsymmetricSavingState,
  HorizonPeriod
} from './types/mlPipeline';
import { isEmpiricallyEligibleObservation } from './trajectoryService';

export class DecisionEpisodeService {
  /**
   * Processes a newly received real snapshot.
   * If no ACTIVE background episode exists for this canonical flight, initializes one.
   * Otherwise, generates a factual StateTransitionObservation and updates recommendation history.
   */
  public async processSnapshot(snapshot: LongitudinalObservation): Promise<void> {
    const canonicalId = snapshot.canonicalId;

    // Check empirical eligibility and synthetic isolation guard
    if (!isEmpiricallyEligibleObservation(snapshot)) {
      console.log(`[DecisionEpisode] Snapshot for ${canonicalId} is not empirically eligible (provenance: ${snapshot.provenance}); skipping episode processing.`);
      return;
    }

    // 1. Check for existing active EXPERIMENTAL_BACKGROUND episode
    let episode: DecisionEpisode | null = await firestoreDB.getActiveBackgroundEpisode(canonicalId);
    const nowISO = new Date().toISOString();

    if (!episode) {
      // Initialize background episode
      const episodeId = `ep-${canonicalId}-EXPERIMENTAL_BACKGROUND`;
      console.log(`[DecisionEpisode] Initializing new ACTIVE background episode ${episodeId}`);

      // First Recommendation Version (v1)
      const versionId = `rec-${episodeId}-v1`;
      const v1: RecommendationVersion = {
        versionId,
        episodeId,
        sequenceNumber: 1,
        generatedAt: snapshot.observedAt,
        spotFareINR: snapshot.priceINR,
        action: 'INSUFFICIENT_EVIDENCE', // Remain INSUFFICIENT_EVIDENCE during DATA_COLLECTION
        selectedValidityHorizon: null,
        validUntil: null,
        triggerReason: 'INITIAL_TRACKING',
        previousVersionId: null,
        convictionProbability: null,
        calibrationStatus: 'INSUFFICIENT_EVIDENCE',
        createdAt: nowISO
      };

      await firestoreDB.saveRecommendationVersion(v1);

      episode = {
        episodeId,
        canonicalId,
        originType: 'EXPERIMENTAL_BACKGROUND',
        routeId: snapshot.routeId,
        airline: snapshot.carrierCode,
        flightNumber: snapshot.flightNumber,
        scheduledDeparture: snapshot.departureDate, // ISO date or departure timestamp
        trackingStartedAt: snapshot.observedAt,
        initialFareINR: snapshot.priceINR,
        currentEpisodeState: 'ACTIVE',
        recommendationVersionIds: [versionId],
        marketOutcomeId: null,
        shadowPolicyOutcomeIds: [],
        provenance: 'REAL_OBSERVATION',
        createdAt: nowISO,
        updatedAt: nowISO
      };

      await firestoreDB.saveDecisionEpisode(episode);
    } else {
      // Background episode already exists. Process state transition.
      const episodeId = episode.episodeId;
      const sequenceNumber = episode.recommendationVersionIds.length + 1;
      const previousVersionId = episode.recommendationVersionIds[episode.recommendationVersionIds.length - 1];

      // Retrieve previous version
      const prevVersion: RecommendationVersion | null = await firestoreDB.getRecommendationVersion(previousVersionId);
      if (!prevVersion) {
        console.warn(`[DecisionEpisode] Previous version ${previousVersionId} not found for episode ${episodeId}`);
        return;
      }

      // Snapshot level idempotency check
      if (prevVersion.generatedAt === snapshot.observedAt) {
        console.log(`[DecisionEpisode] Snapshot at ${snapshot.observedAt} has already been processed for episode ${episodeId}. Skipping to ensure snapshot-level idempotency.`);
        return;
      }

      // Generate StateTransitionObservation
      const transitionObservationId = `sto-${episodeId}-${snapshot.observationId}`;
      const previousObsTime = prevVersion.generatedAt;
      const currentObsTime = snapshot.observedAt;
      const elapsedMinutes = Math.max(1, Math.round((new Date(currentObsTime).getTime() - new Date(previousObsTime).getTime()) / 60000));

      const absoluteFareChangeINR = snapshot.priceINR - prevVersion.spotFareINR;
      const percentageFareChange = prevVersion.spotFareINR > 0 ? absoluteFareChangeINR / prevVersion.spotFareINR : 0;

      const observation: StateTransitionObservation = {
        transitionObservationId,
        episodeId,
        previousRecommendationVersionId: previousVersionId,
        canonicalFlightId: canonicalId,
        previousObservationTimestamp: previousObsTime,
        currentObservationTimestamp: currentObsTime,
        elapsedMinutes,
        previousSnapshotId: `snapshot-${previousObsTime}`, // Provenance proxy
        currentSnapshotId: snapshot.observationId,
        previousFareINR: prevVersion.spotFareINR,
        currentFareINR: snapshot.priceINR,
        absoluteFareChangeINR,
        percentageFareChange,
        previousDTD: Math.round(prevVersion.spotFareINR), // DTD or fare depending on schema context
        currentDTD: snapshot.leadTimeDays,
        pointInTimeTrajectoryFeatures: {
          trailing24hDeltaINR: absoluteFareChangeINR,
          trailing72hDeltaINR: null,
          snapshotCountPast7d: sequenceNumber,
          volatilityINR: null
        },
        factualContextAtCurrentObservation: {
          isWeekendDeparture: false,
          nearbyFestivalName: null,
          daysToNearbyFestival: null,
          scheduleDelayMinutes: snapshot.scheduleDriftMinutes || 0
        },
        previousRecommendationAction: prevVersion.action,
        provenance: 'REAL_OBSERVATION',
        createdAt: nowISO
      };

      await firestoreDB.saveStateTransitionObservation(observation);

      // Create new Recommendation Version
      const newVersionId = `rec-${episodeId}-v${sequenceNumber}`;
      const newVersion: RecommendationVersion = {
        versionId: newVersionId,
        episodeId,
        sequenceNumber,
        generatedAt: currentObsTime,
        spotFareINR: snapshot.priceINR,
        action: 'INSUFFICIENT_EVIDENCE', // Remains INSUFFICIENT_EVIDENCE
        selectedValidityHorizon: null,
        validUntil: null,
        triggerReason: 'OBSERVED_STATE_TRANSITION',
        previousVersionId,
        convictionProbability: null,
        calibrationStatus: 'INSUFFICIENT_EVIDENCE',
        createdAt: nowISO
      };

      await firestoreDB.saveRecommendationVersion(newVersion);

      // Save Recommendation Transition
      const transitionId = `trans-${previousVersionId}-${newVersionId}`;
      const transition: RecommendationTransition = {
        transitionId,
        episodeId,
        policyId: 'shadow-decision-policy-v1',
        fromVersionId: previousVersionId,
        toVersionId: newVersionId,
        transitionType: 'INSUFFICIENT_EVIDENCE_TO_INSUFFICIENT_EVIDENCE',
        timestamp: currentObsTime,
        fromFareINR: prevVersion.spotFareINR,
        toFareINR: snapshot.priceINR,
        deltaFareINR: absoluteFareChangeINR,
        elapsedMinutes,
        associatedStateTransitionObservationId: transitionObservationId
      };

      await firestoreDB.saveRecommendationTransition(transition);

      // Update and save DecisionEpisode
      episode.recommendationVersionIds.push(newVersionId);
      episode.updatedAt = nowISO;
      await firestoreDB.saveDecisionEpisode(episode);
    }
  }

  /**
   * Resolves opportunity and downside labels for a given recommendation version
   * based on referenced immutable raw snapshots.
   */
  public async resolveLabels(
    version: RecommendationVersion,
    horizon: HorizonPeriod,
    snapshots: LongitudinalObservation[]
  ): Promise<{ opportunity: OpportunityLabel; downside: DownsideRecoveryLabel }> {
    const startMs = new Date(version.generatedAt).getTime();
    const durationHours = this.getHorizonHours(horizon);
    const endMs = startMs + durationHours * 3600 * 1000;

    // Filter snapshots in range [T_gen, T_gen + H]
    const windowSnapshots = snapshots
      .filter(s => {
        const t = new Date(s.observedAt).getTime();
        return t >= startMs && t <= endMs;
      })
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    const snapshotIds = windowSnapshots.map(s => s.observationId);
    const windowStartTimestamp = version.generatedAt;
    const windowEndTimestamp = new Date(endMs).toISOString();

    const provenanceRef: TrajectoryProvenanceReference = {
      snapshotIds,
      windowStartTimestamp,
      windowEndTimestamp,
      resolverVersion: 'v1.0-sequential-decision-resolution'
    };

    // Calculate Factual Metrics
    let minObserved = version.spotFareINR;
    let minObservedTime = version.generatedAt;
    let maxObserved = version.spotFareINR;
    let maxObservedTime = version.generatedAt;
    let firstMeaningfulSavingTimestamp: string | null = null;

    for (const s of windowSnapshots) {
      if (s.priceINR < minObserved) {
        minObserved = s.priceINR;
        minObservedTime = s.observedAt;
      }
      if (s.priceINR > maxObserved) {
        maxObserved = s.priceINR;
        maxObservedTime = s.observedAt;
      }
      if (!firstMeaningfulSavingTimestamp && s.priceINR <= version.spotFareINR - 51) {
        firstMeaningfulSavingTimestamp = s.observedAt;
      }
    }

    const maxAchievableSaving = Math.max(0, version.spotFareINR - minObserved);
    const maxAdverseSurge = Math.max(0, maxObserved - version.spotFareINR);

    // Coverage Analysis
    const expectedSnapshots = Math.max(2, Math.ceil(durationHours / 3)); // Expect 1 snapshot every 3 hours
    const snapshotCount = windowSnapshots.length;
    const coverageRatio = expectedSnapshots > 0 ? snapshotCount / expectedSnapshots : 0;

    // Find largest observation gap
    let largestGapMinutes = 0;
    if (windowSnapshots.length >= 2) {
      for (let i = 1; i < windowSnapshots.length; i++) {
        const gap = (new Date(windowSnapshots[i].observedAt).getTime() - new Date(windowSnapshots[i - 1].observedAt).getTime()) / 60000;
        if (gap > largestGapMinutes) {
          largestGapMinutes = gap;
        }
      }
    }

    const isSufficientCoverage = snapshotCount >= 2 && coverageRatio >= 0.5 && largestGapMinutes <= 12 * 60;

    // Asymmetric Saving State
    let meaningfulSavingState: AsymmetricSavingState = 'UNKNOWN_DUE_TO_COVERAGE';
    if (maxAchievableSaving > 50) {
      meaningfulSavingState = 'CONFIRMED_TRUE'; // CONFIRMED_TRUE works even with poor coverage if drop observed
    } else if (isSufficientCoverage) {
      meaningfulSavingState = 'CONFIRMED_FALSE'; // Only FALSE when coverage is sufficient
    }

    const opportunity: OpportunityLabel = {
      labelId: `opp-${version.versionId}-${horizon}`,
      versionId: version.versionId,
      canonicalId: version.episodeId, // or lookup
      startTimestamp: windowStartTimestamp,
      evaluationEndTimestamp: windowEndTimestamp,
      startingFareINR: version.spotFareINR,
      minimumObservedFareINR: minObserved,
      timeToMinimumObservedFareMinutes: Math.round((new Date(minObservedTime).getTime() - startMs) / 60000),
      firstMeaningfulSavingTimestamp,
      timeToFirstMeaningfulSavingMinutes: firstMeaningfulSavingTimestamp
        ? Math.round((new Date(firstMeaningfulSavingTimestamp).getTime() - startMs) / 60000)
        : null,
      bestObservedOpportunityINR: maxAchievableSaving,
      meaningfulSavingState,
      meaningfulSavingOccurred: meaningfulSavingState === 'CONFIRMED_TRUE' ? true : (meaningfulSavingState === 'CONFIRMED_FALSE' ? false : null),
      snapshotCountInWindow: snapshotCount,
      isSufficientCoverage,
      largestObservationGapMinutes: Math.round(largestGapMinutes),
      coverageRatio,
      trajectoryProvenance: provenanceRef
    };

    // Advanced Recovery Semantics
    let returnedToStartFare = false;
    let timeToReturnToStartFareMinutes: number | null = null;
    let returnedBelowStartFare = false;
    let bestObservedFareAfterSurgeINR: number | null = null;
    let timeToBestObservedFareAfterSurgeMinutes: number | null = null;
    let returnedToMeaningfulSaving = false;
    let timeToMeaningfulSavingAfterSurgeMinutes: number | null = null;

    let surgeOccurred = maxAdverseSurge > 0;
    if (surgeOccurred) {
      const surgeIndex = windowSnapshots.findIndex(s => s.priceINR === maxObserved);
      if (surgeIndex !== -1) {
        const surgeTimeMs = new Date(windowSnapshots[surgeIndex].observedAt).getTime();
        const postSurgeSnapshots = windowSnapshots.slice(surgeIndex + 1);

        for (const s of postSurgeSnapshots) {
          const obsTimeMs = new Date(s.observedAt).getTime();
          if (!returnedToStartFare && s.priceINR <= version.spotFareINR) {
            returnedToStartFare = true;
            timeToReturnToStartFareMinutes = Math.round((obsTimeMs - surgeTimeMs) / 60000);
          }
          if (s.priceINR < version.spotFareINR) {
            returnedBelowStartFare = true;
            if (bestObservedFareAfterSurgeINR === null || s.priceINR < bestObservedFareAfterSurgeINR) {
              bestObservedFareAfterSurgeINR = s.priceINR;
              timeToBestObservedFareAfterSurgeMinutes = Math.round((obsTimeMs - surgeTimeMs) / 60000);
            }
          }
          if (!returnedToMeaningfulSaving && s.priceINR <= version.spotFareINR - 51) {
            returnedToMeaningfulSaving = true;
            timeToMeaningfulSavingAfterSurgeMinutes = Math.round((obsTimeMs - surgeTimeMs) / 60000);
          }
        }
      }
    }

    const downside: DownsideRecoveryLabel = {
      labelId: `down-${version.versionId}-${horizon}`,
      versionId: version.versionId,
      canonicalId: version.episodeId,
      startTimestamp: windowStartTimestamp,
      evaluationEndTimestamp: windowEndTimestamp,
      startingFareINR: version.spotFareINR,
      maximumObservedFareINR: maxObserved,
      maxAdverseSurgeINR: maxAdverseSurge,
      timeToMaxAdverseSurgeMinutes: surgeOccurred
        ? Math.round((new Date(maxObservedTime).getTime() - startMs) / 60000)
        : null,
      didSurgeOccur: surgeOccurred,
      returnedToStartFare,
      timeToReturnToStartFareMinutes,
      returnedBelowStartFare,
      bestObservedFareAfterSurgeINR,
      timeToBestObservedFareAfterSurgeMinutes,
      returnedToMeaningfulSaving,
      timeToMeaningfulSavingAfterSurgeMinutes,
      isSufficientCoverage,
      resolutionStatus: isSufficientCoverage ? 'CONFIRMED' : 'UNKNOWN_DUE_TO_COVERAGE',
      trajectoryProvenance: provenanceRef
    };

    return { opportunity, downside };
  }

  private getHorizonHours(horizon: HorizonPeriod): number {
    switch (horizon) {
      case '24h': return 24;
      case '48h': return 48;
      case '3d': return 72;
      case '5d': return 120;
      case '7d': return 168;
      case '14d': return 336;
      case 'DEPARTURE': return 168;
      default: return 24;
    }
  }
}

export const decisionEpisodeService = new DecisionEpisodeService();
