export interface IndexSummary {
  routeId: string;
  totalDaysCollected: number;
  isPreliminary: boolean;
  minDataPointsThreshold: number;
  minDaysThreshold: number;
}

export interface OverallIndexPoint {
  date: string;
  lowestFare: number;
  indexValue: number;
  percentChange: number;
}

export interface BookingWindowPoint {
  daysBeforeDeparture: number;
  normalizedFareIndex: number;
  averageFare: number;
  dataPointsCount: number;
  status: 'sufficient' | 'insufficient_data';
}

export interface TimeOfDayPoint {
  slot: string;
  hourStart: number;
  normalizedIndex: number;
  averageFare: number;
  dataPointsCount: number;
  status: 'sufficient' | 'insufficient_data';
}

export interface DayOfWeekPoint {
  dayName: string;
  dayIndex: number;
  normalizedIndex: number;
  averageFare: number;
  dataPointsCount: number;
  status: 'sufficient' | 'insufficient_data';
}

export interface DateFareInfo {
  date: string; // YYYY-MM-DD
  minPrice: number;
  airline: string;
  source: 'database_snapshot' | 'live_aggregator';
  dataPoints: number;
  isPeak: boolean;
  lastUpdated?: string;
  isFresh?: boolean;
}

export interface CalendarFaresResponse {
  routeId: string;
  origin: string;
  destination: string;
  month?: string;
  fares: Record<string, DateFareInfo>;
}

export interface InfographicKeyRoute {
  route: string;
  label?: string;
  points: { label: string; value: number }[];
  changeNote?: string;
}

export interface InfographicPillarData {
  title: string;
  subtitle: string;
  description: string;
  baseLabel: string;
  insight: string;
  allIndiaPoints: { label: string; value: number; subLabel?: string }[];
  keyRoutes: InfographicKeyRoute[];
}

export interface InfographicBenchmarkData {
  overallIndex: InfographicPillarData;
  bookingWindow: InfographicPillarData;
  timeOfDay: InfographicPillarData;
  dayOfWeek: InfographicPillarData;
}

export interface RouteAnalyticsReport {
  routeId: string;
  summary: IndexSummary;
  overallIndex: {
    points: OverallIndexPoint[];
    insight: string;
  };
  bookingWindowIndex: {
    points: BookingWindowPoint[];
    insight: string;
  };
  timeOfDayIndex: {
    points: TimeOfDayPoint[];
    insight: string;
  };
  dayOfWeekIndex: {
    points: DayOfWeekPoint[];
    insight: string;
  };
  infographic?: InfographicBenchmarkData;
}
