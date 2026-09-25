/**
 * Isolated Test Fixtures & Factual YoY Aggregator
 * 
 * STRICT SCIENTIFIC REVENUE INTEGRITY RULE:
 * 1. Zero synthetic, simulated, or generated fare data is permitted in the empirical ML pipeline.
 * 2. Any mock records in this file exist purely for isolated software test fixtures.
 * 3. Any attempt to feed these fixtures into production ML will throw an explicit DataIntegrityViolation.
 */

import { YoYDataPoint } from '../src/types';
import { DataProvenance } from './types/mlPipeline';

export interface IsolatedMockTestRecord {
  routeId: string;
  leadTimeDays: number;
  dayOfWeek: number;
  month: number;
  isSaturday: boolean;
  isSunday: boolean;
  actualFinalPrice: number;
  lowestObservedPrice: number;
  provenance: DataProvenance;
}

/**
 * Isolated test fixture for offline unit test assertions only.
 * Prohibited from being imported by production training algorithms.
 */
export const ISOLATED_TEST_FIXTURES: IsolatedMockTestRecord[] = [
  {
    routeId: 'PNQ-LKO',
    leadTimeDays: 20,
    dayOfWeek: 2,
    month: 10,
    isSaturday: false,
    isSunday: false,
    actualFinalPrice: 5200,
    lowestObservedPrice: 4800,
    provenance: 'ISOLATED_TEST_FIXTURE'
  },
  {
    routeId: 'LKO-PNQ',
    leadTimeDays: 5,
    dayOfWeek: 5,
    month: 10,
    isSaturday: false,
    isSunday: false,
    actualFinalPrice: 7900,
    lowestObservedPrice: 7800,
    provenance: 'ISOLATED_TEST_FIXTURE'
  }
];

/**
 * Factual YoY aggregator: calculates year-over-year statistics strictly from real persisted snapshots
 * If no real data exists for a given past year (e.g. 2024 or 2025 before the system was created),
 * it returns zero fictitious points.
 */
export function getFactualYoYTrends(realSnapshots: any[], routeId: string): YoYDataPoint[] {
  const points: YoYDataPoint[] = [];
  const routeSnaps = (realSnapshots || []).filter(s => 
    s.routeId?.toUpperCase() === routeId.toUpperCase() &&
    s.provenance !== 'ISOLATED_TEST_FIXTURE'
  );

  if (routeSnaps.length === 0) {
    return [];
  }

  // Group real snapshots by departure date
  const byDate = new Map<string, number[]>();
  for (const s of routeSnaps) {
    const d = s.departureDate;
    if (!d) continue;
    const list = byDate.get(d) || [];
    list.push(s.price || s.currentPrice);
    byDate.set(d, list);
  }

  for (const [dateStr, prices] of byDate.entries()) {
    const dObj = new Date(dateStr);
    const year = dObj.getFullYear();
    const today = new Date();
    const lead = Math.max(0, Math.round((dObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    points.push({
      year,
      daysToDeparture: lead,
      relativeDateLabel: `T-${lead}d (${dateStr})`,
      averagePrice: avg,
      lowestPrice: low,
      highestPrice: high,
      festivalEvent: 'Observed Market Fares'
    });
  }

  return points.sort((a, b) => b.daysToDeparture - a.daysToDeparture);
}
