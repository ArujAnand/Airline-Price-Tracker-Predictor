import { SmartDateRecommendation, SmartDateFinderResponse } from '../src/types';
import { INDIAN_FESTIVALS_2026_2027 } from './festivals';
import { flightAggregator } from './aggregator';

export interface VagueTripQuery {
  rawQuery?: string;
  origin: string;
  destination: string;
  departureMonth?: string; // e.g. "October", "November", "Dec", "any"
  tripLengthPref?: 'short' | 'standard' | 'extended' | 'any'; // 3-4d, 5-7d, 8-10d
  airlinePref?: string; // 'all', 'cheapest_any', 'IX', '6E', 'QP', 'SG'
  maxBudgetINR?: number;
  priority?: 'cheapest' | 'minimal_leaves' | 'weekend_only' | 'avoid_peak';
}

// Helper to determine day of week name
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseNaturalLanguageQuery(query: string, origin: string, destination: string): VagueTripQuery {
  const q = (query || '').toLowerCase().trim();
  const parsed: VagueTripQuery = {
    rawQuery: query,
    origin,
    destination,
    tripLengthPref: 'standard',
    airlinePref: 'cheapest_any',
    priority: 'cheapest',
  };

  // Detect month
  if (q.includes('oct') || q.includes('diwali') || q.includes('dussehra')) parsed.departureMonth = '10';
  else if (q.includes('nov') || q.includes('chhath')) parsed.departureMonth = '11';
  else if (q.includes('dec') || q.includes('xmas') || q.includes('christmas') || q.includes('new year')) parsed.departureMonth = '12';
  else if (q.includes('jan')) parsed.departureMonth = '01';

  // Detect trip length
  if (q.includes('weekend') || q.includes('short') || q.includes('quick') || q.includes('3 day') || q.includes('4 day') || q.includes('few days')) {
    parsed.tripLengthPref = 'short';
  } else if (q.includes('long') || q.includes('extended') || q.includes('week and a half') || q.includes('8 day') || q.includes('10 day')) {
    parsed.tripLengthPref = 'extended';
  } else if (q.includes('week') || q.includes('5 day') || q.includes('6 day') || q.includes('7 day')) {
    parsed.tripLengthPref = 'standard';
  }

  // Detect priorities
  if (q.includes('leave') || q.includes('work') || q.includes('pto') || q.includes('office')) {
    parsed.priority = 'minimal_leaves';
  } else if (q.includes('cheapest') || q.includes('lowest') || q.includes('budget') || q.includes('save') || q.includes('best price')) {
    parsed.priority = 'cheapest';
  } else if (q.includes('avoid rush') || q.includes('off peak') || q.includes('avoid crowd')) {
    parsed.priority = 'avoid_peak';
  } else if (q.includes('weekend')) {
    parsed.priority = 'weekend_only';
  }

  // Detect airline preference
  if (q.includes('air india') || q.includes('express') || q.includes('ix')) {
    parsed.airlinePref = 'IX';
  } else if (q.includes('indigo') || q.includes('6e')) {
    parsed.airlinePref = '6E';
  } else if (q.includes('akasa') || q.includes('qp')) {
    parsed.airlinePref = 'QP';
  } else if (q.includes('spicejet') || q.includes('sg')) {
    parsed.airlinePref = 'SG';
  }

  // Detect budget mention e.g. "under 15000", "under 12k", "below 10,000"
  const budgetMatch = q.match(/(?:under|below|less than|max|budget)\s*(?:rs\.?|inr|₹)?\s*(\d+)(k)?/i);
  if (budgetMatch) {
    let num = parseInt(budgetMatch[1], 10);
    if (budgetMatch[2]) num *= 1000;
    parsed.maxBudgetINR = num;
  }

  return parsed;
}

export function findSmartDates(
  origin: string,
  destination: string,
  queryOrFestival: string = 'Diwali',
  tripLengthPref: 'short' | 'standard' | 'extended' | 'any' = 'standard',
  airlinePref: string = 'all',
  customPriority: 'cheapest' | 'minimal_leaves' | 'weekend_only' | 'avoid_peak' = 'cheapest'
): SmartDateFinderResponse {
  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();
  const parsedNL = parseNaturalLanguageQuery(queryOrFestival, orig, dest);
  const effectiveLength = tripLengthPref === 'any' ? (parsedNL.tripLengthPref || 'standard') : tripLengthPref;
  const effectivePriority = customPriority || parsedNL.priority;

  // Identify anchor date or festival
  const searchKeyword = (queryOrFestival || '').toLowerCase().trim();
  const matchedFestival = INDIAN_FESTIVALS_2026_2027.find(
    (f) =>
      f.name.toLowerCase().includes(searchKeyword) ||
      searchKeyword.includes(f.name.toLowerCase().split(' ')[0])
  );

  let anchorDate: Date;
  let eventContextName: string;

  if (matchedFestival) {
    anchorDate = new Date(matchedFestival.startDate);
    eventContextName = matchedFestival.name;
  } else if (searchKeyword.includes('october') || parsedNL.departureMonth === '10') {
    anchorDate = new Date('2026-10-18'); // Mid October
    eventContextName = 'Mid-October Festive Window';
  } else if (searchKeyword.includes('november') || parsedNL.departureMonth === '11') {
    anchorDate = new Date('2026-11-15');
    eventContextName = 'November Post-Festival Window';
  } else if (searchKeyword.includes('december') || searchKeyword.includes('year') || parsedNL.departureMonth === '12') {
    anchorDate = new Date('2026-12-25');
    eventContextName = 'Year-End Holiday Season';
  } else {
    anchorDate = new Date('2026-10-18');
    eventContextName = 'Upcoming Travel Window (Diwali/Autumn)';
  }

  // Candidate generation matrices across all airlines
  // We simulate round-trip pairs and inspect real airline schedules
  type CandidateProfile = {
    outOffset: number;
    retOffset: number;
    title: string;
    tag: 'Best Value' | 'Lowest Fare' | 'Minimal Leaves' | 'Holiday Peak';
    verdict: 'HIGHLY_RECOMMENDED' | 'GOOD_VALUE' | 'EXPENSIVE_PEAK';
    leaves: number;
    rationale: string;
    surgeRisk: 'Low' | 'Moderate' | 'Severe';
  };

  const candidateProfiles: CandidateProfile[] = [];

  if (effectiveLength === 'short') {
    // 3 - 4 days window
    candidateProfiles.push(
      {
        outOffset: -4, // Wed
        retOffset: -1, // Sat
        title: 'Midweek Quick Dip (Lowest Round-Trip Across Airlines)',
        tag: 'Lowest Fare',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 2,
        rationale: 'Bypasses the Thursday evening & Friday rush. Captures introductory Air India Express or early morning IndiGo inventory.',
        surgeRisk: 'Low',
      },
      {
        outOffset: -2, // Fri
        retOffset: +1, // Mon
        title: 'Weekend Warrior (Minimal Leaves Required)',
        tag: 'Minimal Leaves',
        verdict: 'GOOD_VALUE',
        leaves: 1,
        rationale: 'Depart Friday evening and return Monday morning. Takes only 1 official leave, with moderate weekend pricing.',
        surgeRisk: 'Moderate',
      },
      {
        outOffset: -1, // Sat
        retOffset: +2, // Tue
        title: 'Peak Weekend Crush (High Surcharges)',
        tag: 'Holiday Peak',
        verdict: 'EXPENSIVE_PEAK',
        leaves: 1,
        rationale: 'Airlines have pushed seats into Tier-3 pricing buckets. High demand across all carriers.',
        surgeRisk: 'Severe',
      },
      {
        outOffset: +1, // Mon after
        retOffset: +4, // Thu after
        title: 'Post-Festival Counter-Flow Window',
        tag: 'Best Value',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 3,
        rationale: 'Traveling opposite to the general passenger flow secures up to 35% savings on returned aircraft capacity.',
        surgeRisk: 'Low',
      }
    );
  } else if (effectiveLength === 'extended') {
    // 8 - 10 days window
    candidateProfiles.push(
      {
        outOffset: -6, // Monday
        retOffset: +3, // Wednesday
        title: '10-Day Grand Holiday (Early Midweek Departure)',
        tag: 'Best Value',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 5,
        rationale: 'Early departure unlocks base promotional tiers across Air India Express, SpiceJet, and Akasa Air before surges activate.',
        surgeRisk: 'Low',
      },
      {
        outOffset: -5,
        retOffset: +4,
        title: 'Wednesday-to-Thursday Extended Vacation',
        tag: 'Lowest Fare',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 5,
        rationale: 'Midweek flights both ways shield you completely from surge pricing spikes.',
        surgeRisk: 'Low',
      },
      {
        outOffset: -3,
        retOffset: +6,
        title: 'Festival Peak Bridge (Extensive Holiday)',
        tag: 'Holiday Peak',
        verdict: 'EXPENSIVE_PEAK',
        leaves: 4,
        rationale: 'Captures both major festival dates. Both outbound and return occur in congested peak windows.',
        surgeRisk: 'Severe',
      }
    );
  } else {
    // Standard 5 - 7 days window
    candidateProfiles.push(
      {
        outOffset: -4, // e.g. Oct 14 Wednesday
        retOffset: +3, // e.g. Oct 21 Wednesday
        title: 'Optimal Balance: Pre-Festival Dip & Post-Festival Return',
        tag: 'Best Value',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 3,
        rationale: 'Departing 4 days before peak bypasses the Friday airport crush and secures lower fare classes (e.g. newly listed IX-1618). Returning Wednesday catches off-peak seat releases.',
        surgeRisk: 'Low',
      },
      {
        outOffset: -5, // e.g. Oct 13 Tuesday
        retOffset: +2, // e.g. Oct 20 Tuesday
        title: 'Maximum Savings: Midweek Departures Across Airlines',
        tag: 'Lowest Fare',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 4,
        rationale: 'Tuesday/Wednesday flights completely dodge peak weekend algorithms. Airlines price seats at base rack rates.',
        surgeRisk: 'Low',
      },
      {
        outOffset: -2, // Friday
        retOffset: +4, // Thursday
        title: 'Weekend Anchor (Leaves-Conscious)',
        tag: 'Minimal Leaves',
        verdict: 'GOOD_VALUE',
        leaves: 2,
        rationale: 'Depart Friday after work and return next Thursday. Only 2 working days required, with moderate Friday fare demand.',
        surgeRisk: 'Moderate',
      },
      {
        outOffset: -1, // Saturday
        retOffset: +2, // Tuesday
        title: 'High-Demand Peak Window (Not Recommended)',
        tag: 'Holiday Peak',
        verdict: 'EXPENSIVE_PEAK',
        leaves: 1,
        rationale: 'Highest possible load factors. Air India Express and IndiGo have filled lower tiers; pricing is 1.6x-1.9x normal rack rates.',
        surgeRisk: 'Severe',
      },
      {
        outOffset: -3, // Thursday
        retOffset: +3, // Wednesday
        title: 'Thursday-Wednesday Flexible Window',
        tag: 'Best Value',
        verdict: 'HIGHLY_RECOMMENDED',
        leaves: 3,
        rationale: 'Captures the sweet spot before weekend surcharge kicks in on Friday afternoon.',
        surgeRisk: 'Low',
      }
    );
  }

  const recommendations: SmartDateRecommendation[] = [];

  for (let i = 0; i < candidateProfiles.length; i++) {
    const cp = candidateProfiles[i];
    const outDateObj = new Date(anchorDate);
    outDateObj.setDate(outDateObj.getDate() + cp.outOffset);

    const retDateObj = new Date(anchorDate);
    retDateObj.setDate(retDateObj.getDate() + cp.retOffset);

    const outDateStr = outDateObj.toISOString().split('T')[0];
    const retDateStr = retDateObj.toISOString().split('T')[0];

    const outDow = DAYS_OF_WEEK[outDateObj.getDay()];
    const retDow = DAYS_OF_WEEK[retDateObj.getDay()];
    const tripDuration = Math.round((retDateObj.getTime() - outDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Inspect real flights from aggregator for both directions
    const outboundFlights = flightAggregator.getFlights(orig, dest, outDateStr);
    const returnFlights = flightAggregator.getFlights(dest, orig, retDateStr);

    // Filter by airline preference if requested
    let eligibleOutbound = outboundFlights;
    let eligibleReturn = returnFlights;

    if (airlinePref && airlinePref !== 'all' && airlinePref !== 'cheapest_any') {
      const matchOut = outboundFlights.filter((f) => f.airlineCode.toUpperCase() === airlinePref.toUpperCase());
      if (matchOut.length > 0) eligibleOutbound = matchOut;
      const matchRet = returnFlights.filter((f) => f.airlineCode.toUpperCase() === airlinePref.toUpperCase());
      if (matchRet.length > 0) eligibleReturn = matchRet;
    }

    // Pick best flights (prefer direct non-stops with lowest price)
    eligibleOutbound.sort((a, b) => {
      if (a.stops !== b.stops) return a.stops - b.stops;
      return a.currentPrice - b.currentPrice;
    });

    eligibleReturn.sort((a, b) => {
      if (a.stops !== b.stops) return a.stops - b.stops;
      return a.currentPrice - b.currentPrice;
    });

    const bestOut = eligibleOutbound[0] || outboundFlights[0];
    const bestRet = eligibleReturn[0] || returnFlights[0];

    const outPrice = bestOut ? bestOut.currentPrice : 4850;
    const retPrice = bestRet ? bestRet.currentPrice : 4850;
    const totalRoundTrip = outPrice + retPrice;

    // Peak benchmark calculation
    const peakOutPrice = Math.round((bestOut ? bestOut.basePrice : 4500) * 1.82);
    const peakRetPrice = Math.round((bestRet ? bestRet.basePrice : 4500) * 1.82);
    const peakRoundTrip = peakOutPrice + peakRetPrice;
    const savings = Math.max(0, peakRoundTrip - totalRoundTrip);

    recommendations.push({
      id: `smart-date-${i + 1}`,
      title: cp.title,
      tag: cp.tag,
      outboundDate: outDateStr,
      outboundDayOfWeek: outDow,
      outboundPrice: outPrice,
      bestOutboundFlight: bestOut
        ? {
            flightNumber: bestOut.flightNumber,
            airline: bestOut.airline,
            airlineCode: bestOut.airlineCode,
            departureTime: bestOut.departureTime,
            arrivalTime: bestOut.arrivalTime,
            stops: bestOut.stops,
            price: bestOut.currentPrice,
          }
        : undefined,
      returnDate: retDateStr,
      returnDayOfWeek: retDow,
      returnPrice: retPrice,
      bestReturnFlight: bestRet
        ? {
            flightNumber: bestRet.flightNumber,
            airline: bestRet.airline,
            airlineCode: bestRet.airlineCode,
            departureTime: bestRet.departureTime,
            arrivalTime: bestRet.arrivalTime,
            stops: bestRet.stops,
            price: bestRet.currentPrice,
          }
        : undefined,
      totalRoundTripPrice: totalRoundTrip,
      peakRoundTripPrice: peakRoundTrip,
      totalSavingsINR: savings,
      tripDurationDays: tripDuration,
      workDaysOffNeeded: cp.leaves,
      verdict: cp.verdict,
      rationale: cp.rationale,
      surgeRisk: cp.surgeRisk,
    });
  }

  // Sort based on priority
  recommendations.sort((a, b) => {
    if (effectivePriority === 'minimal_leaves') {
      if (a.workDaysOffNeeded !== b.workDaysOffNeeded) return a.workDaysOffNeeded - b.workDaysOffNeeded;
      return a.totalRoundTripPrice - b.totalRoundTripPrice;
    }
    if (effectivePriority === 'avoid_peak') {
      const riskScore = { Low: 1, Moderate: 2, Severe: 3 };
      if (riskScore[a.surgeRisk] !== riskScore[b.surgeRisk]) return riskScore[a.surgeRisk] - riskScore[b.surgeRisk];
      return a.totalRoundTripPrice - b.totalRoundTripPrice;
    }
    // Default: Cheapest recommended first
    if (a.verdict === 'HIGHLY_RECOMMENDED' && b.verdict !== 'HIGHLY_RECOMMENDED') return -1;
    if (b.verdict === 'HIGHLY_RECOMMENDED' && a.verdict !== 'HIGHLY_RECOMMENDED') return 1;
    return a.totalRoundTripPrice - b.totalRoundTripPrice;
  });

  const bestOption = recommendations[0];
  const airlineNames = Array.from(
    new Set(
      recommendations.flatMap((r) => [
        r.bestOutboundFlight?.airline,
        r.bestReturnFlight?.airline,
      ]).filter(Boolean)
    )
  ).join(', ');

  const summaryAnalysis = `Analyzed round-trip pairs across all carriers (**${airlineNames || 'Air India Express, IndiGo, SpiceJet, Akasa Air'}**) for **${orig} ⇄ ${dest}** around ${eventContextName}. The optimal recommendation is departing **${bestOption.outboundDate} (${bestOption.outboundDayOfWeek})** and returning **${bestOption.returnDate} (${bestOption.returnDayOfWeek})**. Total round-trip fare is **₹${bestOption.totalRoundTripPrice.toLocaleString('en-IN')}** (saving up to **₹${bestOption.totalSavingsINR.toLocaleString('en-IN')}** vs peak), requiring ${bestOption.workDaysOffNeeded} work leaves for a ${bestOption.tripDurationDays}-day itinerary.`;

  return {
    queryFestivalOrEvent: eventContextName,
    origin: orig,
    destination: dest,
    searchWindow: {
      start: recommendations[0]?.outboundDate || anchorDate.toISOString().split('T')[0],
      end: recommendations[recommendations.length - 1]?.returnDate || anchorDate.toISOString().split('T')[0],
    },
    recommendations,
    summaryAnalysis,
  };
}
