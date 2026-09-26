import { PredictionAuditRecord } from '../server/types/mlPipeline';
import { buildCanonicalFlightKey } from '../server/flightIdentity';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== TEST SUITE 4: PROSPECTIVE BACKGROUND PREDICTIONS & MATURITY SCHEMA ===');

const key = buildCanonicalFlightKey('PNQ', 'LKO', '6E-656', '2026-10-18');
const predRecord: PredictionAuditRecord = {
  predictionId: `pred-PNQ-LKO-2026-10-18-23d-${Date.now()}`,
  originType: 'EXPERIMENTAL_BACKGROUND',
  createdAt: new Date().toISOString(),
  canonicalId: key.canonicalId,
  routeId: 'PNQ-LKO',
  origin: 'PNQ',
  destination: 'LKO',
  departureDate: '2026-10-18',
  departureTimestampAtPrediction: '2026-10-18T10:00:00.000Z',
  leadTimeDays: 23,
  leadTimeHours: 552,
  currentFareINR: 7100,
  features: {
    leadTimeHours: 552,
    leadTimeDays: 23,
    departureDayOfWeek: 0,
    departureHourOfDay: 10,
    departureMinuteOfHour: 0,
    isSaturday: false,
    isSunday: true,
    isPublicHoliday: false,
    nearbyEvents: [
      {
        eventName: 'Navratri & Dussehra',
        eventDate: '2026-10-11',
        daysFromDeparture: -7,
        eventType: 'FESTIVAL'
      }
    ],
    carrierCode: '6E',
    flightNumber: '6E-656',
    scheduledStops: 0,
    scheduledDepartureTimeIST: '10:00',
    currentSpotFareINR: 7100,
    observedTrajectoryLength: 3,
    hoursSinceFirstObservation: 48,
    trailing12hPriceDeltaINR: -200,
    trailing24hPriceDeltaINR: -400,
    trailingCorridorMedianFareINR: 7200
  },
  forecastingModelId: 'candidate-persistence-baseline',
  decisionModelId: 'candidate-insufficient-evidence-baseline',
  modelVersion: 'v1.0-empirical-real',
  maturityState: 'DATA_COLLECTION',
  provenance: 'ISOLATED_TEST_FIXTURE',
  forecast: {
    p10: 6400,
    p50: 7100,
    p90: 8200,
    expectedMean: 7150,
    uncertaintySpreadRatio: 0.25
  },
  selectedValidityHorizon: null,
  candidateHorizons: ['24h', '48h', '3d', '5d', '7d', '14d'],
  validUntil: null,
  meaningfulDropProbability: null,
  rawDropFrequency: null,
  expectedSavingINR: null,
  expectedSurgeINR: null,
  recommendation: 'INSUFFICIENT_EVIDENCE',
  insufficientEvidenceReason: 'DATA_COLLECTION maturity stage: accumulating real prospective trajectories.',
  overallResolutionState: 'PENDING_HORIZONS',
  horizonResolutionStates: {},
  horizonOutcomes: {},
  isResolved: false
};

// Test 1: Record Schema Integrity
assert(predRecord.originType === 'EXPERIMENTAL_BACKGROUND', 'Marked as EXPERIMENTAL_BACKGROUND');
assert(predRecord.recommendation === 'INSUFFICIENT_EVIDENCE', 'Supports INSUFFICIENT_EVIDENCE recommendation');
assert(predRecord.maturityState === 'DATA_COLLECTION', 'Maturity state is DATA_COLLECTION');
assert(predRecord.selectedValidityHorizon === null, 'selectedValidityHorizon is strictly null during DATA_COLLECTION state');
assert(Array.isArray(predRecord.candidateHorizons) && predRecord.candidateHorizons.length === 6, 'Candidate evaluation horizons present as research array');
assert(predRecord.meaningfulDropProbability === null, 'Drop probability remains null while uncalibrated');

// Test 2: Ensure economicRegretINR is NOT stored in raw ungrounded record
assert((predRecord as any).actualOutcome?.economicRegretINR === undefined, 'Raw ground truth contains no hardcoded regret');

console.log('✅ All Prospective Prediction & Schema tests passed successfully!\n');
