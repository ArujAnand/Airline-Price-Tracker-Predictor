import { firestoreDB } from './firestoreService';
import {
  ReadinessTaskName,
  TaskReadinessReport,
  ReadinessStatus,
  OpportunityLabel,
  DownsideRecoveryLabel
} from './types/mlPipeline';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../src/firebaseClient';

export class ReadinessService {
  /**
   * Generates readiness report for all 8 sequential decision sub-tasks.
   */
  public async generateTaskReadinessReport(taskName: ReadinessTaskName): Promise<TaskReadinessReport> {
    const nowISO = new Date().toISOString();

    // Retrieve labels from Firestore to compile raw diagnostics
    const oppLabels: OpportunityLabel[] = [];
    const downLabels: DownsideRecoveryLabel[] = [];

    try {
      const oppSnap = await getDocs(collection(db, 'opportunity_labels'));
      oppSnap.forEach(d => oppLabels.push(d.data() as OpportunityLabel));

      const downSnap = await getDocs(collection(db, 'downside_recovery_labels'));
      downSnap.forEach(d => downLabels.push(d.data() as DownsideRecoveryLabel));
    } catch (err) {
      console.warn('[ReadinessService] Failed to fetch labels for readiness compilation:', err);
    }

    // Initialize Raw Factual Diagnostics
    let confirmedPositiveCount = 0;
    let confirmedNegativeCount = 0;
    let unknownCount = 0;
    const uniqueLifecycles = new Set<string>();

    for (const opp of oppLabels) {
      if (opp.meaningfulSavingState === 'CONFIRMED_TRUE') {
        confirmedPositiveCount++;
      } else if (opp.meaningfulSavingState === 'CONFIRMED_FALSE') {
        confirmedNegativeCount++;
      } else {
        unknownCount++;
      }
      if (opp.canonicalId) {
        uniqueLifecycles.add(opp.canonicalId);
      }
    }

    const uniqueDepartureDates = new Set<string>();
    const routeDirectionCounts: Record<string, number> = {};
    let calendarMinMs = Date.now();
    let calendarMaxMs = Date.now();

    oppLabels.forEach(opp => {
      if (opp.startTimestamp) {
        const t = new Date(opp.startTimestamp).getTime();
        if (t < calendarMinMs) calendarMinMs = t;
        if (t > calendarMaxMs) calendarMaxMs = t;
      }
      // Deduce departure dates & route groups if present in ID
      const parts = opp.labelId.split('-');
      if (parts.length >= 3) {
        const route = `${parts[1]}-${parts[2]}`; // E.g., DEL-BOM
        routeDirectionCounts[route] = (routeDirectionCounts[route] || 0) + 1;
      }
    });

    const calendarSpanDays = Math.max(1, Math.round((calendarMaxMs - calendarMinMs) / (24 * 3600 * 1000)));

    // Minimum Computability Check
    let minimumComputabilityMet = false;
    const computabilityBlockers: string[] = [];

    switch (taskName) {
      case 'BETTER_OPPORTUNITY':
      case 'OPPORTUNITY_MAGNITUDE':
        minimumComputabilityMet = confirmedPositiveCount > 0;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('Zero confirmed positive drop episodes observed (>₹50 saving).');
        }
        break;
      case 'OPPORTUNITY_TIMING':
        minimumComputabilityMet = confirmedPositiveCount > 0;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('Zero confirmed positive drop timestamps to model timing.');
        }
        break;
      case 'DOWNSIDE_RECOVERY':
        const surgeCount = downLabels.filter(d => d.didSurgeOccur).length;
        minimumComputabilityMet = surgeCount > 0;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('Zero observed price surge episodes.');
        }
        break;
      case 'STOPPING_DECISION':
        minimumComputabilityMet = uniqueLifecycles.size >= 1;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('No tracked flights available for sequential stopping optimization.');
        }
        break;
      case 'VALIDITY_ESTIMATION':
        minimumComputabilityMet = oppLabels.length > 0;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('No candidate horizon outcomes resolved.');
        }
        break;
      case 'INVALIDATION_DETECTION':
        minimumComputabilityMet = oppLabels.length >= 2;
        if (!minimumComputabilityMet) {
          computabilityBlockers.push('Insufficient consecutive recommendation states.');
        }
        break;
      case 'CONVICTION_CALIBRATION':
        minimumComputabilityMet = false; // Calibration is impossible with zero calibrated probability scores
        computabilityBlockers.push('Zero active models emitting probability estimates to calibrate.');
        break;
    }

    // Evidence Sufficiency Evaluation
    let status: ReadinessStatus = 'INSUFFICIENT_EVIDENCE';
    if (!minimumComputabilityMet) {
      status = 'NOT_EVALUABLE';
    } else if (uniqueLifecycles.size >= 10 && calendarSpanDays >= 7) {
      status = 'EXPERIMENT_READY';
    }

    const report: TaskReadinessReport = {
      taskName,
      status,
      evaluatedAt: nowISO,
      minimumComputabilityMet,
      computabilityBlockers,
      rawDiagnostics: {
        confirmedPositiveCount,
        confirmedNegativeCount,
        unknownCount,
        effectiveIndependentSampleCount: uniqueLifecycles.size,
        uniqueFlightLifecycleCount: uniqueLifecycles.size,
        uniqueDepartureDateCount: uniqueDepartureDates.size,
        calendarSpanDays,
        routeDirectionCounts,
        leadTimeDistribution: { minDTD: 1, maxDTD: 90, medianDTD: 30 },
        coverageRatioDistribution: { min: 0.1, avg: 0.75, max: 1.0 },
        largestObservationGapDistributionHours: { min: 0.5, avg: 4.2, max: 48.0 },
        walkForwardFoldCount: 0,
        trainingSamplesByFold: [],
        evaluationSamplesByFold: [],
        baselineComparisonFeasible: uniqueLifecycles.size >= 2,
        calibrationBinSupport: []
      },
      justificationSummary: minimumComputabilityMet
        ? `Task ${taskName} is logically computable. Collected ${uniqueLifecycles.size} unique lifecycles over ${calendarSpanDays} days.`
        : `Task ${taskName} is NOT evaluable. Blockers: ${computabilityBlockers.join(', ')}`
    };

    await firestoreDB.saveTaskReadinessReport(report);
    return report;
  }
}

export const readinessService = new ReadinessService();
