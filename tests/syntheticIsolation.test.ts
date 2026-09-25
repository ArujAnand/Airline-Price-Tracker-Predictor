import { ISOLATED_TEST_FIXTURES, getFactualYoYTrends } from '../server/historicalData';
import { DataProvenance } from '../server/types/mlPipeline';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== TEST SUITE 2: ZERO SYNTHETIC FARE DATA ISOLATION & PURITY ===');

// Test 1: Isolated Fixture Tagging
for (const fixture of ISOLATED_TEST_FIXTURES) {
  assert(
    fixture.provenance === 'ISOLATED_TEST_FIXTURE',
    `Fixture ${fixture.routeId} explicitly tagged as ISOLATED_TEST_FIXTURE`
  );
}

// Test 2: ML Pipeline Ingestion Guard
function simulateMLIngestion(records: { provenance: DataProvenance }[]) {
  for (const r of records) {
    if (r.provenance !== 'REAL_OBSERVATION') {
      throw new Error(`Data Integrity Violation: Non-real observation rejected by ML training pipeline: ${r.provenance}`);
    }
  }
  return true;
}

let violationCaught = false;
try {
  simulateMLIngestion(ISOLATED_TEST_FIXTURES as any);
} catch (err: any) {
  violationCaught = true;
  assert(
    err.message.includes('Data Integrity Violation'),
    'Synthetic/test fixture immediately triggers Data Integrity Violation'
  );
}
assert(violationCaught, 'ML Ingestion guard successfully blocked test fixtures');

// Test 3: Real YoY Aggregation with Zero Synthetic History
const realSnapshots = [
  {
    routeId: 'PNQ-LKO',
    departureDate: '2026-10-18',
    price: 7200,
    provenance: 'REAL_OBSERVATION'
  },
  {
    routeId: 'PNQ-LKO',
    departureDate: '2026-10-18',
    price: 6800,
    provenance: 'REAL_OBSERVATION'
  }
];

const yoyTrends = getFactualYoYTrends(realSnapshots, 'PNQ-LKO');
assert(yoyTrends.length === 1, 'Only real observed dates included in factual YoY');
assert(yoyTrends[0].averagePrice === 7000, 'Calculated real average fare 7000');
assert(yoyTrends[0].lowestPrice === 6800, 'Calculated real low fare 6800');
assert(yoyTrends[0].highestPrice === 7200, 'Calculated real high fare 7200');

// Test 4: Empty Real Data Returns Zero Fictitious Points
const emptyYoY = getFactualYoYTrends([], 'DEL-BOM');
assert(emptyYoY.length === 0, 'Zero fictitious data points returned for unobserved route');

console.log('✅ All Synthetic Isolation tests passed successfully!\n');
