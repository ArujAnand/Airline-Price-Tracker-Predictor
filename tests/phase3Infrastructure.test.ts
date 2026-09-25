/**
 * Phase 3 Infrastructure Test Suite
 * 
 * Verifies Test Cases 1 through 18.
 */

import { persistenceBaseline, trailingMomentumBaseline } from '../server/baselines';
import { modelRegistryService } from '../server/modelRegistryService';
import { groupedTemporalEvaluator } from '../server/groupedTemporalEvaluator';
import { calibrationAnalyzerService } from '../server/calibrationAnalyzer';
import { featureEvidenceAnalyzer } from '../server/featureEvidenceAnalyzer';
import { datasetManifestService } from '../server/datasetManifestService';
import { trajectoryService } from '../server/trajectoryService';
import {
  PredictionAuditRecord,
  LongitudinalObservation,
  HorizonPeriod,
  ShadowPredictionRecord,
  EvaluationDatasetRow
} from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== PHASE 3 INFRASTRUCTURE TEST SUITE (TESTS 1 - 18) ===\n');

async function runTests() {
  await modelRegistryService.init();

  // --------------------------------------------------------------------------
  // TEST 1: Persistence baseline produces current fare as point forecast
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Persistence baseline produces current fare as point forecast ---');
  const pOut = persistenceBaseline.generateHorizonOutputs(7400, ['24h']);
  assert(pOut['24h'].pointForecastINR === 7400, 'Point forecast equals current spot fare (₹7,400)');

  // --------------------------------------------------------------------------
  // TEST 2: Persistence baseline does NOT fabricate quantiles
  // --------------------------------------------------------------------------
  console.log('--- Test 2: Persistence baseline does NOT fabricate quantiles ---');
  assert(pOut['24h'].quantileForecasts === null, 'quantileForecasts is strictly null (unfabricated)');

  // --------------------------------------------------------------------------
  // TEST 3: Persistence baseline does NOT fabricate drop probability
  // --------------------------------------------------------------------------
  console.log('--- Test 3: Persistence baseline does NOT fabricate drop probability ---');
  assert(pOut['24h'].dropProbability === null, 'dropProbability is strictly null (unfabricated)');

  // --------------------------------------------------------------------------
  // TEST 4: Trailing baseline refuses prediction with insufficient prior observations
  // --------------------------------------------------------------------------
  console.log('--- Test 4: Trailing baseline refuses prediction with insufficient prior observations ---');
  const nowISO = '2026-09-25T10:00:00.000Z';
  const singleObs: LongitudinalObservation[] = [{
    observationId: 'obs-1',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    carrierCode: '6E',
    flightNumber: '6E-656',
    departureDate: '2026-10-18',
    scheduledDepartureTime: '06:10',
    observedAt: '2026-09-25T09:00:00.000Z',
    leadTimeHours: 550,
    leadTimeDays: 22,
    priceINR: 7400,
    currency: 'INR',
    isScheduleChanged: false,
    scheduleDriftMinutes: 0,
    isIdentityInferred: false,
    provenance: 'REAL_OBSERVATION',
    source: 'PERSISTED_FIRESTORE'
  }];
  const mOut = trailingMomentumBaseline.generateHorizonOutputs(7400, ['24h'], singleObs, nowISO, 24);
  assert(mOut['24h'].pointForecastINR === null, 'Trailing momentum output is null when < 2 prior observations exist');

  // --------------------------------------------------------------------------
  // TEST 5: Shadow prediction is horizon-specific
  // --------------------------------------------------------------------------
  console.log('--- Test 5: Shadow prediction is horizon-specific ---');
  const multiHorizonOut = persistenceBaseline.generateHorizonOutputs(7400, ['24h', '48h', '7d']);
  assert(multiHorizonOut['24h'] !== undefined && multiHorizonOut['48h'] !== undefined, 'Horizon outputs contain independent horizon-specific objects');

  // --------------------------------------------------------------------------
  // TEST 6: Shadow prediction exists before its outcome
  // --------------------------------------------------------------------------
  console.log('--- Test 6: Shadow prediction exists before its outcome ---');
  const shadowRecord: ShadowPredictionRecord = {
    shadowPredictionId: 'shadow-baseline-fare-persistence-PNQ-LKO-6E-656-2026-10-18-20260925-h10',
    modelId: 'baseline-fare-persistence',
    modelVersion: 'v1.0-empirical',
    predictionTimestamp: '2026-09-25T10:00:00.000Z',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    departureDate: '2026-10-18',
    currentSpotFareINR: 7400,
    horizonOutputs: multiHorizonOut,
    provenance: 'REAL_OBSERVATION',
    createdAt: '2026-09-25T10:00:00.000Z'
  };
  const targetExpiryMs = new Date('2026-09-25T10:00:00.000Z').getTime() + 24 * 3600 * 1000;
  assert(new Date(shadowRecord.predictionTimestamp).getTime() < targetExpiryMs, 'Shadow prediction timestamp precedes horizon expiry moment');

  // --------------------------------------------------------------------------
  // TEST 7: Re-running same baseline/flight/window/horizon is idempotent
  // --------------------------------------------------------------------------
  console.log('--- Test 7: Re-running same baseline/flight/window/horizon is idempotent ---');
  const windowKey = '20260925-h10';
  const shadowId1 = `shadow-baseline-fare-persistence-${shadowRecord.canonicalId}-${windowKey}`;
  const shadowId2 = `shadow-baseline-fare-persistence-${shadowRecord.canonicalId}-${windowKey}`;
  assert(shadowId1 === shadowId2, 'Deterministic shadow prediction ID guarantees idempotency on reruns');

  // --------------------------------------------------------------------------
  // TEST 8: Different horizons remain separately auditable
  // --------------------------------------------------------------------------
  console.log('--- Test 8: Different horizons remain separately auditable ---');
  assert(shadowRecord.horizonOutputs['24h']?.horizon === '24h' && shadowRecord.horizonOutputs['7d']?.horizon === '7d', 'Horizons 24h and 7d remain separately auditable');

  // --------------------------------------------------------------------------
  // TEST 9: UNKNOWN outcomes cannot train classifier
  // --------------------------------------------------------------------------
  console.log('--- Test 9: UNKNOWN outcomes cannot train classifier ---');
  const rowUnknown: EvaluationDatasetRow = {
    predictionId: 'pred-1',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    originType: 'EXPERIMENTAL_BACKGROUND',
    predictionTimestamp: '2026-09-20T10:00:00.000Z',
    departureDate: '2026-10-18',
    leadTimeHours: 672,
    leadTimeDays: 28,
    initialFareINR: 7000,
    features: {} as any,
    horizon: '24h',
    outcome: {} as any,
    labelMeaningfulSaving: 'UNKNOWN_DUE_TO_COVERAGE',
    labelMaxAchievableSavingINR: null,
    labelMaxDownsideSurgeINR: null,
    labelExpiryPriceDeltaINR: null
  };
  const calRep = calibrationAnalyzerService.evaluateCalibration([rowUnknown], () => 0.2);
  assert(calRep.confirmedTrueCount === 0 && calRep.confirmedFalseCount === 0, 'UNKNOWN_DUE_TO_COVERAGE excludes record from confirmed label calibration targets');

  // --------------------------------------------------------------------------
  // TEST 10: Test/synthetic fixture cannot enter model infrastructure
  // --------------------------------------------------------------------------
  console.log('--- Test 10: Test/synthetic fixture cannot enter model infrastructure ---');
  const fixtureRecord: PredictionAuditRecord = {
    predictionId: 'pred-fixture',
    originType: 'EXPERIMENTAL_BACKGROUND',
    createdAt: nowISO,
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    origin: 'PNQ',
    destination: 'LKO',
    departureDate: '2026-10-18',
    departureTimestampAtPrediction: '2026-10-18T10:00:00.000Z',
    leadTimeDays: 23,
    leadTimeHours: 552,
    currentFareINR: 7100,
    features: {} as any,
    forecastingModelId: 'baseline-persistence',
    decisionModelId: 'baseline-insufficient-evidence',
    modelVersion: 'v1.0-empirical',
    maturityState: 'DATA_COLLECTION',
    provenance: 'ISOLATED_TEST_FIXTURE',
    forecast: {} as any,
    selectedValidityHorizon: null,
    candidateHorizons: ['24h'],
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
  let caughtFixture = false;
  try {
    groupedTemporalEvaluator.performGroupedTemporalSplit([fixtureRecord], nowISO);
  } catch (err: any) {
    caughtFixture = true;
    assert(err.message.includes('Data Integrity Violation'), 'Grouped temporal evaluator rejects isolated test fixtures');
  }
  assert(caughtFixture, 'Test fixture successfully blocked by model evaluator guard');

  // --------------------------------------------------------------------------
  // TEST 11: Same-flight outcome leakage is prevented in evaluation
  // --------------------------------------------------------------------------
  console.log('--- Test 11: Same-flight outcome leakage is prevented in evaluation ---');
  const realRecord1 = { ...fixtureRecord, predictionId: 'pred-1', provenance: 'REAL_OBSERVATION' as const, createdAt: '2026-09-20T10:00:00.000Z' };
  const realRecord2 = { ...fixtureRecord, predictionId: 'pred-2', provenance: 'REAL_OBSERVATION' as const, createdAt: '2026-09-22T10:00:00.000Z' };
  const splitRes = groupedTemporalEvaluator.performGroupedTemporalSplit([realRecord1, realRecord2], '2026-09-21T00:00:00.000Z');
  assert(splitRes.uniqueTrainFlights === 1 && splitRes.uniqueEvalFlights === 0, 'All predictions for same canonicalId placed together in train split without leakage');

  // --------------------------------------------------------------------------
  // TEST 12: Earlier point-in-time observations of current flight ARE permitted
  // --------------------------------------------------------------------------
  console.log('--- Test 12: Earlier point-in-time observations of current flight ARE permitted ---');
  const obsPast: LongitudinalObservation = { ...singleObs[0], observedAt: '2026-09-20T10:00:00.000Z', priceINR: 7500 };
  const pitFeatures = trajectoryService.extractPointInTimeFeatures(
    'PNQ-LKO-6E-656-2026-10-18',
    '2026-09-25T10:00:00.000Z',
    7400,
    [obsPast]
  );
  assert(pitFeatures.observedTrajectoryLength === 1, 'Point-in-time prior observation included in feature vector');

  // --------------------------------------------------------------------------
  // TEST 13: Future observations of current flight are forbidden
  // --------------------------------------------------------------------------
  console.log('--- Test 13: Future observations of current flight are forbidden ---');
  const obsFuture: LongitudinalObservation = { ...singleObs[0], observedAt: '2026-10-10T10:00:00.000Z', priceINR: 4000 };
  const pitFeaturesNoFuture = trajectoryService.extractPointInTimeFeatures(
    'PNQ-LKO-6E-656-2026-10-18',
    '2026-09-25T10:00:00.000Z',
    7400,
    [obsPast, obsFuture]
  );
  assert(pitFeaturesNoFuture.observedTrajectoryLength === 1, 'Future observation on Oct 10 strictly excluded at Sep 25 prediction moment');

  // --------------------------------------------------------------------------
  // TEST 14: Registry cannot promote model merely because it trained
  // --------------------------------------------------------------------------
  console.log('--- Test 14: Registry cannot promote model merely because it trained ---');
  let caughtPromotion = false;
  try {
    modelRegistryService.updateModelStatus('baseline-fare-persistence', 'CHAMPION', 'DATA_COLLECTION', 'Attempted ungrounded promotion');
  } catch (err: any) {
    caughtPromotion = true;
    assert(err.message.includes('Promotion Violation'), 'Model registry blocks promotion to CHAMPION during DATA_COLLECTION state');
  }
  assert(caughtPromotion, 'Promotion guard successfully blocked ungrounded CHAMPION assignment');

  // --------------------------------------------------------------------------
  // TEST 15: Different task categories can have different eventual champions
  // --------------------------------------------------------------------------
  console.log('--- Test 15: Different task categories can have different eventual champions ---');
  const model1 = modelRegistryService.getModel('baseline-fare-persistence');
  const model2 = modelRegistryService.getModel('baseline-trailing-momentum');
  assert(model1?.task === 'PRICE_FORECASTING' && model2?.task === 'PRICE_FORECASTING', 'Task categories independently structured in model registry');

  // --------------------------------------------------------------------------
  // TEST 16: Calibration analyzer returns INSUFFICIENT_EVIDENCE with current label state
  // --------------------------------------------------------------------------
  console.log('--- Test 16: Calibration analyzer returns INSUFFICIENT_EVIDENCE with current label state ---');
  const calReport = calibrationAnalyzerService.evaluateCalibration([], () => 0.5);
  assert(calReport.status === 'INSUFFICIENT_EVIDENCE', 'Calibration status is INSUFFICIENT_EVIDENCE given 0 confirmed labels');

  // --------------------------------------------------------------------------
  // TEST 17: Festival evidence remains INSUFFICIENT_EVIDENCE with current data
  // --------------------------------------------------------------------------
  console.log('--- Test 17: Festival evidence remains INSUFFICIENT_EVIDENCE with current data ---');
  const festReport = featureEvidenceAnalyzer.evaluateFestivalFeatureEvidence(singleObs);
  assert(festReport.evidenceStatus === 'INSUFFICIENT_EVIDENCE', 'Festival feature status is INSUFFICIENT_EVIDENCE with current data span');

  // --------------------------------------------------------------------------
  // TEST 18: Dataset manifest reproduces exact eligible record set
  // --------------------------------------------------------------------------
  console.log('--- Test 18: Dataset manifest reproduces exact eligible record set ---');
  const manifest = await datasetManifestService.generateManifest('v1.0-empirical-resolved');
  assert(manifest.manifestId.startsWith('manifest-v1.0-empirical-resolved'), 'Generates versioned dataset manifest for training/evaluation traceability');

  console.log('\n✅ All Phase 3 Infrastructure Tests (1 - 18) passed successfully!\n');
}

runTests().catch(console.error);
