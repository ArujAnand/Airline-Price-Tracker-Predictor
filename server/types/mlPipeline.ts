/**
 * Production ML/Data-Science Pipeline Types & Schemas
 * 
 * Strict Data Purity Rules:
 * 1. Zero synthetic fare data permitted in empirical training or scientific evaluation.
 * 2. Festivals and calendar events are represented purely as factual variables with ZERO assumed price multipliers.
 * 3. Immutable ground-truth horizon outcomes preserve only raw observations; economic regret is computed in versioned evaluation layers.
 */

// ============================================================================
// 1. DATA PROVENANCE & OPERATIONAL MATURITY
// ============================================================================
export type DataProvenance = 
  | 'REAL_OBSERVATION'         // Genuine scraped/live market observation persisted from production
  | 'ISOLATED_TEST_FIXTURE'   // Isolated unit test fixture (Strictly prohibited from ML training)
  | 'EXPERIMENTAL';            // Live candidate model output generated for evaluation

export type ModelMaturityState = 
  | 'DATA_COLLECTION'          // Insufficient real longitudinal data; display factuals; recommend INSUFFICIENT_EVIDENCE
  | 'EXPERIMENTAL'             // Preliminary baseline models evaluating on prospective real observations
  | 'VALIDATION'               // Multi-week walk-forward validation and probability calibration active
  | 'PRODUCTION';              // Statistically verified champion model serving live recommendations

export type RecommendationAction = 
  | 'BUY_NOW'                  // Favorable buy timing within declared validity horizon
  | 'WAIT'                     // Favorable probability & magnitude of meaningful saving (>₹50) within validity horizon
  | 'INSUFFICIENT_EVIDENCE';   // Empirical support is inadequate; honest uncertainty

export type PredictionOrigin = 
  | 'USER_REQUESTED'           // Triggered by an active human user query in the UI
  | 'EXPERIMENTAL_BACKGROUND'; // Prospective prediction generated automatically by background daemon

export type HorizonPeriod = '24h' | '48h' | '3d' | '5d' | '7d' | '14d' | 'DEPARTURE';

export type SavingEventState = 
  | 'CONFIRMED_TRUE'           // Observed at least one snapshot where P_obs < P_0 - 50
  | 'CONFIRMED_FALSE'          // No snapshot < P_0 - 50 observed AND isSufficientCoverage === true
  | 'UNKNOWN_DUE_TO_COVERAGE'; // No snapshot < P_0 - 50 observed BUT isSufficientCoverage === false

export type HorizonResolutionState = 
  | 'PENDING'
  | 'RESOLVED'
  | 'UNRESOLVABLE_DUE_TO_DATA_QUALITY'
  | 'UNRESOLVABLE_FLIGHT_CANCELLED'
  | 'UNRESOLVABLE_FLIGHT_DEPARTED_BEFORE_HORIZON';

export type UnresolvedReason = 
  | 'FLIGHT_DEPARTED'
  | 'FLIGHT_CANCELLED_OR_DISAPPEARED'
  | 'INSUFFICIENT_COVERAGE'
  | 'SCRAPER_FAILURE'
  | 'SERVER_DOWNTIME'
  | 'IDENTITY_AMBIGUITY'
  | 'UNKNOWN';

// ============================================================================
// 2. FACTUAL CONTEXT & CALENDAR EVENTS (ZERO MULTIPLIERS)
// ============================================================================
export interface NearbyCalendarEvent {
  eventName: string;            // e.g. 'Diwali', 'Chhath Puja', 'Gandhi Jayanti', 'Dussehra'
  eventDate: string;            // 'YYYY-MM-DD'
  daysFromDeparture: number;    // Signed integer: e.g. -2 (2 days after event), +4 (4 days before event)
  eventType: 'FESTIVAL' | 'GAZETTED_PUBLIC_HOLIDAY' | 'RESTRICTED_HOLIDAY' | 'LONG_WEEKEND_ANCHOR';
}

export interface FactualContextFeatures {
  // 1. Raw Temporal Signals (Zero assumed groupings)
  leadTimeHours: number;             // Exact hours until scheduled departure
  leadTimeDays: number;              // Exact float: leadTimeHours / 24.0
  departureDayOfWeek: number;        // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  departureHourOfDay: number;        // 0..23 (IST)
  departureMinuteOfHour: number;     // 0..59
  isSaturday: boolean;               // Factual binary
  isSunday: boolean;                 // Factual binary
  isPublicHoliday: boolean;          // Factual gazetted holiday flag on departure date
  
  // 2. Factual Coexisting Calendar Events (Multiple events, empty array if none)
  nearbyEvents: NearbyCalendarEvent[];
  
  // 3. Raw Operational Context
  carrierCode: string;               // '6E', 'IX', 'QP', 'AI', 'SG'
  flightNumber: string;              // e.g. '6E-656'
  scheduledStops: number;            // 0, 1, 2
  scheduledDepartureTimeIST: string; // '06:10'
  
  // 4. Point-in-Time Trajectory Signals (Computed ONLY from t <= t_pred)
  currentSpotFareINR: number;
  observedTrajectoryLength: number;
  hoursSinceFirstObservation: number | null;
  trailing12hPriceDeltaINR: number | null; // null if no observation exists in window
  trailing24hPriceDeltaINR: number | null; // null if no observation exists in window
  trailingCorridorMedianFareINR: number | null;
}

// ============================================================================
// 3. CANONICAL FLIGHT IDENTITY & LONGITUDINAL TRAJECTORY
// ============================================================================
export interface CanonicalFlightKey {
  origin: string;              // 'PNQ'
  destination: string;         // 'LKO'
  carrierCode: string;         // '6E'
  flightNumber: string;        // '6E-656'
  departureDate: string;       // 'YYYY-MM-DD'
  canonicalId: string;         // 'PNQ-LKO-6E-656-2026-10-18'
}

export interface LongitudinalObservation {
  observationId: string;       // Unique observation id, e.g. 'obs-1727258400000-PNQ-LKO-6E-656-2026-10-18'
  canonicalId: string;         // References CanonicalFlightKey
  routeId: string;             // 'PNQ-LKO'
  origin: string;
  destination: string;
  carrierCode: string;
  flightNumber: string;
  departureDate: string;
  scheduledDepartureTime: string; // '06:10'
  observedAt: string;          // ISO-8601 Timestamp
  leadTimeHours: number;       // Elapsed hours until departure
  leadTimeDays: number;        // Elapsed days until departure
  priceINR: number;            // Observed spot fare
  currency: 'INR';
  isScheduleChanged: boolean;
  scheduleDriftMinutes: number;
  isIdentityInferred: boolean; // True if flight number could not be extracted directly from source
  provenance: DataProvenance;
  source: 'GOOGLE_FLIGHTS_SCRAPER' | 'LIVE_AGGREGATOR' | 'PERSISTED_FIRESTORE';
}

export interface FlightTrajectorySeries {
  canonicalId: string;
  origin: string;
  destination: string;
  carrierCode: string;
  flightNumber: string;
  departureDate: string;
  firstObservedAt: string;
  lastObservedAt: string;
  observationCount: number;
  minObservedPriceINR: number;
  maxObservedPriceINR: number;
  observations: LongitudinalObservation[]; // Sorted chronologically ascending
}

// ============================================================================
// 4. MULTI-HORIZON OUTCOME GROUND TRUTH (RAW OBSERVATIONS ONLY)
// ============================================================================
export interface HorizonOutcome {
  horizon: HorizonPeriod;
  predictionTimestamp: string;          // ISO-8601 prediction creation moment T
  targetExpiryTimestamp: string;        // Target ISO-8601 expiry moment T + H
  effectiveHorizonEndTimestamp: string; // Min(T + H, scheduledDeparture)
  wasHorizonTruncatedByDeparture: boolean;
  
  // Data Coverage & Quality Diagnostics
  expectedObservationCount: number;
  actualObservationCount: number;
  observationCoverageRatio: number;    // actualObservationCount / expectedObservationCount
  largestObservationGapHours: number;
  isSufficientCoverage: boolean;       // Threshold check (e.g. ratio >= 0.50 & gap <= 12h & count >= 2)
  firstObservationTimestamp: string | null;
  lastObservationTimestamp: string | null;
  
  // Factual Price Trajectory inside Horizon
  initialPriceINR: number;
  minimumPriceObservedINR: number | null;
  maximumPriceObservedINR: number | null;
  
  // Expiry Fare Measurement (Strict 4h WindowRule, Null if no snapshot close enough)
  priceAtExpiryINR: number | null;
  actualExpiryObservationTimestamp: string | null;
  expiryObservationDistanceMinutes: number | null;
  
  // A. Event Prediction Correctness (Product definition: strictly > ₹50 saving)
  hasMeaningfulSavingEvent: SavingEventState; // CONFIRMED_TRUE, CONFIRMED_FALSE, or UNKNOWN_DUE_TO_COVERAGE
  timeToFirstMeaningfulSavingHours: number | null;
  
  // B. Economic Quality & Persistence Metrics
  maxAchievableSavingINR: number | null;   // max(0, initialPrice - minPrice)
  maxDownsideSurgeINR: number | null;       // max(0, maxPrice - initialPrice)
  expiryPriceDeltaINR: number | null;       // priceAtExpiry - initialPrice
  
  // Saving Persistence & Opportunity Window
  meaningfulSavingObservationCount: number; // Count of snapshots where price <= initialPrice - 51
  meaningfulSavingDurationHours: number | null; // Step-interval estimate of duration saving remained available
  durationEstimationMethod: string | null;     // 'DISCRETE_SNAPSHOT_STEP_INTERVAL'
  
  // Traceability & Audit Reference
  observedTrajectorySnapshotIds: string[]; // List of snapshot IDs inside horizon window
  resolutionTimestamp: string;             // Moment when this horizon outcome was resolved
  resolutionVersion: string;               // e.g. 'v1.0-raw-factual-measurement'
}

// ============================================================================
// 5. VERSIONED DECISION EVALUATION (SEPARATED FROM RAW GROUND TRUTH)
// ============================================================================
export interface DecisionEvaluation {
  evaluationMethodId: string;          // Identifier of decision evaluation formula
  evaluationMethodVersion: string;     // e.g. 'v1.0-asymmetric-regret'
  evaluatedAt: string;
  predictionId: string;
  recommendation: RecommendationAction;
  horizon: HorizonPeriod;
  derivedMetrics: {
    wasDirectionallyCorrect: boolean | null;
    wasEconomicallyJustified: boolean | null;
    evaluatedFinancialRegretINR: number | null;
    netRealizedEconomicPayoffINR: number | null;
  };
}

// ============================================================================
// 6. PREDICTION & AUDIT RECORD SCHEMA
// ============================================================================
export interface PredictionAuditRecord {
  predictionId: string;        // 'pred-[ORIGIN]-[DEST]-[DATE]-[DTD]d-[TIMESTAMP]'
  originType: PredictionOrigin;
  createdAt: string;           // ISO-8601 Timestamp of prediction creation T
  canonicalId: string;         // 'PNQ-LKO-6E-656-2026-10-18'
  routeId: string;             // 'PNQ-LKO'
  origin: string;
  destination: string;
  departureDate: string;
  departureTimestampAtPrediction: string; // Scheduled departure timestamp known at creation T
  latestObservedDepartureTimestamp?: string;
  leadTimeDays: number;
  leadTimeHours: number;
  currentFareINR: number;
  
  // Point-in-time feature snapshot (strictly no future data)
  features: FactualContextFeatures;

  // Model Metadata
  forecastingModelId: string;
  decisionModelId: string;
  modelVersion: string;
  maturityState: ModelMaturityState;
  provenance: DataProvenance;

  // Forecast Outputs
  forecast: {
    p10: number;
    p50: number;
    p90: number;
    expectedMean: number;
    uncertaintySpreadRatio: number;
  };

  // Declared Recommendation & Horizon Research Windows
  selectedValidityHorizon: HorizonPeriod | null; // Null when INSUFFICIENT_EVIDENCE or unselected
  candidateHorizons: HorizonPeriod[];            // Evaluation windows: ['24h', '48h', '3d', '5d', '7d', '14d']
  validUntil: string | null;
  meaningfulDropProbability: number | null; // Calibrated probability of >₹50 drop (null if uncalibrated)
  rawDropFrequency: number | null;          // Empirical uncalibrated rate
  expectedSavingINR: number | null;
  expectedSurgeINR: number | null;
  recommendation: RecommendationAction;
  insufficientEvidenceReason?: string;

  // Multi-Horizon Independent Resolution Tracking
  overallResolutionState: 'PENDING_HORIZONS' | 'FULLY_RESOLVED' | 'UNRESOLVABLE';
  horizonResolutionStates: Partial<Record<HorizonPeriod, HorizonResolutionState>>;
  horizonOutcomes: Partial<Record<HorizonPeriod, HorizonOutcome>>;
  
  // Backward-compatibility references
  isResolved: boolean;
  resolvedAt?: string;
  actualOutcome?: HorizonOutcome; // Points to the first available resolved outcome or primary candidate
  unresolvedReason?: UnresolvedReason;
}

// ============================================================================
// 7. EVALUATION DATASET INTERFACE (FOR PHASE 3 CONSUMPTION)
// ============================================================================
export interface EvaluationDatasetFilter {
  horizon: HorizonPeriod;
  routeId?: string;
  originType?: PredictionOrigin;
  minCoverageRatio?: number;            // Default 0.50
  provenances?: DataProvenance[];      // Default ['REAL_OBSERVATION']
  requireSufficientCoverage?: boolean; // Default true
}

export interface EvaluationDatasetRow {
  predictionId: string;
  canonicalId: string;
  originType: PredictionOrigin;
  predictionTimestamp: string;
  departureDate: string;
  leadTimeHours: number;
  leadTimeDays: number;
  initialFareINR: number;
  
  // Point-in-time features (t <= T_pred)
  features: FactualContextFeatures;
  
  // Target Horizon Outcome
  horizon: HorizonPeriod;
  outcome: HorizonOutcome;
  
  // Target Labels for Phase 3 Model Training/Validation
  labelMeaningfulSaving: SavingEventState; // CONFIRMED_TRUE, CONFIRMED_FALSE, UNKNOWN
  labelMaxAchievableSavingINR: number | null;
  labelMaxDownsideSurgeINR: number | null;
  labelExpiryPriceDeltaINR: number | null;
}

// ============================================================================
// 8. MULTIDIMENSIONAL DATA SUFFICIENCY ASSESSMENT
// ============================================================================
export interface DataSufficiencyAssessment {
  independentCompletedLifecycles: number; // Closed trajectories tracked from early lead-time to departure
  totalVerifiedRealSnapshots: number;      // Total valid non-null Firestore observations
  uniqueFlightsTracked: number;
  calendarSpanDays: number;               // Elapsed days of genuine prospective tracking
  leadTimeRegimeCoverage: {
    shortTerm_0_7d: number;               // Count of trajectories with observations in 0-7d window
    mediumTerm_8_30d: number;             // Count of trajectories with observations in 8-30d window
    longTerm_31_90d: number;              // Count of trajectories with observations in 31-90d window
  };
  resolvedProspectivePredictions: number; // Completed prediction episodes with verified outcomes
  outcomeClassDiversity: {
    meaningfulDropCount: number;          // Episodes where >₹50 drop occurred
    stablePriceCount: number;             // Episodes where price remained within ±₹50
    adverseSurgeCount: number;            // Episodes where price increased >₹50
  };
  eventSampleSupport: {
    festivalsObservedCount: number;       // Distinct festival periods with real tracking data
    holidaysObservedCount: number;        // Distinct public holiday periods with real tracking data
  };
  maturityState: ModelMaturityState;
  maturityRationale: string;
}
