import { firestoreDB } from '../server/firestoreService';

async function runExamine() {
  console.log('=== EXAMINING IN-MEMORY PRICE EVOLUTION ===');
  try {
    await firestoreDB.init();
    const snaps = Array.from((firestoreDB as any).inMemorySnapshots.values())
      .filter((s: any) => s.routeId === 'PNQ-LKO' && s.flightNumber === '6E-656')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`Found ${snaps.length} in-memory snapshots for 6E-656:`);
    snaps.slice(0, 10).forEach((s: any) => {
      console.log(`Snapshot: ${s.id}`);
      console.log(`  Timestamp: ${s.timestamp}`);
      console.log(`  Departure Date: ${s.departureDate}`);
      console.log(`  Price: ₹${s.price}`);
      console.log(`  Source: ${s.source}`);
      console.log('--------------------------------------');
    });
  } catch (err) {
    console.error('Failed to examine in-memory prices:', err);
  }
}

runExamine();
