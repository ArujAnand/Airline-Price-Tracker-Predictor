import { db } from '../src/firebaseClient';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function runDiagnosis() {
  console.log('=== STARTING DIRECT CANONICAL FIRESTORE DIAGNOSIS ===');

  try {
    // 1. Direct fetch from snapshots collection for PNQ-LKO
    const snapshotsRef = collection(db, 'snapshots');
    const qPNQ = query(snapshotsRef, where('routeId', '==', 'PNQ-LKO'));
    const snapPNQ = await getDocs(qPNQ);
    
    const pnqSnaps = snapPNQ.docs.map(d => d.data());
    console.log(`\n--- Direct /snapshots (routeId == 'PNQ-LKO') ---`);
    console.log(`Total Document Count: ${pnqSnaps.length}`);
    
    if (pnqSnaps.length > 0) {
      const timestamps = pnqSnaps.map(s => s.timestamp).sort();
      console.log(`Earliest snapshot timestamp: ${timestamps[0]}`);
      console.log(`Latest snapshot timestamp: ${timestamps[timestamps.length - 1]}`);
    }

    // 2. Fetch all snapshots in /snapshots collection
    const allSnaps = await getDocs(snapshotsRef);
    console.log(`\n--- Direct /snapshots (All Documents) ---`);
    console.log(`Total Document Count in DB: ${allSnaps.size}`);

    // 3. Direct fetch from prediction_records
    const predictionsRef = collection(db, 'prediction_records');
    const allPreds = await getDocs(predictionsRef);
    const predsList = allPreds.docs.map(d => d.data());
    console.log(`\n--- Direct /prediction_records (All Documents) ---`);
    console.log(`Total Document Count in DB: ${allPreds.size}`);
    
    if (predsList.length > 0) {
      const createdTimes = predsList.map(p => p.createdAt).sort();
      console.log(`Earliest prediction record: ${createdTimes[0]}`);
      console.log(`Latest prediction record: ${createdTimes[createdTimes.length - 1]}`);
    }

  } catch (err) {
    console.error('Diagnosis Failed:', err);
  }
}

runDiagnosis().catch(console.error);
