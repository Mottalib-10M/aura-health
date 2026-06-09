-- =============================================================================
-- Uzavita - PostgreSQL Initialization Script
-- Runs on first container start via docker-entrypoint-initdb.d
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS clinical;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS scheduling;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Create read-only role for analytics
CREATE ROLE uzavita_readonly;
GRANT CONNECT ON DATABASE uzavita TO uzavita_readonly;
GRANT USAGE ON SCHEMA clinical, messaging, scheduling, analytics, audit TO uzavita_readonly;

-- Create application role
CREATE ROLE uzavita_app;
GRANT CONNECT ON DATABASE uzavita TO uzavita_app;
GRANT USAGE, CREATE ON SCHEMA clinical, messaging, scheduling, analytics, audit TO uzavita_app;

-- Logging confirmation
DO $$
BEGIN
  RAISE NOTICE 'Uzavita database initialized successfully';
END $$;
