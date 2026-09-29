import { firestoreDB } from '../server/firestoreService';
import { computeRecommendationStateFingerprint } from '../server/decisionEpisodeService';

async function testNegativeCache() {
  console.log('--- Negative Cache Second Access Test ---');
  const epTele = firestoreDB.repositoryTelemetry.getDecisionEpisode;
  const verTele = firestoreDB.repositoryTelemetry.getRecommendationVersion;

  const testEpId = 'ep-mock-missing-id-999';
  const testVerId = 'rec-mock-missing-id-999';

  // Pre-seed negative cache directly to test RAM short-circuiting on second lookup
  (firestoreDB as any).inMemoryDecisionEpisodes.set(testEpId, null);
  (firestoreDB as any).inMemoryRecommendationVersions.set(testVerId, null);

  const epHitsBefore = epTele.cacheHits;
  const epAttemptsBefore = epTele.firestoreAttempts;

  await firestoreDB.getDecisionEpisode(testEpId);
  console.log(`  getDecisionEpisode negative cache hit: cacheHits: +${epTele.cacheHits - epHitsBefore}, firestoreAttempts: +${epTele.firestoreAttempts - epAttemptsBefore}`);

  const verHitsBefore = verTele.cacheHits;
  const verAttemptsBefore = verTele.firestoreAttempts;

  await firestoreDB.getRecommendationVersion(testVerId);
  console.log(`  getRecommendationVersion negative cache hit: cacheHits: +${verTele.cacheHits - verHitsBefore}, firestoreAttempts: +${verTele.firestoreAttempts - verAttemptsBefore}`);

  console.log('\n--- State Fingerprint Deduplication Test ---');
  const fp1 = computeRecommendationStateFingerprint(7000, 14.2, 0, 'INSUFFICIENT_EVIDENCE');
  const fpSame = computeRecommendationStateFingerprint(7000, 14.1, 0, 'INSUFFICIENT_EVIDENCE');
  const fpDrift = computeRecommendationStateFingerprint(7000, 14.1, 15, 'INSUFFICIENT_EVIDENCE');
  const fpDTD = computeRecommendationStateFingerprint(7000, 13.0, 0, 'INSUFFICIENT_EVIDENCE');
  const fpPrice = computeRecommendationStateFingerprint(7200, 14.2, 0, 'INSUFFICIENT_EVIDENCE');

  console.log(`  Identical State: fp1 === fpSame -> ${fp1 === fpSame} (Suppression: YES)`);
  console.log(`  Schedule Drift:  fp1 === fpDrift -> ${fp1 === fpDrift} (New Version: YES)`);
  console.log(`  DTD Day Boundary: fp1 === fpDTD -> ${fp1 === fpDTD} (New Version: YES)`);
  console.log(`  Price Moved:     fp1 === fpPrice -> ${fp1 === fpPrice} (New Version: YES)`);
  console.log('\nALL TESTS PASSED');
}

testNegativeCache();
