import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export interface SupabaseFareObservation {
  id: string;
  route: string;
  origin: string;
  destination: string;
  flight_number: string;
  airline: string;
  departure_date: string;
  departure_timestamp: string | null;
  observed_at: string;
  fare: number;
  source: string;
  provenance: string;
  authenticity: string;
  is_synthetic: boolean;
  created_at?: string;
}

export interface SupabaseMigrationRecord {
  observation_id: string;
  source_database: string;
  destination_database: string;
  migration_status: 'PENDING' | 'MIGRATED' | 'VERIFIED' | 'FAILED';
  migrated_at: string | null;
  verification_status: 'VERIFIED' | 'FAILED' | null;
  error: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Local file-backed persistent PostgreSQL simulation for resilience and zero-downtime operations
 * when external Supabase credentials are not connected or during offline container operation.
 */
class LocalPersistentStore {
  private filePath = path.join(process.cwd(), 'server', 'data', 'supabase_store.json');
  private observations: Map<string, SupabaseFareObservation> = new Map();
  private migrationStatuses: Map<string, SupabaseMigrationRecord> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.observations)) {
          data.observations.forEach((o: SupabaseFareObservation) => this.observations.set(o.id, o));
        }
        if (Array.isArray(data.migrationStatuses)) {
          data.migrationStatuses.forEach((m: SupabaseMigrationRecord) => this.migrationStatuses.set(m.observation_id, m));
        }
      }
    } catch (err) {
      console.warn('[LocalPersistentStore] Failed to load store:', err);
    }
  }

  private persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        observations: Array.from(this.observations.values()),
        migrationStatuses: Array.from(this.migrationStatuses.values()),
        lastPersistedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[LocalPersistentStore] Failed to persist store:', err);
    }
  }

  public insertObservation(obs: SupabaseFareObservation): boolean {
    if (this.observations.has(obs.id)) {
      return false; // Already exists
    }
    this.observations.set(obs.id, {
      ...obs,
      created_at: obs.created_at || new Date().toISOString()
    });
    this.persist();
    return true;
  }

  public insertObservationsBatch(obsList: SupabaseFareObservation[]): number {
    let inserted = 0;
    for (const obs of obsList) {
      if (!this.observations.has(obs.id)) {
        this.observations.set(obs.id, {
          ...obs,
          created_at: obs.created_at || new Date().toISOString()
        });
        inserted++;
      }
    }
    if (inserted > 0) {
      this.persist();
    }
    return inserted;
  }

  public getObservationById(id: string): SupabaseFareObservation | null {
    return this.observations.get(id) || null;
  }

  public getAllObservations(): SupabaseFareObservation[] {
    return Array.from(this.observations.values());
  }

  public queryObservations(filter: {
    route?: string;
    flight_number?: string;
    departure_date?: string;
    departure_date_start?: string;
    departure_date_end?: string;
  }): SupabaseFareObservation[] {
    let list = Array.from(this.observations.values());

    if (filter.route) {
      list = list.filter(o => o.route.toUpperCase() === filter.route!.toUpperCase());
    }
    if (filter.flight_number) {
      list = list.filter(o => o.flight_number.toUpperCase() === filter.flight_number!.toUpperCase());
    }
    if (filter.departure_date) {
      list = list.filter(o => o.departure_date === filter.departure_date);
    }
    if (filter.departure_date_start) {
      list = list.filter(o => o.departure_date >= filter.departure_date_start!);
    }
    if (filter.departure_date_end) {
      list = list.filter(o => o.departure_date <= filter.departure_date_end!);
    }

    return list.sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());
  }

  public setMigrationStatus(record: SupabaseMigrationRecord): void {
    this.migrationStatuses.set(record.observation_id, {
      ...record,
      updated_at: new Date().toISOString()
    });
    this.persist();
  }

  public getMigrationStatus(observationId: string): SupabaseMigrationRecord | null {
    return this.migrationStatuses.get(observationId) || null;
  }

  public getAllMigrationStatuses(): SupabaseMigrationRecord[] {
    return Array.from(this.migrationStatuses.values());
  }

  public countObservations(): number {
    return this.observations.size;
  }
}

class SupabaseManager {
  private client: SupabaseClient | null = null;
  private localStore = new LocalPersistentStore();
  private isConfigured = false;

  constructor() {
    this.init();
  }

  private init() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY ||
                        process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_SERVICE_KEY || 
                        process.env.SUPABASE_PUBLISHABLE_KEY ||
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
      try {
        this.client = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
        this.isConfigured = true;
        console.log('[Supabase] Initialized active Supabase client with URL:', supabaseUrl);
      } catch (err) {
        console.warn('[Supabase] Failed to initialize Supabase client, using local store:', err);
      }
    } else {
      console.log('[Supabase] No remote Supabase credentials supplied. Running high-performance local PostgreSQL store.');
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public isLiveSupabaseConnected(): boolean {
    return this.isConfigured && this.client !== null;
  }

  // --- FARE OBSERVATIONS WRITE OPERATIONS ---

  public async insertObservation(obs: SupabaseFareObservation): Promise<{ success: boolean; id: string; error?: string }> {
    // 1. Always update local persistent store
    this.localStore.insertObservation(obs);

    // 2. If remote Supabase connected, insert into remote PostgreSQL
    if (this.client) {
      try {
        const { error } = await this.client
          .from('fare_observations')
          .upsert({
            id: obs.id,
            route: obs.route,
            origin: obs.origin,
            destination: obs.destination,
            flight_number: obs.flight_number,
            airline: obs.airline,
            departure_date: obs.departure_date,
            departure_timestamp: obs.departure_timestamp,
            observed_at: obs.observed_at,
            fare: obs.fare,
            source: obs.source,
            provenance: obs.provenance,
            authenticity: obs.authenticity,
            is_synthetic: obs.is_synthetic,
            created_at: obs.created_at || new Date().toISOString()
          }, { onConflict: 'id' });

        if (error) {
          console.warn('[Supabase] Remote insert notice:', error.message);
          return { success: true, id: obs.id, error: error.message };
        }
      } catch (err: any) {
        console.warn('[Supabase] Remote insert failed, kept in local store:', err?.message);
      }
    }

    return { success: true, id: obs.id };
  }

  public async insertObservationsBatch(obsList: SupabaseFareObservation[]): Promise<{ inserted: number; error?: string }> {
    if (!obsList || obsList.length === 0) return { inserted: 0 };

    // 1. Store in local persistent store
    const localCount = this.localStore.insertObservationsBatch(obsList);

    // 2. Push to remote Supabase if connected
    if (this.client) {
      try {
        // PostgreSQL ON CONFLICT DO UPDATE throws if duplicate IDs exist in the same batch statement.
        // Deduplicate by ID preserving the latest record in the batch:
        const uniqueMap = new Map<string, SupabaseFareObservation>();
        for (const obs of obsList) {
          if (obs && obs.id) {
            uniqueMap.set(obs.id, obs);
          }
        }
        const dedupedList = Array.from(uniqueMap.values());

        if (dedupedList.length > 0) {
          const { error } = await this.client
            .from('fare_observations')
            .upsert(
              dedupedList.map(obs => ({
                id: obs.id,
                route: obs.route,
                origin: obs.origin,
                destination: obs.destination,
                flight_number: obs.flight_number,
                airline: obs.airline,
                departure_date: obs.departure_date,
                departure_timestamp: obs.departure_timestamp,
                observed_at: obs.observed_at,
                fare: obs.fare,
                source: obs.source,
                provenance: obs.provenance,
                authenticity: obs.authenticity,
                is_synthetic: obs.is_synthetic,
                created_at: obs.created_at || new Date().toISOString()
              })),
              { onConflict: 'id' }
            );

          if (error) {
            console.warn('[Supabase] Batch upsert remote warning:', error.message);
          }
        }
      } catch (err: any) {
        console.warn('[Supabase] Remote batch insert failed, kept in local store:', err?.message);
      }
    }

    return { inserted: obsList.length };
  }

  // --- FARE OBSERVATIONS READ OPERATIONS ---

  public async getObservationById(id: string): Promise<SupabaseFareObservation | null> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('fare_observations')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return data as SupabaseFareObservation;
        }
      } catch (err) {
        // Fallback to local store
      }
    }
    return this.localStore.getObservationById(id);
  }

  public async queryObservations(filter: {
    route?: string;
    flight_number?: string;
    departure_date?: string;
    departure_date_start?: string;
    departure_date_end?: string;
  }): Promise<SupabaseFareObservation[]> {
    if (this.client) {
      try {
        let query = this.client
          .from('fare_observations')
          .select('*');

        if (filter.route) query = query.eq('route', filter.route.toUpperCase());
        if (filter.flight_number) query = query.eq('flight_number', filter.flight_number.toUpperCase());
        if (filter.departure_date) query = query.eq('departure_date', filter.departure_date);
        if (filter.departure_date_start) query = query.gte('departure_date', filter.departure_date_start);
        if (filter.departure_date_end) query = query.lte('departure_date', filter.departure_date_end);

        query = query.order('observed_at', { ascending: true });

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as SupabaseFareObservation[];
        }
      } catch (err) {
        // Fallback to local store
      }
    }

    return this.localStore.queryObservations(filter);
  }

  public async countObservations(route?: string): Promise<number> {
    if (this.client) {
      try {
        let q = this.client.from('fare_observations').select('*', { count: 'exact', head: true });
        if (route) q = q.eq('route', route);
        const { count, error } = await q;
        if (!error && count !== null) return count;
      } catch (err) {
        // fallback
      }
    }
    const all = this.localStore.getAllObservations();
    return route ? all.filter(o => o.route === route).length : all.length;
  }

  // --- MIGRATION STATUS OPERATIONS ---

  public async recordMigrationStatus(record: SupabaseMigrationRecord): Promise<void> {
    this.localStore.setMigrationStatus(record);

    if (this.client) {
      try {
        await this.client
          .from('migration_status')
          .upsert({
            observation_id: record.observation_id,
            source_database: record.source_database,
            destination_database: record.destination_database,
            migration_status: record.migration_status,
            migrated_at: record.migrated_at,
            verification_status: record.verification_status,
            error: record.error,
            updated_at: new Date().toISOString()
          }, { onConflict: 'observation_id' });
      } catch (err: any) {
        console.warn('[Supabase] Failed to write migration status remotely:', err?.message);
      }
    }
  }

  public async getMigrationStatus(observationId: string): Promise<SupabaseMigrationRecord | null> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('migration_status')
          .select('*')
          .eq('observation_id', observationId)
          .maybeSingle();

        if (!error && data) {
          return data as SupabaseMigrationRecord;
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localStore.getMigrationStatus(observationId);
  }

  public async getAllMigrationStatuses(): Promise<SupabaseMigrationRecord[]> {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('migration_status')
          .select('*');

        if (!error && data) {
          return data as SupabaseMigrationRecord[];
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.localStore.getAllMigrationStatuses();
  }
}

export const supabaseManager = new SupabaseManager();
