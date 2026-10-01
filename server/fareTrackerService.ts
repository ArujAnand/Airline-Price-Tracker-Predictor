import { db } from '../src/firebaseClient';
import { collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

export interface AuthenticFareObservation {
  id: string;
  flightNumber: string;
  flightId: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  price: number;
  timestamp: string;
  source: string;
  provenance: string;
  type?: string;
  capturedHour?: number;
}

export interface FlightFareTrajectory {
  flightNumber: string;
  airline: string;
  departureDate: string;
  observationsCount: number;
  firstPrice: number;
  lastPrice: number;
  minPrice: number;
  maxPrice: number;
  priceDelta: number; // lastPrice - firstPrice
  priceDeltaPercent: number;
  firstObservedAt: string;
  lastObservedAt: string;
  history: Array<{
    timestamp: string;
    price: number;
    source: string;
    provenance: string;
  }>;
}

export interface LkoPnqTrendSummary {
  route: string;
  departureDateWindow: {
    start: string;
    end: string;
  };
  totalAuthenticObservations: number;
  uniqueDepartureDates: string[];
  uniqueFlights: string[];
  airlines: Array<{
    name: string;
    count: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
  }>;
  overallMinFare: {
    price: number;
    flightNumber: string;
    departureDate: string;
    observedAt: string;
    airline: string;
  };
  overallMaxFare: {
    price: number;
    flightNumber: string;
    departureDate: string;
    observedAt: string;
    airline: string;
  };
  earliestObservationTimestamp: string;
  latestObservationTimestamp: string;
  dateBreakdown: Array<{
    date: string;
    observationCount: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    flightCount: number;
  }>;
  trajectories: FlightFareTrajectory[];
  rawObservations: AuthenticFareObservation[];
}

class LkoPnqFareTrackerService {
  private cachedData: LkoPnqTrendSummary | null = null;
  private cacheExpiryMs = 0;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
  private cacheFilePath = path.join(process.cwd(), 'server', 'data', 'lko_pnq_cache.json');

  constructor() {
    this.cachedData = this.loadDiskCache();
  }

  private loadDiskCache(): LkoPnqTrendSummary | null {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(raw) as LkoPnqTrendSummary;
        console.log(`[FareTracker] Loaded authentic LKO-PNQ cache from disk (${parsed.totalAuthenticObservations} observations).`);
        return parsed;
      }
    } catch (err) {
      console.warn('[FareTracker] Could not load disk cache:', err);
    }
    return null;
  }

  private saveDiskCache(data: LkoPnqTrendSummary): void {
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[FareTracker] Persisted authentic LKO-PNQ cache to disk (${data.totalAuthenticObservations} observations).`);
    } catch (err) {
      console.warn('[FareTracker] Could not write disk cache:', err);
    }
  }

  /**
   * Fetches only authentic observations for LKO -> PNQ in the 9 Nov - 23 Nov 2026 window
   */
  public async getTrendData(forceRefresh = false): Promise<LkoPnqTrendSummary> {
    const now = Date.now();
    if (!forceRefresh && this.cachedData && now < this.cacheExpiryMs) {
      return this.cachedData;
    }

    try {
      const colRef = collection(db, 'snapshots');
      const q = query(
        colRef,
        where('routeId', '==', 'LKO-PNQ'),
        where('departureDate', '>=', '2026-11-09'),
        where('departureDate', '<=', '2026-11-23')
      );

      const snapshot = await getDocs(q);
      const rawObs: AuthenticFareObservation[] = [];

      const allowedProvenances = new Set([
        'REAL_EXTERNAL_OBSERVATION',
        'REAL_VERIFIED_HISTORICAL_OBSERVATION',
        'REAL_OBSERVATION',
        undefined
      ]);

      const forbiddenSources = new Set(['SYNTHETIC_FIXTURE', 'MOCK_GENERATOR', 'HISTORICAL_ESTIMATOR']);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        // Strict purity check: reject synthetic
        if (data.isSynthetic === true || data.provenance === 'ISOLATED_TEST_FIXTURE' || forbiddenSources.has(data.source)) {
          return;
        }
        if (!allowedProvenances.has(data.provenance) && data.provenance !== undefined) {
          return;
        }

        rawObs.push({
          id: docSnap.id,
          flightNumber: data.flightNumber || 'UNKNOWN',
          flightId: data.flightId || `${data.routeId}-${data.flightNumber}-${data.departureDate}`,
          airline: data.airline || 'Unknown',
          origin: data.origin || 'LKO',
          destination: data.destination || 'PNQ',
          departureDate: data.departureDate,
          price: Number(data.price),
          timestamp: data.timestamp || new Date().toISOString(),
          source: data.source || 'Direct Observation',
          provenance: data.provenance || 'REAL_OBSERVATION',
          type: data.type,
          capturedHour: data.capturedHour
        });
      });

      // Chronological sort by observation timestamp
      rawObs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Compute trajectory by canonical flight instance (flightNumber + departureDate)
      const trajectoryMap = new Map<string, FlightFareTrajectory>();

      for (const obs of rawObs) {
        const key = `${obs.flightNumber}_${obs.departureDate}`;
        if (!trajectoryMap.has(key)) {
          trajectoryMap.set(key, {
            flightNumber: obs.flightNumber,
            airline: obs.airline,
            departureDate: obs.departureDate,
            observationsCount: 0,
            firstPrice: obs.price,
            lastPrice: obs.price,
            minPrice: obs.price,
            maxPrice: obs.price,
            priceDelta: 0,
            priceDeltaPercent: 0,
            firstObservedAt: obs.timestamp,
            lastObservedAt: obs.timestamp,
            history: []
          });
        }

        const traj = trajectoryMap.get(key)!;
        traj.observationsCount++;
        traj.lastPrice = obs.price;
        traj.lastObservedAt = obs.timestamp;
        if (obs.price < traj.minPrice) traj.minPrice = obs.price;
        if (obs.price > traj.maxPrice) traj.maxPrice = obs.price;
        traj.priceDelta = traj.lastPrice - traj.firstPrice;
        traj.priceDeltaPercent = traj.firstPrice > 0 ? ((traj.priceDelta / traj.firstPrice) * 100) : 0;
        traj.history.push({
          timestamp: obs.timestamp,
          price: obs.price,
          source: obs.source,
          provenance: obs.provenance
        });
      }

      const trajectories = Array.from(trajectoryMap.values()).sort((a, b) => {
        if (a.departureDate !== b.departureDate) {
          return a.departureDate.localeCompare(b.departureDate);
        }
        return a.minPrice - b.minPrice;
      });

      // Compute aggregations
      let overallMinPrice = Infinity;
      let overallMaxPrice = -Infinity;
      let minFareItem: any = null;
      let maxFareItem: any = null;

      const dateStatsMap = new Map<string, { count: number; prices: number[]; flights: Set<string> }>();
      const airlineStatsMap = new Map<string, { count: number; prices: number[] }>();

      for (const obs of rawObs) {
        if (obs.price < overallMinPrice) {
          overallMinPrice = obs.price;
          minFareItem = {
            price: obs.price,
            flightNumber: obs.flightNumber,
            departureDate: obs.departureDate,
            observedAt: obs.timestamp,
            airline: obs.airline
          };
        }
        if (obs.price > overallMaxPrice) {
          overallMaxPrice = obs.price;
          maxFareItem = {
            price: obs.price,
            flightNumber: obs.flightNumber,
            departureDate: obs.departureDate,
            observedAt: obs.timestamp,
            airline: obs.airline
          };
        }

        // Date stats
        if (!dateStatsMap.has(obs.departureDate)) {
          dateStatsMap.set(obs.departureDate, { count: 0, prices: [], flights: new Set() });
        }
        const dStat = dateStatsMap.get(obs.departureDate)!;
        dStat.count++;
        dStat.prices.push(obs.price);
        dStat.flights.add(obs.flightNumber);

        // Airline stats
        if (!airlineStatsMap.has(obs.airline)) {
          airlineStatsMap.set(obs.airline, { count: 0, prices: [] });
        }
        const aStat = airlineStatsMap.get(obs.airline)!;
        aStat.count++;
        aStat.prices.push(obs.price);
      }

      const dateBreakdown = Array.from(dateStatsMap.entries())
        .map(([date, stat]) => ({
          date,
          observationCount: stat.count,
          minPrice: Math.min(...stat.prices),
          maxPrice: Math.max(...stat.prices),
          avgPrice: Math.round(stat.prices.reduce((acc, p) => acc + p, 0) / stat.prices.length),
          flightCount: stat.flights.size
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const airlines = Array.from(airlineStatsMap.entries())
        .map(([name, stat]) => ({
          name,
          count: stat.count,
          minPrice: Math.min(...stat.prices),
          maxPrice: Math.max(...stat.prices),
          avgPrice: Math.round(stat.prices.reduce((acc, p) => acc + p, 0) / stat.prices.length)
        }))
        .sort((a, b) => b.count - a.count);

      const uniqueDepartureDates = dateBreakdown.map((d) => d.date);
      const uniqueFlights = Array.from(new Set(rawObs.map((o) => o.flightNumber))).sort();

      const summary: LkoPnqTrendSummary = {
        route: 'LKO-PNQ (Lucknow to Pune)',
        departureDateWindow: {
          start: '2026-11-09',
          end: '2026-11-23'
        },
        totalAuthenticObservations: rawObs.length,
        uniqueDepartureDates,
        uniqueFlights,
        airlines,
        overallMinFare: minFareItem || { price: 0, flightNumber: '', departureDate: '', observedAt: '', airline: '' },
        overallMaxFare: maxFareItem || { price: 0, flightNumber: '', departureDate: '', observedAt: '', airline: '' },
        earliestObservationTimestamp: rawObs.length > 0 ? rawObs[0].timestamp : '',
        latestObservationTimestamp: rawObs.length > 0 ? rawObs[rawObs.length - 1].timestamp : '',
        dateBreakdown,
        trajectories,
        rawObservations: rawObs
      };

      this.cachedData = summary;
      this.cacheExpiryMs = now + this.CACHE_TTL_MS;
      this.saveDiskCache(summary);
      return summary;
    } catch (err: any) {
      console.warn('[FareTracker] Firestore read failed, checking disk cache fallback:', err?.message);
      if (this.cachedData) {
        return this.cachedData;
      }
      const disk = this.loadDiskCache();
      if (disk) {
        this.cachedData = disk;
        return disk;
      }
      throw err;
    }
  }
}

export const lkoPnqFareTrackerService = new LkoPnqFareTrackerService();
