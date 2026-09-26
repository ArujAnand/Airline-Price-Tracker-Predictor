/**
 * Phase 3 & 4: Shadow Prediction Daemon
 * 
 * Periodically generates prospective shadow predictions for registered baseline models
 * BEFORE outcomes occur.
 * 
 * STRICT SHADOW RULES:
 * 1. Prospective Execution: Shadow predictions are created BEFORE outcomes elapse.
 * 2. Horizon-Specific Outputs: Explicitly structures horizon outputs: horizonOutputs[horizon].
 * 3. Zero User Impact: Shadow predictions are stored in shadow_predictions Firestore collection
 *    and NEVER control user-facing BUY/WAIT recommendations (which remain INSUFFICIENT_EVIDENCE).
 * 4. Deterministic Idempotency: shadow-[modelId]-[canonicalId]-[windowKey] guarantees server restarts
 *    update the same document without generating duplicate records.
 */

import { flightAggregator } from './aggregator';
import { trajectoryService } from './trajectoryService';
import { firestoreDB } from './firestoreService';
import {
  persistenceBaseline,
  trailingStepBaseline,
  timeNormalizedMomentumBaseline
} from './baselines';
import { buildCanonicalFlightKey } from './flightIdentity';
import {
  HorizonPeriod,
  ShadowPredictionRecord
} from './types/mlPipeline';

export class ShadowPredictionDaemon {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔮 [Shadow Daemon] Background shadow prediction daemon started (3-hour cycle).');

    // Run initial sweep after 8 seconds
    setTimeout(() => {
      this.runShadowCycle().catch(err => console.error('[Shadow Daemon] Initial sweep error:', err));
    }, 8000);

    this.intervalTimer = setInterval(() => {
      this.runShadowCycle().catch(err => console.error('[Shadow Daemon] Periodic sweep error:', err));
    }, this.INTERVAL_MS);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('🔮 [Shadow Daemon] Shadow daemon stopped.');
  }

  /**
   * Runs a complete shadow prediction cycle across monitored routes
   */
  public async runShadowCycle(nowISO = new Date().toISOString()): Promise<{
    shadowPredictionsGenerated: number;
  }> {
    console.log(`🔮 [Shadow Daemon] Running prospective shadow prediction cycle at ${nowISO}...`);

    const rawSnapshots = await firestoreDB.getSnapshots(undefined, 2000);
    const normalizedSnapshots = rawSnapshots.map(s => trajectoryService.normalizeRawSnapshot(s));

    const candidateHorizons: HorizonPeriod[] = ['24h', '48h', '3d', '5d', '7d', '14d'];
    const targetRoutes = ['PNQ-LKO', 'LKO-PNQ'];
    let generatedCount = 0;
    let persistCount = 0;
    let stepCount = 0;
    let timeNormalizedCount = 0;

    const today = new Date();
    const currentHourWindow = Math.floor(today.getHours() / 3) * 3;
    const windowKey = `${today.toISOString().split('T')[0]}-h${String(currentHourWindow).padStart(2, '0')}`;

    // Sample dates: 1 to 60 days out
    const sampleDates: string[] = [];
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
            const currentFare = fl.currentPrice;

            // Prior snapshots strictly t <= nowISO
            const flightPriors = normalizedSnapshots.filter(s => 
              s.canonicalId === canonicalKey.canonicalId && new Date(s.observedAt).getTime() <= new Date(nowISO).getTime()
            );

            // 1. Generate Persistence Baseline Shadow Prediction
            const persistenceOutputs = persistenceBaseline.generateHorizonOutputs(currentFare, candidateHorizons);
            const shadowRecordPersist: ShadowPredictionRecord = {
              shadowPredictionId: `shadow-baseline-fare-persistence-${canonicalKey.canonicalId}-${windowKey}`,
              modelId: 'baseline-fare-persistence',
              modelVersion: 'v1.0-empirical',
              predictionTimestamp: nowISO,
              canonicalId: canonicalKey.canonicalId,
              routeId,
              origin,
              destination,
              departureDate: dateStr,
              currentSpotFareINR: currentFare,
              horizonOutputs: persistenceOutputs,
              provenance: 'REAL_OBSERVATION',
              createdAt: nowISO
            };

            await firestoreDB.saveShadowPredictionRecord(shadowRecordPersist);
            generatedCount++;
            persistCount++;

            // 2. Generate Trailing Step Baseline (Historical Semantics preserved)
            const stepOutputs = trailingStepBaseline.generateHorizonOutputs(
              currentFare,
              candidateHorizons,
              flightPriors,
              nowISO,
              24
            );
            const shadowRecordStep: ShadowPredictionRecord = {
              shadowPredictionId: `shadow-baseline-trailing-step-v1-${canonicalKey.canonicalId}-${windowKey}`,
              modelId: 'baseline-trailing-step-v1',
              modelVersion: 'v1.0-empirical',
              predictionTimestamp: nowISO,
              canonicalId: canonicalKey.canonicalId,
              routeId,
              origin,
              destination,
              departureDate: dateStr,
              currentSpotFareINR: currentFare,
              horizonOutputs: stepOutputs,
              provenance: 'REAL_OBSERVATION',
              createdAt: nowISO
            };

            await firestoreDB.saveShadowPredictionRecord(shadowRecordStep);
            generatedCount++;
            stepCount++;

            // 3. Generate Time-Normalized Momentum Baseline Shadow Prediction
            const timeNormalizedOutputs = timeNormalizedMomentumBaseline.generateHorizonOutputs(
              currentFare,
              candidateHorizons,
              flightPriors,
              nowISO,
              24
            );
            const shadowRecordTimeNormalized: ShadowPredictionRecord = {
              shadowPredictionId: `shadow-baseline-trailing-momentum-time-normalized-v1-${canonicalKey.canonicalId}-${windowKey}`,
              modelId: 'baseline-trailing-momentum-time-normalized-v1',
              modelVersion: 'v1.0-empirical',
              predictionTimestamp: nowISO,
              canonicalId: canonicalKey.canonicalId,
              routeId,
              origin,
              destination,
              departureDate: dateStr,
              currentSpotFareINR: currentFare,
              horizonOutputs: timeNormalizedOutputs,
              provenance: 'REAL_OBSERVATION',
              createdAt: nowISO
            };

            await firestoreDB.saveShadowPredictionRecord(shadowRecordTimeNormalized);
            generatedCount++;
            timeNormalizedCount++;

          } catch (itemErr) {
            console.warn('[Shadow Daemon] Error generating shadow prediction:', itemErr);
          }
        }
      }
    }

    console.log(`[Shadow Predictions by Model]`);
    console.log(`  persistence: ${persistCount}`);
    console.log(`  trailing-step: ${stepCount}`);
    console.log(`  normalized-momentum: ${timeNormalizedCount}`);
    console.log(`Total shadow predictions generated: ${generatedCount}`);
    return { shadowPredictionsGenerated: generatedCount };
  }
}

export const shadowSchedulerDaemon = new ShadowPredictionDaemon();
