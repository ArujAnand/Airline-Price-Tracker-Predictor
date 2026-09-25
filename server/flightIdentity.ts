/**
 * Canonical Flight Identity Engine
 * 
 * Provides unified, collision-free, and schedule-drift resilient identification
 * across the scraper, aggregator, Firestore persistence, trajectory builder, and audit models.
 */

import { CanonicalFlightKey } from './types/mlPipeline';

/**
 * Standard IATA airline code normalizer
 */
export function normalizeCarrier(rawCarrierOrAirline: string): { code: string; name: string } {
  const lower = (rawCarrierOrAirline || '').toLowerCase().trim();
  
  if (lower.includes('indigo') || lower.includes('6e')) {
    return { code: '6E', name: 'IndiGo' };
  }
  if (lower.includes('air india express') || lower.includes('ix')) {
    return { code: 'IX', name: 'Air India Express' };
  }
  if (lower.includes('akasa') || lower.includes('qp')) {
    return { code: 'QP', name: 'Akasa Air' };
  }
  if (lower.includes('spicejet') || lower.includes('sg')) {
    return { code: 'SG', name: 'SpiceJet' };
  }
  if (lower.includes('vistara') || lower.includes('uk')) {
    return { code: 'UK', name: 'Vistara (Air India)' };
  }
  if (lower.includes('air india') || lower.includes('ai')) {
    return { code: 'AI', name: 'Air India' };
  }

  // Fallback if carrier is standard 2-letter code
  const uppercase = rawCarrierOrAirline.toUpperCase().trim();
  if (/^[A-Z0-9]{2}$/.test(uppercase)) {
    return { code: uppercase, name: uppercase };
  }

  return { code: '6E', name: rawCarrierOrAirline || 'Domestic Carrier' };
}

/**
 * Normalizes flight number string (e.g., '6E 656' -> '6E-656', 'IX1618' -> 'IX-1618')
 */
export function normalizeFlightNumber(rawFlightNum: string, defaultCarrierCode = '6E'): { flightNumber: string; carrierCode: string; isInferred: boolean } {
  if (!rawFlightNum || rawFlightNum.trim() === '') {
    return { flightNumber: `${defaultCarrierCode}-000`, carrierCode: defaultCarrierCode, isInferred: true };
  }

  let cleaned = rawFlightNum.trim().toUpperCase().replace(/\s+/g, '-');
  
  // Format like '6E656' -> '6E-656'
  const matchNoDash = cleaned.match(/^([A-Z0-9]{2})([0-9]+)$/);
  if (matchNoDash) {
    cleaned = `${matchNoDash[1]}-${matchNoDash[2]}`;
  }

  // Extract carrier prefix
  const parts = cleaned.split('-');
  if (parts.length >= 2) {
    const carrier = normalizeCarrier(parts[0]);
    return {
      flightNumber: `${carrier.code}-${parts.slice(1).join('-')}`,
      carrierCode: carrier.code,
      isInferred: false
    };
  }

  return {
    flightNumber: `${defaultCarrierCode}-${cleaned}`,
    carrierCode: defaultCarrierCode,
    isInferred: false
  };
}

/**
 * Builds the canonical flight identity key
 * Format: [ORIGIN]-[DESTINATION]-[CARRIER]-[FLIGHT_NUMBER]-[DEPARTURE_DATE]
 * Example: 'PNQ-LKO-6E-656-2026-10-18'
 */
export function buildCanonicalFlightKey(
  origin: string,
  destination: string,
  flightNumberOrAirline: string,
  departureDate: string,
  explicitCarrierCode?: string
): CanonicalFlightKey {
  const normOrigin = origin.trim().toUpperCase();
  const normDest = destination.trim().toUpperCase();
  const normDate = departureDate.trim(); // YYYY-MM-DD

  const carrierInfo = explicitCarrierCode 
    ? normalizeCarrier(explicitCarrierCode) 
    : normalizeCarrier(flightNumberOrAirline);
    
  const normFlight = normalizeFlightNumber(flightNumberOrAirline, carrierInfo.code);

  const canonicalId = `${normOrigin}-${normDest}-${normFlight.flightNumber}-${normDate}`;

  return {
    origin: normOrigin,
    destination: normDest,
    carrierCode: normFlight.carrierCode,
    flightNumber: normFlight.flightNumber,
    departureDate: normDate,
    canonicalId
  };
}

/**
 * Parses a canonical flight ID back into its constituent components
 */
export function parseCanonicalFlightId(canonicalId: string): CanonicalFlightKey | null {
  if (!canonicalId) return null;
  const parts = canonicalId.trim().split('-');
  
  // Expected: ORIGIN - DEST - CARRIER - NUMBER - YYYY - MM - DD (7 parts if date is YYYY-MM-DD)
  if (parts.length < 6) return null;
  
  const origin = parts[0];
  const destination = parts[1];
  const carrierCode = parts[2];
  const number = parts[3];
  const flightNumber = `${carrierCode}-${number}`;
  const departureDate = parts.slice(4).join('-');

  return {
    origin,
    destination,
    carrierCode,
    flightNumber,
    departureDate,
    canonicalId
  };
}

/**
 * Detects schedule drift between baseline schedule and observed schedule time
 * Does NOT split the canonical flight identity into a separate flight instance.
 */
export function detectScheduleDrift(
  baseScheduledTimeStr: string, // e.g. "06:10"
  observedScheduledTimeStr: string // e.g. "06:35"
): { isScheduleChanged: boolean; scheduleDriftMinutes: number } {
  if (!baseScheduledTimeStr || !observedScheduledTimeStr) {
    return { isScheduleChanged: false, scheduleDriftMinutes: 0 };
  }

  const [bH, bM] = baseScheduledTimeStr.split(':').map(Number);
  const [oH, oM] = observedScheduledTimeStr.split(':').map(Number);

  if (isNaN(bH) || isNaN(bM) || isNaN(oH) || isNaN(oM)) {
    return { isScheduleChanged: false, scheduleDriftMinutes: 0 };
  }

  const baseMinutes = bH * 60 + bM;
  const obsMinutes = oH * 60 + oM;
  const drift = obsMinutes - baseMinutes;

  return {
    isScheduleChanged: Math.abs(drift) >= 5, // Significant if >= 5 minutes
    scheduleDriftMinutes: drift
  };
}

/**
 * Generates an immutable, collision-free snapshot observation ID
 */
export function buildObservationId(canonicalId: string, timestampMs = Date.now()): string {
  return `obs-${timestampMs}-${canonicalId}`;
}
