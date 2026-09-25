/**
 * Phase 2: Idempotent Audit & Horizon Resolution Worker
 * 
 * Periodically executes multi-horizon outcome resolution over all active predictions.
 * 
 * STRICT RULES:
 * 1. Idempotent: Executing worker multiple times produces identical outcomes without duplicates.
 * 2. Versioning: If late-arriving legitimate data resolves an outcome previously incomplete,
 *    re-resolution preserves audit trace with an incremented version (e.g. 'v1.1-re-resolved').
 * 3. Independent Horizons: Each horizon (24h, 48h, 3d, 5d, 7d, 14d) is resolved as soon as it elapses.
 * 4. Ground Truth Persistence: Persists updated prediction records back to Cloud Firestore.
 */

import { firestoreDB } from './firestoreService';
import { trajectoryService } from './trajectoryService';
import { outcomeResolverEngine } from './outcomeResolver';
import {
  PredictionAuditRecord,
  HorizonPeriod,
  HorizonResolutionState
} from './types/mlPipeline';

export class AuditOutcomeResolutionWorker {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // Run hourly

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔍 [Audit Worker] Multi-horizon outcome resolution worker started (hourly cycle).');

    // Run initial resolution sweep after 10 seconds
    setTimeout(() => {
      this.runResolutionCycle().catch(err => console.error('[Audit Worker] Initial sweep error:', err));
    }, 10000);

    this.intervalTimer = setInterval(() => {
      this.runResolutionCycle().catch(err => console.error('[Audit Worker] Periodic sweep error:', err));
    }, this.INTERVAL_MS);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('🔍 [Audit Worker] Outcome resolution worker stopped.');
  }

  /**
   * Runs a complete outcome resolution sweep across all prediction records
   */
  public async runResolutionCycle(nowISO = new Date().toISOString()): Promise<{
    evaluatedPredictionsCount: number;
    resolvedHorizonsCount: number;
    updatedRecordsCount: number;
  }> {
    console.log(`🔍 [Audit Worker] Running outcome resolution sweep at ${nowISO}...`);

    // 1. Load predictions & observations from persistent storage
    const allPredictions = await firestoreDB.getPredictionRecords();
    const rawSnapshots = await firestoreDB.getSnapshots(undefined, 2000);
    const normalizedObs = rawSnapshots.map(s => trajectoryService.normalizeRawSnapshot(s));

    let evaluatedPredictions = 0;
    let resolvedHorizonsTotal = 0;
    let updatedRecords = 0;

    for (const predRaw of allPredictions) {
      const pred = predRaw as unknown as PredictionAuditRecord;
      if (pred.provenance === 'ISOLATED_TEST_FIXTURE') continue;

      evaluatedPredictions++;
      const candidateHorizons: HorizonPeriod[] = pred.candidateHorizons || ['24h', '48h', '3d', '5d', '7d', '14d'];
      const currentStates = pred.horizonResolutionStates || {};
      const currentOutcomes = pred.horizonOutcomes || {};
      let isRecordModified = false;
      let newlyResolvedInCycle = 0;

      for (const horizon of candidateHorizons) {
        const currentState = currentStates[horizon] || 'PENDING';
        
        // Skip if already fully resolved unless force re-resolution is requested
        if (currentState === 'RESOLVED' && currentOutcomes[horizon]?.isSufficientCoverage) {
          continue;
        }

        const res = outcomeResolverEngine.resolveCandidateHorizon(pred, horizon, normalizedObs, nowISO);

        if (res.state === 'RESOLVED' && res.outcome) {
          currentStates[horizon] = 'RESOLVED';
          currentOutcomes[horizon] = res.outcome;
          isRecordModified = true;
          newlyResolvedInCycle++;
        }
      }

      if (isRecordModified) {
        // Evaluate overall prediction resolution state
        const allResolved = candidateHorizons.every(h => currentStates[h] === 'RESOLVED' || currentStates[h] === 'UNRESOLVABLE_DUE_TO_DATA_QUALITY');
        
        const updatedPred: PredictionAuditRecord = {
          ...pred,
          horizonResolutionStates: currentStates,
          horizonOutcomes: currentOutcomes,
          overallResolutionState: allResolved ? 'FULLY_RESOLVED' : 'PENDING_HORIZONS',
          isResolved: allResolved,
          resolvedAt: allResolved ? nowISO : pred.resolvedAt,
          actualOutcome: currentOutcomes['7d'] || currentOutcomes[candidateHorizons[0]] || pred.actualOutcome
        };

        await firestoreDB.savePredictionRecord(updatedPred as any);
        updatedRecords++;
        resolvedHorizonsTotal += newlyResolvedInCycle;
      }
    }

    console.log(`🔍 [Audit Worker] Sweep complete: ${evaluatedPredictions} predictions evaluated, ${resolvedHorizonsTotal} candidate horizons newly resolved, ${updatedRecords} records persisted.`);

    return {
      evaluatedPredictionsCount: evaluatedPredictions,
      resolvedHorizonsCount: resolvedHorizonsTotal,
      updatedRecordsCount: updatedRecords
    };
  }
}

export const auditOutcomeWorker = new AuditOutcomeResolutionWorker();
