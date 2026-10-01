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
  priceDelta: number;
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
  dateBreakdown: Array<{
    date: string;
    observationCount: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    flightCount: number;
  }>;
  trajectories: FlightFareTrajectory[];
  rawObservations: AuthenticFareObservation[];
}
