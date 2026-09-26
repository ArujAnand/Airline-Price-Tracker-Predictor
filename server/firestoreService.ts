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
  startAfter,
  deleteDoc,
  writeBatch,
  getCountFromServer
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

  // In-memory fallback caches to ensure resilient operation during Firestore quota limits
  private inMemorySnapshots = new Map<string, PriceSnapshot>();
  private inMemoryDecisionEpisodes = new Map<string, any>();
  private inMemoryActiveBackgroundEpisodes = new Map<string, any>();
  private inMemoryRecommendationVersions = new Map<string, any>();
  private inMemoryPredictionRecords = new Map<string, TrackedPredictionRecord>();
  private inMemoryShadowPredictions = new Map<string, any>();
  private inMemoryAlerts = new Map<string, TrackedTripAlert>();
  private inMemoryNotifications = new Map<string, AppNotification>();
  private lastQuotaWarningTimestamp = 0;

  private async runWithWriteTimeout<T>(fn: () => Promise<T>, timeoutMs = 2500): Promise<T | null> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timer!);
      return result;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  private logQuotaWarningThrottled(context: string, err: any): void {
    const now = Date.now();
    const errStr = String(err?.message || err);
    const isQuotaError = errStr.includes('Quota limit exceeded') || err?.code === 'resource-exhausted';
    if (isQuotaError) {
      if (now - this.lastQuotaWarningTimestamp > 60000) { // Log once per 60 seconds maximum
        console.warn(`[Firestore DB] Quota limit reached - operating gracefully via in-memory empirical cache. (${context})`);
        this.lastQuotaWarningTimestamp = now;
      }
    } else {
      console.warn(`[Firestore] ${context}:`, errStr);
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('[Firestore] Connected to persistent Firestore DB:', db.app.name);
      await this.hydrateFromMaterializedState();
      this.isInitialized = true;
    } catch (err) {
      console.error('[Firestore] Initialization error:', err);
    }
  }

  /**
   * Task 1: Reads ONLY system_state/materializedState (1 single Firestore read!) on cold start.
   * If document exists, instantly hydrates in-memory maps.
   * If missing, performs 1-time full query fallback and creates the materialized state doc.
   */
  public async hydrateFromMaterializedState(): Promise<void> {
    try {
      const docRef = doc(db, 'system_state', 'materializedState');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.snapshots && Array.isArray(data.snapshots)) {
          data.snapshots.forEach((s: PriceSnapshot) => {
            if (s.id) this.inMemorySnapshots.set(s.id, s);
          });
        }
        if (data.predictionRecords && Array.isArray(data.predictionRecords)) {
          data.predictionRecords.forEach((p: TrackedPredictionRecord) => {
            const pId = (p as any).predictionId || p.id;
            if (pId) this.inMemoryPredictionRecords.set(pId, p);
          });
        }
        if (data.activeBackgroundEpisodes && Array.isArray(data.activeBackgroundEpisodes)) {
          data.activeBackgroundEpisodes.forEach((ep: any) => {
            if (ep.canonicalId) this.inMemoryActiveBackgroundEpisodes.set(ep.canonicalId, ep);
            if (ep.episodeId) this.inMemoryDecisionEpisodes.set(ep.episodeId, ep);
          });
        }
        console.log(`[Firestore DB] Cold start hydrated via 1 single materialized state read (${this.inMemorySnapshots.size} snaps, ${this.inMemoryPredictionRecords.size} predictions).`);
        return;
      }
    } catch (err) {
      this.logQuotaWarningThrottled('hydrateFromMaterializedState', err);
    }

    // 1-Time Fallback if materializedState doc does not exist yet
    console.log('[Firestore DB] Materialized state doc missing — running initial 1-time fallback hydration.');
    await this.getSnapshots(undefined, 500);
    await this.getPredictionRecords(500);
    await this.saveMaterializedState();
  }

  /**
   * Persists rolled-up in-memory state summary to system_state/materializedState
   * Fixed-size rolling summary (latest 50 snapshots per route = 100 max, 50 predictions, 36 episodes max)
   * Keeps document lightweight (~28 KB) without unbounded growth.
   */
  public async saveMaterializedState(): Promise<void> {
    try {
      const pnqSnapshots = Array.from(this.inMemorySnapshots.values())
        .filter(s => s.routeId?.toUpperCase() === 'PNQ-LKO')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      const lkoSnapshots = Array.from(this.inMemorySnapshots.values())
        .filter(s => s.routeId?.toUpperCase() === 'LKO-PNQ')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      const recentSnapshots = [...pnqSnapshots, ...lkoSnapshots];

      const recentPredictions = Array.from(this.inMemoryPredictionRecords.values())
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 50);

      const activeEpisodes = Array.from(this.inMemoryActiveBackgroundEpisodes.values()).slice(0, 36);

      const payload = sanitizeForFirestore({
        id: 'materializedState',
        updatedAt: new Date().toISOString(),
        snapshotCount: this.inMemorySnapshots.size,
        predictionRecordCount: this.inMemoryPredictionRecords.size,
        snapshots: recentSnapshots,
        predictionRecords: recentPredictions,
        activeBackgroundEpisodes: activeEpisodes
      });

      const docRef = doc(db, 'system_state', 'materializedState');
      await this.runWithWriteTimeout(() => setDoc(docRef, payload, { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled('saveMaterializedState', err);
    }
  }

  // --- Snapshots ---
  private validateSnapshotPurity(snapshot: PriceSnapshot): boolean {
    const isSynthetic = 
      snapshot.source?.includes('Yield') || 
      snapshot.source?.includes('Collector') || 
      snapshot.source?.includes('Calibrator') || 
      snapshot.source?.includes('fallback') || 
      snapshot.source?.includes('synthetic') || 
      snapshot.source?.includes('simulation');

    // If provenance was not explicitly passed but source is a confirmed genuine external scraper, assign REAL_EXTERNAL_OBSERVATION
    if (!snapshot.provenance) {
      if (
        snapshot.source === 'SerpApi (Google Flights)' ||
        snapshot.source === 'SearchApi (Google Flights)' ||
        snapshot.source === 'Google Flights (Live Scraping)'
      ) {
        snapshot.provenance = 'REAL_EXTERNAL_OBSERVATION';
      }
    }

    // Production /snapshots must strictly only contain real empirical market observations.
    // Isolated test fixtures and experimental provider observations are strictly forbidden from /snapshots.
    const allowedProvenances = ['REAL_EXTERNAL_OBSERVATION', 'REAL_VERIFIED_HISTORICAL_OBSERVATION', 'REAL_OBSERVATION'];
    const hasAllowedProvenance = snapshot.provenance && allowedProvenances.includes(snapshot.provenance);

    if (isSynthetic || !hasAllowedProvenance) {
      const errorMsg = `Data Integrity Violation: Attempted to save non-production-real snapshot to /snapshots! Source: '${snapshot.source}', Provenance: '${snapshot.provenance}'`;
      const isTestOrDev = process.env.NODE_ENV !== 'production' || process.argv.some(arg => arg.includes('test') || arg.includes('tsx'));
      if (isTestOrDev) {
        throw new Error(errorMsg);
      } else {
        console.warn(`[Purity Guard ALERT] ${errorMsg} - Skipping save to preserve empirical purity.`);
        return false;
      }
    }
    return true;
  }

  public async saveSnapshot(snapshot: PriceSnapshot): Promise<void> {
    if (!this.validateSnapshotPurity(snapshot)) {
      return;
    }
    const snapshotId = snapshot.id || (snapshot as any).observationId;
    if (!snapshotId) return;

    // Task 3: Automatic TTL Retention Policy (Expires 90 days after departure date)
    const depTime = snapshot.departureDate ? new Date(snapshot.departureDate).getTime() : Date.now();
    const expireAt = new Date(depTime + 90 * 24 * 60 * 60 * 1000).toISOString();
    const enrichedSnapshot = { ...snapshot, id: snapshotId, expireAt };

    this.inMemorySnapshots.set(snapshotId, enrichedSnapshot);

    try {
      const docRef = doc(db, 'snapshots', snapshotId);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(enrichedSnapshot), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveSnapshot (${snapshotId})`, err);
    }
  }

  /**
   * Task 2: Aggregation queries using getCountFromServer (1 read unit regardless of doc count!)
   */
  public async getCollectionCount(collectionName: string): Promise<number> {
    try {
      const colRef = collection(db, collectionName);
      const snap = await getCountFromServer(colRef);
      return snap.data().count;
    } catch (err) {
      this.logQuotaWarningThrottled(`getCollectionCount (${collectionName})`, err);
      if (collectionName === 'snapshots') return this.inMemorySnapshots.size;
      if (collectionName === 'prediction_records') return this.inMemoryPredictionRecords.size;
      if (collectionName === 'shadow_predictions') return this.inMemoryShadowPredictions.size;
      return 0;
    }
  }

  public async saveSnapshotsBatch(snapshots: PriceSnapshot[]): Promise<void> {
    if (!snapshots || snapshots.length === 0) return;
    const validSnapshots = snapshots.filter(s => this.validateSnapshotPurity(s));
    if (validSnapshots.length === 0) return;

    validSnapshots.forEach(s => {
      const snapshotId = s.id || (s as any).observationId;
      if (snapshotId) this.inMemorySnapshots.set(snapshotId, s);
    });

    try {
      for (let i = 0; i < validSnapshots.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = validSnapshots.slice(i, i + 250);
        for (const s of chunk) {
          const snapshotId = s.id || (s as any).observationId;
          if (!snapshotId) continue;
          const docRef = doc(db, 'snapshots', snapshotId);
          batch.set(docRef, sanitizeForFirestore({ ...s, id: snapshotId }), { merge: true });
        }
        await batch.commit();
      }
      console.log(`[Firestore] Persisted ${validSnapshots.length} price snapshots to database.`);
    } catch (err) {
      this.logQuotaWarningThrottled('saveSnapshotsBatch', err);
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
        const data = docItem.data() as PriceSnapshot;
        list.push(data);
        if (data.id) this.inMemorySnapshots.set(data.id, data);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getSnapshots', err);
      let list = Array.from(this.inMemorySnapshots.values());
      if (routeId) {
        list = list.filter(s => s.routeId.toUpperCase() === routeId.toUpperCase());
      }
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limitCount);
    }
  }

  // --- Prediction Records (Ground Truth Audit) ---
  public async savePredictionRecord(record: TrackedPredictionRecord | any): Promise<void> {
    try {
      const recordId = record.predictionId || record.id;
      if (!recordId || typeof recordId !== 'string') {
        return;
      }
      const cleanRecord = sanitizeForFirestore({
        ...record,
        id: recordId,
        predictionId: recordId
      });
      this.inMemoryPredictionRecords.set(recordId, cleanRecord as TrackedPredictionRecord);

      const docRef = doc(db, 'prediction_records', recordId);
      await this.runWithWriteTimeout(() => setDoc(docRef, cleanRecord, { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`savePredictionRecord (${record?.predictionId || record?.id})`, err);
    }
  }

  public async getPredictionRecords(limitCount: number = 1000, oldestFirst = false): Promise<TrackedPredictionRecord[]> {
    try {
      const colRef = collection(db, 'prediction_records');
      const orderDir = oldestFirst ? 'asc' : 'desc';
      const q = query(colRef, orderBy('createdAt', orderDir), fsLimit(limitCount));
      const snap = await getDocs(q);
      const list: TrackedPredictionRecord[] = [];
      snap.forEach((docItem) => {
        const data = docItem.data() as TrackedPredictionRecord;
        list.push(data);
        const pId = (data as any).predictionId || data.id;
        if (pId) {
          this.inMemoryPredictionRecords.set(pId, data);
        }
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getPredictionRecords', err);
      const list = Array.from(this.inMemoryPredictionRecords.values());
      list.sort((a, b) => {
        const diff = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        return oldestFirst ? diff : -diff;
      });
      return list.slice(0, limitCount);
    }
  }

  public async getDeterministicallyPagedPredictionRecords(
    batchSize: number = 200,
    cursor?: { lastEligibleAt?: string; lastCreatedAt?: string; lastDocId?: string }
  ): Promise<{
    records: TrackedPredictionRecord[];
    nextCursor?: { lastEligibleAt?: string; lastCreatedAt?: string; lastDocId?: string };
  }> {
    // Also sync from Firestore if not full
    try {
      const colRef = collection(db, 'prediction_records');
      const snap = await getDocs(query(colRef, fsLimit(batchSize * 5)));
      snap.forEach((docItem) => {
        const data = docItem.data() as TrackedPredictionRecord;
        const pId = (data as any).predictionId || data.id;
        if (pId) this.inMemoryPredictionRecords.set(pId, data);
      });
    } catch (err) {
      this.logQuotaWarningThrottled('getDeterministicallyPagedPredictionRecords', err);
    }

    const all = Array.from(this.inMemoryPredictionRecords.values()).sort((a, b) => {
      const eligA = a.nextResolutionEligibleAt || '9999-12-31T23:59:59.999Z';
      const eligB = b.nextResolutionEligibleAt || '9999-12-31T23:59:59.999Z';
      if (eligA !== eligB) return eligA.localeCompare(eligB);

      const createdA = a.createdAt || '';
      const createdB = b.createdAt || '';
      if (createdA !== createdB) return createdA.localeCompare(createdB);

      const idA = (a as any).predictionId || a.id || '';
      const idB = (b as any).predictionId || b.id || '';
      return idA.localeCompare(idB);
    });

    let filtered = all;
    if (cursor && (cursor.lastEligibleAt || cursor.lastCreatedAt || cursor.lastDocId)) {
      filtered = all.filter((r) => {
        const elig = r.nextResolutionEligibleAt || '9999-12-31T23:59:59.999Z';
        const created = r.createdAt || '';
        const docId = (r as any).predictionId || r.id || '';

        const lastElig = cursor.lastEligibleAt || '';
        const lastCreated = cursor.lastCreatedAt || '';
        const lastId = cursor.lastDocId || '';

        if (elig > lastElig) return true;
        if (elig < lastElig) return false;
        if (created > lastCreated) return true;
        if (created < lastCreated) return false;
        return docId > lastId;
      });
    }

    const batch = filtered.slice(0, batchSize);
    let nextCursor: { lastEligibleAt?: string; lastCreatedAt?: string; lastDocId?: string } | undefined = undefined;
    if (batch.length > 0) {
      const lastRec = batch[batch.length - 1];
      nextCursor = {
        lastEligibleAt: lastRec.nextResolutionEligibleAt || undefined,
        lastCreatedAt: lastRec.createdAt,
        lastDocId: (lastRec as any).predictionId || lastRec.id
      };
    }

    return { records: batch, nextCursor };
  }

  public async deletePredictionRecord(recordId: string): Promise<void> {
    try {
      const docRef = doc(db, 'prediction_records', recordId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn(`[Firestore] Failed to delete prediction record ${recordId}:`, err);
    }
  }

  private inMemoryModelRegistry = new Map<string, any>();
  private inMemoryDatasetManifests = new Map<string, any>();

  // --- Price Alerts ---
  public async saveAlert(alert: TrackedTripAlert): Promise<void> {
    if (!alert || !alert.id) return;
    this.inMemoryAlerts.set(alert.id, alert);
    try {
      const docRef = doc(db, 'price_alerts', alert.id);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(alert), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveAlert (${alert.id})`, err);
    }
  }

  public async getAlerts(): Promise<TrackedTripAlert[]> {
    try {
      const colRef = collection(db, 'price_alerts');
      const snap = await getDocs(colRef);
      const list: TrackedTripAlert[] = [];
      snap.forEach((d) => {
        const item = d.data() as TrackedTripAlert;
        list.push(item);
        if (item.id) this.inMemoryAlerts.set(item.id, item);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getAlerts', err);
      return Array.from(this.inMemoryAlerts.values());
    }
  }

  public async deleteAlert(alertId: string): Promise<void> {
    this.inMemoryAlerts.delete(alertId);
    try {
      const docRef = doc(db, 'price_alerts', alertId);
      await deleteDoc(docRef);
    } catch (err) {
      this.logQuotaWarningThrottled(`deleteAlert (${alertId})`, err);
    }
  }

  // --- Notifications ---
  public async saveNotification(notification: AppNotification): Promise<void> {
    if (!notification || !notification.id) return;
    this.inMemoryNotifications.set(notification.id, notification);
    try {
      const docRef = doc(db, 'notifications', notification.id);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(notification), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveNotification (${notification.id})`, err);
    }
  }

  public async getNotifications(): Promise<AppNotification[]> {
    try {
      const colRef = collection(db, 'notifications');
      const q = query(colRef, orderBy('timestamp', 'desc'), fsLimit(50));
      const snap = await getDocs(q);
      const list: AppNotification[] = [];
      snap.forEach((d) => {
        const item = d.data() as AppNotification;
        list.push(item);
        if (item.id) this.inMemoryNotifications.set(item.id, item);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getNotifications', err);
      return Array.from(this.inMemoryNotifications.values());
    }
  }

  // --- Model Registry & Shadow Predictions ---
  public async saveModelRegistryRecord(record: any): Promise<void> {
    if (!record || !record.modelId) return;
    this.inMemoryModelRegistry.set(record.modelId, record);
    try {
      const docRef = doc(db, 'model_registry', record.modelId);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(record), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveModelRegistryRecord (${record?.modelId})`, err);
    }
  }

  public async getModelRegistryRecords(): Promise<any[]> {
    try {
      const colRef = collection(db, 'model_registry');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach(d => {
        const item = d.data();
        list.push(item);
        if (item.modelId) this.inMemoryModelRegistry.set(item.modelId, item);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getModelRegistryRecords', err);
      return Array.from(this.inMemoryModelRegistry.values());
    }
  }

  public async saveShadowPredictionRecord(record: any): Promise<void> {
    if (!record || !record.shadowPredictionId) return;
    this.inMemoryShadowPredictions.set(record.shadowPredictionId, record);
    try {
      const docRef = doc(db, 'shadow_predictions', record.shadowPredictionId);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(record), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveShadowPredictionRecord (${record?.shadowPredictionId})`, err);
    }
  }

  public async getShadowPredictionRecords(): Promise<any[]> {
    try {
      const colRef = collection(db, 'shadow_predictions');
      const q = query(colRef, orderBy('createdAt', 'desc'), fsLimit(500));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        const item = d.data();
        list.push(item);
        if (item.shadowPredictionId) this.inMemoryShadowPredictions.set(item.shadowPredictionId, item);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getShadowPredictionRecords', err);
      return Array.from(this.inMemoryShadowPredictions.values());
    }
  }

  public async saveDatasetManifest(manifest: any): Promise<void> {
    if (!manifest || !manifest.manifestId) return;
    this.inMemoryDatasetManifests.set(manifest.manifestId, manifest);
    try {
      const docRef = doc(db, 'dataset_manifests', manifest.manifestId);
      await this.runWithWriteTimeout(() => setDoc(docRef, sanitizeForFirestore(manifest), { merge: true }));
    } catch (err) {
      this.logQuotaWarningThrottled(`saveDatasetManifest (${manifest?.manifestId})`, err);
    }
  }

  public async getDatasetManifests(): Promise<any[]> {
    try {
      const colRef = collection(db, 'dataset_manifests');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach(d => {
        const item = d.data();
        list.push(item);
        if (item.manifestId) this.inMemoryDatasetManifests.set(item.manifestId, item);
      });
      return list;
    } catch (err) {
      this.logQuotaWarningThrottled('getDatasetManifests', err);
      return Array.from(this.inMemoryDatasetManifests.values());
    }
  }

  // --- Sequential Booking Decision persistence ---
  public async saveDecisionEpisode(episode: any): Promise<void> {
    if (!episode || !episode.episodeId) return;
    this.inMemoryDecisionEpisodes.set(episode.episodeId, episode);
    if (episode.originType === 'EXPERIMENTAL_BACKGROUND' && episode.currentEpisodeState === 'ACTIVE' && episode.canonicalId) {
      this.inMemoryActiveBackgroundEpisodes.set(episode.canonicalId, episode);
    }

    try {
      const docRef = doc(db, 'decision_episodes', episode.episodeId);
      await setDoc(docRef, sanitizeForFirestore(episode), { merge: true });
    } catch (err) {
      this.logQuotaWarningThrottled(`saveDecisionEpisode (${episode?.episodeId})`, err);
    }
  }

  public async getDecisionEpisode(episodeId: string): Promise<any | null> {
    if (this.inMemoryDecisionEpisodes.has(episodeId)) {
      return this.inMemoryDecisionEpisodes.get(episodeId);
    }
    try {
      const docRef = doc(db, 'decision_episodes', episodeId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        this.inMemoryDecisionEpisodes.set(episodeId, data);
        return data;
      }
      return null;
    } catch (err) {
      this.logQuotaWarningThrottled(`getDecisionEpisode (${episodeId})`, err);
      return this.inMemoryDecisionEpisodes.get(episodeId) || null;
    }
  }

  public async getActiveBackgroundEpisode(canonicalId: string): Promise<any | null> {
    // Check in-memory store first
    if (this.inMemoryActiveBackgroundEpisodes.has(canonicalId)) {
      return this.inMemoryActiveBackgroundEpisodes.get(canonicalId);
    }

    try {
      const colRef = collection(db, 'decision_episodes');
      const q = query(
        colRef,
        where('canonicalId', '==', canonicalId),
        where('originType', '==', 'EXPERIMENTAL_BACKGROUND'),
        where('currentEpisodeState', '==', 'ACTIVE')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        this.inMemoryActiveBackgroundEpisodes.set(canonicalId, data);
        return data;
      }
      return null;
    } catch (err) {
      this.logQuotaWarningThrottled(`getActiveBackgroundEpisode (${canonicalId})`, err);
      return this.inMemoryActiveBackgroundEpisodes.get(canonicalId) || null;
    }
  }

  public async saveRecommendationVersion(version: any): Promise<void> {
    if (!version || !version.versionId) return;
    this.inMemoryRecommendationVersions.set(version.versionId, version);

    try {
      const docRef = doc(db, 'recommendation_versions', version.versionId);
      await setDoc(docRef, sanitizeForFirestore(version), { merge: true });
    } catch (err) {
      this.logQuotaWarningThrottled(`saveRecommendationVersion (${version?.versionId})`, err);
    }
  }

  public async getRecommendationVersion(versionId: string): Promise<any | null> {
    if (this.inMemoryRecommendationVersions.has(versionId)) {
      return this.inMemoryRecommendationVersions.get(versionId);
    }
    try {
      const docRef = doc(db, 'recommendation_versions', versionId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        this.inMemoryRecommendationVersions.set(versionId, data);
        return data;
      }
      return null;
    } catch (err) {
      this.logQuotaWarningThrottled(`getRecommendationVersion (${versionId})`, err);
      return this.inMemoryRecommendationVersions.get(versionId) || null;
    }
  }

  public async saveStateTransitionObservation(observation: any): Promise<void> {
    try {
      const docRef = doc(db, 'state_transition_observations', observation.transitionObservationId);
      await setDoc(docRef, sanitizeForFirestore(observation), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save state transition observation ${observation?.transitionObservationId}:`, err);
    }
  }

  public async getStateTransitionObservations(episodeId?: string): Promise<any[]> {
    try {
      const colRef = collection(db, 'state_transition_observations');
      let q = query(colRef, orderBy('currentObservationTimestamp', 'asc'));
      if (episodeId) {
        q = query(colRef, where('episodeId', '==', episodeId), orderBy('currentObservationTimestamp', 'asc'));
      }
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } catch (err) {
      console.warn('[Firestore] Failed to get state transition observations:', err);
      return [];
    }
  }

  public async saveRecommendationTransition(transition: any): Promise<void> {
    try {
      const docRef = doc(db, 'recommendation_transitions', transition.transitionId);
      await setDoc(docRef, sanitizeForFirestore(transition), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save recommendation transition ${transition?.transitionId}:`, err);
    }
  }

  public async getRecommendationTransitions(episodeId?: string): Promise<any[]> {
    try {
      const colRef = collection(db, 'recommendation_transitions');
      let q = query(colRef, orderBy('timestamp', 'asc'));
      if (episodeId) {
        q = query(colRef, where('episodeId', '==', episodeId), orderBy('timestamp', 'asc'));
      }
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } catch (err) {
      console.warn('[Firestore] Failed to get recommendation transitions:', err);
      return [];
    }
  }

  public async saveOpportunityLabel(label: any): Promise<void> {
    try {
      const docRef = doc(db, 'opportunity_labels', label.labelId);
      await setDoc(docRef, sanitizeForFirestore(label), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save opportunity label ${label?.labelId}:`, err);
    }
  }

  public async getOpportunityLabel(labelId: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'opportunity_labels', labelId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Failed to get opportunity label:', err);
      return null;
    }
  }

  public async saveDownsideRecoveryLabel(label: any): Promise<void> {
    try {
      const docRef = doc(db, 'downside_recovery_labels', label.labelId);
      await setDoc(docRef, sanitizeForFirestore(label), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save downside recovery label ${label?.labelId}:`, err);
    }
  }

  public async getDownsideRecoveryLabel(labelId: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'downside_recovery_labels', labelId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Failed to get downside recovery label:', err);
      return null;
    }
  }

  public async saveMarketOutcome(outcome: any): Promise<void> {
    try {
      const docRef = doc(db, 'market_outcomes', outcome.marketOutcomeId);
      await setDoc(docRef, sanitizeForFirestore(outcome), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save market outcome ${outcome?.marketOutcomeId}:`, err);
    }
  }

  public async getMarketOutcome(marketOutcomeId: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'market_outcomes', marketOutcomeId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Failed to get market outcome:', err);
      return null;
    }
  }

  public async savePolicyOutcome(outcome: any): Promise<void> {
    try {
      const docRef = doc(db, 'policy_outcomes', outcome.policyOutcomeId);
      await setDoc(docRef, sanitizeForFirestore(outcome), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save policy outcome ${outcome?.policyOutcomeId}:`, err);
    }
  }

  public async getPolicyOutcome(policyOutcomeId: string): Promise<any | null> {
    try {
      const docRef = doc(db, 'policy_outcomes', policyOutcomeId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Firestore] Failed to get policy outcome:', err);
      return null;
    }
  }

  public async saveNotificationCandidate(candidate: any): Promise<void> {
    try {
      const docRef = doc(db, 'shadow_notifications', candidate.candidateId);
      await setDoc(docRef, sanitizeForFirestore(candidate), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save notification candidate ${candidate?.candidateId}:`, err);
    }
  }

  public async getNotificationCandidates(): Promise<any[]> {
    try {
      const colRef = collection(db, 'shadow_notifications');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } catch (err) {
      console.warn('[Firestore] Failed to get notification candidates:', err);
      return [];
    }
  }

  public async saveTaskReadinessReport(report: any): Promise<void> {
    try {
      const docRef = doc(db, 'task_readiness_reports', report.taskName);
      await setDoc(docRef, sanitizeForFirestore(report), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save readiness report ${report?.taskName}:`, err);
    }
  }

  public async getTaskReadinessReports(): Promise<any[]> {
    try {
      const colRef = collection(db, 'task_readiness_reports');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } catch (err) {
      console.warn('[Firestore] Failed to get readiness reports:', err);
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

  // --- Collection Attempts ---
  public async saveCollectionAttempt(attempt: any): Promise<void> {
    try {
      const docRef = doc(db, 'collection_attempts', attempt.attemptId);
      await setDoc(docRef, sanitizeForFirestore(attempt), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save collection attempt ${attempt?.attemptId}:`, err);
    }
  }

  // --- Experimental Provider Observations ---
  public async saveExperimentalObservation(obs: any): Promise<void> {
    try {
      const docRef = doc(db, 'experimental_provider_observations', obs.id);
      await setDoc(docRef, sanitizeForFirestore(obs), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save experimental observation ${obs?.id}:`, err);
    }
  }

  // --- Provider Comparisons ---
  public async saveProviderComparison(comp: any): Promise<void> {
    try {
      const docRef = doc(db, 'provider_comparisons', comp.comparisonId);
      await setDoc(docRef, sanitizeForFirestore(comp), { merge: true });
    } catch (err) {
      console.warn(`[Firestore] Failed to save provider comparison ${comp?.comparisonId}:`, err);
    }
  }
}

export const firestoreDB = new FirestorePersistenceService();
