/**
 * Phase 3: Model Registry Service & Promotion Governance
 * 
 * Tracks model metadata, tasks, algorithm types, output capabilities, evaluation results, and status.
 * 
 * STRICT PROMOTION GOVERNANCE:
 * 1. Prohibits assigning CHAMPION status when operational maturity is DATA_COLLECTION.
 * 2. Prohibits assigning CHAMPION status merely because a model trained, compiled, or won in-sample loss.
 * 3. Requires typed evaluation results; Record<string, any> is prohibited for core evaluation metrics.
 */

import { firestoreDB } from './firestoreService';
import {
  ModelRegistryRecord,
  ModelStatus,
  ModelMaturityState
} from './types/mlPipeline';

export class ModelRegistryService {
  private inMemoryRegistry: Map<string, ModelRegistryRecord> = new Map();

  public async init(): Promise<void> {
    // 1. Load existing records from persistent store
    const persisted = await firestoreDB.getModelRegistryRecords();
    for (const p of persisted) {
      if (p.modelId) {
        this.inMemoryRegistry.set(p.modelId, p as ModelRegistryRecord);
      }
    }

    // 2. Register baseline models if not present
    if (!this.inMemoryRegistry.has('baseline-fare-persistence')) {
      await this.registerModel({
        modelId: 'baseline-fare-persistence',
        task: 'PRICE_FORECASTING',
        algorithm: 'Current Spot Fare Persistence (Factual Naïve)',
        modelVersion: 'v1.0-empirical',
        featureVersion: 'v1.0-factual-point-in-time',
        trainingDatasetVersion: 'none-unlearned',
        trainingPeriod: { start: '2026-09-01T00:00:00Z', end: '2026-09-25T00:00:00Z' },
        routes: ['PNQ-LKO', 'LKO-PNQ'],
        candidateHorizons: ['24h', '48h', '3d', '5d', '7d', '14d'],
        hyperparameters: { strategy: 'persistence' },
        trainingSampleCount: 0,
        uniqueFlightCount: 0,
        effectiveIndependentSampleCount: 0,
        evaluationResults: null,
        status: 'BASELINE',
        outputCapabilities: ['POINT_PRICE_FORECAST'],
        maturityState: 'DATA_COLLECTION',
        createdAt: new Date().toISOString(),
        lastEvaluatedAt: null,
        shadowPredictionCount: 0,
        resolvedShadowPredictionCount: 0
      });
    }

    if (!this.inMemoryRegistry.has('baseline-trailing-momentum')) {
      await this.registerModel({
        modelId: 'baseline-trailing-momentum',
        task: 'PRICE_FORECASTING',
        algorithm: 'Trailing 24h Spot Delta Momentum (Factual Baseline)',
        modelVersion: 'v1.0-empirical',
        featureVersion: 'v1.0-factual-point-in-time',
        trainingDatasetVersion: 'none-unlearned',
        trainingPeriod: { start: '2026-09-01T00:00:00Z', end: '2026-09-25T00:00:00Z' },
        routes: ['PNQ-LKO', 'LKO-PNQ'],
        candidateHorizons: ['24h', '48h', '3d', '5d', '7d', '14d'],
        hyperparameters: { lookbackHours: 24 },
        trainingSampleCount: 0,
        uniqueFlightCount: 0,
        effectiveIndependentSampleCount: 0,
        evaluationResults: null,
        status: 'BASELINE',
        outputCapabilities: ['POINT_PRICE_FORECAST'],
        maturityState: 'DATA_COLLECTION',
        createdAt: new Date().toISOString(),
        lastEvaluatedAt: null,
        shadowPredictionCount: 0,
        resolvedShadowPredictionCount: 0
      });
    }
  }

  public async registerModel(record: ModelRegistryRecord): Promise<ModelRegistryRecord> {
    // Enforcement: Check status promotion rules
    if (record.status === 'CHAMPION') {
      this.validateChampionPromotionGuard(record);
    }

    this.inMemoryRegistry.set(record.modelId, record);
    await firestoreDB.saveModelRegistryRecord(record);
    return record;
  }

  public getModel(modelId: string): ModelRegistryRecord | undefined {
    return this.inMemoryRegistry.get(modelId);
  }

  public getAllModels(): ModelRegistryRecord[] {
    return Array.from(this.inMemoryRegistry.values());
  }

  /**
   * Status Promotion Guard: Prohibits promoting any model to CHAMPION unless strict empirical conditions are satisfied
   */
  public updateModelStatus(
    modelId: string,
    newStatus: ModelStatus,
    systemMaturityState: ModelMaturityState,
    rationale: string
  ): ModelRegistryRecord {
    const model = this.inMemoryRegistry.get(modelId);
    if (!model) {
      throw new Error(`ModelId ${modelId} not found in registry.`);
    }

    if (newStatus === 'CHAMPION') {
      if (systemMaturityState === 'DATA_COLLECTION') {
        throw new Error(`Promotion Violation: Cannot promote model '${modelId}' to CHAMPION while system maturity is DATA_COLLECTION.`);
      }
      if (!model.evaluationResults || model.evaluationResults.maeImprovementVsPersistenceRatio === null) {
        throw new Error(`Promotion Violation: Cannot promote model '${modelId}' to CHAMPION without held-out walk-forward evaluation results vs persistence baseline.`);
      }
    }

    model.status = newStatus;
    model.lastEvaluatedAt = new Date().toISOString();
    if (model.evaluationResults) {
      model.evaluationResults.statusRationale = rationale;
    }

    this.inMemoryRegistry.set(modelId, model);
    firestoreDB.saveModelRegistryRecord(model).catch(err => console.warn('Failed saving model status:', err));
    return model;
  }

  private validateChampionPromotionGuard(record: ModelRegistryRecord): void {
    if (record.maturityState === 'DATA_COLLECTION') {
      throw new Error(`Promotion Violation: Model '${record.modelId}' cannot be registered as CHAMPION while system maturity is DATA_COLLECTION.`);
    }
  }
}

export const modelRegistryService = new ModelRegistryService();
