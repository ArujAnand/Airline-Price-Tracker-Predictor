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

  let cleaned = rawFlightNum.trim().toUpperCase().replace(/[\s/\\|]+/g, '-').replace(/-+/g, '-');
  
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

export type FlightIdentitySemantic = 
  | 'VALID_SINGLE_FLIGHT'
  | 'CONNECTING_ITINERARY'
  | 'CODESHARE'
  | 'CODESHARE_AMBIGUOUS'
  | 'MULTIPLE_MARKETING_NUMBERS'
  | 'MULTI_SEGMENT_MISCLASSIFIED'
  | 'PARSER_ARTIFACT'
  | 'IDENTITY_UNKNOWN';

export interface StructuredFlightObservationInput {
  flightNumber?: string;
  canonicalId?: string;
  stops?: number;
  segments?: Array<{
    carrierCode?: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    departureTime?: string;
    arrivalTime?: string;
  }>;
  operatingCarrier?: string;
  operatingFlightNumber?: string;
  marketingCarrier?: string;
  marketingFlightNumber?: string;
  isCodeshare?: boolean;
}

/**
 * Authoritative structured classifier for flight vs. itinerary identity
 * Priority:
 * 1. Structured segments array (segments.length === 1 vs > 1)
 * 2. Structured stops count (stops === 0 vs > 0)
 * 3. Codeshare disambiguation (operatingCarrier / marketingCarrier)
 * 4. Defensive legacy string parsing for records without structured segment arrays
 */
export function classifyFlightObservation(input: StructuredFlightObservationInput | string): FlightIdentitySemantic {
  if (typeof input === 'string') {
    input = { flightNumber: input };
  }

  // 1. Authoritative structured segment length
  if (input.segments && Array.isArray(input.segments)) {
    if (input.segments.length > 1) {
      return 'CONNECTING_ITINERARY';
    }
    if (input.segments.length === 0) {
      return 'IDENTITY_UNKNOWN';
    }
  }

  // 2. Authoritative structured stops count
  if (typeof input.stops === 'number' && input.stops > 0) {
    return 'CONNECTING_ITINERARY';
  }

  // 3. Codeshare semantics
  if (input.isCodeshare || (input.operatingCarrier && input.marketingCarrier && input.operatingCarrier !== input.marketingCarrier)) {
    if (input.operatingCarrier && input.operatingFlightNumber) {
      return 'CODESHARE'; // Unambiguous operating flight identity known
    }
    return 'CODESHARE_AMBIGUOUS';
  }

  // 4. Defensive string evaluation for legacy or string-only inputs
  const rawFn = (input.flightNumber || input.canonicalId || '').trim();
  if (!rawFn) {
    return 'IDENTITY_UNKNOWN';
  }

  // Check for multi-segment indicators in legacy string
  if (rawFn.includes(' / ') || rawFn.includes('|') || rawFn.includes('-/-')) {
    // If it has multiple carrier codes with multiple flight numbers, e.g. "6E 2190 / 6E 2132"
    const legs = rawFn.split(/\s*[\/|]\s*|\s*-\/-\s*/).filter(Boolean);
    if (legs.length > 1) {
      // Check if this is a codeshare like "AI 804 / NZ 3124" (same leg marketed by two carriers)
      // vs connecting itinerary like "6E 2190 / 6E 2132"
      const carrier1 = legs[0].trim().slice(0, 2);
      const carrier2 = legs[1].trim().slice(0, 2);
      if (carrier1 === carrier2) {
        return 'CONNECTING_ITINERARY'; // Same carrier connecting legs (e.g. 6E 2190 then 6E 2132)
      } else {
        // Different carrier: e.g. "AI 804 / NZ 3124"
        // If provider didn't specify operating carrier, it is CODESHARE_AMBIGUOUS
        if (!input.operatingCarrier) {
          return 'CODESHARE_AMBIGUOUS';
        }
        return 'CODESHARE';
      }
    }
    return 'CONNECTING_ITINERARY';
  }

  // Check for comma separated marketing numbers
  if (rawFn.includes(',')) {
    return 'MULTIPLE_MARKETING_NUMBERS';
  }

  // Standard single flight formats:
  // e.g. '6E-656', '6E 656', '6E656', 'AI-804', 'AI 804', 'AI804', 'IX-1144', 'IX 1144', 'IX1144'
  const singleFlightRegex = /^([A-Z0-9]{2})[-\s]?([0-9]{1,4})$/i;
  if (singleFlightRegex.test(rawFn)) {
    return 'VALID_SINGLE_FLIGHT';
  }

  // If canonical ID format: ORIGIN-DEST-CARRIER-NUM-DATE e.g. 'PNQ-LKO-6E-656-2026-10-18'
  if (/^[A-Z]{3}-[A-Z]{3}-([A-Z0-9]{2})-([0-9]{1,4})-[0-9]{4}-[0-9]{2}-[0-9]{2}$/i.test(rawFn)) {
    return 'VALID_SINGLE_FLIGHT';
  }

  return 'IDENTITY_UNKNOWN';
}

/**
 * Backward compatibility alias
 */
export function classifyFlightIdentity(rawFlightNum: string, stops?: number): FlightIdentitySemantic {
  return classifyFlightObservation({ flightNumber: rawFlightNum, stops });
}

/**
 * Centralized Firestore Document-ID Validation Safeguard
 */
export function validateFirestoreDocId(id: string): { isValid: boolean; reason?: string } {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return { isValid: false, reason: 'ID cannot be empty' };
  }
  if (id.includes('/')) {
    return { isValid: false, reason: 'ID cannot contain forward slashes' };
  }
  if (id.startsWith('__')) {
    return { isValid: false, reason: 'ID cannot start with reserved prefix __' };
  }
  if (id === '.' || id === '..') {
    return { isValid: false, reason: 'ID cannot be . or ..' };
  }
  if (Buffer.byteLength(id, 'utf8') > 1500) {
    return { isValid: false, reason: 'ID exceeds maximum 1500 bytes' };
  }
  return { isValid: true };
}

/**
 * Deterministic reversible mapping from scientific ID to Firestore-safe document ID
 */
export function toFirestoreDocId(canonicalScientificId: string): string {
  return canonicalScientificId.replace(/\//g, '__slash__');
}

/**
 * Reversible decoding from Firestore document ID back to canonical scientific ID
 */
export function fromFirestoreDocId(firestoreDocId: string): string {
  return firestoreDocId.replace(/__slash__/g, '/');
}

