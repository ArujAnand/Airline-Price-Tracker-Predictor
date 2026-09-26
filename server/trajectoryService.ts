/**
 * Real Longitudinal Trajectory Service
 * 
 * Reconstructs chronological price series for individual flight instances.
 * Computes point-in-time features strictly from historical data available at prediction time (t <= t_pred).
 */

import {
  LongitudinalObservation,
  FlightTrajectorySeries,
  FactualContextFeatures,
  DataProvenance
} from './types/mlPipeline';
import { parseCanonicalFlightId, detectScheduleDrift, buildCanonicalFlightKey } from './flightIdentity';
import { getFactualNearbyEvents } from './festivals';

export class LongitudinalTrajectoryService {
  /**
   * Normalizes any raw snapshot (from Firestore or memory) into a strict LongitudinalObservation
   */
  public normalizeRawSnapshot(raw: any): LongitudinalObservation {
    const origin = (raw.origin || 'PNQ').toUpperCase();
    const destination = (raw.destination || 'LKO').toUpperCase();
    const flightNum = raw.flightNumber || '6E-656';
    const departureDate = raw.departureDate || new Date().toISOString().split('T')[0];

    const key = buildCanonicalFlightKey(origin, destination, flightNum, departureDate, raw.airlineCode);
    const observedAt = raw.timestamp || raw.observedAt || new Date().toISOString();
    const scheduledTime = raw.departureTime || '10:00';

    // Calculate exact lead time at observation moment
    const depDateTime = new Date(`${departureDate}T${scheduledTime}:00+05:30`);
    const obsDateTime = new Date(observedAt);
    const diffMs = depDateTime.getTime() - obsDateTime.getTime();
    const leadTimeHours = Math.max(0, diffMs / (1000 * 60 * 60));
    const leadTimeDays = leadTimeHours / 24.0;

    const drift = detectScheduleDrift(raw.scheduledDepartureTime || scheduledTime, scheduledTime);

    const isSyntheticSource = 
      raw.source?.includes('Yield') || 
      raw.source?.includes('Collector') || 
      raw.source?.includes('Calibrator') || 
      raw.source?.includes('fallback') || 
      raw.source?.includes('synthetic') || 
      raw.source?.includes('simulation') ||
      raw.purityClassification === 'POTENTIALLY_NON_REAL';

    // Enforce typed provenance as primary scientific guard; legacy fallback only when provenance is undefined
    let provenance: SnapshotProvenance;
    if (raw.provenance) {
      provenance = raw.provenance;
    } else if (isSyntheticSource) {
      provenance = 'CONFIRMED_NON_REAL';
    } else if (raw.source === 'Google Flights Live Aggregator Scraper') {
      provenance = 'UNKNOWN_PROVENANCE';
    } else if (raw.source === 'SerpApi (Google Flights)') {
      provenance = 'REAL_EXTERNAL_OBSERVATION';
    } else {
      provenance = 'UNKNOWN_PROVENANCE';
    }

    return {
      observationId: raw.id || `obs-${new Date(observedAt).getTime()}-${key.canonicalId}`,
      canonicalId: key.canonicalId,
      routeId: `${origin}-${destination}`,
      origin,
      destination,
      carrierCode: key.carrierCode,
      flightNumber: key.flightNumber,
      departureDate,
      scheduledDepartureTime: scheduledTime,
      observedAt,
      leadTimeHours: Number(leadTimeHours.toFixed(2)),
      leadTimeDays: Number(leadTimeDays.toFixed(2)),
      priceINR: Math.round(Number(raw.currentPrice || raw.price || raw.priceINR || 5000)),
      currency: 'INR',
      isScheduleChanged: drift.isScheduleChanged,
      scheduleDriftMinutes: drift.scheduleDriftMinutes,
      isIdentityInferred: raw.isIdentityInferred === true,
      provenance,
      source: raw.source?.includes('SerpApi') ? 'GOOGLE_FLIGHTS_SCRAPER' : (raw.source || 'PERSISTED_FIRESTORE')
    };
  }

  /**
   * Builds longitudinal trajectory series for a set of raw snapshots
   * Filters by provenance if requested, groups by canonical flight ID, and sorts chronologically
   */
  public buildTrajectorySeries(rawSnapshots: any[], allowTestFixtures = false): Map<string, FlightTrajectorySeries> {
    const trajectories = new Map<string, FlightTrajectorySeries>();

    for (const raw of rawSnapshots) {
      const obs = this.normalizeRawSnapshot(raw);
      if (obs.provenance === 'ISOLATED_TEST_FIXTURE') {
        if (!allowTestFixtures) {
          continue; // Strictly exclude test fixtures from production trajectories
        }
      } else if (!isEmpiricallyEligibleObservation(obs)) {
        continue; // Strictly quarantine non-real, experimental, and unverified observations!
      }
      
      let series = trajectories.get(obs.canonicalId);
      if (!series) {
        series = {
          canonicalId: obs.canonicalId,
          origin: obs.origin,
          destination: obs.destination,
          carrierCode: obs.carrierCode,
          flightNumber: obs.flightNumber,
          departureDate: obs.departureDate,
          firstObservedAt: obs.observedAt,
          lastObservedAt: obs.observedAt,
          observationCount: 0,
          minObservedPriceINR: obs.priceINR,
          maxObservedPriceINR: obs.priceINR,
          observations: []
        };
        trajectories.set(obs.canonicalId, series);
      }

      series.observations.push(obs);
    }

    // Sort observations chronologically and recompute bounds
    for (const [id, series] of trajectories.entries()) {
      series.observations.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
      series.firstObservedAt = series.observations[0].observedAt;
      series.lastObservedAt = series.observations[series.observations.length - 1].observedAt;
      series.observationCount = series.observations.length;
      series.minObservedPriceINR = Math.min(...series.observations.map(o => o.priceINR));
      series.maxObservedPriceINR = Math.max(...series.observations.map(o => o.priceINR));
    }

    return trajectories;
  }

  /**
   * Constructs point-in-time features strictly using observations where observedAt <= predictionTimestamp
   * GUARANTEE: Zero future data leakage
   */
  public extractPointInTimeFeatures(
    canonicalId: string,
    predictionTimestamp: string,
    currentSpotPrice: number,
    allPriorSnapshots: LongitudinalObservation[]
  ): FactualContextFeatures {
    const parsedKey = parseCanonicalFlightId(canonicalId);
    const origin = parsedKey?.origin || 'PNQ';
    const destination = parsedKey?.destination || 'LKO';
    const departureDate = parsedKey?.departureDate || '2026-10-18';
    const carrierCode = parsedKey?.carrierCode || '6E';
    const flightNumber = parsedKey?.flightNumber || '6E-656';

    const predTime = new Date(predictionTimestamp).getTime();

    // 1. Strict point-in-time filtering (<= predTime)
    const priorForFlight = allPriorSnapshots
      .filter(s => s.canonicalId === canonicalId && new Date(s.observedAt).getTime() <= predTime)
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    // 2. Trajectory length and timeline
    const trajectoryLength = priorForFlight.length;
    let hoursSinceFirstObs: number | null = null;
    let delta12h: number | null = null;
    let delta24h: number | null = null;

    if (trajectoryLength > 0) {
      const firstObsTime = new Date(priorForFlight[0].observedAt).getTime();
      hoursSinceFirstObs = Math.max(0, (predTime - firstObsTime) / (1000 * 60 * 60));

      // Trailing 12h price delta
      const obs12hAgo = priorForFlight.filter(s => predTime - new Date(s.observedAt).getTime() <= 12 * 3600 * 1000);
      if (obs12hAgo.length >= 2) {
        delta12h = currentSpotPrice - obs12hAgo[0].priceINR;
      }

      // Trailing 24h price delta
      const obs24hAgo = priorForFlight.filter(s => predTime - new Date(s.observedAt).getTime() <= 24 * 3600 * 1000);
      if (obs24hAgo.length >= 2) {
        delta24h = currentSpotPrice - obs24hAgo[0].priceINR;
      }
    }

    // 3. Trailing Corridor 24h Median (Same route, past 24h, t <= predTime)
    const routeId = `${origin}-${destination}`;
    const corridorRecentObs = allPriorSnapshots.filter(s => 
      s.routeId === routeId &&
      new Date(s.observedAt).getTime() <= predTime &&
      predTime - new Date(s.observedAt).getTime() <= 24 * 3600 * 1000
    );

    let corridorMedian: number | null = null;
    if (corridorRecentObs.length > 0) {
      const sortedPrices = corridorRecentObs.map(s => s.priceINR).sort((a, b) => a - b);
      corridorMedian = sortedPrices[Math.floor(sortedPrices.length / 2)];
    }

    // 4. Calendar, Day, and Hours context
    const depDateObj = new Date(`${departureDate}T10:00:00+05:30`);
    const dayOfWeek = depDateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isSat = dayOfWeek === 6;
    const isSun = dayOfWeek === 0;

    const diffHours = (depDateObj.getTime() - predTime) / (1000 * 60 * 60);
    const leadTimeHours = Math.max(0, diffHours);
    const leadTimeDays = leadTimeHours / 24.0;

    // 5. Factual Coexisting Calendar Events (Multiple events within ±45 days, zero multipliers)
    const nearbyEvents = getFactualNearbyEvents(departureDate);
    const isPublicHoliday = nearbyEvents.some(e => e.daysFromDeparture === 0 && e.eventType === 'GAZETTED_PUBLIC_HOLIDAY');

    return {
      leadTimeHours: Number(leadTimeHours.toFixed(2)),
      leadTimeDays: Number(leadTimeDays.toFixed(2)),
      departureDayOfWeek: dayOfWeek,
      departureHourOfDay: 10,
      departureMinuteOfHour: 0,
      isSaturday: isSat,
      isSunday: isSun,
      isPublicHoliday,
      nearbyEvents,
      carrierCode,
      flightNumber,
      scheduledStops: 0,
      scheduledDepartureTimeIST: '10:00',
      currentSpotFareINR: currentSpotPrice,
      observedTrajectoryLength: trajectoryLength,
      hoursSinceFirstObservation: hoursSinceFirstObs !== null ? Number(hoursSinceFirstObs.toFixed(1)) : null,
      trailing12hPriceDeltaINR: delta12h,
      trailing24hPriceDeltaINR: delta24h,
      trailingCorridorMedianFareINR: corridorMedian
    };
  }
}

export const trajectoryService = new LongitudinalTrajectoryService();

export type SnapshotProvenance =
  | 'REAL_EXTERNAL_OBSERVATION'          // Genuine live scraped/API observations from production
  | 'REAL_VERIFIED_HISTORICAL_OBSERVATION' // Verified audited real historical snapshots
  | 'EXPERIMENTAL_EXTERNAL_OBSERVATION'    // Raw parallel experimental observations (Fli sidecar)
  | 'UNKNOWN_PROVENANCE'                 // Unverified snapshots with ambiguous harvest paths
  | 'CONFIRMED_NON_REAL'                 // Artificially generated/calculated yield fallback prices
  | 'ISOLATED_TEST_FIXTURE'              // Isolated test snapshots (Strictly prohibited from live pipelines/training)
  | 'CONFIRMED_TEST_ARTIFACT'            // Test generated artifact in storage (Strictly prohibited from live pipelines/training)
  | 'REAL_OBSERVATION';                  // Legacy real observations (for backwards compatibility)

export function isEmpiricallyEligibleObservation(snapshot: any): boolean {
  if (!snapshot) return false;
  const provenance = snapshot.provenance;
  // Explicitly reject non-empirical categories
  if (
    !provenance ||
    provenance === 'ISOLATED_TEST_FIXTURE' ||
    provenance === 'CONFIRMED_TEST_ARTIFACT' ||
    provenance === 'CONFIRMED_NON_REAL' ||
    provenance === 'UNKNOWN_PROVENANCE' ||
    provenance === 'EXPERIMENTAL_EXTERNAL_OBSERVATION' ||
    provenance === 'EXPERIMENTAL'
  ) {
    return false;
  }
  return provenance === 'REAL_EXTERNAL_OBSERVATION' || 
         provenance === 'REAL_VERIFIED_HISTORICAL_OBSERVATION' ||
         provenance === 'REAL_OBSERVATION';
}

