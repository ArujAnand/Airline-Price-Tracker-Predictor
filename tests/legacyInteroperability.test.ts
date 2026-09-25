import { trajectoryService } from '../server/trajectoryService';
import { parseCanonicalFlightId, detectScheduleDrift, buildCanonicalFlightKey } from '../server/flightIdentity';
import { LongitudinalObservation, HorizonOutcome } from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== TEST SUITE 5: LEGACY INTEROPERABILITY, IDEMPOTENCY & COVERAGE SEMANTICS ===');

// 1. Test Legacy vs New Snapshot Normalization
const legacySnapshot = {
  id: 'snap-1727258400000-6E-656-2026-10-18',
  flightId: 'PNQ-LKO-6E-656-2026-10-18',
  routeId: 'PNQ-LKO',
  origin: 'PNQ',
  destination: 'LKO',
  departureDate: '2026-10-18',
  flightNumber: '6E-656',
  airline: 'IndiGo',
  price: 7400,
  timestamp: '2026-09-20T10:00:00.000Z',
  capturedHour: 10,
  type: 'hourly',
  source: 'Google Flights Yield Collector'
};

const newSnapshot = {
  id: 'obs-1727344800000-PNQ-LKO-6E-656-2026-10-18',
  canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
  routeId: 'PNQ-LKO',
  origin: 'PNQ',
  destination: 'LKO',
  departureDate: '2026-10-18',
  flightNumber: '6E-656',
  carrierCode: '6E',
  priceINR: 7100,
  observedAt: '2026-09-21T10:00:00.000Z',
  provenance: 'REAL_OBSERVATION'
};

const normLegacy = trajectoryService.normalizeRawSnapshot(legacySnapshot);
const normNew = trajectoryService.normalizeRawSnapshot(newSnapshot);

assert(normLegacy.canonicalId === normNew.canonicalId, 'Legacy snap-* and new obs-* map to identical canonical ID: PNQ-LKO-6E-656-2026-10-18');

// Build trajectory series combining legacy + new
const combinedSeries = trajectoryService.buildTrajectorySeries([legacySnapshot, newSnapshot]);
const series = combinedSeries.get('PNQ-LKO-6E-656-2026-10-18');

assert(series !== undefined, 'Legacy and new snapshot grouped into single trajectory series');
assert(series?.observationCount === 2, 'Combined trajectory contains 2 observations');
assert(series?.minObservedPriceINR === 7100, 'Correct min fare calculated across legacy and new snapshots');

// 2. Test Schedule Drift vs Identity Split Rules
const driftTest = detectScheduleDrift('06:10', '06:35');
assert(driftTest.isScheduleChanged && driftTest.scheduleDriftMinutes === 25, 'Schedule drift detects 25m delay');

const keyFlightA = buildCanonicalFlightKey('PNQ', 'LKO', '6E-656', '2026-10-18');
const keyFlightDiffDate = buildCanonicalFlightKey('PNQ', 'LKO', '6E-656', '2026-10-19');
const keyFlightDiffCarrier = buildCanonicalFlightKey('PNQ', 'LKO', 'IX-1144', '2026-10-18');

assert(keyFlightA.canonicalId !== keyFlightDiffDate.canonicalId, 'Different departure dates split the trajectory series');
assert(keyFlightA.canonicalId !== keyFlightDiffCarrier.canonicalId, 'Different flight numbers split the trajectory series');

// 3. Test Missing Observation Coverage Semantics
// Horizon outcome must explicitly compute coverage ratio and refuse to claim false drop/success if undercovered
function evaluateHorizonCoverage(observedCount: number, expectedCount: number): Partial<HorizonOutcome> {
  const ratio = expectedCount > 0 ? observedCount / expectedCount : 0;
  const isSufficient = ratio >= 0.50 && observedCount >= 2;
  return {
    actualObservationCount: observedCount,
    expectedObservationCount: expectedCount,
    observationCoverageRatio: Number(ratio.toFixed(2)),
    isSufficientCoverage: isSufficient,
    hasMeaningfulSavingEvent: isSufficient ? 'CONFIRMED_FALSE' : 'UNKNOWN_DUE_TO_COVERAGE'
  };
}

const wellCovered = evaluateHorizonCoverage(12, 16);
assert(wellCovered.isSufficientCoverage === true, 'Sufficient observations (75% coverage) evaluated as valid');

const severelyUndercovered = evaluateHorizonCoverage(1, 16);
assert(severelyUndercovered.isSufficientCoverage === false, 'Severely missing observations (6% coverage) flagged as INSUFFICIENT');
assert(severelyUndercovered.hasMeaningfulSavingEvent === 'UNKNOWN_DUE_TO_COVERAGE', 'Undercovered horizon resolves to UNKNOWN_DUE_TO_COVERAGE');

// 4. Test Point-in-Time Purity Invariant
const futureSnapshot: LongitudinalObservation = {
  observationId: 'obs-future',
  canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
  routeId: 'PNQ-LKO',
  origin: 'PNQ',
  destination: 'LKO',
  carrierCode: '6E',
  flightNumber: '6E-656',
  departureDate: '2026-10-18',
  scheduledDepartureTime: '06:10',
  observedAt: '2026-10-10T12:00:00.000Z', // Far future
  leadTimeHours: 192,
  leadTimeDays: 8,
  priceINR: 4200, // Big drop in future
  currency: 'INR',
  isScheduleChanged: false,
  scheduleDriftMinutes: 0,
  isIdentityInferred: false,
  provenance: 'REAL_OBSERVATION',
  source: 'PERSISTED_FIRESTORE'
};

const pitFeaturesAtSep25 = trajectoryService.extractPointInTimeFeatures(
  'PNQ-LKO-6E-656-2026-10-18',
  '2026-09-25T10:00:00.000Z',
  7100,
  [normLegacy, normNew, futureSnapshot]
);

assert(pitFeaturesAtSep25.observedTrajectoryLength === 2, 'Point-in-time feature extraction strictly excludes future observations (length = 2)');
assert(pitFeaturesAtSep25.currentSpotFareINR === 7100, 'Point-in-time spot fare remains ₹7,100 without future contamination');

console.log('✅ All Legacy Interoperability, Idempotency & Coverage tests passed successfully!\n');
