/**
 * Phase 3: Dataset Manifest Service
 * 
 * Generates deterministic, versioned dataset manifests referencing exact prediction IDs,
 * snapshot IDs, and resolved horizon outcome versions eligible at timestamp T_manifest.
 * 
 * Traceability Rule:
 * Every model training or evaluation run must reference a DatasetManifest so results can be exactly reproduced.
 */

import { firestoreDB } from './firestoreService';
import { trajectoryService } from './trajectoryService';
import {
  DatasetManifest,
  PredictionAuditRecord,
  HorizonPeriod
} from './types/mlPipeline';

export class DatasetManifestService {
  /**
   * Generates a versioned dataset manifest for eligible real predictions and resolved outcomes
   */
  public async generateManifest(
    manifestVersion = 'v1.0-empirical-resolved',
    targetHorizon?: HorizonPeriod,
    nowISO = new Date().toISOString()
  ): Promise<DatasetManifest> {
    const rawPredictions = await firestoreDB.getPredictionRecords();
    const rawSnapshots = await firestoreDB.getSnapshots(undefined, 5000);

    const eligiblePreds = rawPredictions.filter((p: any) => p.provenance === 'REAL_OBSERVATION') as unknown as PredictionAuditRecord[];
    const eligibleSnaps = rawSnapshots.filter(s => s.provenance === 'REAL_OBSERVATION');

    const eligiblePredIds: string[] = [];
    const outcomeVersions: Record<string, string> = {};
    const uniqueFlights = new Set<string>();

    for (const pred of eligiblePreds) {
      if (!pred.horizonOutcomes) continue;

      let hasEligibleHorizon = false;
      for (const [h, outcome] of Object.entries(pred.horizonOutcomes)) {
        if (targetHorizon && h !== targetHorizon) continue;
        if (outcome && outcome.isSufficientCoverage) {
          hasEligibleHorizon = true;
          outcomeVersions[`${pred.predictionId}:${h}`] = outcome.resolutionVersion || 'v1.0-raw-factual-measurement';
        }
      }

      if (hasEligibleHorizon) {
        eligiblePredIds.push(pred.predictionId);
        uniqueFlights.add(pred.canonicalId);
      }
    }

    const normSnaps = eligibleSnaps.map(s => trajectoryService.normalizeRawSnapshot(s));
    let spanDays = 0;
    if (normSnaps.length > 0) {
      const times = normSnaps.map(s => new Date(s.observedAt).getTime()).sort();
      spanDays = Number(((times[times.length - 1] - times[0]) / (86400 * 1000)).toFixed(1));
    }

    const manifest: DatasetManifest = {
      manifestId: `manifest-${manifestVersion}-${Date.now()}`,
      manifestVersion,
      createdTimestamp: nowISO,
      eligiblePredictionIds: eligiblePredIds,
      eligibleSnapshotIds: eligibleSnaps.map(s => s.id || (s as any).observationId),
      horizonOutcomeVersions: outcomeVersions,
      uniqueFlightCount: uniqueFlights.size,
      effectiveIndependentSampleCount: uniqueFlights.size,
      dataSpanDays: spanDays,
      provenance: 'REAL_OBSERVATION'
    };

    await firestoreDB.saveDatasetManifest(manifest);
    return manifest;
  }
}

export const datasetManifestService = new DatasetManifestService();
