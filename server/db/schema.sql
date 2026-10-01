-- Supabase PostgreSQL Schema for FareTracker & Incremental Historical Migration

-- 1. Fare Observations Table
CREATE TABLE IF NOT EXISTS fare_observations (
    id TEXT PRIMARY KEY,
    route TEXT NOT NULL,
    origin VARCHAR(10) NOT NULL,
    destination VARCHAR(10) NOT NULL,
    flight_number VARCHAR(50) NOT NULL,
    airline VARCHAR(100) NOT NULL,
    departure_date VARCHAR(20) NOT NULL,
    departure_timestamp TIMESTAMPTZ,
    observed_at TIMESTAMPTZ NOT NULL,
    fare NUMERIC NOT NULL,
    source TEXT NOT NULL,
    provenance TEXT NOT NULL,
    authenticity TEXT NOT NULL,
    is_synthetic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes for Historical Querying and Analytics
CREATE INDEX IF NOT EXISTS idx_fare_obs_route ON fare_observations(route);
CREATE INDEX IF NOT EXISTS idx_fare_obs_flight_date ON fare_observations(flight_number, departure_date);
CREATE INDEX IF NOT EXISTS idx_fare_obs_observed_at ON fare_observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_fare_obs_dep_date ON fare_observations(departure_date);
CREATE INDEX IF NOT EXISTS idx_fare_obs_route_dates ON fare_observations(route, departure_date);
CREATE INDEX IF NOT EXISTS idx_fare_obs_authenticity ON fare_observations(authenticity);

-- 2. Incremental Migration Tracking Table
CREATE TABLE IF NOT EXISTS migration_status (
    observation_id TEXT PRIMARY KEY,
    source_database TEXT NOT NULL DEFAULT 'firestore',
    destination_database TEXT NOT NULL DEFAULT 'supabase',
    migration_status TEXT NOT NULL, -- 'PENDING', 'MIGRATED', 'VERIFIED', 'FAILED'
    migrated_at TIMESTAMPTZ,
    verification_status TEXT, -- 'VERIFIED', 'FAILED'
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_status ON migration_status(migration_status);
CREATE INDEX IF NOT EXISTS idx_verification_status ON migration_status(verification_status);
