-- OmniGraph PostgreSQL schema (Phase 1 baseline)

CREATE TABLE IF NOT EXISTS source_department (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(32) UNIQUE NOT NULL,
    department_name VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_entity (
    id BIGSERIAL PRIMARY KEY,
    unified_entity_id VARCHAR(32) UNIQUE,
    canonical_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    pan VARCHAR(32),
    city VARCHAR(128),
    state VARCHAR(128),
    pincode VARCHAR(16),
    source_system_count INT NOT NULL DEFAULT 0,
    resolution_quality NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    sample_decision_reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_identifier (
    id BIGSERIAL PRIMARY KEY,
    business_entity_id BIGINT REFERENCES business_entity(id) ON DELETE CASCADE,
    identifier_type VARCHAR(32) NOT NULL,
    identifier_value VARCHAR(128) NOT NULL,
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    source_department_id INT REFERENCES source_department(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (identifier_type, identifier_value)
);

CREATE TABLE IF NOT EXISTS business_address (
    id BIGSERIAL PRIMARY KEY,
    business_entity_id BIGINT REFERENCES business_entity(id) ON DELETE CASCADE,
    line_1 VARCHAR(255),
    city VARCHAR(128),
    state VARCHAR(128),
    pincode VARCHAR(16),
    normalized_address TEXT NOT NULL,
    source_department_id INT REFERENCES source_department(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingestion_run (
    id BIGSERIAL PRIMARY KEY,
    run_label VARCHAR(128) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
    records_read INT NOT NULL DEFAULT 0,
    records_written INT NOT NULL DEFAULT 0,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS source_record_map (
    id BIGSERIAL PRIMARY KEY,
    ingestion_run_id BIGINT REFERENCES ingestion_run(id) ON DELETE SET NULL,
    source_department_id INT REFERENCES source_department(id),
    source_record_id VARCHAR(128) NOT NULL,
    business_entity_id BIGINT REFERENCES business_entity(id) ON DELETE SET NULL,
    resolution_tier VARCHAR(32) NOT NULL DEFAULT 'UNRESOLVED',
    resolution_confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    resolution_reason TEXT,
    pan VARCHAR(32),
    name VARCHAR(255),
    address TEXT,
    city VARCHAR(128),
    state VARCHAR(128),
    pincode VARCHAR(16),
    raw_payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (source_department_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_business_identifier_value
    ON business_identifier(identifier_value);

CREATE INDEX IF NOT EXISTS idx_business_entity_normalized_name
    ON business_entity(normalized_name);
