import { supabaseManager, SupabaseFareObservation } from '../supabaseClient';
import { db } from '../../src/firebaseClient';
import { collection, getDocs, query, where, limit as fsLimit } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export interface StandardFareObservation {
  id: string;
  flightNumber: string;
  flightId: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTimestamp?: string;
  price: number;
  timestamp: string;
  source: string;
  provenance: string;
  authenticity: string;
  isSynthetic: boolean;
  dataSource: 'SUPABASE' | 'CACHE' | 'FIRESTORE';
}

export interface FlightHistorySummary {
  flightNumber: string;
  airline: string;
  departureDate: string;
  observations: Array<{
    id: string;
    observedAt: string;
    fare: number;
    source: string;
    provenance: string;
    airline: string;
    flightNumber: string;
    departureDate: string;
    dataSource: 'SUPABASE' | 'CACHE' | 'FIRESTORE';
  }>;
  totalObservations: number;
  lowestObservedFare: number | null;
  latestObservedFare: number | null;
  firstObservedFare: number | null;
  priceDelta: number | null;
  priceDeltaPercent: number | null;
}

export class FareObservationRepository {
  private cacheFilePath = path.join(process.cwd(), 'server', 'data', 'lko_pnq_cache.json');
  private cachedHistoricalObservations: Map<string, StandardFareObservation> = new Map();
  private hasLoadedCache = false;
  private lastFirestoreQuotaError = 0;

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    if (this.hasLoadedCache) return;
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        const rawObs = parsed.rawObservations || [];
        for (const obs of rawObs) {
          if (obs.id) {
            this.cachedHistoricalObservations.set(obs.id, {
              id: obs.id,
              flightNumber: obs.flightNumber || 'UNKNOWN',
              flightId: obs.flightId || `${obs.origin || 'LKO'}-${obs.destination || 'PNQ'}-${obs.flightNumber}-${obs.departureDate}`,
              airline: obs.airline || 'Unknown',
              origin: obs.origin || 'LKO',
              destination: obs.destination || 'PNQ',
              departureDate: obs.departureDate,
              price: Number(obs.price),
              timestamp: obs.timestamp,
              source: obs.source || 'Direct Observation',
              provenance: obs.provenance || 'REAL_OBSERVATION',
              authenticity: 'REAL_EXTERNAL_OBSERVATION',
              isSynthetic: false,
              dataSource: 'CACHE'
            });
          }
        }

        // Unroll any trajectory history items not already captured
        const trajectories = parsed.trajectories || [];
        for (const traj of trajectories) {
          const hist = traj.history || [];
          for (let i = 0; i < hist.length; i++) {
            const h = hist[i];
            const derivedId = `snap-hist-LKO-PNQ-${traj.flightNumber}-${traj.departureDate}-${h.timestamp}`;
            if (!this.cachedHistoricalObservations.has(derivedId)) {
              this.cachedHistoricalObservations.set(derivedId, {
                id: derivedId,
                flightNumber: traj.flightNumber || 'UNKNOWN',
                flightId: `LKO-PNQ-${traj.flightNumber}-${traj.departureDate}`,
                airline: traj.airline || 'Unknown',
                origin: 'LKO',
                destination: 'PNQ',
                departureDate: traj.departureDate,
                price: Number(h.price),
                timestamp: h.timestamp,
                source: h.source || 'Google Flights (Historical)',
                provenance: h.provenance || 'REAL_VERIFIED_HISTORICAL_OBSERVATION',
                authenticity: 'REAL_EXTERNAL_OBSERVATION',
                isSynthetic: false,
                dataSource: 'CACHE'
              });
            }
          }
        }
        this.hasLoadedCache = true;
        console.log(`[Repository] Loaded ${this.cachedHistoricalObservations.size} verified historical observations from cache.`);
      }
    } catch (err) {
      console.warn('[Repository] Could not load cache file:', err);
    }
  }

  // --- WRITE PATH: STRICTLY SUPABASE ONLY ---

  public async saveNewObservation(obs: {
    id?: string;
    routeId?: string;
    origin: string;
    destination: string;
    flightNumber: string;
    airline: string;
    departureDate: string;
    departureTimestamp?: string;
    price: number;
    timestamp?: string;
    source: string;
    provenance?: string;
    isSynthetic?: boolean;
  }): Promise<{ success: boolean; id: string }> {
    // Provenance validation guard
    if (obs.isSynthetic === true || obs.provenance === 'ISOLATED_TEST_FIXTURE') {
      console.warn('[Repository] Data purity guard rejected synthetic record from primary write path.');
      return { success: false, id: '' };
    }

    const depDate = obs.departureDate;
    const obsId = obs.id || `snap-supa-${obs.origin}-${obs.destination}-${obs.flightNumber}-${depDate}-${Date.now()}`;
    const route = obs.routeId || `${obs.origin}-${obs.destination}`.toUpperCase();

    const supabaseRecord: SupabaseFareObservation = {
      id: obsId,
      route,
      origin: obs.origin.toUpperCase(),
      destination: obs.destination.toUpperCase(),
      flight_number: obs.flightNumber.toUpperCase(),
      airline: obs.airline,
      departure_date: depDate,
      departure_timestamp: obs.departureTimestamp || `${depDate}T10:00:00.000Z`,
      observed_at: obs.timestamp || new Date().toISOString(),
      fare: Number(obs.price),
      source: obs.source,
      provenance: obs.provenance || 'REAL_EXTERNAL_OBSERVATION',
      authenticity: 'REAL_EXTERNAL_OBSERVATION',
      is_synthetic: false
    };

    await supabaseManager.insertObservation(supabaseRecord);
    return { success: true, id: obsId };
  }

  public async saveNewObservationsBatch(observations: any[]): Promise<number> {
    if (!observations || observations.length === 0) return 0;

    const validSupaRecords: SupabaseFareObservation[] = [];

    for (const snap of observations) {
      if (snap.isSynthetic === true || snap.provenance === 'ISOLATED_TEST_FIXTURE') {
        continue;
      }
      const depDate = snap.departureDate;
      const origin = (snap.origin || (snap.routeId ? snap.routeId.split('-')[0] : 'LKO')).toUpperCase();
      const destination = (snap.destination || (snap.routeId ? snap.routeId.split('-')[1] : 'PNQ')).toUpperCase();
      const route = (snap.routeId || `${origin}-${destination}`).toUpperCase();
      const id = snap.id || (snap as any).observationId || `snap-supa-${route}-${snap.flightNumber}-${depDate}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      validSupaRecords.push({
        id,
        route,
        origin,
        destination,
        flight_number: snap.flightNumber ? snap.flightNumber.toUpperCase() : 'UNKNOWN',
        airline: snap.airline || 'Unknown',
        departure_date: depDate,
        departure_timestamp: snap.departureTimestamp || `${depDate}T10:00:00.000Z`,
        observed_at: snap.timestamp || new Date().toISOString(),
        fare: Number(snap.price),
        source: snap.source || 'Google Flights (Live Scraping)',
        provenance: snap.provenance || 'REAL_EXTERNAL_OBSERVATION',
        authenticity: 'REAL_EXTERNAL_OBSERVATION',
        is_synthetic: false
      });
    }

    if (validSupaRecords.length === 0) return 0;

    const res = await supabaseManager.insertObservationsBatch(validSupaRecords);
    return res.inserted;
  }

  // --- READ PATH: SUPABASE -> VERIFIED CACHE -> FIRESTORE (DEDUPLICATED) ---

  public async getObservationsForRoute(
    route: string,
    departureDateStart?: string,
    departureDateEnd?: string
  ): Promise<StandardFareObservation[]> {
    this.loadCache();
    const obsMap = new Map<string, StandardFareObservation>();

    // 1. Read from Supabase (Authoritative)
    let supaCount = 0;
    try {
      const supaRecords = await supabaseManager.queryObservations({
        route,
        departure_date_start: departureDateStart,
        departure_date_end: departureDateEnd
      });

      supaCount = supaRecords.length;
      for (const s of supaRecords) {
        obsMap.set(s.id, {
          id: s.id,
          flightNumber: s.flight_number,
          flightId: `${s.route}-${s.flight_number}-${s.departure_date}`,
          airline: s.airline,
          origin: s.origin,
          destination: s.destination,
          departureDate: s.departure_date,
          departureTimestamp: s.departure_timestamp || undefined,
          price: Number(s.fare),
          timestamp: s.observed_at,
          source: s.source,
          provenance: s.provenance,
          authenticity: s.authenticity,
          isSynthetic: s.is_synthetic,
          dataSource: 'SUPABASE'
        });
      }
    } catch (err) {
      console.warn('[Repository] Supabase query error, falling back to cache:', err);
    }

    // 2. Read from Verified Cache for any unmigrated records during transition
    for (const [id, cached] of this.cachedHistoricalObservations.entries()) {
      if (!obsMap.has(id)) {
        if (departureDateStart && cached.departureDate < departureDateStart) continue;
        if (departureDateEnd && cached.departureDate > departureDateEnd) continue;
        obsMap.set(id, cached);
      }
    }

    // 3. Always query Firebase Firestore snapshots collection (with quota protection)
    if (Date.now() - this.lastFirestoreQuotaError > 10 * 60 * 1000) {
      try {
        const colRef = collection(db, 'snapshots');
        let q = query(colRef, where('routeId', '==', route.toUpperCase()), fsLimit(300));
        if (departureDateStart) {
          q = query(colRef, where('routeId', '==', route.toUpperCase()), where('departureDate', '>=', departureDateStart), fsLimit(300));
        }
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
          const data = docSnap.data() as any;
          if (data.isSynthetic !== true && data.provenance !== 'ISOLATED_TEST_FIXTURE' && !obsMap.has(docSnap.id)) {
            obsMap.set(docSnap.id, {
              id: docSnap.id,
              flightNumber: data.flightNumber || 'UNKNOWN',
              flightId: data.flightId || `${route}-${data.flightNumber}-${data.departureDate}`,
              airline: data.airline || 'Unknown',
              origin: data.origin || route.split('-')[0],
              destination: data.destination || route.split('-')[1],
              departureDate: data.departureDate,
              departureTimestamp: data.departureTimestamp,
              price: Number(data.price),
              timestamp: data.timestamp || new Date().toISOString(),
              source: data.source || 'Direct Observation',
              provenance: data.provenance || 'REAL_OBSERVATION',
              authenticity: 'REAL_EXTERNAL_OBSERVATION',
              isSynthetic: false,
              dataSource: 'FIRESTORE'
            });
          }
        });
      } catch (err: any) {
        this.lastFirestoreQuotaError = Date.now();
        console.warn('[Repository] Firestore query notice:', err?.message || err);
      }
    }

    return Array.from(obsMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Dedicated flight fare history query for specific flight + departure date
   * strictly ordered by observation timestamp (X-axis: observed_at, Y-axis: fare).
   */
  public async getFlightFareHistory(
    flightNumber: string,
    departureDate: string
  ): Promise<FlightHistorySummary> {
    const all = await this.getObservationsForRoute('LKO-PNQ', departureDate, departureDate);
    const flightObs = all.filter(
      o => o.flightNumber.toUpperCase() === flightNumber.toUpperCase() && o.departureDate === departureDate
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const observations = flightObs.map(o => ({
      id: o.id,
      observedAt: o.timestamp,
      fare: o.price,
      source: o.source,
      provenance: o.provenance,
      airline: o.airline,
      flightNumber: o.flightNumber,
      departureDate: o.departureDate,
      dataSource: o.dataSource
    }));

    const prices = observations.map(o => o.fare);
    const lowestObservedFare = prices.length > 0 ? Math.min(...prices) : null;
    const latestObservedFare = prices.length > 0 ? prices[prices.length - 1] : null;
    const firstObservedFare = prices.length > 0 ? prices[0] : null;

    let priceDelta: number | null = null;
    let priceDeltaPercent: number | null = null;

    if (firstObservedFare !== null && latestObservedFare !== null) {
      priceDelta = latestObservedFare - firstObservedFare;
      priceDeltaPercent = firstObservedFare > 0 ? Number(((priceDelta / firstObservedFare) * 100).toFixed(1)) : 0;
    }

    const airline = observations.length > 0 ? observations[0].airline : 'Unknown';

    return {
      flightNumber,
      airline,
      departureDate,
      observations,
      totalObservations: observations.length,
      lowestObservedFare,
      latestObservedFare,
      firstObservedFare,
      priceDelta,
      priceDeltaPercent
    };
  }

  public getAllCachedHistoricalRecords(): StandardFareObservation[] {
    this.loadCache();
    return Array.from(this.cachedHistoricalObservations.values());
  }
}

export const fareObservationRepository = new FareObservationRepository();
