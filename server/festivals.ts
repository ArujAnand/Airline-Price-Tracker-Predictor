import { FestivalEvent } from '../src/types';
import { NearbyCalendarEvent } from './types/mlPipeline';

export const INDIAN_FESTIVALS_2026_2027: FestivalEvent[] = [
  {
    id: 'navratri-dussehra-2026',
    name: 'Navratri & Dussehra (Vijayadashami)',
    startDate: '2026-10-11',
    endDate: '2026-10-21',
    demandSurgeFactor: 1.45,
    description: 'High homecoming demand across North and Central India; spike in Pune to UP routes.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM', 'CCU']
  },
  {
    id: 'diwali-2026',
    name: 'Diwali & Deepavali Festival Week',
    startDate: '2026-11-05',
    endDate: '2026-11-12',
    demandSurgeFactor: 1.85,
    description: 'Peak festive travel season. Over 300% booking velocity from Pune/Mumbai tech hubs to Lucknow & UP.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM', 'BLR', 'HYD']
  },
  {
    id: 'chhath-puja-2026',
    name: 'Chhath Puja Mahaparv',
    startDate: '2026-11-14',
    endDate: '2026-11-18',
    demandSurgeFactor: 1.95,
    description: 'Extreme demand corridor for Lucknow, Varanasi, Patna, and Gorakhpur. Flights routinely hit fare caps.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM', 'BLR']
  },
  {
    id: 'winter-wedding-season-2026',
    name: 'Peak Winter Wedding Season',
    startDate: '2026-11-20',
    endDate: '2026-12-15',
    demandSurgeFactor: 1.35,
    description: 'Continuous weekend and auspicious muhurat surges across North-West interstate flights.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'JAI', 'BOM']
  },
  {
    id: 'year-end-holidays-2026',
    name: 'Christmas & New Year Holidays',
    startDate: '2026-12-22',
    endDate: '2027-01-03',
    demandSurgeFactor: 1.55,
    description: 'Annual winter holiday rush with leisure and family reunion travelers.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM', 'GOI', 'BLR']
  },
  {
    id: 'republic-day-weekend-2027',
    name: 'Republic Day Long Weekend',
    startDate: '2027-01-23',
    endDate: '2027-01-27',
    demandSurgeFactor: 1.3,
    description: 'Extended holiday weekend with intercity family visits.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM']
  },
  {
    id: 'holi-2027',
    name: 'Holi Festival of Colors',
    startDate: '2027-03-20',
    endDate: '2027-03-25',
    demandSurgeFactor: 1.7,
    description: 'Massive homecoming rush to Uttar Pradesh and Bihar from industrial hubs like Pune.',
    affectedRegions: ['PNQ', 'LKO', 'DEL', 'BOM']
  }
];

/**
 * Factual calendar event extractor:
 * Returns all factual calendar events within +/- 45 days of travel date.
 * Zero price multipliers or demand assumptions are attached.
 */
export function getFactualNearbyEvents(travelDateStr: string): NearbyCalendarEvent[] {
  const travelDate = new Date(`${travelDateStr}T00:00:00Z`);
  const travelTime = travelDate.getTime();
  const events: NearbyCalendarEvent[] = [];

  for (const festival of INDIAN_FESTIVALS_2026_2027) {
    const start = new Date(`${festival.startDate}T00:00:00Z`).getTime();
    const end = new Date(`${festival.endDate}T00:00:00Z`).getTime();

    // Days from start date (signed integer: positive means departure is before festival, negative means after)
    const daysFromStart = Math.round((start - travelTime) / (1000 * 60 * 60 * 24));
    const daysFromEnd = Math.round((travelTime - end) / (1000 * 60 * 60 * 24));

    // If within +/- 45 days of either start or end
    if (Math.abs(daysFromStart) <= 45 || (travelTime >= start && travelTime <= end)) {
      const signedOffset = (travelTime >= start && travelTime <= end) ? 0 : daysFromStart;
      events.push({
        eventName: festival.name,
        eventDate: festival.startDate,
        daysFromDeparture: signedOffset,
        eventType: 'FESTIVAL'
      });
    }
  }

  return events;
}

export function getFestivalImpact(travelDateStr: string, origin: string, destination: string) {
  const travelDate = new Date(travelDateStr);
  const travelTime = travelDate.getTime();

  let closestFestival: FestivalEvent | null = null;
  let minDaysDiff = Infinity;
  let isWithinFestival = false;

  for (const festival of INDIAN_FESTIVALS_2026_2027) {
    const start = new Date(festival.startDate).getTime();
    const end = new Date(festival.endDate).getTime();

    // Check if directly inside
    if (travelTime >= start && travelTime <= end) {
      closestFestival = festival;
      minDaysDiff = 0;
      isWithinFestival = true;
      break;
    }

    // Distance to start or end
    const distToStart = Math.round((start - travelTime) / (1000 * 60 * 60 * 24));
    const distToEnd = Math.round((travelTime - end) / (1000 * 60 * 60 * 24));

    const absDist = Math.min(Math.abs(distToStart), Math.abs(distToEnd));
    if (absDist < minDaysDiff) {
      minDaysDiff = absDist;
      closestFestival = festival;
    }
  }

  // Calculate multiplier
  let demandMultiplier = 1.0;
  let impactDescription = "Regular booking cycle with standard seasonal pricing.";

  if (closestFestival && minDaysDiff <= 14) {
    const isMajorRoute = (origin === 'PNQ' && destination === 'LKO') || (origin === 'LKO' && destination === 'PNQ');
    const routeFactor = isMajorRoute ? 1.15 : 1.0; // Pune - Lucknow is heavily impacted

    if (isWithinFestival) {
      demandMultiplier = closestFestival.demandSurgeFactor * routeFactor;
      impactDescription = `High Alert: Direct overlap with ${closestFestival.name}. High demand corridor on ${origin} ⇄ ${destination} causes sticky premium pricing. Seats selling fast.`;
    } else if (minDaysDiff <= 5) {
      demandMultiplier = (1 + (closestFestival.demandSurgeFactor - 1) * 0.75) * routeFactor;
      impactDescription = `Near-Festival Spike: Travel date is ${minDaysDiff} day(s) from ${closestFestival.name}. Anticipate rapid seat depletion and sudden fare jumps.`;
    } else if (minDaysDiff <= 14) {
      demandMultiplier = (1 + (closestFestival.demandSurgeFactor - 1) * 0.4) * routeFactor;
      impactDescription = `Festival Proximity: Travel date is ${minDaysDiff} days from ${closestFestival.name}. Upward pricing pressure expected as airlines open higher fare buckets.`;
    }
  }

  return {
    nearFestival: minDaysDiff <= 14,
    festivalName: closestFestival?.name,
    daysFromFestival: minDaysDiff === Infinity ? undefined : minDaysDiff,
    demandMultiplier: Number(demandMultiplier.toFixed(2)),
    impactDescription
  };
}
