import { db } from '../src/firebaseClient';
import { collection, getDocs } from 'firebase/firestore';

async function runAudit() {
  console.log('=== RUNNING DETAILED PROVENANCE AUDIT ===');
  try {
    const snapshotsRef = collection(db, 'snapshots');
    const snap = await getDocs(snapshotsRef);
    
    console.log(`Total snapshots in DB: ${snap.size}`);
    
    const provGroups: Record<string, number> = {};
    const sourceGroups: Record<string, number> = {};
    const idPrefixGroups: Record<string, number> = {};
    
    snap.docs.forEach(docItem => {
      const data = docItem.data();
      const prov = data.provenance || 'UNDEFINED';
      const src = data.source || 'UNDEFINED';
      const id = docItem.id || '';
      
      provGroups[prov] = (provGroups[prov] || 0) + 1;
      sourceGroups[src] = (sourceGroups[src] || 0) + 1;
      
      const prefix = id.split('-')[0] || 'NO_PREFIX';
      idPrefixGroups[prefix] = (idPrefixGroups[prefix] || 0) + 1;
    });
    
    console.log('\n--- Provenance Groups ---');
    console.log(JSON.stringify(provGroups, null, 2));
    
    console.log('\n--- Source Groups ---');
    console.log(JSON.stringify(sourceGroups, null, 2));
    
    console.log('\n--- ID Prefix Groups ---');
    console.log(JSON.stringify(idPrefixGroups, null, 2));
    
  } catch (err) {
    console.error('Audit failed:', err);
  }
}

runAudit();
