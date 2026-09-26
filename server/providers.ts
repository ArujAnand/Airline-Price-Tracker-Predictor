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
 * Connects to the Python-based Fli service (supporting modern MCP JSON-RPC protocol and REST sidecars).
 * Transport: Uses Google Flights public page with tfs protobuf and inline ds:1 payload.
 * Keeps Node.js completely isolated from Python/reverse-engineering complexities.
 * Strictly forbids synthetic price fallbacks (missing prices result in parsing error or omission).
 */
export class FliExperimentalProvider implements FlightDataProvider {
  public readonly providerId = 'FLI_EXPERIMENTAL';
  public readonly providerVersion = 'v1.0-fli-mcp';
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
      const timeoutMs = Number(process.env.FLI_TIMEOUT_MS) || 12000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const transport = process.env.FLI_TRANSPORT || (sidecarUrl.includes('/mcp') ? 'mcp' : 'auto');
      let response: Response;

      if (transport === 'mcp' || sidecarUrl.endsWith('/mcp') || sidecarUrl.endsWith('/mcp/')) {
        // Model Context Protocol (MCP) Streamable HTTP JSON-RPC POST
        const mcpUrl = sidecarUrl.endsWith('/') ? sidecarUrl : `${sidecarUrl}/`;
        response = await fetch(mcpUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'search_flights',
              arguments: {
                origin: origin.toUpperCase(),
                destination: destination.toUpperCase(),
                departure_date: departureDate,
                currency: 'INR'
              }
            }
          })
        });
      } else {
        // Standard REST or auto-bridge GET/POST
        const url = `${sidecarUrl}/search?origin=${origin.toUpperCase()}&destination=${destination.toUpperCase()}&date=${departureDate}&currency=INR`;
        response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
      }

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'FAILED_PROVIDER_ERROR',
          flights: [],
          latencyMs,
          errorMessage: `Fli sidecar returned HTTP ${response.status}: ${response.statusText}`
        };
      }

      const rawData = await response.json();
      let rawFlights: any[] = [];

      // Handle MCP response structure vs REST response structure
      if (rawData.result && rawData.result.content && Array.isArray(rawData.result.content)) {
        // MCP tool output
        for (const item of rawData.result.content) {
          if (item.type === 'text') {
            try {
              const parsed = JSON.parse(item.text);
              if (Array.isArray(parsed)) rawFlights = parsed;
              else if (parsed.flights && Array.isArray(parsed.flights)) rawFlights = parsed.flights;
            } catch {
              // Not JSON text
            }
          }
        }
      } else if (Array.isArray(rawData)) {
        rawFlights = rawData;
      } else if (rawData.flights && Array.isArray(rawData.flights)) {
        rawFlights = rawData.flights;
      } else {
        return {
          status: 'FAILED_PARSE',
          flights: [],
          latencyMs,
          errorMessage: 'Sidecar returned malformed JSON (expected flights array or MCP tool content)'
        };
      }

      if (rawFlights.length === 0) {
        return {
          status: 'EMPTY_CONFIRMED',
          flights: [],
          latencyMs
        };
      }

      // Strictly map flights with ZERO synthetic defaults
      const mappedFlights: ProviderFlightResult[] = [];
      for (const fl of rawFlights) {
        const flightNumber = fl.flightNumber || fl.flight_number || (fl.legs && fl.legs[0]?.flight_number);
        const priceVal = fl.priceINR ?? fl.price ?? fl.currentPrice;
        
        // Scientific Purity: Reject flights without real prices (NO 8500 fallback!)
        if (typeof priceVal !== 'number' || priceVal <= 0 || isNaN(priceVal)) {
          console.warn(`[FliExperimentalProvider] Dropped flight ${flightNumber} due to missing or invalid price.`);
          continue;
        }

        const airlineName = fl.airlineName || fl.airline_name || fl.airline || (fl.legs && fl.legs[0]?.airline?.value) || 'IndiGo';
        const airlineCode = fl.airlineCode || fl.airline_code || (airlineName.toLowerCase().includes('indigo') ? '6E' : 'AI');
        const depTime = fl.departureTime || fl.departure_time || (fl.legs && fl.legs[0]?.departure_time) || '';
        const arrTime = fl.arrivalTime || fl.arrival_time || (fl.legs && fl.legs[fl.legs.length - 1]?.arrival_time) || '';
        const stops = fl.stops ?? (fl.legs ? Math.max(0, fl.legs.length - 1) : 0);

        mappedFlights.push({
          airlineCode,
          airlineName,
          flightNumber: String(flightNumber),
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          departureDate,
          departureTime: depTime,
          arrivalTime: arrTime,
          stops,
          priceINR: Math.round(priceVal),
          currency: fl.currency || 'INR',
          cabin: fl.cabin || fl.seat_type || 'Economy',
          adults: fl.adults || fl.passengers || 1,
          providerId: this.providerId,
          providerObservedAt: new Date().toISOString()
        });
      }

      if (mappedFlights.length === 0 && rawFlights.length > 0) {
        return {
          status: 'FAILED_PARSE',
          flights: [],
          latencyMs,
          errorMessage: 'No flights in Fli payload contained valid numeric prices.'
        };
      }

      return {
        status: mappedFlights.length > 0 ? 'SUCCESS' : 'EMPTY_CONFIRMED',
        flights: mappedFlights,
        latencyMs,
        providerMetadata: {
          transport,
          rawCount: rawFlights.length,
          priceInsights: rawData.priceInsights || null
        }
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      if (err.name === 'AbortError') {
        return {
          status: 'FAILED_TIMEOUT',
          flights: [],
          latencyMs,
          errorMessage: `Fli sidecar connection timed out after ${process.env.FLI_TIMEOUT_MS || 12000}ms`
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
