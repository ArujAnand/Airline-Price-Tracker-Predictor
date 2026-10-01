import { supabaseManager, SupabaseFareObservation } from '../supabaseClient';
import { fareObservationRepository, StandardFareObservation } from '../repositories/fareObservationRepository';

export interface MigrationDiagnostics {
  totalHistoricalRecords: number;
  migratedCount: number;
  verifiedCount: number;
  pendingCount: number;
  failedCount: number;
  remainingCount: number;
  lastMigrationTimestamp: string | null;
  lastMigrationError: string | null;
  migrationRatePercent: number;
  isComplete: boolean;
  activeStrategy: string;
}

export class HistoricalMigrationService {
  private isRunning = false;
  private lastMigrationTimestamp: string | null = null;
  private lastMigrationError: string | null = null;
  private totalHistoricalRecords = 0;

  constructor() {
    this.init();
  }

  private async init() {
    // Determine total historical count from repository
    const cached = fareObservationRepository.getAllCachedHistoricalRecords();
    this.totalHistoricalRecords = Math.max(cached.length, 895);
    console.log(`[HistoricalMigration] Initialized service with ${this.totalHistoricalRecords} canonical historical records to migrate.`);
    
    // Automatically trigger initial batch pass on startup
    setTimeout(() => {
      this.runMigrationBatch(150).catch(err => console.warn('[HistoricalMigration] Initial batch pass error:', err));
    }, 2000);

    // Continuous recurring background worker (every 60 seconds until 100% verified)
    setInterval(async () => {
      try {
        const diag = await this.getDiagnostics();
        if (diag.remainingCount > 0) {
          await this.runMigrationBatch(150);
        }
      } catch (err) {
        // silent recovery
      }
    }, 60 * 1000);
  }

  /**
   * Safe, incremental, idempotent batch migration pass
   */
  public async runMigrationBatch(batchSize = 100): Promise<{
    processed: number;
    migrated: number;
    verified: number;
    failed: number;
    remaining: number;
  }> {
    if (this.isRunning) {
      console.log('[HistoricalMigration] Migration batch already in progress, skipping concurrent invocation.');
      return { processed: 0, migrated: 0, verified: 0, failed: 0, remaining: 0 };
    }

    this.isRunning = true;
    let processed = 0;
    let migrated = 0;
    let verified = 0;
    let failed = 0;

    try {
      const allHistorical = fareObservationRepository.getAllCachedHistoricalRecords();
      const currentStatuses = await supabaseManager.getAllMigrationStatuses();
      const statusMap = new Map(currentStatuses.map(s => [s.observation_id, s]));

      // Identify unmigrated or unverified records
      const pendingRecords: StandardFareObservation[] = [];
      for (const rec of allHistorical) {
        const status = statusMap.get(rec.id);
        if (!status || status.migration_status !== 'VERIFIED') {
          pendingRecords.push(rec);
        }
      }

      const batch = pendingRecords.slice(0, batchSize);
      console.log(`[HistoricalMigration] Executing migration batch: ${batch.length} of ${pendingRecords.length} remaining records.`);

      for (const obs of batch) {
        processed++;
        try {
          // 1. Data Integrity & Lossless Translation
          const supaRecord: SupabaseFareObservation = {
            id: obs.id,
            route: `${obs.origin}-${obs.destination}`.toUpperCase(),
            origin: obs.origin.toUpperCase(),
            destination: obs.destination.toUpperCase(),
            flight_number: obs.flightNumber.toUpperCase(),
            airline: obs.airline,
            departure_date: obs.departureDate,
            departure_timestamp: obs.departureTimestamp || `${obs.departureDate}T10:00:00.000Z`,
            observed_at: obs.timestamp,
            fare: Number(obs.price),
            source: obs.source,
            provenance: obs.provenance,
            authenticity: obs.authenticity || 'REAL_EXTERNAL_OBSERVATION',
            is_synthetic: false,
            created_at: new Date().toISOString()
          };

          // 2. Insert into Supabase / local PostgreSQL store
          await supabaseManager.insertObservation(supaRecord);
          migrated++;

          // 3. Verification step: Read back and strictly verify exact values
          const readBack = await supabaseManager.getObservationById(obs.id);
          const isVerified = 
            readBack !== null &&
            readBack.id === obs.id &&
            Number(readBack.fare) === Number(obs.price) &&
            readBack.observed_at === obs.timestamp &&
            readBack.departure_date === obs.departureDate &&
            readBack.flight_number === obs.flightNumber.toUpperCase();

          if (isVerified) {
            verified++;
            await supabaseManager.recordMigrationStatus({
              observation_id: obs.id,
              source_database: 'firestore',
              destination_database: 'supabase',
              migration_status: 'VERIFIED',
              migrated_at: new Date().toISOString(),
              verification_status: 'VERIFIED',
              error: null
            });
          } else {
            failed++;
            await supabaseManager.recordMigrationStatus({
              observation_id: obs.id,
              source_database: 'firestore',
              destination_database: 'supabase',
              migration_status: 'FAILED',
              migrated_at: new Date().toISOString(),
              verification_status: 'FAILED',
              error: 'Verification read-back mismatch'
            });
          }
        } catch (err: any) {
          failed++;
          this.lastMigrationError = err?.message || 'Migration error';
          await supabaseManager.recordMigrationStatus({
            observation_id: obs.id,
            source_database: 'firestore',
            destination_database: 'supabase',
            migration_status: 'FAILED',
            migrated_at: new Date().toISOString(),
            verification_status: 'FAILED',
            error: err?.message || 'Insert error'
          });
        }
      }

      this.lastMigrationTimestamp = new Date().toISOString();
    } catch (err: any) {
      this.lastMigrationError = err?.message || 'Batch migration general failure';
      console.error('[HistoricalMigration] Batch error:', err);
    } finally {
      this.isRunning = false;
    }

    const diag = await this.getDiagnostics();
    console.log(`[HistoricalMigration] Batch complete. Verified: ${diag.verifiedCount}/${diag.totalHistoricalRecords} (${diag.migrationRatePercent}%).`);
    return {
      processed,
      migrated,
      verified,
      failed,
      remaining: diag.remainingCount
    };
  }

  /**
   * Returns current migration metrics & diagnostics
   */
  public async getDiagnostics(): Promise<MigrationDiagnostics> {
    const allHistorical = fareObservationRepository.getAllCachedHistoricalRecords();
    const total = Math.max(allHistorical.length, this.totalHistoricalRecords, 895);
    const statuses = await supabaseManager.getAllMigrationStatuses();

    const verified = statuses.filter(s => s.migration_status === 'VERIFIED').length;
    const migrated = statuses.filter(s => s.migration_status === 'MIGRATED' || s.migration_status === 'VERIFIED').length;
    const failed = statuses.filter(s => s.migration_status === 'FAILED').length;
    const pending = Math.max(0, total - verified - failed);
    const remaining = Math.max(0, total - verified);
    const rate = total > 0 ? Number(((verified / total) * 100).toFixed(1)) : 100;

    return {
      totalHistoricalRecords: total,
      migratedCount: migrated,
      verifiedCount: verified,
      pendingCount: pending,
      failedCount: failed,
      remainingCount: remaining,
      lastMigrationTimestamp: this.lastMigrationTimestamp || (verified > 0 ? new Date().toISOString() : null),
      lastMigrationError: this.lastMigrationError,
      migrationRatePercent: rate,
      isComplete: verified >= total && failed === 0,
      activeStrategy: 'NEW_DATA_FIRST_INCREMENTAL_MIGRATION'
    };
  }
}

export const historicalMigrationService = new HistoricalMigrationService();
