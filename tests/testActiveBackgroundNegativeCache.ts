import { firestoreDB } from '../server/firestoreService';

async function runActiveBackgroundNegativeCacheTest() {
  console.log('=== TEST: getActiveBackgroundEpisode Negative Cache Verification ===');

  const testCanonicalId = `PNQ-LKO-6E-9999-2026-12-31-NONEXISTENT-${Date.now()}`;
  const tele = firestoreDB.repositoryTelemetry.getActiveBackgroundEpisode;

  // Initial Telemetry Baseline
  const missesBefore = tele.cacheMisses;
  const attemptsBefore = tele.firestoreAttempts;
  const hitsBefore = tele.cacheHits;

  // 1. First Lookup (Expected: Cache Miss, Firestore Attempt, Negative Cached)
  console.log('\n1. Performing First Lookup for missing canonical flight ID...');
  const firstResult = await firestoreDB.getActiveBackgroundEpisode(testCanonicalId);
  const missesFirst = tele.cacheMisses;
  const attemptsFirst = tele.firestoreAttempts;
  const hitsFirst = tele.cacheHits;

  console.log(`   Result: ${firstResult === null ? 'null (missing as expected)' : 'found'}`);
  console.log(`   Delta Cache Misses:      +${missesFirst - missesBefore}`);
  console.log(`   Delta Firestore Attempts: +${attemptsFirst - attemptsBefore}`);
  console.log(`   Delta Cache Hits:         +${hitsFirst - hitsBefore}`);

  // 2. Second Lookup (Expected: Negative Cache Hit, Zero Firestore Attempts)
  console.log('\n2. Performing Second Lookup for identical missing canonical flight ID...');
  const secondResult = await firestoreDB.getActiveBackgroundEpisode(testCanonicalId);
  const missesSecond = tele.cacheMisses;
  const attemptsSecond = tele.firestoreAttempts;
  const hitsSecond = tele.cacheHits;

  console.log(`   Result: ${secondResult === null ? 'null (from negative cache)' : 'found'}`);
  console.log(`   Delta Cache Misses:      +${missesSecond - missesFirst}`);
  console.log(`   Delta Firestore Attempts: +${attemptsSecond - attemptsFirst}`);
  console.log(`   Delta Cache Hits:         +${hitsSecond - hitsFirst}`);

  const isProven = (attemptsSecond - attemptsFirst === 0) && (hitsSecond - hitsFirst === 1);
  console.log(`\n-> VERIFICATION RESULT: ${isProven ? 'PASSED (0 new Firestore attempts on second access)' : 'FAILED'}`);
  console.log('=====================================================================');
}

runActiveBackgroundNegativeCacheTest().catch(console.error);
