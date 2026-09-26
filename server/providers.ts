import { getLiveGoogleFlights } from './googleFlightsScraper';
import { Flight } from '../src/types';

export interface ProviderFetchResult {
  status:
    | 'SUCCESS'
    | 'EMPTY_CONFIRMED'
    | 'FAILED_TIMEOUT'
    | 'FAILED_RATE_LIMIT'
    | 'FAILED_BLOCKED'
    | 'FAILED_PROVIDER_ERROR'
    | 'FAILED_PARSE'
    | 'UNKNOWN';
  flights: ProviderFlightResult[];
  latencyMs: number;
  errorMessage?: string;
  providerMetadata?: any;
}

export interface ProviderFlightResult {
  airlineCode: string;
  airlineName: string;
  flightNumber: string;

  origin: string;
  destination: string;

  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalTime: string;   // HH:mm

  stops: number;
  priceINR: number;

  currency: string;
  cabin: string;
  adults: number;

  providerId: string;
  providerObservedAt: string;
}

export interface FlightDataProvider {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerClass: string;

  fetchFlights(origin: string, destination: string, departureDate: string): Promise<ProviderFetchResult>;
}

/**
 * CurrentProductionProvider
 * Wraps SerpApi / SearchApi / direct Google scraping into the unified FlightDataProvider interface
 */
export class CurrentProductionProvider implements FlightDataProvider {
  public readonly providerId = 'PRIMARY_PRODUCTION';
  public readonly providerVersion = 'v1.0';
  public readonly providerClass = 'MultiSourceScraper';

  public async fetchFlights(origin: string, destination: string, departureDate: string): Promise<ProviderFetchResult> {
    const startTime = Date.now();
    try {
      // Direct call to our existing multi-source fetcher (no synthetic fallback allowed!)
      const result = await getLiveGoogleFlights(origin, destination, departureDate);
      const latencyMs = Date.now() - startTime;

      if (!result.flights || result.flights.length === 0) {
        return {
          status: 'EMPTY_CONFIRMED',
          flights: [],
          latencyMs,
          providerMetadata: { source: result.source }
        };
      }

      const mappedFlights: ProviderFlightResult[] = result.flights.map(fl => ({
        airlineCode: fl.airlineCode || '6E',
        airlineName: fl.airline,
        flightNumber: fl.flightNumber,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departureDate,
        departureTime: fl.departureTime,
        arrivalTime: fl.arrivalTime,
        stops: fl.stops,
        priceINR: fl.currentPrice,
        currency: 'INR',
        cabin: 'Economy',
        adults: 1,
        providerId: `production-${result.source}`,
        providerObservedAt: new Date().toISOString()
      }));

      return {
        status: 'SUCCESS',
        flights: mappedFlights,
        latencyMs,
        providerMetadata: { source: result.source }
      };
    } catch (err: any) {
      return {
        status: 'FAILED_PROVIDER_ERROR',
        flights: [],
        latencyMs: Date.now() - startTime,
        errorMessage: err?.message || 'Production scraper exception'
      };
    }
  }
}

/**
 * FliExperimentalProvider
 * Connects to the Python-based Fli sidecar service over HTTP
 * Keeps Node.js completely isolated from Python/reverse-engineering complexities
 */
export class FliExperimentalProvider implements FlightDataProvider {
  public readonly providerId = 'FLI_EXPERIMENTAL';
  public readonly providerVersion = 'v1.0-fli';
  public readonly providerClass = 'FliPythonSidecar';

  private getSidecarUrl(): string | null {
    return process.env.FLI_SIDECAR_URL || null;
  }

  public async fetchFlights(origin: string, destination: string, departureDate: string): Promise<ProviderFetchResult> {
    const sidecarUrl = this.getSidecarUrl();
    const startTime = Date.now();

    if (!sidecarUrl) {
      return {
        status: 'FAILED_PROVIDER_ERROR',
        flights: [],
        latencyMs: 0,
        errorMessage: 'FLI_SIDECAR_URL is not configured.'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.FLI_TIMEOUT_MS) || 12000; // 12 seconds default
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = `${sidecarUrl}/search?origin=${origin.toUpperCase()}&destination=${destination.toUpperCase()}&date=${departureDate}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'FAILED_PROVIDER_ERROR',
          flights: [],
          latencyMs,
          errorMessage: `Sidecar returned HTTP ${response.status}`
        };
      }

      const rawData = await response.json();
      if (!Array.isArray(rawData)) {
        return {
          status: 'FAILED_PARSE',
          flights: [],
          latencyMs,
          errorMessage: 'Sidecar returned malformed JSON (expected array)'
        };
      }

      if (rawData.length === 0) {
        return {
          status: 'EMPTY_CONFIRMED',
          flights: [],
          latencyMs
        };
      }

      const mappedFlights: ProviderFlightResult[] = rawData.map((fl: any) => ({
        airlineCode: fl.airlineCode || '6E',
        airlineName: fl.airlineName || 'IndiGo',
        flightNumber: fl.flightNumber,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departureDate,
        departureTime: fl.departureTime || '12:00',
        arrivalTime: fl.arrivalTime || '14:00',
        stops: fl.stops ?? 0,
        priceINR: fl.priceINR || fl.price || 8500,
        currency: fl.currency || 'INR',
        cabin: fl.cabin || 'Economy',
        adults: fl.adults || 1,
        providerId: this.providerId,
        providerObservedAt: new Date().toISOString()
      }));

      return {
        status: 'SUCCESS',
        flights: mappedFlights,
        latencyMs,
        providerMetadata: { priceInsights: rawData[0]?.priceInsights || null }
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      if (err.name === 'AbortError') {
        return {
          status: 'FAILED_TIMEOUT',
          flights: [],
          latencyMs,
          errorMessage: 'Fli sidecar connection timed out after 6000ms'
        };
      }
      return {
        status: 'FAILED_PROVIDER_ERROR',
        flights: [],
        latencyMs,
        errorMessage: err?.message || 'Failed to query Fli sidecar'
      };
    }
  }
}

export const currentProductionProvider = new CurrentProductionProvider();
export const fliExperimentalProvider = new FliExperimentalProvider();
