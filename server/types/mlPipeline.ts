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
  | 'REAL_EXTERNAL_OBSERVATION'          // Genuine live scraped/API observations from production
  | 'REAL_VERIFIED_HISTORICAL_OBSERVATION' // Verified audited real historical snapshots
  | 'EXPERIMENTAL_EXTERNAL_OBSERVATION'    // Raw parallel experimental observations (Fli sidecar)
  | 'UNKNOWN_PROVENANCE'                 // Unverified snapshots with ambiguous harvest paths
  | 'CONFIRMED_NON_REAL'                 // Artificially generated/calculated yield fallback prices
  | 'ISOLATED_TEST_FIXTURE'              // Isolated test snapshots (Strictly prohibited from live pipelines/training)
  | 'CONFIRMED_TEST_ARTIFACT'            // Test generated artifact in storage (Strictly prohibited from live pipelines/training)
  | 'REAL_OBSERVATION'                   // Legacy real observations (for backwards compatibility)
  | 'EXPERIMENTAL';                      // Live candidate model output generated for evaluation

export interface ProvenanceEligibilityPolicy {
  mayEnterProductionSnapshots: boolean;
  mayEnterTrajectories: boolean;
  mayEnterDecisionEpisodes: boolean;
  mayEnterOutcomeResolution: boolean;
  mayEnterReadiness: boolean;
  mayEnterTraining: boolean;
  mayEnterProviderComparison: boolean;
}

export const PROVENANCE_ELIGIBILITY_MATRIX: Record<DataProvenance, ProvenanceEligibilityPolicy> = {
  REAL_EXTERNAL_OBSERVATION: {
    mayEnterProductionSnapshots: true,
    mayEnterTrajectories: true,
    mayEnterDecisionEpisodes: true,
    mayEnterOutcomeResolution: true,
    mayEnterReadiness: true,
    mayEnterTraining: true,
    mayEnterProviderComparison: true
  },
  REAL_VERIFIED_HISTORICAL_OBSERVATION: {
    mayEnterProductionSnapshots: true,
    mayEnterTrajectories: true,
    mayEnterDecisionEpisodes: true,
    mayEnterOutcomeResolution: true,
    mayEnterReadiness: true,
    mayEnterTraining: true,
    mayEnterProviderComparison: true
  },
  EXPERIMENTAL_EXTERNAL_OBSERVATION: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: true
  },
  UNKNOWN_PROVENANCE: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: false
  },
  CONFIRMED_NON_REAL: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: false
  },
  ISOLATED_TEST_FIXTURE: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: false
  },
  CONFIRMED_TEST_ARTIFACT: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: false
  },
  REAL_OBSERVATION: {
    mayEnterProductionSnapshots: true,
    mayEnterTrajectories: true,
    mayEnterDecisionEpisodes: true,
    mayEnterOutcomeResolution: true,
    mayEnterReadiness: true,
    mayEnterTraining: true,
    mayEnterProviderComparison: true
  },
  EXPERIMENTAL: {
    mayEnterProductionSnapshots: false,
    mayEnterTrajectories: false,
    mayEnterDecisionEpisodes: false,
    mayEnterOutcomeResolution: false,
    mayEnterReadiness: false,
    mayEnterTraining: false,
    mayEnterProviderComparison: false
  }
};

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
  meaningfulSavingObservedAtTimestamps: string[]; // Timestamps where price <= initialPrice - 51
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

export interface TrajectoryProvenanceReference {
  canonicalId?: string;
  throughTimestamp?: string;
  snapshotIds: string[];
  snapshotCount?: number;
  snapshotSetHash?: string;
  featureExtractorVersion?: string;
  cleanProspectiveEraStartedAt?: string;
  windowStartTimestamp?: string;
  windowEndTimestamp?: string;
  resolverVersion?: string;
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

  // Exact deterministic trajectory provenance reference (Task 2)
  trajectoryProvenanceReference?: TrajectoryProvenanceReference;
  evaluationEligibility?: 'ELIGIBLE_REAL' | 'QUARANTINED_NON_REAL_INPUT' | 'QUARANTINED_UNKNOWN_INPUT';

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
  
  // Operational tracking & resolution scheduling
  collectionCycleId?: string | null;
  freshObservationThisCycle?: boolean;
  latestObservationTimestamp?: string;
  observationAgeMinutes?: number;
  nextResolutionEligibleAt?: string | null;

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

// ============================================================================
// 9. PHASE 3 INFRASTRUCTURE SCHEMAS (REGISTRY, SHADOW & EVALUATION)
// ============================================================================
export type ModelCapability = 
  | 'POINT_PRICE_FORECAST'
  | 'QUANTILE_PRICE_FORECAST'
  | 'DROP_PROBABILITY'
  | 'HORIZON_SCORE'
  | 'DECISION_POLICY';

export type TaskCategory = 
  | 'PRICE_FORECASTING'
  | 'MEANINGFUL_DROP_EVENT'
  | 'HORIZON_SELECTION'
  | 'DECISION_POLICY';

export type ModelStatus = 
  | 'BASELINE'
  | 'CANDIDATE'
  | 'CHALLENGER'
  | 'CHAMPION'
  | 'RETIRED';

export interface ModelTaskEvaluationResults {
  evaluatorVersion: string;
  evaluatedAt: string;
  datasetManifestId: string;
  maeINR?: number | null;
  medianAbsoluteErrorINR?: number | null;
  rmseINR?: number | null;
  brierScore?: number | null;
  logLoss?: number | null;
  rocAUC?: number | null;
  maeImprovementVsPersistenceRatio?: number | null;
  statusRationale: string;
}

export interface ModelRegistryRecord {
  modelId: string;
  task: TaskCategory;
  algorithm: string;
  modelVersion: string;
  featureVersion: string;
  trainingDatasetVersion: string;
  trainingPeriod: { start: string; end: string };
  routes: string[];
  candidateHorizons: HorizonPeriod[];
  hyperparameters: Record<string, any>;
  trainingSampleCount: number;
  uniqueFlightCount: number;
  effectiveIndependentSampleCount: number;
  evaluationResults: ModelTaskEvaluationResults | null;
  status: ModelStatus;
  outputCapabilities: ModelCapability[];
  maturityState: ModelMaturityState;
  createdAt: string;
  lastEvaluatedAt: string | null;
  shadowPredictionCount: number;
  resolvedShadowPredictionCount: number;
}

export interface HorizonOutput {
  horizon: HorizonPeriod;
  pointForecastINR: number | null;        // null if model does not produce point forecast
  quantileForecasts: { p10: number; p50: number; p90: number } | null; // null if uncalibrated/unsupported
  dropProbability: number | null;         // null if model does not produce calibrated drop prob
  horizonScore: number | null;            // null if horizon selector inactive
  decisionPolicy: RecommendationAction | null; // null if decision policy inactive
  predictionStatus?: string;              // Optional extrapolation status
}

export interface ShadowPredictionRecord {
  shadowPredictionId: string;           // 'shadow-[modelId]-[canonicalId]-[windowKey]'
  modelId: string;
  modelVersion: string;
  predictionTimestamp: string;          // ISO-8601 moment T_pred before outcome occurs
  canonicalId: string;
  routeId: string;
  origin: string;
  destination: string;
  departureDate: string;
  currentSpotFareINR: number;
  horizonOutputs: Partial<Record<HorizonPeriod, HorizonOutput>>; // Horizon-specific outputs
  provenance: DataProvenance;
  createdAt: string;
}

export interface DatasetManifest {
  manifestId: string;
  manifestVersion: string;
  createdTimestamp: string;
  eligiblePredictionIds: string[];
  eligibleSnapshotIds: string[];
  horizonOutcomeVersions: Record<string, string>; // 'predictionId:horizon' -> resolutionVersion
  uniqueFlightCount: number;
  effectiveIndependentSampleCount: number;
  dataSpanDays: number;
  provenance: DataProvenance;
}

export interface CalibrationAnalysisReport {
  status: 'INSUFFICIENT_EVIDENCE' | 'CALIBRATED' | 'UNCALIBRATED';
  sampleCount: number;
  confirmedTrueCount: number;
  confirmedFalseCount: number;
  brierScore: number | null;
  logLoss: number | null;
  reliabilityBins: Array<{
    binRange: [number, number];
    expectedFreq: number;
    observedFreq: number;
    sampleCount: number;
  }>;
  rationale: string;
}

export interface FeatureGroupEvidence {
  featureGroup: 
    | 'CURRENT_FARE'
    | 'RECENT_TRAJECTORY'
    | 'LEAD_TIME'
    | 'ROUTE'
    | 'AIRLINE'
    | 'DEPARTURE_CALENDAR'
    | 'FESTIVAL_CONTEXT'
    | 'SCHEDULE_DRIFT'
    | 'VOLATILITY'
    | 'EXTERNAL_FACTUAL';
  evidenceStatus: 'SUPPORTED' | 'NOT_SUPPORTED' | 'INSUFFICIENT_EVIDENCE';
  multiFactorAssessment: {
    independentEventCount: number;
    departureDateCount: number;
    uniqueFlightCount: number;
    routeDirectionCoverageRatio: number;
    leadTimeRegimeCoverageRatio: number;
    nonEventBaselineComparisonCount: number;
    effectiveSampleSize: number;
  };
  rationale: string;
}

// ============================================================================
// 10. SEQUENTIAL BOOKING DECISION SCHEMAS & INSTRUMENTATION
// ============================================================================
export type EpisodeOriginType = 'EXPERIMENTAL_BACKGROUND' | 'USER_REQUESTED';

export interface DecisionEpisode {
  episodeId: string;                     // 'ep-[canonicalId]-[originType]' for background, 'ep-[canonicalId]-[originType]-[timestamp]' for user
  canonicalId: string;                   // 'DEL-BOM-6E-201-2026-10-18'
  originType: EpisodeOriginType;
  routeId: string;                       // 'DEL-BOM'
  airline: string;                       // 'IndiGo'
  flightNumber: string;                  // '6E-201'
  scheduledDeparture: string;            // ISO-8601
  trackingStartedAt: string;             // ISO-8601 (T0)
  initialFareINR: number;                // P(T0)
  currentEpisodeState: 'ACTIVE' | 'RESOLVED_BOUGHT' | 'RESOLVED_DEPARTED' | 'EXPIRED';
  
  // Sequential Recommendation Version IDs
  recommendationVersionIds: string[];
  
  // Market & Policy Outcomes (Separated)
  marketOutcomeId: string | null;
  shadowPolicyOutcomeIds: string[];      // Map of policyId -> policyOutcomeId

  provenance: DataProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationVersion {
  versionId: string;                     // 'rec-[episodeId]-v[sequenceNumber]'
  episodeId: string;
  sequenceNumber: number;               // 1, 2, 3...
  generatedAt: string;                  // ISO-8601 timestamp (T_gen)
  spotFareINR: number;                  // P(T_gen)
  
  // Recommendation State (Strictly INSUFFICIENT_EVIDENCE during DATA_COLLECTION)
  action: RecommendationAction;
  selectedValidityHorizon: HorizonPeriod | null; // Strictly NULL during DATA_COLLECTION
  validUntil: string | null;            // Strictly NULL during DATA_COLLECTION
  
  // Trigger Reason
  triggerReason: 
    | 'INITIAL_TRACKING'
    | 'SCHEDULED_EXPIRY'
    | 'OBSERVED_STATE_TRANSITION'
    | 'MANUAL_REASSESSMENT';
  
  previousVersionId: string | null;
  
  // Conviction & Calibration (Strictly NULL during DATA_COLLECTION)
  convictionProbability: number | null; // NULL
  calibrationStatus: 'INSUFFICIENT_EVIDENCE';
  
  createdAt: string;
}

export interface StateTransitionObservation {
  transitionObservationId: string;      // 'sto-[episodeId]-[currentSnapshotId]'
  episodeId: string;
  previousRecommendationVersionId: string | null;
  canonicalFlightId: string;

  // Timestamps
  previousObservationTimestamp: string;
  currentObservationTimestamp: string;
  elapsedMinutes: number;
  previousSnapshotId: string;
  currentSnapshotId: string;

  // Fare Metrics
  previousFareINR: number;
  currentFareINR: number;
  absoluteFareChangeINR: number;         // currentFareINR - previousFareINR
  percentageFareChange: number;          // (currentFareINR - previousFareINR) / previousFareINR

  // Lead Time & Context
  previousDTD: number;
  currentDTD: number;
  
  // Point-in-Time Features & Context (t <= currentObservationTimestamp)
  pointInTimeTrajectoryFeatures: {
    trailing24hDeltaINR: number | null;
    trailing72hDeltaINR: number | null;
    snapshotCountPast7d: number;
    volatilityINR: number | null;
  };
  factualContextAtCurrentObservation: {
    isWeekendDeparture: boolean;
    nearbyFestivalName: string | null;
    daysToNearbyFestival: number | null;
    scheduleDelayMinutes: number;
  };

  previousRecommendationAction: RecommendationAction;
  provenance: DataProvenance;
  createdAt: string;
}

export type RecommendationStateTransition =
  | 'WAIT_TO_WAIT'
  | 'WAIT_TO_BUY_NOW'
  | 'WAIT_TO_INSUFFICIENT_EVIDENCE'
  | 'BUY_NOW_TO_BUY_NOW'
  | 'BUY_NOW_TO_WAIT'
  | 'BUY_NOW_TO_INSUFFICIENT_EVIDENCE'
  | 'INSUFFICIENT_EVIDENCE_TO_WAIT'
  | 'INSUFFICIENT_EVIDENCE_TO_BUY_NOW'
  | 'INSUFFICIENT_EVIDENCE_TO_INSUFFICIENT_EVIDENCE';

export interface RecommendationTransition {
  transitionId: string;
  episodeId: string;
  policyId: string;
  fromVersionId: string;
  toVersionId: string;
  transitionType: RecommendationStateTransition;
  timestamp: string;
  fromFareINR: number;
  toFareINR: number;
  deltaFareINR: number;
  elapsedMinutes: number;
  associatedStateTransitionObservationId: string;
}

export type AsymmetricSavingState = 
  | 'CONFIRMED_TRUE'              // >₹50 saving observed (valid under any coverage)
  | 'CONFIRMED_FALSE'             // No saving observed AND coverage is sufficient
  | 'UNKNOWN_DUE_TO_COVERAGE';    // No saving observed BUT coverage is poor

export interface OpportunityLabel {
  labelId: string;                      // 'opp-[versionId]-[horizon]'
  versionId: string;
  canonicalId: string;
  startTimestamp: string;               // T_gen
  evaluationEndTimestamp: string;       // End of candidate evaluation horizon
  startingFareINR: number;              // P(T_gen)
  
  // Real Opportunity Outcomes (Observed)
  minimumObservedFareINR: number;
  timeToMinimumObservedFareMinutes: number;
  firstMeaningfulSavingTimestamp: string | null;
  timeToFirstMeaningfulSavingMinutes: number | null;
  bestObservedOpportunityINR: number;   // max(0, startingFareINR - minimumObservedFareINR)
  
  // Tri-State Asymmetric Observability
  meaningfulSavingState: AsymmetricSavingState;
  meaningfulSavingOccurred: boolean | null; // Compatibility field: true / false / null
  
  // Quality & Sampling Audit
  snapshotCountInWindow: number;
  isSufficientCoverage: boolean;
  largestObservationGapMinutes: number;
  coverageRatio: number;                // Observed hours / window hours
  
  // Trajectory Source Provenance Reference (No duplicated full arrays)
  trajectoryProvenance: TrajectoryProvenanceReference;
}

export interface DownsideRecoveryLabel {
  labelId: string;                      // 'down-[versionId]-[horizon]'
  versionId: string;
  canonicalId: string;
  startTimestamp: string;
  evaluationEndTimestamp: string;
  startingFareINR: number;
  
  // Surge / Adverse Movement
  maximumObservedFareINR: number;
  maxAdverseSurgeINR: number;           // max(0, maximumObservedFareINR - startingFareINR)
  timeToMaxAdverseSurgeMinutes: number | null;
  didSurgeOccur: boolean;               // maxAdverseSurgeINR > 0
  
  // Expanded Multi-Level Recovery Metrics
  returnedToStartFare: boolean;
  timeToReturnToStartFareMinutes: number | null;
  
  returnedBelowStartFare: boolean;
  bestObservedFareAfterSurgeINR: number | null;
  timeToBestObservedFareAfterSurgeMinutes: number | null;
  
  returnedToMeaningfulSaving: boolean;  // Achieved <= startingFareINR - 51 after surge
  timeToMeaningfulSavingAfterSurgeMinutes: number | null;

  isSufficientCoverage: boolean;
  resolutionStatus: 'CONFIRMED' | 'UNKNOWN_DUE_TO_COVERAGE';

  // Trajectory Source Provenance Reference
  trajectoryProvenance: TrajectoryProvenanceReference;
}

export interface MarketOutcome {
  marketOutcomeId: string;              // 'mkt-[canonicalId]'
  canonicalId: string;
  departureTimestamp: string;
  trackingStartTimestamp: string;
  trackingEndTimestamp: string;
  
  // Factual Market Trajectory Statistics
  initialObservedFareINR: number;
  finalObservedFareINR: number;
  minimumObservedFareINR: number;
  maximumObservedFareINR: number;
  minimumObservedFareTimestamp: string;
  maximumObservedFareTimestamp: string;
  
  // Trajectory Integrity
  totalSnapshotsCollected: number;
  overallCoverageRatio: number;
  largestObservationGapMinutes: number;
  
  trajectoryProvenance: TrajectoryProvenanceReference;
  createdAt: string;
}

export interface PolicyOutcome {
  policyOutcomeId: string;              // 'pol-[policyId]-[episodeId]'
  episodeId: string;
  policyId: string;                     // e.g. 'shadow-policy-persistence-stop'
  policyVersion: string;
  
  // Shadow Policy Execution Facts
  stoppedAtTimestamp: string | null;    // Moment shadow policy issued BUY_NOW
  fareAtStoppingINR: number | null;
  wasStoppedBeforeDeparture: boolean;
  
  // Counterfactual Comparison vs Real Market Trajectory
  opportunityCapturedINR: number | null;  // initialFare - fareAtStopping
  subsequentMinFareAfterStopINR: number | null; // Did fare drop further after BUY?
  opportunityMissedAfterStopINR: number | null;
  downsideAvoidedByStopINR: number | null;      // Did fare surge after BUY?
  downsideIncurredWhileWaitingINR: number | null; // Surge suffered before BUY
  
  // Evaluation Mode
  evaluationType: 'PROSPECTIVE_SHADOW' | 'RETROSPECTIVE_SIMULATION';
  createdAt: string;
}

export interface NotificationCandidate {
  candidateId: string;                  // 'notif-[versionId]-[timestamp]'
  episodeId: string;
  versionId: string;
  canonicalId: string;
  eventType: 
    | 'RECOMMENDATION_INVALIDATED'
    | 'BETTER_PRICE_OBSERVED'
    | 'WAIT_STILL_SUPPORTED'
    | 'BUY_OPPORTUNITY_DETECTED'
    | 'CONVICTION_CHANGED'
    | 'VALIDITY_EXPIRED';
  
  generatedAt: string;
  triggerFareINR: number;
  previousFareINR: number;
  headlineText: string;
  bodyText: string;
  
  // Shadow Mode Audit
  isShadowOnly: true;                   // ALWAYS true during DATA_COLLECTION
  wouldHaveBeenActionable: boolean | null;
  timeToNextSnapshotMinutes: number | null;
}

export type ReadinessTaskName = 
  | 'BETTER_OPPORTUNITY'
  | 'OPPORTUNITY_MAGNITUDE'
  | 'OPPORTUNITY_TIMING'
  | 'DOWNSIDE_RECOVERY'
  | 'STOPPING_DECISION'
  | 'VALIDITY_ESTIMATION'
  | 'INVALIDATION_DETECTION'
  | 'CONVICTION_CALIBRATION';

export type ReadinessStatus = 'NOT_EVALUABLE' | 'INSUFFICIENT_EVIDENCE' | 'EXPERIMENT_READY' | 'VALIDATION_READY';

export interface TaskReadinessReport {
  taskName: ReadinessTaskName;
  status: ReadinessStatus;
  evaluatedAt: string;
  
  // Logical Precondition Checks (Minimum Computability)
  minimumComputabilityMet: boolean;
  computabilityBlockers: string[];
  
  // Raw Factual Diagnostics (No opaque composite scores)
  rawDiagnostics: {
    confirmedPositiveCount: number;
    confirmedNegativeCount: number;
    unknownCount: number;
    effectiveIndependentSampleCount: number;
    uniqueFlightLifecycleCount: number;
    uniqueDepartureDateCount: number;
    calendarSpanDays: number;
    routeDirectionCounts: Record<string, number>;
    leadTimeDistribution: { minDTD: number; maxDTD: number; medianDTD: number };
    coverageRatioDistribution: { min: number; avg: number; max: number };
    largestObservationGapDistributionHours: { min: number; avg: number; max: number };
    walkForwardFoldCount: number;
    trainingSamplesByFold: number[];
    evaluationSamplesByFold: number[];
    baselineComparisonFeasible: boolean;
    calibrationBinSupport: number[];
  };

  justificationSummary: string;
}
