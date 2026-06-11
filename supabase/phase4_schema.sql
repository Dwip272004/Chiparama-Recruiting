-- Phase 4: AI match scoring columns on submissions
-- Run this in the Supabase SQL Editor

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS match_score     integer CHECK (match_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS match_reasoning text;

-- Index for sorting/filtering by score
CREATE INDEX IF NOT EXISTS idx_submissions_match_score ON submissions (match_score DESC NULLS LAST);
