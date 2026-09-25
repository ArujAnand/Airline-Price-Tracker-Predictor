import { firestoreDB } from '../server/firestoreService';
import { trajectoryService } from '../server/trajectoryService';
import { PredictionAuditRecord, LongitudinalObservation } from '../server/types/mlPipeline';

async function generateReport() {
  console.log('=== QUERYING PRODUCTION FIRESTORE DATASTORE FOR PHASE 3 READINESS ===\n');

  const rawSnapshots = await firestoreDB.getSnapshots(undefined, 5000);
  const rawPredictions = await firestoreDB.getPredictionRecords();

  const realSnapshots = rawSnapshots.filter(s => s.provenance !== 'ISOLATED_TEST_FIXTURE');
  const realPredictions = rawPredictions.filter((p: any) => p.provenance !== 'ISOLATED_TEST_FIXTURE') as unknown as PredictionAuditRecord[];

  const normalizedObs = realSnapshots.map(s => trajectoryService.normalizeRawSnapshot(s));
  const trajectoryMap = trajectoryService.buildTrajectorySeries(realSnapshots);

  // 1. Total Snapshots
  const snapshotCount = realSnapshots.length;

  // 2. Unique Flights
  const uniqueFlights = new Set(normalizedObs.map(o => o.canonicalId));

  // 3. Completed Lifecycles
  const nowMs = Date.now();
  let completedLifecycles = 0;
  for (const [canonicalId, series] of trajectoryMap.entries()) {
    const depMs = new Date(`${series.departureDate}T10:00:00.000Z`).getTime();
    if (depMs <= nowMs) {
      completedLifecycles++;
    }
  }

  // 4. Resolved Predictions by Horizon & 5. TRUE/FALSE/UNKNOWN
  const candidateHorizons = ['24h', '48h', '3d', '5d', '7d', '14d'] as const;
  const horizonCounts: Record<string, { resolved: number; trueCount: number; falseCount: number; unknownCount: number }> = {};

  for (const h of candidateHorizons) {
    horizonCounts[h] = { resolved: 0, trueCount: 0, falseCount: 0, unknownCount: 0 };
  }

  for (const pred of realPredictions) {
    if (pred.horizonOutcomes) {
      for (const h of candidateHorizons) {
        const outcome = pred.horizonOutcomes[h];
        if (outcome) {
          horizonCounts[h].resolved++;
          if (outcome.hasMeaningfulSavingEvent === 'CONFIRMED_TRUE') horizonCounts[h].trueCount++;
          else if (outcome.hasMeaningfulSavingEvent === 'CONFIRMED_FALSE') horizonCounts[h].falseCount++;
          else horizonCounts[h].unknownCount++;
        }
      }
    }
  }

  // 6. Calendar Span
  let earliestObs = '';
  let latestObs = '';
  if (normalizedObs.length > 0) {
    const sortedTimes = normalizedObs.map(o => o.observedAt).sort();
    earliestObs = sortedTimes[0];
    latestObs = sortedTimes[sortedTimes.length - 1];
  }
  const spanDays = earliestObs && latestObs 
    ? Number(((new Date(latestObs).getTime() - new Date(earliestObs).getTime()) / (86400 * 1000)).toFixed(1))
    : 0;

  // 7. Lead Time Distribution
  const leadTimesDays = normalizedObs.map(o => o.leadTimeDays);
  const lt_0_7 = leadTimesDays.filter(d => d <= 7).length;
  const lt_8_30 = leadTimesDays.filter(d => d > 7 && d <= 30).length;
  const lt_31_90 = leadTimesDays.filter(d => d > 30).length;

  // 8. Route / Direction Distribution
  const routeDist: Record<string, number> = {};
  for (const o of normalizedObs) {
    routeDist[o.routeId] = (routeDist[o.routeId] || 0) + 1;
  }

  // 9. Airline Distribution
  const airlineDist: Record<string, number> = {};
  for (const o of normalizedObs) {
    airlineDist[o.carrierCode] = (airlineDist[o.carrierCode] || 0) + 1;
  }

  // 10. Event / Festival Coverage
  const festivalObs = normalizedObs.filter(o => o.departureDate.startsWith('2026-10') || o.departureDate.startsWith('2026-11'));

  // 11. Independence / Dependence Analysis
  const predCanonicalMap: Record<string, number> = {};
  for (const p of realPredictions) {
    predCanonicalMap[p.canonicalId] = (predCanonicalMap[p.canonicalId] || 0) + 1;
  }

  console.log('--- FIRESTORE DATASET METRICS ---');
  console.log(`1. Total Genuine Snapshots: ${snapshotCount}`);
  console.log(`2. Unique Canonical Flight Instances: ${uniqueFlights.size}`);
  console.log(`3. Completed Flight Lifecycles (Departed): ${completedLifecycles}`);
  console.log(`4/5. Resolved Prospective Predictions by Horizon:`, JSON.stringify(horizonCounts, null, 2));
  console.log(`6. Calendar Span: ${spanDays} days (${earliestObs} to ${latestObs})`);
  console.log(`7. Lead Time Distribution: 0-7d=${lt_0_7}, 8-30d=${lt_8_30}, 31-90d=${lt_31_90}`);
  console.log(`8. Route Distribution:`, JSON.stringify(routeDist, null, 2));
  console.log(`9. Airline Distribution:`, JSON.stringify(airlineDist, null, 2));
  console.log(`10. Festival/Event Coverage Snapshots: ${festivalObs.length}`);
  console.log(`11. Average Predictions per Canonical Flight: ${realPredictions.length > 0 ? (realPredictions.length / Math.max(1, uniqueFlights.size)).toFixed(1) : 0}`);
  console.log(`Total Prospective Predictions: ${realPredictions.length}`);
  process.exit(0);
}

generateReport().catch(console.error);
