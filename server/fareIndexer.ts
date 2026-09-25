import { PriceSnapshot } from '../src/types';
import { firestoreDB } from './firestoreService';
import { AIRPORTS, flightAggregator } from './aggregator';
import { geminiService, CorridorInputData } from './geminiService';
import { 
  IndexSummary, 
  OverallIndexPoint, 
  BookingWindowPoint, 
  TimeOfDayPoint, 
  DayOfWeekPoint, 
  RouteAnalyticsReport,
  DateFareInfo,
  CalendarFaresResponse,
  InfographicBenchmarkData
} from '../src/types/analytics';

export type {
  IndexSummary,
  OverallIndexPoint,
  BookingWindowPoint,
  TimeOfDayPoint,
  DayOfWeekPoint,
  RouteAnalyticsReport,
  DateFareInfo,
  CalendarFaresResponse,
  InfographicBenchmarkData
};

/**
 * Fare Indexing Analytics Service
 * Computes Overall, Booking Window, Time-of-Day, and Day-of-Week indices
 * from stored price snapshots without building a second scraper.
 */
class FareIndexingService {
  private MIN_POINTS_THRESHOLD = 3;
  private MIN_DAYS_THRESHOLD = 30;

  public async getRouteAnalytics(routeId: string): Promise<RouteAnalyticsReport> {
    const cleanRouteId = routeId.toUpperCase();
    // Fetch stored snapshots for this route from Firestore
    const rawSnapshots = await firestoreDB.getSnapshots(cleanRouteId, 2000);

    // Filter strictly genuine snapshots (no synthetic / seed data)
    const snapshots = rawSnapshots.filter(
      (s) =>
        s.routeId.toUpperCase() === cleanRouteId &&
        !s.id.startsWith('hist-') &&
        !(s.source && s.source.includes('Historical')) &&
        Boolean(s.timestamp)
    );

    // Calculate real distinct calendar days of continuous data collected
    const uniqueDatesSet = new Set<string>();
    snapshots.forEach((s) => {
      const dayStr = s.timestamp.split('T')[0];
      if (dayStr) uniqueDatesSet.add(dayStr);
    });
    const sortedDates = Array.from(uniqueDatesSet).sort();
    const totalDaysCollected = sortedDates.length;
    const isPreliminary = totalDaysCollected < this.MIN_DAYS_THRESHOLD;

    const summary: IndexSummary = {
      routeId: cleanRouteId,
      totalDaysCollected,
      isPreliminary,
      minDataPointsThreshold: this.MIN_POINTS_THRESHOLD,
      minDaysThreshold: this.MIN_DAYS_THRESHOLD,
      totalSnapshots: snapshots.length,
      earliestDate: sortedDates[0] || '',
      latestDate: sortedDates[sortedDates.length - 1] || '',
    };

    const overallIndex = this.computeOverallIndex(snapshots, totalDaysCollected, isPreliminary, cleanRouteId);
    const bookingWindowIndex = this.computeBookingWindowIndex(snapshots, totalDaysCollected, isPreliminary, cleanRouteId);
    const timeOfDayIndex = this.computeTimeOfDayIndex(snapshots, totalDaysCollected, isPreliminary, cleanRouteId);
    const dayOfWeekIndexResult = this.computeDayOfWeekIndex(snapshots, totalDaysCollected, isPreliminary, cleanRouteId);

    // Generate analytical insights using Gemini models with two API keys pool
    let aiAnalysis = undefined;
    try {
      const aiInput: CorridorInputData = {
        route: cleanRouteId,
        trackingDays: totalDaysCollected,
        isPreliminary,
        totalSnapshots: snapshots.length,
        earliestDate: summary.earliestDate,
        latestDate: summary.latestDate,
        overallPoints: overallIndex.points.map((p) => ({
          date: p.date,
          minPrice: p.lowestFare,
          indexValue: p.indexValue,
          percentChange: p.percentChange,
        })),
        bookingWindows: bookingWindowIndex.points.map((p) => ({
          window: `T-${p.daysBeforeDeparture}d`,
          avg: p.averageFare,
          count: p.dataPointsCount,
          distinctDates: p.distinctDatesCount,
          status: p.status,
        })),
        timeSlots: timeOfDayIndex.points.map((p) => ({
          slot: p.slot,
          avg: p.averageFare,
          count: p.dataPointsCount,
          distinctDates: p.distinctDatesCount,
          status: p.status,
        })),
        dayOfWeek: dayOfWeekIndexResult.points.map((p) => ({
          day: p.dayName,
          avg: p.averageFare,
          count: p.dataPointsCount,
          distinctDates: p.distinctDatesCount,
          status: p.status,
        })),
        unobservedDays: dayOfWeekIndexResult.unobservedWeekdays || [],
      };

      const aiResult = await geminiService.generateCorridorAnalysis(aiInput);
      if (aiResult) {
        overallIndex.insight = aiResult.overallIndexInsight;
        bookingWindowIndex.insight = aiResult.bookingWindowInsight;
        timeOfDayIndex.insight = aiResult.timeOfDayInsight;
        dayOfWeekIndexResult.insight = aiResult.dayOfWeekInsight;
        aiAnalysis = {
          corridorSummary: aiResult.corridorSummary,
          keyTakeaways: aiResult.keyTakeaways,
          modelUsed: aiResult.modelUsed,
          keyLabel: aiResult.keyLabel,
          generatedAt: aiResult.generatedAt,
        };
      }
    } catch (err: any) {
      console.warn('[Gemini Service] Fallback to computed index insights:', err?.message || err);
    }

    return {
      routeId: cleanRouteId,
      summary,
      overallIndex,
      bookingWindowIndex,
      timeOfDayIndex,
      dayOfWeekIndex: dayOfWeekIndexResult,
      aiAnalysis,
    };
  }

  /**
   * Returns calendar fare minimums for every date across a route.
   * Scoped strictly to the focused month to conserve compute and avoid wasteful calls.
   * Verifies that any price older than 24 hours is refreshed with live rates and persisted.
   */
  public async getCalendarFaresForRoute(
    origin: string, 
    destination: string,
    monthStr?: string
  ): Promise<CalendarFaresResponse> {
    const cleanOrigin = origin.toUpperCase();
    const cleanDest = destination.toUpperCase();
    const routeId = `${cleanOrigin}-${cleanDest}`;

    // Determine target year and month (default to current month if not provided)
    let targetYear: number;
    let targetMonth: number; // 1 - 12

    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      const [y, m] = monthStr.split('-');
      targetYear = parseInt(y, 10);
      targetMonth = parseInt(m, 10);
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }

    const formattedMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

    // 1. Retrieve all stored snapshots for this route from DB/memory
    const snapshots = await firestoreDB.getSnapshots(routeId, 1000);
    
    // Group existing snapshots for the target month by departureDate
    const existingSnapshotsByDate: Record<string, PriceSnapshot[]> = {};
    snapshots.forEach((snap) => {
      if (!snap.departureDate || !snap.departureDate.startsWith(formattedMonth)) return;
      if (!existingSnapshotsByDate[snap.departureDate]) {
        existingSnapshotsByDate[snap.departureDate] = [];
      }
      existingSnapshotsByDate[snap.departureDate].push(snap);
    });

    const fares: Record<string, DateFareInfo> = {};
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const freshSnapshotsToSave: PriceSnapshot[] = [];

    // 2. Loop strictly over days in the target month (1 to daysInTargetMonth)
    for (let day = 1; day <= daysInTargetMonth; day++) {
      const dateStr = `${formattedMonth}-${String(day).padStart(2, '0')}`;
      const daySnaps = existingSnapshotsByDate[dateStr] || [];

      // Find the most recent snapshot for this date
      let mostRecentSnap: PriceSnapshot | null = null;
      let minPriceSnap: PriceSnapshot | null = null;

      for (const s of daySnaps) {
        if (!mostRecentSnap || new Date(s.timestamp).getTime() > new Date(mostRecentSnap.timestamp).getTime()) {
          mostRecentSnap = s;
        }
        if (!minPriceSnap || s.price < minPriceSnap.price) {
          minPriceSnap = s;
        }
      }

      const isOlderThanDay = !mostRecentSnap || (nowMs - new Date(mostRecentSnap.timestamp).getTime() > ONE_DAY_MS);

      if (!isOlderThanDay && minPriceSnap && mostRecentSnap) {
        // Price is fresh (< 24 hours old) - use existing cached database fare
        fares[dateStr] = {
          date: dateStr,
          minPrice: minPriceSnap.price,
          airline: minPriceSnap.airline || 'IndiGo',
          source: 'database_snapshot',
          dataPoints: daySnaps.length,
          isPeak: minPriceSnap.price > 6000,
          lastUpdated: mostRecentSnap.timestamp,
          isFresh: true,
        };
      } else {
        // Price is older than a day or missing: re-fetch fresh live fare from aggregator and update DB
        const flights = flightAggregator.getFlights(cleanOrigin, cleanDest, dateStr);
        if (flights && flights.length > 0) {
          let lowestFlight = flights[0];
          flights.forEach((fl) => {
            if (fl.currentPrice < lowestFlight.currentPrice) {
              lowestFlight = fl;
            }
          });

          const freshTimestamp = new Date().toISOString();
          const freshSnap: PriceSnapshot = {
            id: `snap-cal-${Date.now()}-${lowestFlight.flightNumber}-${dateStr}`,
            flightId: `${routeId}-${lowestFlight.flightNumber}`,
            routeId,
            origin: cleanOrigin,
            destination: cleanDest,
            departureDate: dateStr,
            flightNumber: lowestFlight.flightNumber,
            airline: lowestFlight.airline,
            price: lowestFlight.currentPrice,
            timestamp: freshTimestamp,
            capturedHour: new Date().getHours(),
            type: 'daily',
            source: 'Google Flights Daily Calibrator',
          };

          freshSnapshotsToSave.push(freshSnap);
          flightAggregator.addSnapshot(freshSnap);

          fares[dateStr] = {
            date: dateStr,
            minPrice: lowestFlight.currentPrice,
            airline: lowestFlight.airline,
            source: 'live_aggregator',
            dataPoints: daySnaps.length + flights.length,
            isPeak: lowestFlight.currentPrice > 6000,
            lastUpdated: freshTimestamp,
            isFresh: true,
          };
        }
      }
    }

    // Persist any fresh snapshots in background
    if (freshSnapshotsToSave.length > 0) {
      firestoreDB.saveSnapshotsBatch(freshSnapshotsToSave).catch((err) => {
        console.warn('[Firestore DB] Failed to save updated calendar snapshot batch:', err);
      });
    }

    return {
      routeId,
      origin: cleanOrigin,
      destination: cleanDest,
      month: formattedMonth,
      fares,
    };
  }

  private computeOverallIndex(
    snapshots: PriceSnapshot[],
    totalDays: number,
    isPreliminary: boolean,
    cleanRouteId: string
  ): { points: OverallIndexPoint[]; insight: string } {
    const dailyLowest: Record<string, { minPrice: number; count: number }> = {};
    snapshots.forEach((s) => {
      const dateKey = s.timestamp.split('T')[0];
      if (!dateKey) return;
      if (!dailyLowest[dateKey] || s.price < dailyLowest[dateKey].minPrice) {
        dailyLowest[dateKey] = { minPrice: s.price, count: (dailyLowest[dateKey]?.count || 0) + 1 };
      } else {
        dailyLowest[dateKey].count += 1;
      }
    });

    const sortedDates = Object.keys(dailyLowest).sort();
    const prefix = isPreliminary
      ? `Preliminary (${totalDays} tracking days) — `
      : `Validated (${totalDays} tracking days) — `;

    if (sortedDates.length === 0) {
      return {
        points: [],
        insight: `${prefix}Gathering real snapshot data for ${cleanRouteId}. Baseline tracking is active.`,
      };
    }

    const baselineFare = dailyLowest[sortedDates[0]].minPrice || 100;
    const points: OverallIndexPoint[] = sortedDates.map((date) => {
      const lowestFare = dailyLowest[date].minPrice;
      const indexValue = Math.round((lowestFare / baselineFare) * 100);
      const percentChange = Math.round(((lowestFare - baselineFare) / baselineFare) * 100);
      return {
        date,
        lowestFare,
        indexValue,
        percentChange,
      };
    });

    const firstPoint = points[0];
    const latestPoint = points[points.length - 1];
    const totalChange = latestPoint.percentChange;
    const directionWord =
      totalChange === 0
        ? 'remains stable at 0%'
        : totalChange > 0
        ? `rose +${totalChange}%`
        : `decreased -${Math.abs(totalChange)}%`;

    let insight = '';
    if (sortedDates.length === 1) {
      insight = `${prefix}Based on ${snapshots.length} repeated snapshots collected on ${sortedDates[0]} for ${cleanRouteId}, the baseline minimum fare is ₹${firstPoint.lowestFare.toLocaleString()} (Index 100). Repeated periodic scrapes monitor price fluctuations for scheduled departures.`;
    } else {
      insight = `${prefix}Based on ${snapshots.length} repeated snapshots collected across ${totalDays} tracking days (${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}), lowest observed fare on ${cleanRouteId} moved from ₹${firstPoint.lowestFare.toLocaleString()} to ₹${latestPoint.lowestFare.toLocaleString()} (${directionWord}). Snapshot count reflects periodic monitoring of scheduled flights.`;
    }

    return { points, insight };
  }

  private computeBookingWindowIndex(
    snapshots: PriceSnapshot[],
    totalDays: number,
    isPreliminary: boolean,
    cleanRouteId: string
  ): { points: BookingWindowPoint[]; insight: string } {
    const targetWindows = [1, 7, 14, 30, 60, 90];
    const bucketMap: Record<number, { sum: number; count: number; prices: number[]; distinctDates: Set<string> }> = {};
    targetWindows.forEach((w) => {
      bucketMap[w] = { sum: 0, count: 0, prices: [], distinctDates: new Set<string>() };
    });

    snapshots.forEach((s) => {
      if (!s.departureDate || !s.timestamp) return;
      const depDate = new Date(s.departureDate).getTime();
      const snapDate = new Date(s.timestamp.split('T')[0]).getTime();
      const daysBefore = Math.round((depDate - snapDate) / (1000 * 60 * 60 * 24));

      let tw = 90;
      if (daysBefore <= 2) tw = 1;
      else if (daysBefore <= 9) tw = 7;
      else if (daysBefore <= 18) tw = 14;
      else if (daysBefore <= 45) tw = 30;
      else if (daysBefore <= 75) tw = 60;
      else tw = 90;

      bucketMap[tw].sum += s.price;
      bucketMap[tw].count += 1;
      bucketMap[tw].prices.push(s.price);
      bucketMap[tw].distinctDates.add(s.departureDate);
    });

    const t1Bucket = bucketMap[1];
    const hasT1Baseline = t1Bucket && t1Bucket.count >= this.MIN_POINTS_THRESHOLD;
    const t1Avg = hasT1Baseline ? Math.round(t1Bucket.sum / t1Bucket.count) : null;

    let baselineFare = t1Avg;
    if (!baselineFare) {
      for (const tw of targetWindows) {
        if (bucketMap[tw].count >= this.MIN_POINTS_THRESHOLD) {
          baselineFare = Math.round(bucketMap[tw].sum / bucketMap[tw].count);
          break;
        }
      }
    }
    if (!baselineFare) baselineFare = 5000;

    const points: BookingWindowPoint[] = targetWindows.map((w) => {
      const b = bucketMap[w];
      const hasSufficient = b.count >= this.MIN_POINTS_THRESHOLD;
      const avgPrice = b.count > 0 ? Math.round(b.sum / b.count) : 0;
      let normalized = 100;

      if (hasSufficient && baselineFare && baselineFare > 0) {
        normalized = Math.round((avgPrice / baselineFare) * 100);
      }

      return {
        daysBeforeDeparture: w,
        normalizedFareIndex: hasSufficient ? normalized : 0,
        averageFare: avgPrice,
        dataPointsCount: b.count,
        distinctDatesCount: b.distinctDates.size,
        status: hasSufficient ? 'sufficient' : 'insufficient_data',
      };
    });

    const prefix = isPreliminary
      ? `Preliminary (${totalDays} tracking days) — `
      : `Validated (${totalDays} tracking days) — `;

    const t30Bucket = bucketMap[30];
    const t30Avg = t30Bucket.count >= this.MIN_POINTS_THRESHOLD ? Math.round(t30Bucket.sum / t30Bucket.count) : null;
    const t60Bucket = bucketMap[60];
    const t60Avg = t60Bucket.count >= this.MIN_POINTS_THRESHOLD ? Math.round(t60Bucket.sum / t60Bucket.count) : null;

    let insight = '';
    if (hasT1Baseline && t1Avg && t30Avg) {
      const savingsPct = Math.round(((t1Avg - t30Avg) / t1Avg) * 100);
      if (savingsPct > 0) {
        insight = `${prefix}Based on real data (T-1d n=${t1Bucket.count} snapshots across ${t1Bucket.distinctDates.size} date(s) avg ₹${t1Avg.toLocaleString()}, T-30d n=${t30Bucket.count} snapshots across ${t30Bucket.distinctDates.size} date(s) avg ₹${t30Avg.toLocaleString()}), booking ~30 days ahead on ${cleanRouteId} saves ${savingsPct}% compared to last-minute fares. Note: Sample counts reflect periodic checks monitoring specific departure dates.`;
      } else {
        insight = `${prefix}Based on real data (T-1d n=${t1Bucket.count} snapshots across ${t1Bucket.distinctDates.size} date(s) avg ₹${t1Avg.toLocaleString()}, T-30d n=${t30Bucket.count} snapshots across ${t30Bucket.distinctDates.size} date(s) avg ₹${t30Avg.toLocaleString()}), 30-day advance fares average ₹${t30Avg.toLocaleString()} vs last-minute average ₹${t1Avg.toLocaleString()} (${Math.abs(savingsPct)}% difference). Note: Sample counts reflect periodic checks monitoring specific departure dates.`;
      }
    } else if (t30Avg) {
      if (t60Avg) {
        insight = `${prefix}Gathering data for last-minute fares (T-1d has ${t1Bucket.count} snapshot(s), min ${this.MIN_POINTS_THRESHOLD} required). Based on ${t30Bucket.count} repeated snapshots across ${t30Bucket.distinctDates.size} tracked departure date(s), ~30-day advance fares average ₹${t30Avg.toLocaleString()}, and ~60-day fares average ₹${t60Avg.toLocaleString()} (n=${t60Bucket.count} snapshots across ${t60Bucket.distinctDates.size} date(s)) on ${cleanRouteId}. High n reflects periodic scraping of scheduled flights rather than independent calendar days.`;
      } else {
        insight = `${prefix}Gathering data for last-minute fares (T-1d has ${t1Bucket.count} snapshot(s), min ${this.MIN_POINTS_THRESHOLD} required). Based on ${t30Bucket.count} repeated snapshots across ${t30Bucket.distinctDates.size} tracked departure date(s), ~30-day advance fares average ₹${t30Avg.toLocaleString()} on ${cleanRouteId}. High n reflects periodic scraping of scheduled flights rather than independent calendar days.`;
      }
    } else {
      const totalPointsWithWindows = Object.values(bucketMap).reduce((acc, curr) => acc + curr.count, 0);
      insight = `${prefix}Gathering data across advance booking windows for ${cleanRouteId} (${totalPointsWithWindows} snapshots collected so far; minimum ${this.MIN_POINTS_THRESHOLD} required per window).`;
    }

    return { points, insight };
  }

  private computeTimeOfDayIndex(
    snapshots: PriceSnapshot[],
    totalDays: number,
    isPreliminary: boolean,
    cleanRouteId: string
  ): { points: TimeOfDayPoint[]; insight: string } {
    const slots = [
      { label: '00:00 - 04:00', start: 0, end: 4 },
      { label: '04:00 - 08:00', start: 4, end: 8 },
      { label: '08:00 - 12:00', start: 8, end: 12 },
      { label: '12:00 - 16:00', start: 12, end: 16 },
      { label: '16:00 - 20:00', start: 16, end: 20 },
      { label: '20:00 - 24:00', start: 20, end: 24 },
    ];

    const slotMap: Record<number, { sum: number; count: number; distinctDates: Set<string> }> = {};
    slots.forEach((s) => {
      slotMap[s.start] = { sum: 0, count: 0, distinctDates: new Set<string>() };
    });

    const sched = flightAggregator.getSchedule(cleanRouteId) || [];
    const schedMap: Record<string, number> = {};
    sched.forEach((f) => {
      if (f.departureTime) schedMap[f.flightNumber] = parseInt(f.departureTime.split(':')[0], 10);
    });

    snapshots.forEach((snap) => {
      let depH = schedMap[snap.flightNumber];
      if (depH === undefined && snap.flightId) {
        const m = snap.flightId.match(/-(\d{2})(\d{2})-/);
        if (m) depH = parseInt(m[1], 10);
      }
      if (depH === undefined) depH = snap.capturedHour ?? new Date(snap.timestamp).getHours();

      const matchedSlot = slots.find((sl) => depH >= sl.start && depH < sl.end);
      if (matchedSlot && slotMap[matchedSlot.start]) {
        slotMap[matchedSlot.start].sum += snap.price;
        slotMap[matchedSlot.start].count += 1;
        if (snap.departureDate) {
          slotMap[matchedSlot.start].distinctDates.add(snap.departureDate);
        }
      }
    });

    let totalSlotSum = 0;
    let totalSlotCount = 0;
    slots.forEach((sl) => {
      const data = slotMap[sl.start];
      if (data.count >= this.MIN_POINTS_THRESHOLD) {
        totalSlotSum += data.sum;
        totalSlotCount += data.count;
      }
    });
    const baselineAvg = totalSlotCount > 0 ? totalSlotSum / totalSlotCount : 5000;

    const points: TimeOfDayPoint[] = slots.map((sl) => {
      const data = slotMap[sl.start];
      const hasSufficient = data.count >= this.MIN_POINTS_THRESHOLD;
      const avgPrice = data.count > 0 ? Math.round(data.sum / data.count) : 0;
      let normalized = 100;

      if (hasSufficient && baselineAvg > 0) {
        normalized = Math.round((avgPrice / baselineAvg) * 100);
      }

      return {
        slot: sl.label,
        hourStart: sl.start,
        normalizedIndex: hasSufficient ? normalized : 0,
        averageFare: avgPrice,
        dataPointsCount: data.count,
        distinctDatesCount: data.distinctDates.size,
        status: hasSufficient ? 'sufficient' : 'insufficient_data',
      };
    });

    const prefix = isPreliminary
      ? `Preliminary (${totalDays} tracking days) — `
      : `Validated (${totalDays} tracking days) — `;

    const sufficientSlots = points.filter((p) => p.status === 'sufficient');
    let insight = '';
    if (sufficientSlots.length >= 2) {
      const lowestSlot = [...sufficientSlots].sort((a, b) => a.averageFare - b.averageFare)[0];
      const highestSlot = [...sufficientSlots].sort((a, b) => b.averageFare - a.averageFare)[0];
      const advantagePct = Math.round(((highestSlot.averageFare - lowestSlot.averageFare) / highestSlot.averageFare) * 100);
      insight = `${prefix}Across ${sufficientSlots.length} departure slot(s) on ${cleanRouteId}, lowest fares cluster in ${lowestSlot.slot} (avg ₹${lowestSlot.averageFare.toLocaleString()}, n=${lowestSlot.dataPointsCount} snapshots across ${lowestSlot.distinctDatesCount} date(s)) vs ${highestSlot.slot} (avg ₹${highestSlot.averageFare.toLocaleString()}, n=${highestSlot.dataPointsCount} snapshots across ${highestSlot.distinctDatesCount} date(s)) — ${advantagePct}% spread. Note: Snapshot counts reflect periodic scraping of scheduled flights rather than independent calendar dates; continuous multi-day logging is required to confirm general intraday yield shifts.`;
    } else if (sufficientSlots.length === 1) {
      insight = `${prefix}Fares in the ${sufficientSlots[0].slot} slot average ₹${sufficientSlots[0].averageFare.toLocaleString()} (n=${sufficientSlots[0].dataPointsCount} snapshots across ${sufficientSlots[0].distinctDatesCount} date(s)) on ${cleanRouteId}. Other slots are still gathering observations.`;
    } else {
      insight = `${prefix}Gathering intraday departure time observations for ${cleanRouteId} (minimum ${this.MIN_POINTS_THRESHOLD} data points required per slot).`;
    }

    return { points, insight };
  }

  private computeDayOfWeekIndex(
    snapshots: PriceSnapshot[],
    totalDays: number,
    isPreliminary: boolean,
    cleanRouteId: string
  ): { points: DayOfWeekPoint[]; insight: string; unobservedWeekdays: string[] } {
    const weekdays = [
      { name: 'Monday', index: 1, jsDay: 1 },
      { name: 'Tuesday', index: 2, jsDay: 2 },
      { name: 'Wednesday', index: 3, jsDay: 3 },
      { name: 'Thursday', index: 4, jsDay: 4 },
      { name: 'Friday', index: 5, jsDay: 5 },
      { name: 'Saturday', index: 6, jsDay: 6 },
      { name: 'Sunday', index: 7, jsDay: 0 },
    ];

    const dayMap: Record<number, { sum: number; count: number; distinctDates: Set<string> }> = {};
    weekdays.forEach((w) => {
      dayMap[w.jsDay] = { sum: 0, count: 0, distinctDates: new Set<string>() };
    });

    snapshots.forEach((snap) => {
      if (!snap.departureDate) return;
      const d = new Date(snap.departureDate);
      const jsDay = d.getDay();
      if (dayMap[jsDay]) {
        dayMap[jsDay].sum += snap.price;
        dayMap[jsDay].count += 1;
        dayMap[jsDay].distinctDates.add(snap.departureDate);
      }
    });

    let totalDaySum = 0;
    let totalDayCount = 0;
    weekdays.forEach((w) => {
      const data = dayMap[w.jsDay];
      if (data.count >= this.MIN_POINTS_THRESHOLD) {
        totalDaySum += data.sum;
        totalDayCount += data.count;
      }
    });
    const baselineDayAvg = totalDayCount > 0 ? totalDaySum / totalDayCount : 5000;

    const unobservedWeekdays = weekdays.filter((w) => dayMap[w.jsDay].count === 0).map((w) => w.name);

    const points: DayOfWeekPoint[] = weekdays.map((wd) => {
      const data = dayMap[wd.jsDay];
      const distinctDatesCount = data.distinctDates.size;
      const avgPrice = data.count > 0 ? Math.round(data.sum / data.count) : 0;
      let normalized = 100;

      if (data.count >= this.MIN_POINTS_THRESHOLD && baselineDayAvg > 0) {
        normalized = Math.round((avgPrice / baselineDayAvg) * 100);
      }

      let status: 'sufficient' | 'insufficient_data' | 'no_data' = 'no_data';
      if (data.count === 0) {
        status = 'no_data';
      } else if (data.count < this.MIN_POINTS_THRESHOLD || distinctDatesCount < 2) {
        status = 'insufficient_data';
      } else {
        status = 'sufficient';
      }

      return {
        dayName: wd.name,
        dayIndex: wd.index,
        normalizedIndex: data.count > 0 && status === 'sufficient' ? normalized : 0,
        averageFare: avgPrice,
        dataPointsCount: data.count,
        distinctDatesCount,
        status,
      };
    });

    const prefix = isPreliminary
      ? `Preliminary (${totalDays} tracking days) — `
      : `Validated (${totalDays} tracking days) — `;

    const observedList = weekdays
      .filter((w) => dayMap[w.jsDay].count > 0)
      .map((w) => {
        const d = dayMap[w.jsDay];
        return `${w.name} (avg ₹${Math.round(d.sum / d.count).toLocaleString()}, n=${d.count} snapshots across ${d.distinctDates.size} date${d.distinctDates.size > 1 ? 's' : ''})`;
      });

    const totalDepDates = new Set(snapshots.filter((s) => s.departureDate).map((s) => s.departureDate)).size;

    let insight = `${prefix}Data covers ${7 - unobservedWeekdays.length}/7 weekdays across ${totalDepDates} tracked departure dates on ${cleanRouteId}. `;
    if (unobservedWeekdays.length > 0) {
      insight += `${unobservedWeekdays.join(', ')}: no departures tracked yet. `;
    }
    if (observedList.length > 0) {
      insight += `Observed: ${observedList.join('; ')}. `;
    }
    insight += `Recurring weekly yield pattern requires observations across multiple distinct calendar weeks per day (high snapshot counts reflect repeated hourly monitoring of individual departure dates).`;

    return { points, insight, unobservedWeekdays };
  }
}

export const fareIndexingService = new FareIndexingService();
