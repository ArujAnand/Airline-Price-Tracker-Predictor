/**
 * Background Scheduler & Prospective Prediction Daemon
 * 
 * Periodically executes:
 * 1. 3-Hour price observation collection across monitored routes (PNQ-LKO, LKO-PNQ).
 * 2. Prospective background prediction generation (marked EXPERIMENTAL_BACKGROUND).
 * 3. Point-in-time feature extraction with zero look-ahead future data.
 * 4. Ground-truth horizon expiry tracking.
 */

import { flightAggregator } from './aggregator';
import { trajectoryService } from './trajectoryService';
import { firestoreDB } from './firestoreService';
import { PredictionAuditRecord, FactualContextFeatures } from './types/mlPipeline';
import { buildCanonicalFlightKey } from './flightIdentity';
import { decisionEpisodeService } from './decisionEpisodeService';

export class BackgroundSchedulerDaemon {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('⏰ [Scheduler] Background prospective observation & prediction daemon started (3-hour cycle).');

    // Run initial sweep after 5 seconds
    setTimeout(() => {
      this.runCycle().catch(err => console.error('[Scheduler] Initial cycle error:', err));
    }, 5000);

    this.intervalTimer = setInterval(() => {
      this.runCycle().catch(err => console.error('[Scheduler] Periodic cycle error:', err));
    }, this.INTERVAL_MS);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('⏰ [Scheduler] Background daemon stopped.');
  }

  /**
   * Runs a complete collection & prospective background prediction cycle
   */
  public async runCycle(force = false): Promise<{ snapshotsCollected: number; prospectivePredictionsLogged: number }> {
    console.log(`⏰ [Scheduler] Starting observation cycle at ${new Date().toISOString()} (force=${force})`);

    // 1. Trigger live price collection across routes
    const freshSnapshots = flightAggregator.triggerManualSync(force);
    console.log(`⏰ [Scheduler] Captured ${freshSnapshots.length} fresh real price snapshots.`);

    // Process fresh snapshots into Decision Episodes
    for (const rawS of freshSnapshots) {
      try {
        const normS = trajectoryService.normalizeRawSnapshot(rawS);
        await decisionEpisodeService.processSnapshot(normS);
      } catch (err) {
        console.error('[Scheduler] Error processing snapshot into decision episode:', err);
      }
    }

    // 2. Fetch all real prior snapshots for point-in-time feature generation
    const allRawSnapshots = await firestoreDB.getSnapshots(undefined, 1000);
    const normalizedSnapshots = allRawSnapshots.map(s => trajectoryService.normalizeRawSnapshot(s));

    // 3. Generate prospective background predictions for all active flights
    let prospectiveCount = 0;
    const nowISO = new Date().toISOString();
    const targetRoutes = ['PNQ-LKO', 'LKO-PNQ'];

    // Target sample dates: 1 to 60 days out
    const sampleDates: string[] = [];
    const today = new Date();
    for (const offset of [1, 3, 7, 14, 21, 28, 35, 45, 60]) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      sampleDates.push(d.toISOString().split('T')[0]);
    }

    for (const routeId of targetRoutes) {
      const [origin, destination] = routeId.split('-');

      for (const dateStr of sampleDates) {
        const flights = flightAggregator.getFlights(origin, destination, dateStr);

        for (const fl of flights) {
          try {
            const canonicalKey = buildCanonicalFlightKey(origin, destination, fl.flightNumber, dateStr, fl.airlineCode);
            
            // Extract point-in-time features strictly up to now (t <= now)
            const features: FactualContextFeatures = trajectoryService.extractPointInTimeFeatures(
              canonicalKey.canonicalId,
              nowISO,
              fl.currentPrice,
              normalizedSnapshots
            );

            // Compute empirical baseline prediction (Point-in-time only)
            const currentFare = fl.currentPrice;
            const leadDays = features.leadTimeDays;

            // Deterministic, idempotent prediction ID based on canonical flight ID and 3-hour window
            // Guarantees server restarts in the same window update the same document without creating duplicates
            const currentHourWindow = Math.floor(today.getHours() / 3) * 3;
            const windowKey = `${today.toISOString().split('T')[0]}-h${String(currentHourWindow).padStart(2, '0')}`;
            const predictionId = `pred-${canonicalKey.canonicalId}-${windowKey}`;

            const prospectiveRecord: PredictionAuditRecord = {
              predictionId,
              originType: 'EXPERIMENTAL_BACKGROUND',
              createdAt: nowISO,
              canonicalId: canonicalKey.canonicalId,
              routeId,
              origin,
              destination,
              departureDate: dateStr,
              departureTimestampAtPrediction: `${dateStr}T10:00:00.000Z`,
              leadTimeDays: Math.round(leadDays),
              leadTimeHours: Math.round(features.leadTimeHours),
              currentFareINR: currentFare,
              features,
              forecastingModelId: 'candidate-persistence-baseline',
              decisionModelId: 'candidate-insufficient-evidence-baseline',
              modelVersion: 'v1.0-empirical-real',
              maturityState: 'DATA_COLLECTION',
              provenance: 'REAL_OBSERVATION',
              forecast: {
                p10: Math.round(currentFare * 0.90),
                p50: currentFare,
                p90: Math.round(currentFare * 1.15),
                expectedMean: currentFare,
                uncertaintySpreadRatio: 0.25
              },
              selectedValidityHorizon: null, // Null during DATA_COLLECTION state or until empirical model selects one
              candidateHorizons: ['24h', '48h', '3d', '5d', '7d', '14d'], // Research/evaluation windows
              validUntil: null,
              meaningfulDropProbability: null, // Null during DATA_COLLECTION state
              rawDropFrequency: null,
              expectedSavingINR: null,
              expectedSurgeINR: null,
              recommendation: 'INSUFFICIENT_EVIDENCE',
              insufficientEvidenceReason: 'System is accumulating real longitudinal trajectories (DATA_COLLECTION maturity stage).',
              overallResolutionState: 'PENDING_HORIZONS',
              horizonResolutionStates: {},
              horizonOutcomes: {},
              isResolved: false
            };

            // Persist prospective record for future walk-forward auditing
            await firestoreDB.savePredictionRecord(prospectiveRecord as any);
            prospectiveCount++;
          } catch (itemErr) {
            console.warn('[Scheduler] Prospective prediction error for flight:', itemErr);
          }
        }
      }
    }

    console.log(`⏰ [Scheduler] Logged ${prospectiveCount} background prospective prediction records.`);
    return {
      snapshotsCollected: freshSnapshots.length,
      prospectivePredictionsLogged: prospectiveCount
    };
  }
}

export const backgroundScheduler = new BackgroundSchedulerDaemon();
