import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../src/firebaseClient';
import { PriceSnapshot, TrackedTripAlert, AppNotification, TrackedPredictionRecord } from '../src/types';

function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleanObj[key] = sanitizeForFirestore(val);
    }
  }
  return cleanObj as T;
}

/**
 * Persistent Storage Service backed by Cloud Firestore
 */
export class FirestorePersistenceService {
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('[Firestore] Connected to persistent Firestore DB:', db.app.name);
      this.isInitialized = true;
    } catch (err) {
      console.error('[Firestore] Initialization error:', err);
    }
  }

  // --- Snapshots ---
  public async saveSnapshot(snapshot: PriceSnapshot): Promise<void> {
    try {
      const snapshotId = snapshot.id || (snapshot as any).observationId;
      if (!snapshotId) {
        console.warn('[Firestore] saveSnapshot skipped: missing id and observationId');
        return;
      }
      const docRef = doc(db, 'snapshots', snapshotId);
      await setDoc(docRef, sanitizeForFirestore({ ...snapshot, id: snapshotId }), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save snapshot ${snapshot.id}:`, err);
    }
  }

  public async saveSnapshotsBatch(snapshots: PriceSnapshot[]): Promise<void> {
    if (!snapshots || snapshots.length === 0) return;
    try {
      for (let i = 0; i < snapshots.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = snapshots.slice(i, i + 250);
        for (const s of chunk) {
          const snapshotId = s.id || (s as any).observationId;
          if (!snapshotId) continue;
          const docRef = doc(db, 'snapshots', snapshotId);
          batch.set(docRef, sanitizeForFirestore({ ...s, id: snapshotId }), { merge: true });
        }
        await batch.commit();
      }
      console.log(`[Firestore] Persisted ${snapshots.length} price snapshots to database.`);
    } catch (err) {
      console.warn('[Firestore] Batch save snapshots warning:', err);
    }
  }

  public async getSnapshots(routeId?: string, limitCount = 100): Promise<PriceSnapshot[]> {
    try {
      const snapshotsRef = collection(db, 'snapshots');
      let q = query(snapshotsRef, orderBy('timestamp', 'desc'), fsLimit(limitCount));
      
      if (routeId) {
        q = query(
          snapshotsRef,
          where('routeId', '==', routeId.toUpperCase()),
          orderBy('timestamp', 'desc'),
          fsLimit(limitCount)
        );
      }

      const snap = await getDocs(q);
      const list: PriceSnapshot[] = [];
      snap.forEach((docItem) => {
        list.push(docItem.data() as PriceSnapshot);
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] getSnapshots fallback:', err);
      return [];
    }
  }

  // --- Prediction Records (Ground Truth Audit) ---
  public async savePredictionRecord(record: TrackedPredictionRecord | any): Promise<void> {
    try {
      const recordId = record.predictionId || record.id;
      if (!recordId || typeof recordId !== 'string') {
        console.warn('[Firestore] Cannot save prediction record: missing predictionId or id', record);
        return;
      }
      const docRef = doc(db, 'prediction_records', recordId);
      const cleanRecord = sanitizeForFirestore({
        ...record,
        id: recordId,
        predictionId: recordId
      });
      await setDoc(docRef, cleanRecord, { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to persist prediction record ${record?.predictionId || record?.id}:`, err);
    }
  }

  public async getPredictionRecords(): Promise<TrackedPredictionRecord[]> {
    try {
      const colRef = collection(db, 'prediction_records');
      const q = query(colRef, orderBy('createdAt', 'desc'), fsLimit(200));
      const snap = await getDocs(q);
      const list: TrackedPredictionRecord[] = [];
      snap.forEach((docItem) => {
        list.push(docItem.data() as TrackedPredictionRecord);
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] getPredictionRecords warning:', err);
      return [];
    }
  }

  public async deletePredictionRecord(recordId: string): Promise<void> {
    try {
      const docRef = doc(db, 'prediction_records', recordId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn(`[Firestore] Failed to delete prediction record ${recordId}:`, err);
    }
  }

  // --- Price Alerts ---
  public async saveAlert(alert: TrackedTripAlert): Promise<void> {
    try {
      const docRef = doc(db, 'price_alerts', alert.id);
      await setDoc(docRef, sanitizeForFirestore(alert), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save alert ${alert.id}:`, err);
    }
  }

  public async getAlerts(): Promise<TrackedTripAlert[]> {
    try {
      const colRef = collection(db, 'price_alerts');
      const snap = await getDocs(colRef);
      const list: TrackedTripAlert[] = [];
      snap.forEach((d) => {
        list.push(d.data() as TrackedTripAlert);
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] getAlerts warning:', err);
      return [];
    }
  }

  public async deleteAlert(alertId: string): Promise<void> {
    try {
      const docRef = doc(db, 'price_alerts', alertId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn(`[Firestore] Failed to delete alert ${alertId}:`, err);
    }
  }

  // --- Notifications ---
  public async saveNotification(notification: AppNotification): Promise<void> {
    try {
      const docRef = doc(db, 'notifications', notification.id);
      await setDoc(docRef, sanitizeForFirestore(notification), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save notification ${notification.id}:`, err);
    }
  }

  public async getNotifications(): Promise<AppNotification[]> {
    try {
      const colRef = collection(db, 'notifications');
      const q = query(colRef, orderBy('timestamp', 'desc'), fsLimit(50));
      const snap = await getDocs(q);
      const list: AppNotification[] = [];
      snap.forEach((d) => {
        list.push(d.data() as AppNotification);
      });
      return list;
    } catch (err) {
      console.warn('[Firestore] getNotifications warning:', err);
      return [];
    }
  }

  // --- Daily AI Briefings (Persisted once per calendar day) ---
  public async getDailyCorridorAnalysis(route: string, dateKey: string): Promise<any | null> {
    try {
      const docId = `${route.toUpperCase()}_${dateKey}`;
      const docRef = doc(db, 'daily_ai_briefings', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        console.log(`[Firestore] Retrieved persistent daily AI briefing for ${docId}`);
        return snap.data();
      }
      return null;
    } catch (err) {
      console.warn('[Firestore] getDailyCorridorAnalysis warning:', err);
      return null;
    }
  }

  public async saveDailyCorridorAnalysis(route: string, dateKey: string, analysis: any): Promise<void> {
    try {
      const docId = `${route.toUpperCase()}_${dateKey}`;
      const docRef = doc(db, 'daily_ai_briefings', docId);
      await setDoc(docRef, sanitizeForFirestore({ ...analysis, route: route.toUpperCase(), dateKey }), { merge: true });
      console.log(`[Firestore] Saved persistent daily AI briefing for ${docId}`);
    } catch (err) {
      console.warn(`[Firestore] Failed to save daily analysis for ${route}:`, err);
    }
  }
}

export const firestoreDB = new FirestorePersistenceService();
