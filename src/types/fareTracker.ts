export interface AuthenticFareObservation {
  id: string;
  flightNumber: string;
  flightId: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  price: number;
  timestamp: string;
  source: string;
  provenance: string;
  type?: string;
  capturedHour?: number;
}

export interface FlightFareTrajectory {
  flightNumber: string;
  airline: string;
  departureDate: string;
  observationsCount: number;
  firstPrice: number;
  lastPrice: number;
  minPrice: number;
  maxPrice: number;
  priceDelta: number; // lastPrice - firstPrice
  priceDeltaPercent: number;
  firstObservedAt: string;
  lastObservedAt: string;
  history: Array<{
    timestamp: string;
    price: number;
    source: string;
    provenance: string;
  }>;
}

export interface TMinusPoint {
  daysBeforeDeparture: number; // 90, 80, 70, 60, 50, 40, 30, 14, 7, 1
  label: string; // e.g. "T-90d", "T-70d"
  averageFare: number | null;
  minFare: number | null;
  maxFare: number | null;
  dataPointsCount: number;
  distinctDatesCount: number;
  status: 'sufficient' | 'insufficient_data';
}

export interface DateBreakdownItem {
  date: string;
  observationCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  flightCount: number;
  tMinusPoints: TMinusPoint[];
}

export interface LkoPnqTrendSummary {
  route: string;
  departureDateWindow: {
    start: string;
    end: string;
  };
  totalAuthenticObservations: number;
  uniqueDepartureDates: string[];
  uniqueFlights: string[];
  airlines: Array<{
    name: string;
    count: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
  }>;
  overallMinFare: {
    price: number;
    flightNumber: string;
    departureDate: string;
    observedAt: string;
    airline: string;
  };
  overallMaxFare: {
    price: number;
    flightNumber: string;
    departureDate: string;
    observedAt: string;
    airline: string;
  };
  earliestObservationTimestamp: string;
  latestObservationTimestamp: string;
  dateBreakdown: DateBreakdownItem[];
  corridorTMinusPoints: TMinusPoint[];
  trajectories: FlightFareTrajectory[];
  rawObservations: AuthenticFareObservation[];
}
