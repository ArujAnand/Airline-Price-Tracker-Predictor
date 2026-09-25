import { trajectoryService } from '../server/trajectoryService';
import { LongitudinalObservation } from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== TEST SUITE 3: LONGITUDINAL TRAJECTORY & POINT-IN-TIME PURITY ===');

const mockObservations: LongitudinalObservation[] = [
  {
    observationId: 'obs-1',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    carrierCode: '6E',
    flightNumber: '6E-656',
    departureDate: '2026-10-18',
    scheduledDepartureTime: '06:10',
    observedAt: '2026-09-23T12:00:00.000Z',
    leadTimeHours: 600,
    leadTimeDays: 25,
    priceINR: 7500,
    currency: 'INR',
    isScheduleChanged: false,
    scheduleDriftMinutes: 0,
    isIdentityInferred: false,
    provenance: 'REAL_OBSERVATION',
    source: 'PERSISTED_FIRESTORE'
  },
  {
    observationId: 'obs-2',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    carrierCode: '6E',
    flightNumber: '6E-656',
    departureDate: '2026-10-18',
    scheduledDepartureTime: '06:10',
    observedAt: '2026-09-24T08:00:00.000Z',
    leadTimeHours: 576,
    leadTimeDays: 24,
    priceINR: 7100,
    currency: 'INR',
    isScheduleChanged: false,
    scheduleDriftMinutes: 0,
    isIdentityInferred: false,
    provenance: 'REAL_OBSERVATION',
    source: 'PERSISTED_FIRESTORE'
  },
  {
    observationId: 'obs-3',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    carrierCode: '6E',
    flightNumber: '6E-656',
    departureDate: '2026-10-18',
    scheduledDepartureTime: '06:10',
    observedAt: '2026-09-25T08:00:00.000Z',
    leadTimeHours: 552,
    leadTimeDays: 23,
    priceINR: 6900,
    currency: 'INR',
    isScheduleChanged: false,
    scheduleDriftMinutes: 0,
    isIdentityInferred: false,
    provenance: 'REAL_OBSERVATION',
    source: 'PERSISTED_FIRESTORE'
  }
];

// Test 1: Reconstructing Full Trajectory Series
const seriesMap = trajectoryService.buildTrajectorySeries(mockObservations);
const flightSeries = seriesMap.get('PNQ-LKO-6E-656-2026-10-18');
assert(flightSeries !== undefined, 'Flight trajectory series found');
assert(flightSeries?.observationCount === 3, 'All 3 observations grouped into series');
assert(flightSeries?.minObservedPriceINR === 6900, 'Calculated series min fare ₹6,900');
assert(flightSeries?.maxObservedPriceINR === 7500, 'Calculated series max fare ₹7,500');

// Test 2: Point-in-Time Purity (Feature extraction at 2026-09-24T09:00:00.000Z)
// At this timestamp, obs-3 (from Sept 25) DOES NOT EXIST YET.
const pitFeatures = trajectoryService.extractPointInTimeFeatures(
  'PNQ-LKO-6E-656-2026-10-18',
  '2026-09-24T09:00:00.000Z',
  7100,
  mockObservations
);

assert(pitFeatures.observedTrajectoryLength === 2, 'Strictly uses only 2 snapshots prior to prediction timestamp');
assert(pitFeatures.currentSpotFareINR === 7100, 'Point-in-time spot fare is ₹7,100');
assert(pitFeatures.trailing24hPriceDeltaINR === -400, 'Trailing 24h delta is -₹400 (7100 - 7500)');
assert(Array.isArray(pitFeatures.nearbyEvents), 'Nearby calendar events extracted as array');
assert(pitFeatures.nearbyEvents.length > 0, 'Found nearby factual calendar events (Dussehra/Diwali)');
assert((pitFeatures as any).festivalDemandFactor === undefined, 'ZERO assumed festival demand multipliers exist in features');

console.log('✅ All Trajectory & Point-in-Time tests passed successfully!\n');
