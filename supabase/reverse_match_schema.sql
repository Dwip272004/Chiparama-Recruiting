-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_candidate_matches (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id         UUID        NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
  candidate_id   UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  vendor_id      UUID        NOT NULL REFERENCES vendors(id)    ON DELETE CASCADE,
  score          INTEGER     CHECK (score BETWEEN 0 AND 100),
  strengths      JSONB       DEFAULT '[]',
  gaps           JSONB       DEFAULT '[]',
  recommendation TEXT,
  notified_at    TIMESTAMPTZ,
  scored_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_jcm_job_score ON job_candidate_matches (job_id, score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jcm_vendor    ON job_candidate_matches (vendor_id);

ALTER TABLE job_candidate_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_jcm_all" ON job_candidate_matches
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
