export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCity: string;
  originAirport: string;
  destination: string;
  destinationCity: string;
  destinationAirport: string;
  departureTime: string; // HH:mm
  arrivalTime: string;   // HH:mm
  departureDate?: string; // YYYY-MM-DD
  duration: string;      // e.g. "2h 10m"
  stops: number;
  stopDetails?: string;
  basePrice: number;
  currentPrice: number;
  currency: string;
  seatsRemaining: number;
  cabinClass: 'Economy' | 'Premium Economy' | 'Business';
  aircraft: string;
  source: 'Google Flights (Live Scraping)' | 'SerpApi (Google Flights)' | 'SearchApi (Google Flights)' | 'Google Flights Aggregator' | 'Airline Direct Feed' | 'GDS Cache' | string;
  isLiveScraped?: boolean;
  bookingUrl?: string;
  airlineLogo?: string;
  lastUpdated: string;
  historicalLow30d: number;
  historicalHigh30d: number;
  priceTrend24h: number; // percentage change or amount
}

export interface PriceSnapshot {
  id: string;
  flightId: string;
  routeId: string; // e.g. "PNQ-LKO"
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  flightNumber: string;
  airline: string;
  price: number;
  timestamp: string; // ISO string
  capturedHour: number; // 0-23
  type: 'hourly' | 'daily';
  source: string;
}

export interface FestivalEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  demandSurgeFactor: number; // e.g. 1.3 to 1.75
  description: string;
  affectedRegions: string[];
}

export interface PriceForecastPoint {
  date: string;
  daysToDeparture: number;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0-100
  note?: string;
}

export interface PredictionAnalysis {
  routeId: string;
  origin: string;
  destination: string;
  departureDate: string;
  currentLowestPrice: number;
  historicalMedianPrice: number;
  predictedPriceRange: {
    min: number;
    expected: number;
    max: number;
  };
  recommendation: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING';
  confidenceScore: number;
  optimalBookingWindow: {
    start: string;
    end: string;
    description: string;
  };
  expectedPriceChange: {
    amount: number;
    percentage: number;
    direction: 'decrease' | 'increase' | 'stable';
    timeframe: string;
  };
  factors: {
    daysToDeparture: {
      days: number;
      category: 'LAST_MINUTE' | 'HIGH_SURGE' | 'OPTIMAL_SWEET_SPOT' | 'EARLY_STABLE';
      impactDescription: string;
      riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    };
    festivalImpact: {
      nearFestival: boolean;
      festivalName?: string;
      daysFromFestival?: number;
      demandMultiplier: number;
      impactDescription: string;
    };
    dayOfWeekImpact: {
      departureDay: string;
      impactDescription: string;
    };
    hourlyVolatility: {
      bestBookingHour: string;
      currentVolatility: 'Low' | 'Moderate' | 'High';
      trendSummary: string;
    };
  };
  aiAnalysisText: string;
  aiSource?: {
    source: 'live_gemini' | 'cache' | 'deterministic_fallback';
    model?: string;
    keyLabel?: string;
  };
  forecastPoints: PriceForecastPoint[];
  dropProbabilityPercent: number; // e.g. 74%
  surgeProbabilityPercent: number; // e.g. 26%
  optimalBookingTiming: {
    bestDayOfWeek: string;
    bestCalendarDate: string;
    bestBookingHour: string;
    reason: string;
  };
  predictionTrackingId?: string;
  mlComparison?: MLModelComparison;
  yoyTrends?: YoYDataPoint[];
}

export interface TrackedTripAlert {
  id: string;
  routeId: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureDate: string;
  flightNumber?: string;
  targetPrice: number;
  currentLowestPrice: number;
  alertOnOptimalBuy: boolean;
  alertOnPriceDrop: boolean;
  status: 'ACTIVE' | 'TRIGGERED' | 'PAUSED' | 'FIRED';
  createdAt: string;
  lastCheckedAt: string;
  lastFiredAt?: string;
  lastDropNotifAt?: string;
  conditionFired?: 'PRICE_AT_P10_FLOOR' | 'BUY_NOW_LOW_DROP_PROB' | 'SUDDEN_PRICE_DROP' | string;
  history: {
    timestamp: string;
    price: number;
    status: string;
  }[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'PRICE_DROP' | 'OPTIMAL_BUY' | 'SURGE_WARNING' | 'SYSTEM_INFO';
  timestamp: string;
  read: boolean;
  routeId?: string;
  priceDelta?: number;
}

export interface AggregatorStatus {
  isRunning: boolean;
  collectorInterval: 'every 3 hours' | 'hourly' | 'daily' | 'manual' | string;
  lastRunTimestamp: string;
  nextRunTimestamp: string;
  totalSnapshotsCollected: number;
  activeRoutesMonitored: string[];
  autoDiscoveryStatus?: {
    lastScannedAt: string;
    totalActiveAirlines: number;
    carriersCovered: string[];
    autoDiscoveredFlightsCount: number;
    mode: 'AUTOMATIC_LIVE_GDS_SYNC';
  };
  lastError: string | null;
  sources: {
    name: string;
    status: 'online' | 'degraded' | 'offline';
    lastLatencyMs: number;
  }[];
}

export interface FeatureImportance {
  feature: string;
  importancePercentage: number;
  description: string;
}

export interface MLModelComparison {
  heuristicModel: {
    name: string;
    type: 'Statistical Yield Curve (EMSRb)';
    predictedPrice: number;
    recommendation: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING';
    confidenceScore: number;
    maeHistorical: number; // Mean Absolute Error in INR
    rmseHistorical: number;
  };
  mlRegressionModel: {
    name: string;
    type: 'Quantile Gradient Boosted Forest';
    predictedMedianP50: number;
    predictedP10: number; // 10th percentile - lowest reachable floor
    predictedP90: number; // 90th percentile - peak surge ceiling
    recommendation: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING';
    confidenceScore: number;
    maeHistorical: number;
    rmseHistorical: number;
    trainingDataPointsCount: number;
  };
  consensusVerdict: {
    agreement: boolean;
    finalRecommendation: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING';
    dropProbabilityPercent: number;
    surgeProbabilityPercent: number;
    overallConfidence: number;
  };
  featureImportances: FeatureImportance[];
}

export interface SmartDateRecommendation {
  id: string;
  title: string;
  tag?: 'Best Value' | 'Lowest Fare' | 'Minimal Leaves' | 'Holiday Peak';
  outboundDate: string; // YYYY-MM-DD
  outboundDayOfWeek: string;
  outboundPrice: number;
  bestOutboundFlight?: {
    flightNumber: string;
    airline: string;
    airlineCode: string;
    departureTime: string;
    arrivalTime: string;
    stops: number;
    price: number;
  };
  returnDate: string; // YYYY-MM-DD
  returnDayOfWeek: string;
  returnPrice: number;
  bestReturnFlight?: {
    flightNumber: string;
    airline: string;
    airlineCode: string;
    departureTime: string;
    arrivalTime: string;
    stops: number;
    price: number;
  };
  totalRoundTripPrice: number;
  peakRoundTripPrice: number;
  totalSavingsINR: number;
  tripDurationDays: number;
  workDaysOffNeeded: number;
  verdict: 'HIGHLY_RECOMMENDED' | 'GOOD_VALUE' | 'EXPENSIVE_PEAK';
  rationale: string;
  surgeRisk: 'Low' | 'Moderate' | 'Severe';
}

export interface SmartDateFinderResponse {
  queryFestivalOrEvent: string;
  origin: string;
  destination: string;
  searchWindow: {
    start: string;
    end: string;
  };
  recommendations: SmartDateRecommendation[];
  summaryAnalysis: string;
}

export interface TrackedPredictionRecord {
  id: string;
  createdAt: string;
  routeId: string;
  origin: string;
  destination: string;
  departureDate: string;
  flightGroupId?: string; // e.g. "PNQ-LKO-2026-10-18"
  daysToDeparture?: number; // e.g. 58
  initialPriceAtPrediction: number;
  predictedMin: number;
  predictedMax: number;
  predictedP50: number;
  dropProbability: number;
  recommendationGiven: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING';
  modelUsed: 'Quantile ML Forest' | 'Statistical Heuristic' | 'Ensemble Consensus';
  confidenceScore: number;
  modelVersion?: string; // e.g. "v1.2.0-quantile-forest"
  
  // Ground truth actual outcome verification
  actualLowestPriceObserved?: number;
  actualLowestDateObserved?: string;
  finalPriceAtDeparture?: number;
  status: 'PENDING_VERIFICATION' | 'VERIFIED_CORRECT' | 'VERIFIED_PARTIAL' | 'DIVERGED';
  wasAccurate?: boolean;
  actualSavingsOrLossINR?: number;
  auditNotes?: string;
}

export interface PredictionAuditSummary {
  totalPredictionsLogged: number;
  verifiedCount: number;
  pendingCount: number;
  overallAccuracyRate: number; // e.g. 88.5%
  totalTravelerSavingsRealizedINR: number;
  recentRecords: TrackedPredictionRecord[];
}

export interface YoYDataPoint {
  year: number; // 2024, 2025, 2026
  daysToDeparture: number;
  relativeDateLabel: string;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  festivalEvent?: string;
}

