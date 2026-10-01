import { db } from '../src/firebaseClient';
import { firestoreDB } from '../server/firestoreService';
import { collection, getDocs, query, where, orderBy, limit as fsLimit } from 'firebase/firestore';

async function inspectHistorical() {
  console.log('=== INSPECTING HISTORICAL SNAPSHOTS IN FIRESTORE ===\n');

  try {
    const colRef = collection(db, 'snapshots');
    
    // Query snapshots before 2026-09-29
    console.log('Querying snapshots before 2026-09-29...');
    const qOld = query(colRef, where('timestamp', '<', '2026-09-29T00:00:00.000Z'), fsLimit(500));
    const snapOld = await getDocs(qOld);
    console.log(`Found ${snapOld.size} snapshots before 2026-09-29`);

    const oldDates = new Set<string>();
    const oldRoutes: Record<string, number> = {};
    const oldProv: Record<string, number> = {};
    const oldSources: Record<string, number> = {};

    snapOld.forEach(docItem => {
      const data = docItem.data();
      if (data.timestamp) {
        oldDates.add(data.timestamp.split('T')[0]);
      }
      const r = data.routeId || 'UNKNOWN';
      oldRoutes[r] = (oldRoutes[r] || 0) + 1;
      const p = data.provenance || 'NONE';
      oldProv[p] = (oldProv[p] || 0) + 1;
      const s = data.source || 'NONE';
      oldSources[s] = (oldSources[s] || 0) + 1;
    });

    console.log('Older dates found:', Array.from(oldDates).sort());
    console.log('Older routes distribution:', oldRoutes);
    console.log('Older provenance distribution:', oldProv);
    console.log('Older source distribution:', oldSources);

    // Query snapshots on or after 2026-09-29
    console.log('\nQuerying snapshots on or after 2026-09-29...');
    const qNew = query(colRef, where('timestamp', '>=', '2026-09-29T00:00:00.000Z'), fsLimit(1000));
    const snapNew = await getDocs(qNew);
    console.log(`Found ${snapNew.size} snapshots on or after 2026-09-29`);

    // Sample older snapshot to see structure
    if (snapOld.size > 0) {
      console.log('\nSample older snapshot:', snapOld.docs[0].data());
    }

  } catch (err) {
    console.error('Error inspecting historical snapshots:', err);
  }
}

inspectHistorical().catch(console.error);
