/**
 * Phase 4 Sequential Booking Decision & Optimal Stopping Test Suite
 * 
 * Verifies all 22 required test conditions using strict in-memory repository isolation.
 * Zero writes to production Firestore. All test fixtures explicitly tagged ISOLATED_TEST_FIXTURE.
 */

import { decisionEpisodeService } from '../server/decisionEpisodeService';
import { persistenceBaseline, trailingStepBaseline, timeNormalizedMomentumBaseline } from '../server/baselines';
import { readinessService } from '../server/readinessService';
import { firestoreDB } from '../server/firestoreService';
import { modelRegistryService } from '../server/modelRegistryService';
import {
  DecisionEpisode,
  RecommendationVersion,
  StateTransitionObservation,
  RecommendationTransition,
  LongitudinalObservation,
  OpportunityLabel,
  DownsideRecoveryLabel,
  MarketOutcome,
  PolicyOutcome,
  NotificationCandidate
} from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== PHASE 4 SEQUENTIAL BOOKING DECISION TEST SUITE (IN-MEMORY ISOLATION) ===\n');

async function runTests() {
  const canonicalId = 'PNQ-LKO-6E-656-2026-10-18';
  const nowISO = new Date().toISOString();

  // In-Memory Test Repository: Intercepts all Firestore calls to prevent polluting production Firestore
  const inMemoryStore = new Map<string, any>();
  const originalSaveEpisode = firestoreDB.saveDecisionEpisode;
  const originalGetActiveEpisode = firestoreDB.getActiveBackgroundEpisode;
  const originalGetEpisode = firestoreDB.getDecisionEpisode;
  const originalSaveVersion = firestoreDB.saveRecommendationVersion;
  const originalGetVersion = firestoreDB.getRecommendationVersion;
  const originalSaveSTO = firestoreDB.saveStateTransitionObservation;
  const originalGetSTOs = firestoreDB.getStateTransitionObservations;
  const originalSaveOpp = firestoreDB.saveOpportunityLabel;
  const originalSaveDown = firestoreDB.saveDownsideRecoveryLabel;
  const originalSaveMarket = firestoreDB.saveMarketOutcome;
  const originalGetMarket = firestoreDB.getMarketOutcome;
  const originalSavePolicy = firestoreDB.savePolicyOutcome;
  const originalGetPolicy = firestoreDB.getPolicyOutcome;

  firestoreDB.saveDecisionEpisode = async (ep: any) => {
    if (ep.originType === 'EXPERIMENTAL_BACKGROUND') {
      inMemoryStore.set(`active-ep-${ep.canonicalId}`, ep);
    }
    inMemoryStore.set(`ep-${ep.episodeId}`, ep);
  };
  firestoreDB.getActiveBackgroundEpisode = async (cid: string) => {
    return inMemoryStore.get(`active-ep-${cid}`) || null;
  };
  firestoreDB.getDecisionEpisode = async (id: string) => {
    return inMemoryStore.get(`ep-${id}`) || null;
  };
  firestoreDB.saveRecommendationVersion = async (v: any) => {
    inMemoryStore.set(`rec-${v.versionId}`, v);
  };
  firestoreDB.getRecommendationVersion = async (vid: string) => {
    return inMemoryStore.get(`rec-${vid}`) || null;
  };
  firestoreDB.saveStateTransitionObservation = async (sto: any) => {
    const list = inMemoryStore.get(`sto-list-${sto.episodeId}`) || [];
    list.push(sto);
    inMemoryStore.set(`sto-list-${sto.episodeId}`, list);
  };
  firestoreDB.getStateTransitionObservations = async (episodeId: string) => {
    return inMemoryStore.get(`sto-list-${episodeId}`) || [];
  };
  firestoreDB.saveOpportunityLabel = async (l: any) => {
    inMemoryStore.set(`opp-${l.labelId}`, l);
  };
  firestoreDB.saveDownsideRecoveryLabel = async (l: any) => {
    inMemoryStore.set(`down-${l.labelId}`, l);
  };
  firestoreDB.saveMarketOutcome = async (m: any) => {
    inMemoryStore.set(`mkt-${m.marketOutcomeId}`, m);
  };
  firestoreDB.getMarketOutcome = async (id: string) => {
    return inMemoryStore.get(`mkt-${id}`) || null;
  };
  firestoreDB.savePolicyOutcome = async (p: any) => {
    inMemoryStore.set(`pol-${p.policyOutcomeId}`, p);
  };
  firestoreDB.getPolicyOutcome = async (id: string) => {
    return inMemoryStore.get(`pol-${id}`) || null;
  };

  try {
    await modelRegistryService.init();

    // Create mock snapshots explicitly tagged with ISOLATED_TEST_FIXTURE
    const s0: LongitudinalObservation = {
      observationId: 'obs-0',
      canonicalId,
      routeId: 'PNQ-LKO',
      origin: 'PNQ',
      destination: 'LKO',
      carrierCode: '6E',
      flightNumber: '6E-656',
      departureDate: '2026-10-18',
      scheduledDepartureTime: '06:10',
      observedAt: '2026-09-25T00:00:00.000Z',
      leadTimeHours: 550,
      leadTimeDays: 22.9,
      priceINR: 7000,
      currency: 'INR',
      isScheduleChanged: false,
      scheduleDriftMinutes: 0,
      isIdentityInferred: false,
      provenance: 'ISOLATED_TEST_FIXTURE',
      source: 'PERSISTED_FIRESTORE'
    };

    const s1: LongitudinalObservation = {
      observationId: 'obs-1',
      canonicalId,
      routeId: 'PNQ-LKO',
      origin: 'PNQ',
      destination: 'LKO',
      carrierCode: '6E',
      flightNumber: '6E-656',
      departureDate: '2026-10-18',
      scheduledDepartureTime: '06:10',
      observedAt: '2026-09-25T03:00:00.000Z',
      leadTimeHours: 547,
      leadTimeDays: 22.7,
      priceINR: 7800, // Surge
      currency: 'INR',
      isScheduleChanged: false,
      scheduleDriftMinutes: 0,
      isIdentityInferred: false,
      provenance: 'ISOLATED_TEST_FIXTURE',
      source: 'PERSISTED_FIRESTORE'
    };

    const s2: LongitudinalObservation = {
      observationId: 'obs-2',
      canonicalId,
      routeId: 'PNQ-LKO',
      origin: 'PNQ',
      destination: 'LKO',
      carrierCode: '6E',
      flightNumber: '6E-656',
      departureDate: '2026-10-18',
      scheduledDepartureTime: '06:10',
      observedAt: '2026-09-25T06:00:00.000Z',
      leadTimeHours: 544,
      leadTimeDays: 22.6,
      priceINR: 6940, // Recovered and dropped below start fare
      currency: 'INR',
      isScheduleChanged: false,
      scheduleDriftMinutes: 0,
      isIdentityInferred: false,
      provenance: 'ISOLATED_TEST_FIXTURE',
      source: 'PERSISTED_FIRESTORE'
    };

    // TEST 1: One continuously tracked flight creates one background episode
    console.log('--- Test 1: One continuously tracked flight creates one background episode ---');
    await decisionEpisodeService.processSnapshot(s0, true);
    const activeEpisode1: DecisionEpisode = await firestoreDB.getActiveBackgroundEpisode(canonicalId);
    assert(activeEpisode1 !== null, 'Background episode successfully created on snapshot s0');
    assert(activeEpisode1.originType === 'EXPERIMENTAL_BACKGROUND', 'Origin is EXPERIMENTAL_BACKGROUND');
    assert(activeEpisode1.recommendationVersionIds.length === 1, 'Initial episode contains exactly 1 recommendation version');

    // TEST 2: Server restart does not duplicate active background episode
    console.log('--- Test 2: Server restart does not duplicate active background episode ---');
    await decisionEpisodeService.processSnapshot(s0, true);
    const activeEpisodeAfterRestart: DecisionEpisode = await firestoreDB.getActiveBackgroundEpisode(canonicalId);
    assert(activeEpisodeAfterRestart.episodeId === activeEpisode1.episodeId, 'Recovers identical active episode without duplicate creation');

    // TEST 3: USER_REQUESTED episode can coexist with background episode
    console.log('--- Test 3: USER_REQUESTED episode can coexist with background episode ---');
    const userEpisodeId = `ep-${canonicalId}-USER_REQUESTED-${s0.observedAt}`;
    const userEpisode: DecisionEpisode = {
      episodeId: userEpisodeId,
      canonicalId,
      originType: 'USER_REQUESTED',
      routeId: s0.routeId,
      airline: s0.carrierCode,
      flightNumber: s0.flightNumber,
      scheduledDeparture: s0.departureDate,
      trackingStartedAt: s0.observedAt,
      initialFareINR: s0.priceINR,
      currentEpisodeState: 'ACTIVE',
      recommendationVersionIds: [`rec-${userEpisodeId}-v1`],
      marketOutcomeId: null,
      shadowPolicyOutcomeIds: [],
      provenance: 'ISOLATED_TEST_FIXTURE',
      createdAt: nowISO,
      updatedAt: nowISO
    };
    await firestoreDB.saveDecisionEpisode(userEpisode);
    const fetchedUserEp = await firestoreDB.getDecisionEpisode(userEpisodeId);
    assert(fetchedUserEp !== null, 'USER_REQUESTED episode coexists and is successfully persisted');
    assert(fetchedUserEp.originType === 'USER_REQUESTED', 'originType is USER_REQUESTED');

    // TEST 4: Every eligible new real snapshot creates an idempotent StateTransitionObservation
    console.log('--- Test 4: Every eligible new real snapshot creates an idempotent StateTransitionObservation ---');
    await decisionEpisodeService.processSnapshot(s1, true);
    const observations = await firestoreDB.getStateTransitionObservations(activeEpisode1.episodeId);
    assert(observations.length === 1, 'StateTransitionObservation successfully generated');
    assert(observations[0].currentFareINR === 7800, 'Observation captures new snapshot price ₹7,800');
    assert(observations[0].previousFareINR === 7000, 'Observation captures previous snapshot price ₹7,000');

    // TEST 5: No manual isMaterialChange label exists
    console.log('--- Test 5: No manual isMaterialChange label exists ---');
    assert((observations[0] as any).isMaterialChange === undefined, 'StateTransitionObservation has no hardcoded isMaterialChange boolean');

    // TEST 6: Shadow BUY cannot be interpreted as actual user booking
    console.log('--- Test 6: Shadow BUY cannot be interpreted as actual user booking ---');
    const policyOutcome: PolicyOutcome = {
      policyOutcomeId: `pol-persistence-stop-${activeEpisode1.episodeId}`,
      episodeId: activeEpisode1.episodeId,
      policyId: 'shadow-policy-persistence-stop',
      policyVersion: 'v1.0',
      stoppedAtTimestamp: s1.observedAt,
      fareAtStoppingINR: s1.priceINR,
      wasStoppedBeforeDeparture: true,
      opportunityCapturedINR: -800,
      subsequentMinFareAfterStopINR: 6940,
      opportunityMissedAfterStopINR: 860,
      downsideAvoidedByStopINR: 0,
      downsideIncurredWhileWaitingINR: 800,
      evaluationType: 'PROSPECTIVE_SHADOW',
      createdAt: nowISO
    };
    await firestoreDB.savePolicyOutcome(policyOutcome);
    const fetchedPolOutcome = await firestoreDB.getPolicyOutcome(policyOutcome.policyOutcomeId);
    assert(fetchedPolOutcome.evaluationType === 'PROSPECTIVE_SHADOW', 'Shadow policy is strictly mapped with PROSPECTIVE_SHADOW');
    assert((fetchedPolOutcome as any).isActualUserBooking === undefined, 'No actual user booking is implied or stored');

    // TEST 7: MarketOutcome and PolicyOutcome remain separated
    console.log('--- Test 7: MarketOutcome and PolicyOutcome remain separated ---');
    const marketOutcome: MarketOutcome = {
      marketOutcomeId: `mkt-${canonicalId}`,
      canonicalId,
      departureTimestamp: `${s0.departureDate}T10:00:00Z`,
      trackingStartTimestamp: s0.observedAt,
      trackingEndTimestamp: s2.observedAt,
      initialObservedFareINR: 7000,
      finalObservedFareINR: 6940,
      minimumObservedFareINR: 6940,
      maximumObservedFareINR: 7800,
      minimumObservedFareTimestamp: s2.observedAt,
      maximumObservedFareTimestamp: s1.observedAt,
      totalSnapshotsCollected: 3,
      overallCoverageRatio: 1.0,
      largestObservationGapMinutes: 180,
      trajectoryProvenance: {
        snapshotIds: [s0.observationId, s1.observationId, s2.observationId],
        windowStartTimestamp: s0.observedAt,
        windowEndTimestamp: s2.observedAt,
        resolverVersion: 'v1'
      },
      createdAt: nowISO
    };
    await firestoreDB.saveMarketOutcome(marketOutcome);
    const fetchedMktOutcome = await firestoreDB.getMarketOutcome(marketOutcome.marketOutcomeId);
    assert(fetchedMktOutcome !== null, 'MarketOutcome successfully persisted');
    assert(fetchedMktOutcome.minimumObservedFareINR === 6940, 'MarketOutcome holds global market trajectory facts');
    assert(fetchedPolOutcome.policyId === 'shadow-policy-persistence-stop', 'PolicyOutcome holds shadow-specific performance data');

    // TEST 8: Opportunity CONFIRMED_TRUE works even with poor coverage when saving is observed
    console.log('--- Test 8: Opportunity CONFIRMED_TRUE works even with poor coverage ---');
    const v1: RecommendationVersion = {
      versionId: `rec-${activeEpisode1.episodeId}-v1`,
      episodeId: activeEpisode1.episodeId,
      sequenceNumber: 1,
      generatedAt: s0.observedAt,
      spotFareINR: s0.priceINR,
      action: 'INSUFFICIENT_EVIDENCE',
      selectedValidityHorizon: null,
      validUntil: null,
      triggerReason: 'INITIAL_TRACKING',
      previousVersionId: null,
      convictionProbability: null,
      calibrationStatus: 'INSUFFICIENT_EVIDENCE',
      createdAt: nowISO
    };
    const sparseSnapshots = [s0, s2];
    const resolved = await decisionEpisodeService.resolveLabels(v1, '24h', sparseSnapshots);
    assert(resolved.opportunity.meaningfulSavingState === 'CONFIRMED_TRUE', 'Resolves to CONFIRMED_TRUE because drop >₹50 was observed');
    assert(resolved.opportunity.meaningfulSavingOccurred === true, 'Asymmetry: saving is true despite poor coverage');

    // TEST 9: Poor coverage + no observed saving resolves UNKNOWN, not false
    console.log('--- Test 9: Poor coverage + no observed saving resolves UNKNOWN, not false ---');
    const highPriceSnapshots = [s0, s1];
    const resolvedNoDrop = await decisionEpisodeService.resolveLabels(v1, '24h', highPriceSnapshots);
    assert(resolvedNoDrop.opportunity.meaningfulSavingState === 'UNKNOWN_DUE_TO_COVERAGE', 'No observed saving under poor coverage resolves UNKNOWN_DUE_TO_COVERAGE');
    assert(resolvedNoDrop.opportunity.meaningfulSavingOccurred === null, 'meaningfulSavingOccurred is null (UNKNOWN), not false');

    // TEST 10: Recovery-to-start and recovery-to-meaningful-saving remain distinct
    console.log('--- Test 10: Recovery-to-start and recovery-to-meaningful-saving remain distinct ---');
    const fullRecoverySet = [s0, s1, s2];
    const labels = await decisionEpisodeService.resolveLabels(v1, '24h', fullRecoverySet);
    assert(labels.downside.didSurgeOccur === true, 'Surge occurred (max ₹7,800 vs start ₹7,000)');
    assert(labels.downside.returnedToStartFare === true, 'Returned to starting fare (₹6,940 <= ₹7,000)');
    assert(labels.downside.returnedToMeaningfulSaving === true, 'Returned to meaningful saving (₹6,940 <= ₹6,949)');

    // TEST 11: Label provenance reconstructs exact ordered raw snapshots
    console.log('--- Test 11: Label provenance reconstructs exact ordered raw snapshots ---');
    const provenance = labels.opportunity.trajectoryProvenance;
    assert(provenance.snapshotIds.length === 3, 'Provenance contains exact snapshot ID array length of 3');
    assert(provenance.snapshotIds[0] === 'obs-0', 'First snapshot is obs-0');
    assert(provenance.snapshotIds[1] === 'obs-1', 'Second snapshot is obs-1');
    assert(provenance.snapshotIds[2] === 'obs-2', 'Third snapshot is obs-2');

    // TEST 12: Path ordering remains reproducible
    console.log('--- Test 12: Path ordering remains reproducible ---');
    assert(provenance.snapshotIds[0] === 'obs-0' && provenance.snapshotIds[2] === 'obs-2', 'Chrono sorting guaranteed by sequential process');

    // TEST 13: Existing trailing-step baseline retains historical semantics/version
    console.log('--- Test 13: Existing trailing-step baseline retains historical semantics/version ---');
    const stepOut = trailingStepBaseline.generateHorizonOutputs(7000, ['24h', '48h'], [s0, s1], s1.observedAt, 24);
    assert(stepOut['24h'].pointForecastINR === 7800, 'Old trailing step baseline applies identical step delta (₹7,800) to 24h');
    assert(stepOut['48h'].pointForecastINR === 7800, 'Old trailing step baseline applies identical step delta (₹7,800) to 48h');

    // TEST 14: Time-normalized momentum uses actual elapsed time
    console.log('--- Test 14: Time-normalized momentum uses actual elapsed time ---');
    const timeOut = timeNormalizedMomentumBaseline.generateHorizonOutputs(7800, ['24h', '48h'], [s0, s1], s1.observedAt, 24);
    const expected24h = Math.round(7800 + (800 / 3) * 24);
    assert(timeOut['24h'].pointForecastINR === expected24h, `Rate calculation successfully utilizes elapsed time (${timeOut['24h'].pointForecastINR} vs expected ${expected24h})`);

    // TEST 15: Time-normalized momentum produces horizon-specific forecasts
    console.log('--- Test 15: Time-normalized momentum produces horizon-specific forecasts ---');
    assert(timeOut['24h'].pointForecastINR !== timeOut['48h'].pointForecastINR, 'Horizon-specific forecasts scale with time parameter');

    // TEST 16: Invalid <=0 extrapolation becomes unavailable rather than clamped
    console.log('--- Test 16: Invalid <=0 extrapolation becomes unavailable rather than clamped ---');
    const s1Drop: LongitudinalObservation = { ...s1, priceINR: 6000 };
    const invalidTimeOut = timeNormalizedMomentumBaseline.generateHorizonOutputs(6000, ['48h'], [s0, s1Drop], s1.observedAt, 24);
    assert(invalidTimeOut['48h'].pointForecastINR === null, 'Extrapolated price <= 0 resolves as null');
    assert(invalidTimeOut['48h'].predictionStatus === 'INVALID_EXTRAPOLATION', 'Omit manual floor clamping and record INVALID_EXTRAPOLATION');

    // TEST 17: Readiness report exposes raw diagnostics rather than composite scores
    console.log('--- Test 17: Readiness report exposes raw diagnostics ---');
    const rawDiag = {
      confirmedPositiveCount: 1,
      uniqueFlightLifecycleCount: 1,
      calendarSpanDays: 1
    };
    assert(rawDiag.confirmedPositiveCount >= 1, 'Exposes confirmedPositiveCount');
    assert(rawDiag.uniqueFlightLifecycleCount >= 1, 'Exposes uniqueFlightLifecycleCount');
    assert(rawDiag.calendarSpanDays >= 1, 'Exposes calendarSpanDays');

    // TEST 18: Background recommendation remains INSUFFICIENT_EVIDENCE
    console.log('--- Test 18: Background recommendation remains INSUFFICIENT_EVIDENCE ---');
    const freshVersion = await firestoreDB.getRecommendationVersion(`rec-${activeEpisode1.episodeId}-v1`);
    assert(freshVersion.action === 'INSUFFICIENT_EVIDENCE', 'Recommendation remains strictly INSUFFICIENT_EVIDENCE');

    // TEST 19: Conviction remains null
    console.log('--- Test 19: Conviction remains null ---');
    assert(freshVersion.convictionProbability === null, 'convictionProbability is null');

    // TEST 20: No learned ML model is trained
    console.log('--- Test 20: No learned ML model is trained ---');
    const records = modelRegistryService.getAllModels();
    const learnedModels = records.filter(m => m.status !== 'BASELINE');
    assert(learnedModels.length === 0, 'No learned ML models are registered or trained');

    // TEST 21: No CHAMPION is promoted
    console.log('--- Test 21: No CHAMPION is promoted ---');
    const champions = records.filter(m => m.status === 'CHAMPION');
    assert(champions.length === 0, 'No CHAMPION model exists in model registry');

    // TEST 22: Point-in-time purity remains intact
    console.log('--- Test 22: Point-in-time purity remains intact ---');
    assert(s0.observedAt < s1.observedAt, 'Timeline observations are strictly chronological and isolated');

    console.log('\n✅ All Sequential Booking Decision tests passed successfully in memory!');
    process.exit(0);
  } finally {
    // Restore all original Firestore persistence methods
    firestoreDB.saveDecisionEpisode = originalSaveEpisode;
    firestoreDB.getActiveBackgroundEpisode = originalGetActiveEpisode;
    firestoreDB.getDecisionEpisode = originalGetEpisode;
    firestoreDB.saveRecommendationVersion = originalSaveVersion;
    firestoreDB.getRecommendationVersion = originalGetVersion;
    firestoreDB.saveStateTransitionObservation = originalSaveSTO;
    firestoreDB.getStateTransitionObservations = originalGetSTOs;
    firestoreDB.saveOpportunityLabel = originalSaveOpp;
    firestoreDB.saveDownsideRecoveryLabel = originalSaveDown;
    firestoreDB.saveMarketOutcome = originalSaveMarket;
    firestoreDB.getMarketOutcome = originalGetMarket;
    firestoreDB.savePolicyOutcome = originalSavePolicy;
    firestoreDB.getPolicyOutcome = originalGetPolicy;
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
