import { db } from '../src/firebaseClient';
import { collection, getDocs } from 'firebase/firestore';

async function runReconciliation() {
  console.log('=== STARTING DEFINITIVE DATA PURITY RECONCILIATION AUDIT ===');
  
  try {
    // 1. Fetch entire snapshots collection
    const snapshotsRef = collection(db, 'snapshots');
    const snapsSnap = await getDocs(snapshotsRef);
    const snapshots = snapsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    
    console.log(`\n1. Snapshots Total (All-time): ${snapshots.length}`);
    
    // Define 48h boundary
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const snaps48h = snapshots.filter(s => s.timestamp >= fortyEightHoursAgo);
    console.log(`2. Snapshots Total (Last 48 Hours): ${snaps48h.length}`);
    
    // 2. Source counts (all-time vs last 48h)
    const sourceAllTime: Record<string, number> = {};
    const source48h: Record<string, number> = {};
    
    snapshots.forEach(s => {
      const src = s.source || 'UNDEFINED';
      sourceAllTime[src] = (sourceAllTime[src] || 0) + 1;
    });
    
    snaps48h.forEach(s => {
      const src = s.source || 'UNDEFINED';
      source48h[src] = (source48h[src] || 0) + 1;
    });
    
    console.log('\n3. All-time Source Counts:');
    console.log(JSON.stringify(sourceAllTime, null, 2));
    
    console.log('\n4. Last 48h Source Counts:');
    console.log(JSON.stringify(source48h, null, 2));
    
    // 3. Provenance counts (all-time)
    const provAllTime: Record<string, number> = {};
    snapshots.forEach(s => {
      const prov = s.provenance || 'UNDEFINED';
      provAllTime[prov] = (provAllTime[prov] || 0) + 1;
    });
    console.log('\n5. All-time Provenance Counts:');
    console.log(JSON.stringify(provAllTime, null, 2));
    
    // 4. Source x Provenance Matrix (all-time)
    const matrix: Record<string, Record<string, number>> = {};
    snapshots.forEach(s => {
      const src = s.source || 'UNDEFINED';
      const prov = s.provenance || 'UNDEFINED';
      if (!matrix[src]) matrix[src] = {};
      matrix[src][prov] = (matrix[src][prov] || 0) + 1;
    });
    console.log('\n6. Source x Provenance Matrix:');
    console.log(JSON.stringify(matrix, null, 2));
    
    // 5. Query prediction_records & shadow_predictions
    const predRef = collection(db, 'prediction_records');
    const predSnap = await getDocs(predRef);
    const predictions = predSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    console.log(`\n7. Total prediction_records: ${predictions.length}`);
    
    const shadowRef = collection(db, 'shadow_predictions');
    const shadowSnap = await getDocs(shadowRef);
    const shadows = shadowSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    console.log(`8. Total shadow_predictions: ${shadows.length}`);
    
    // Group predictions & shadows by evaluationEligibility / provenance
    const predEligibility: Record<string, number> = {};
    predictions.forEach(p => {
      const el = p.evaluationEligibility || 'UNDEFINED';
      predEligibility[el] = (predEligibility[el] || 0) + 1;
    });
    console.log('\n9. prediction_records Eligibility Groups:');
    console.log(JSON.stringify(predEligibility, null, 2));
    
    const shadowEligibility: Record<string, number> = {};
    shadows.forEach(s => {
      const el = s.evaluationEligibility || 'UNDEFINED';
      shadowEligibility[el] = (shadowEligibility[el] || 0) + 1;
    });
    console.log('\n10. shadow_predictions Eligibility Groups:');
    console.log(JSON.stringify(shadowEligibility, null, 2));
    
    // Timestamp range check per source
    console.log('\n11. Snapshot Timestamps Range per Source:');
    const sourceRanges: Record<string, { min: string, max: string }> = {};
    snapshots.forEach(s => {
      const src = s.source || 'UNDEFINED';
      const t = s.timestamp || '';
      if (!sourceRanges[src]) {
        sourceRanges[src] = { min: t, max: t };
      } else {
        if (t < sourceRanges[src].min) sourceRanges[src].min = t;
        if (t > sourceRanges[src].max) sourceRanges[src].max = t;
      }
    });
    console.log(JSON.stringify(sourceRanges, null, 2));
    
  } catch (err) {
    console.error('Reconciliation failed:', err);
  }
}

runReconciliation();
