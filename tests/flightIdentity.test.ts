import {
  buildCanonicalFlightKey,
  parseCanonicalFlightId,
  normalizeCarrier,
  normalizeFlightNumber,
  detectScheduleDrift,
  buildObservationId
} from '../server/flightIdentity';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('=== TEST SUITE 1: CANONICAL FLIGHT IDENTITY & SCHEDULE DRIFT ===');

// Test 1: Canonical Key Generation
const key1 = buildCanonicalFlightKey('pnq', 'lko', '6E 656', '2026-10-18');
assert(key1.origin === 'PNQ', 'Origin normalized to uppercase');
assert(key1.destination === 'LKO', 'Destination normalized to uppercase');
assert(key1.carrierCode === '6E', 'Carrier code extracted as 6E');
assert(key1.flightNumber === '6E-656', 'Flight number normalized with hyphen');
assert(key1.departureDate === '2026-10-18', 'Departure date formatted');
assert(key1.canonicalId === 'PNQ-LKO-6E-656-2026-10-18', 'Canonical ID assembled correctly');

// Test 2: Parsing Canonical Flight ID
const parsed = parseCanonicalFlightId('PNQ-LKO-IX-1618-2026-11-05');
assert(parsed !== null, 'Parsed valid canonical ID');
assert(parsed?.origin === 'PNQ', 'Parsed origin PNQ');
assert(parsed?.destination === 'LKO', 'Parsed destination LKO');
assert(parsed?.carrierCode === 'IX', 'Parsed carrier code IX');
assert(parsed?.flightNumber === 'IX-1618', 'Parsed flight number IX-1618');
assert(parsed?.departureDate === '2026-11-05', 'Parsed departure date 2026-11-05');

// Test 3: Carrier Normalization
assert(normalizeCarrier('IndiGo').code === '6E', 'Normalizes IndiGo to 6E');
assert(normalizeCarrier('Air India Express').code === 'IX', 'Normalizes Air India Express to IX');
assert(normalizeCarrier('Akasa Air').code === 'QP', 'Normalizes Akasa Air to QP');
assert(normalizeCarrier('SpiceJet').code === 'SG', 'Normalizes SpiceJet to SG');

// Test 4: Schedule Drift Handling (Identity Preservation)
const drift1 = detectScheduleDrift('06:10', '06:10');
assert(!drift1.isScheduleChanged && drift1.scheduleDriftMinutes === 0, 'No drift when times match');

const drift2 = detectScheduleDrift('06:10', '06:35');
assert(drift2.isScheduleChanged && drift2.scheduleDriftMinutes === 25, 'Detects 25m schedule delay drift');

// Test 5: Observation ID Generation
const obsId = buildObservationId(key1.canonicalId, 1727258400000);
assert(obsId === 'obs-1727258400000-PNQ-LKO-6E-656-2026-10-18', 'Observation ID formatted cleanly');

console.log('✅ All Canonical Flight Identity tests passed successfully!\n');
