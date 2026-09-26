import { firestoreDB } from '../server/firestoreService';
import { TrackedPredictionRecord } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runDeterministicAuditWorkerTests() {
  console.log('=== TEST SUITE: DETERMINISTIC LOSSLESS AUDIT WORKER PAGINATION ===');

  const nowISO = '2026-09-26T12:00:00.000Z';
  const sameCreatedAt = '2026-09-26T10:00:00.000Z';
  const sameEligibleAt = '2026-09-26T11:00:00.000Z';

  // Create 3 due prediction records with IDENTICAL createdAt and nextResolutionEligibleAt timestamps
  const record1: Record<string, any> = {
    id: 'pred-test-identical-001',
    predictionId: 'pred-test-identical-001',
    createdAt: sameCreatedAt,
    nextResolutionEligibleAt: sameEligibleAt,
    originType: 'EXPERIMENTAL_BACKGROUND',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    departureDate: '2026-10-18',
    currentFareINR: 6500,
    isResolved: false,
    overallResolutionState: 'PENDING_HORIZONS'
  };

  const record2: Record<string, any> = {
    id: 'pred-test-identical-002',
    predictionId: 'pred-test-identical-002',
    createdAt: sameCreatedAt,
    nextResolutionEligibleAt: sameEligibleAt,
    originType: 'EXPERIMENTAL_BACKGROUND',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    departureDate: '2026-10-18',
    currentFareINR: 6500,
    isResolved: false,
    overallResolutionState: 'PENDING_HORIZONS'
  };

  const record3: Record<string, any> = {
    id: 'pred-test-identical-003',
    predictionId: 'pred-test-identical-003',
    createdAt: sameCreatedAt,
    nextResolutionEligibleAt: sameEligibleAt,
    originType: 'EXPERIMENTAL_BACKGROUND',
    canonicalId: 'PNQ-LKO-6E-656-2026-10-18',
    routeId: 'PNQ-LKO',
    departureDate: '2026-10-18',
    currentFareINR: 6500,
    isResolved: false,
    overallResolutionState: 'PENDING_HORIZONS'
  };

  await firestoreDB.savePredictionRecord(record1 as any);
  await firestoreDB.savePredictionRecord(record2 as any);
  await firestoreDB.savePredictionRecord(record3 as any);

  // Test 1: Page 1 with batch size = 2
  const page1 = await firestoreDB.getDeterministicallyPagedPredictionRecords(2);
  assert(page1.records.length === 2, 'Page 1 returns exactly 2 records');
  assert(page1.nextCursor !== undefined, 'Next cursor is populated');

  // Test 2: Page 2 using continuation cursor from Page 1
  const page2 = await firestoreDB.getDeterministicallyPagedPredictionRecords(2, page1.nextCursor);
  assert(page2.records.length >= 1, 'Page 2 retrieves remaining due record without skipping');

  // Test 3: No duplicates across pages
  const p1Ids = new Set(page1.records.map(r => r.id));
  const p2Ids = page2.records.map(r => r.id);
  const duplicates = p2Ids.filter(id => p1Ids.has(id));
  assert(duplicates.length === 0, 'No record is duplicated across deterministic cursor pages');

  console.log('✅ Deterministic Audit Worker Pagination Test Passed Successfully!');
}

runDeterministicAuditWorkerTests().catch(err => {
  console.error('Deterministic Audit Worker Test Failed:', err);
  process.exit(1);
});
