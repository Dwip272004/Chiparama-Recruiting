-- ============================================================
-- JD Marketplace: Supabase / PostgreSQL Schema
-- ============================================================

-- Enable UUID generation (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────
-- Main jobs table
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (

  -- Identity
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_reference_id      TEXT,                         -- e.g. "3538" from "Job 3538: ..."

  -- Core Info
  title                 TEXT        NOT NULL,
  client_company        TEXT,                         -- end-client / employer name
  num_positions         INTEGER     NOT NULL DEFAULT 1,
  employment_type       TEXT        NOT NULL DEFAULT 'contract',
    -- allowed: contract | full-time | part-time | contract-to-hire | unknown

  -- Location
  location_full_address TEXT,
  location_street       TEXT,
  location_city         TEXT,
  location_state        TEXT,
  location_country      TEXT        DEFAULT 'United States',
  location_zip          TEXT,
  work_type             TEXT        NOT NULL DEFAULT 'onsite',
    -- allowed: onsite | remote | hybrid

  -- Timeline
  start_date            DATE,
  end_date              DATE,
  schedule              TEXT,                         -- "M-F 8-5 (1hr non-billable lunch)"

  -- Parsed Content (PostgreSQL arrays of text)
  description           TEXT,
  top_skills            TEXT[]      NOT NULL DEFAULT '{}',
  responsibilities      TEXT[]      NOT NULL DEFAULT '{}',
  qualifications        TEXT[]      NOT NULL DEFAULT '{}',
  special_requirements  TEXT[]      NOT NULL DEFAULT '{}',  -- MVR, background check, etc.
  tags                  TEXT[]      NOT NULL DEFAULT '{}',  -- AI-generated domain tags

  -- Experience
  experience_years_min  INTEGER,
  experience_years_max  INTEGER,

  -- Categorization
  industry              TEXT,
  source_system         TEXT,                         -- "Workday VNDLY", "SAP Fieldglass", etc.

  -- Raw audit data
  raw_email_body        TEXT,
  parsed_at             TIMESTAMPTZ,

  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'active',
    -- allowed: active | filled | expired | draft

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- Indexes for common query patterns
-- ──────────────────────────────────────────────

-- Full-text search on title + company
CREATE INDEX idx_jobs_fts
  ON jobs USING GIN (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(client_company, ''))
  );

-- Filter indexes
CREATE INDEX idx_jobs_status        ON jobs (status);
CREATE INDEX idx_jobs_work_type     ON jobs (work_type);
CREATE INDEX idx_jobs_employment    ON jobs (employment_type);
CREATE INDEX idx_jobs_city          ON jobs (location_city);
CREATE INDEX idx_jobs_state         ON jobs (location_state);
CREATE INDEX idx_jobs_start_date    ON jobs (start_date);
CREATE INDEX idx_jobs_created_at    ON jobs (created_at DESC);
CREATE INDEX idx_jobs_tags          ON jobs USING GIN (tags);
CREATE INDEX idx_jobs_top_skills    ON jobs USING GIN (top_skills);

-- ──────────────────────────────────────────────
-- Auto-update updated_at
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────
-- Row Level Security
-- Public read (frontend fetches without auth)
-- Write only via service-role key (backend)
-- ──────────────────────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active jobs"
  ON jobs FOR SELECT
  USING (status = 'active');

-- Service-role key bypasses RLS automatically; no insert policy needed for anon.
