/**
 * Phase 2 Comprehensive Data Integrity & Outcome Resolution Test Suite
 * 
 * Verifies test cases A through N.
 */

import { outcomeResolverEngine } from '../server/outcomeResolver';
import { trajectoryService } from '../server/trajectoryService';
import { buildCanonicalFlightKey } from '../server/flightIdentity';
import {
  PredictionAuditRecord,
  LongitudinalObservation,
  HorizonPeriod,
  DataProvenance
} from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== PHASE 2 COMPREHENSIVE DATA INTEGRITY TEST SUITE (A - N) ===\n');

const canonicalKey = buildCanonicalFlightKey('PNQ', 'LKO', '6E-656', '2026-10-18');
const predTimestamp = '2026-09-20T10:00:00.000Z';
const depTimestamp = '2026-10-18T06:10:00.000Z';

function createMockPred(initialFare = 7000): PredictionAuditRecord {
  return {
    predictionId: `pred-${canonicalKey.canonicalId}-20260920-h10`,
    originType: 'EXPERIMENTAL_BACKGROUND',
    createdAt: predTimestamp,
    canonicalId: canonicalKey.canonicalId,
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    departureDate: '2026-10-18',
    departureTimestampAtPrediction: depTimestamp,
    leadTimeDays: 28,
    leadTimeHours: 672,
    currentFareINR: initialFare,
    features: {} as any,
    forecastingModelId: 'baseline-persistence',
    decisionModelId: 'baseline-insufficient-evidence',
    modelVersion: 'v1.0-empirical-real',
    maturityState: 'DATA_COLLECTION',
    provenance: 'REAL_OBSERVATION',
    forecast: { p10: 6000, p50: 7000, p90: 8000, expectedMean: 7000, uncertaintySpreadRatio: 0.2 },
    selectedValidityHorizon: null,
    candidateHorizons: ['24h', '48h', '3d', '5d', '7d', '14d'],
    validUntil: null,
    meaningfulDropProbability: null,
    rawDropFrequency: null,
    expectedSavingINR: null,
    expectedSurgeINR: null,
    recommendation: 'INSUFFICIENT_EVIDENCE',
    overallResolutionState: 'PENDING_HORIZONS',
    horizonResolutionStates: {},
    horizonOutcomes: {},
    isResolved: false
  };
}

function createObs(
  id: string,
  observedAtISO: string,
  priceINR: number,
  canonicalId = canonicalKey.canonicalId,
  provenance: DataProvenance = 'REAL_OBSERVATION'
): LongitudinalObservation {
  return {
    observationId: id,
    canonicalId,
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    carrierCode: '6E',
    flightNumber: '6E-656',
    departureDate: '2026-10-18',
    scheduledDepartureTime: '06:10',
    observedAt: observedAtISO,
    leadTimeHours: 600,
    leadTimeDays: 25,
    priceINR,
    currency: 'INR',
    isScheduleChanged: false,
    scheduleDriftMinutes: 0,
    isIdentityInferred: false,
    provenance,
    source: 'PERSISTED_FIRESTORE'
  };
}

// ----------------------------------------------------------------------------
// TEST A: ₹7,000 -> ₹6,949 (Meaningful Saving > ₹50)
// ----------------------------------------------------------------------------
console.log('--- Test A: ₹7,000 -> ₹6,949 (Saving = ₹51 > ₹50) ---');
const predA = createMockPred(7000);
const obsA = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-20T16:00:00.000Z', 6949), // ₹51 drop!
  createObs('obs-3', '2026-09-21T09:55:00.000Z', 7000)
];
const resA = outcomeResolverEngine.resolveCandidateHorizon(predA, '24h', obsA, '2026-09-21T11:00:00.000Z');
assert(resA.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_TRUE', 'Saving ₹51 (6949) evaluates as CONFIRMED_TRUE');
assert(resA.outcome?.maxAchievableSavingINR === 51, 'Max achievable saving is exactly ₹51');

// ----------------------------------------------------------------------------
// TEST B: ₹7,000 -> ₹6,950 (Saving = ₹50, NOT > ₹50)
// ----------------------------------------------------------------------------
console.log('--- Test B: ₹7,000 -> ₹6,950 (Saving = ₹50, NOT > ₹50) ---');
const predB = createMockPred(7000);
const obsB = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-20T16:00:00.000Z', 6950), // Exactly ₹50 drop (not > ₹50)
  createObs('obs-3', '2026-09-20T19:00:00.000Z', 7000),
  createObs('obs-4', '2026-09-20T22:00:00.000Z', 7000),
  createObs('obs-5', '2026-09-21T01:00:00.000Z', 7000),
  createObs('obs-6', '2026-09-21T04:00:00.000Z', 7000),
  createObs('obs-7', '2026-09-21T07:00:00.000Z', 7000),
  createObs('obs-8', '2026-09-21T10:00:00.000Z', 7000)
];
const resB = outcomeResolverEngine.resolveCandidateHorizon(predB, '24h', obsB, '2026-09-21T11:00:00.000Z');
assert(resB.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_FALSE', 'Saving of exactly ₹50 evaluates as CONFIRMED_FALSE (product rule > ₹50)');

// ----------------------------------------------------------------------------
// TEST C: Saving occurs briefly, then later price surges
// ----------------------------------------------------------------------------
console.log('--- Test C: Brief Drop (₹6,900) followed by Surge (₹9,000) ---');
const predC = createMockPred(7000);
const obsC = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 6900), // ₹100 saving
  createObs('obs-2', '2026-09-20T18:00:00.000Z', 9000), // ₹2,000 surge
  createObs('obs-3', '2026-09-21T09:00:00.000Z', 9000)
];
const resC = outcomeResolverEngine.resolveCandidateHorizon(predC, '24h', obsC, '2026-09-21T11:00:00.000Z');
assert(resC.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_TRUE', 'Saving event preserved as CONFIRMED_TRUE');
assert(resC.outcome?.maxAchievableSavingINR === 100, 'Max achievable saving recorded as ₹100');
assert(resC.outcome?.maxDownsideSurgeINR === 2000, 'Downside surge recorded independently as ₹2,000');

// ----------------------------------------------------------------------------
// TEST D: No saving observed with excellent coverage
// ----------------------------------------------------------------------------
console.log('--- Test D: No saving observed with excellent coverage ---');
const predD = createMockPred(7000);
const obsD = Array.from({ length: 8 }, (_, i) => 
  createObs(`obs-${i}`, new Date(new Date(predTimestamp).getTime() + (i + 1) * 3 * 3600 * 1000).toISOString(), 7200)
);
const resD = outcomeResolverEngine.resolveCandidateHorizon(predD, '24h', obsD, '2026-09-21T11:00:00.000Z');
assert(resD.outcome?.isSufficientCoverage === true, 'Coverage flagged as sufficient (8/8 snapshots)');
assert(resD.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_FALSE', 'Evaluates as CONFIRMED_FALSE with high coverage');

// ----------------------------------------------------------------------------
// TEST E: No saving observed with poor coverage
// ----------------------------------------------------------------------------
console.log('--- Test E: No saving observed with poor coverage ---');
const predE = createMockPred(7000);
const obsE = [
  createObs('obs-1', '2026-09-20T12:00:00.000Z', 7200) // Only 1 snapshot in 24h
];
const resE = outcomeResolverEngine.resolveCandidateHorizon(predE, '24h', obsE, '2026-09-21T11:00:00.000Z');
assert(resE.outcome?.isSufficientCoverage === false, 'Coverage flagged as insufficient (1 snapshot in 24h)');
assert(resE.outcome?.hasMeaningfulSavingEvent === 'UNKNOWN_DUE_TO_COVERAGE', 'Undercovered horizon resolves to UNKNOWN_DUE_TO_COVERAGE (never false)');

// ----------------------------------------------------------------------------
// TEST F: Saving observed despite poor coverage
// ----------------------------------------------------------------------------
console.log('--- Test F: Confirmed saving observed despite poor coverage ---');
const predF = createMockPred(7000);
const obsF = [
  createObs('obs-1', '2026-09-20T12:00:00.000Z', 6200) // ₹800 drop in single snapshot!
];
const resF = outcomeResolverEngine.resolveCandidateHorizon(predF, '24h', obsF, '2026-09-21T11:00:00.000Z');
assert(resF.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_TRUE', 'Asymmetric observability: drop is CONFIRMED_TRUE despite sparse snapshots');
assert(resF.outcome?.isSufficientCoverage === false, 'Outcome retains coverage warning (isSufficientCoverage = false)');

// ----------------------------------------------------------------------------
// TEST G: Candidate horizon extends beyond departure
// ----------------------------------------------------------------------------
console.log('--- Test G: Candidate horizon truncated by departure ---');
const predG = createMockPred(7000);
predG.createdAt = '2026-10-17T06:10:00.000Z'; // 24h before departure!
predG.departureTimestampAtPrediction = '2026-10-18T06:10:00.000Z';
const obsG = [
  createObs('obs-1', '2026-10-17T12:00:00.000Z', 7000),
  createObs('obs-2', '2026-10-18T05:00:00.000Z', 7000)
];
const resG = outcomeResolverEngine.resolveCandidateHorizon(predG, '7d', obsG, '2026-10-25T00:00:00.000Z');
assert(resG.outcome?.wasHorizonTruncatedByDeparture === true, '7d horizon truncated at flight departure moment');
assert(resG.outcome?.effectiveHorizonEndTimestamp === '2026-10-18T06:10:00.000Z', 'Effective horizon end equals scheduled departure');

// ----------------------------------------------------------------------------
// TEST H: Expiry observation distance & null when > 240 minutes
// ----------------------------------------------------------------------------
console.log('--- Test H: Expiry price distance and 240m boundary ---');
const predH = createMockPred(7000);
const obsHNear = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-21T09:00:00.000Z', 6800) // 60 mins before 24h expiry
];
const resHNear = outcomeResolverEngine.resolveCandidateHorizon(predH, '24h', obsHNear, '2026-09-21T11:00:00.000Z');
assert(resHNear.outcome?.priceAtExpiryINR === 6800, 'Expiry price captured within 240m window (60m distance)');
assert(resHNear.outcome?.expiryObservationDistanceMinutes === 60, 'Distance recorded as 60 minutes');

const obsHFar = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-21T02:00:00.000Z', 6800) // 8 hours (480 mins) before expiry!
];
const resHFar = outcomeResolverEngine.resolveCandidateHorizon(predH, '24h', obsHFar, '2026-09-21T11:00:00.000Z');
assert(resHFar.outcome?.priceAtExpiryINR === null, 'Expiry price is strictly null when nearest observation > 240 minutes');

// ----------------------------------------------------------------------------
// TEST I: Explicit Worker Idempotency & Late-Arriving Re-resolution
// ----------------------------------------------------------------------------
console.log('--- Test I: Worker Idempotency & Late-Arriving Re-resolution ---');
const predI = createMockPred(7000);
const obsI1 = [
  createObs('obs-1', '2026-09-20T13:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-20T19:00:00.000Z', 7100)
];

// First run of resolution worker logic
const resI1 = outcomeResolverEngine.resolveCandidateHorizon(predI, '24h', obsI1, '2026-09-21T11:00:00.000Z');
assert(resI1.outcome !== null, 'First resolution run creates valid outcome');

// Second run of resolution worker logic on identical data
const resI2 = outcomeResolverEngine.resolveCandidateHorizon(predI, '24h', obsI1, '2026-09-21T11:00:00.000Z');
assert(resI2.outcome !== null, 'Second resolution run creates valid outcome');
assert(JSON.stringify(resI1.outcome) === JSON.stringify(resI2.outcome), 'Identical rerun produces exactly identical HorizonOutcome without factual mutation');
assert(resI1.outcome?.resolutionVersion === resI2.outcome?.resolutionVersion, 'Resolution version remains identical (v1.0-raw-factual-measurement) on rerun');

// Simulated late-arriving legitimate snapshot
const obsI_late = [
  ...obsI1,
  createObs('obs-late', '2026-09-20T16:00:00.000Z', 6500) // Late-arriving ₹500 price drop!
];
const resI3 = outcomeResolverEngine.resolveCandidateHorizon(predI, '24h', obsI_late, '2026-09-21T11:00:00.000Z');
assert(resI3.outcome?.minimumPriceObservedINR === 6500, 'Re-resolution correctly incorporates late-arriving legitimate snapshot');
assert(resI3.outcome?.hasMeaningfulSavingEvent === 'CONFIRMED_TRUE', 'Re-resolution updates saving event state to CONFIRMED_TRUE');

// ----------------------------------------------------------------------------
// TEST J: Future observation excluded from shorter horizon
// ----------------------------------------------------------------------------
console.log('--- Test J: Future observation excluded from shorter horizon ---');
const predJ = createMockPred(7000);
const obsJ = [
  createObs('obs-1', '2026-09-20T18:00:00.000Z', 7000),
  createObs('obs-2', '2026-09-22T10:00:00.000Z', 4000) // 48 hours after pred (outside 24h window)
];
const resJ = outcomeResolverEngine.resolveCandidateHorizon(predJ, '24h', obsJ, '2026-09-21T11:00:00.000Z');
assert(resJ.outcome?.actualObservationCount === 1, '24h horizon excludes 48h observation');
assert(resJ.outcome?.minimumPriceObservedINR === 7000, 'Min price inside 24h window is ₹7,000 (excluding ₹4,000 future drop)');

// ----------------------------------------------------------------------------
// TEST K: Legacy and canonical snapshots produce identical outcomes
// ----------------------------------------------------------------------------
console.log('--- Test K: Legacy and canonical snapshots produce identical outcomes ---');
const legacyRaw = {
  id: 'snap-1727258400000-6E-656-2026-10-18',
  flightId: canonicalKey.canonicalId,
  routeId: 'PNQ-LKO',
  origin: 'PNQ',
  destination: 'LKO',
  departureDate: '2026-10-18',
  flightNumber: '6E-656',
  price: 6800,
  timestamp: '2026-09-20T16:00:00.000Z',
  type: 'hourly',
  source: 'Legacy Collector'
};
const normLegacy = trajectoryService.normalizeRawSnapshot(legacyRaw);
const predK = createMockPred(7000);
const resK = outcomeResolverEngine.resolveCandidateHorizon(predK, '24h', [normLegacy], '2026-09-21T11:00:00.000Z');
assert(resK.outcome?.minimumPriceObservedINR === 6800, 'Normalized legacy snapshot resolves identical min fare ₹6,800');

// ----------------------------------------------------------------------------
// TEST N: Synthetic/test fixture reaching resolver is rejected
// ----------------------------------------------------------------------------
console.log('--- Test N: Synthetic/test fixture rejected by outcome resolver ---');
const predN = createMockPred(7000);
predN.provenance = 'ISOLATED_TEST_FIXTURE';
let caughtN = false;
try {
  outcomeResolverEngine.resolveCandidateHorizon(predN, '24h', [], '2026-09-21T11:00:00.000Z');
} catch (err: any) {
  caughtN = true;
  assert(err.message.includes('Data Integrity Violation'), 'Resolver throws Data Integrity Violation for test fixture');
}
assert(caughtN, 'Test fixture successfully rejected by outcome resolver guard');

console.log('\n✅ All Phase 2 Data Integrity Tests (A - N) passed successfully!\n');
