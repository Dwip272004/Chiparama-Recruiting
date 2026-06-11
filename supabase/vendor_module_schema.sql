-- ================================================================
-- VENDOR MANAGEMENT & CANDIDATE SUBMISSION MODULE
-- Extends the existing jobs table / JD parsing system
-- ================================================================
-- Run this in Supabase SQL Editor AFTER the base schema.sql
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES
-- Extends Supabase auth.users with role + vendor linkage
-- ──────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'vendor'
                CHECK (role IN ('admin', 'vendor')),
  full_name   TEXT,
  email       TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  vendor_id   UUID,                    -- set for vendor users; NULL for admins
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, vendor_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendor'),
    (NEW.raw_user_meta_data->>'vendor_id')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- 2. VENDORS
-- Vendor company records managed by admin
-- ──────────────────────────────────────────────────────────────
CREATE TABLE vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    TEXT NOT NULL,
  primary_contact TEXT NOT NULL,          -- contact person name
  email           TEXT UNIQUE NOT NULL,   -- login email / primary email
  phone           TEXT,
  website         TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT DEFAULT 'United States',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended')),
  specializations TEXT[] DEFAULT '{}',   -- e.g. ['IT', 'Engineering', 'Finance']
  notes           TEXT,
  onboarded_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Back-reference: profiles.vendor_id → vendors.id
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_vendor
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;


-- ──────────────────────────────────────────────────────────────
-- 3. JOB-VENDOR ASSIGNMENTS
-- Admin controls which vendor(s) work on which job
-- ──────────────────────────────────────────────────────────────
CREATE TABLE job_vendor_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  vendor_id        UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assigned_by      UUID REFERENCES profiles(id),
  assigned_at      TIMESTAMPTZ DEFAULT NOW(),
  deadline         DATE,
  max_submissions  INTEGER DEFAULT 10,
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  instructions     TEXT,                  -- private notes from admin to vendor
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused', 'closed')),
  UNIQUE (job_id, vendor_id)
);


-- ──────────────────────────────────────────────────────────────
-- 4. CANDIDATES
-- Owned by vendor; private per-vendor database
-- ──────────────────────────────────────────────────────────────
CREATE TABLE candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  added_by          UUID REFERENCES profiles(id),

  -- Identity
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  linkedin_url      TEXT,

  -- Location
  city              TEXT,
  state             TEXT,
  country           TEXT DEFAULT 'United States',
  work_authorization TEXT,               -- US Citizen | GC | H1B | OPT | EAD | Other

  -- Professional
  current_title     TEXT,
  current_company   TEXT,
  experience_years  INTEGER,
  skills            TEXT[] DEFAULT '{}',
  summary           TEXT,

  -- Resume
  resume_path       TEXT,                -- Supabase Storage path
  resume_filename   TEXT,
  resume_content_type TEXT,
  resume_parsed     BOOLEAN DEFAULT false,
  resume_hash       TEXT,                -- SHA-256 for dedup detection

  -- AI-parsed resume fields (populated by Mistral)
  parsed_education    JSONB DEFAULT '[]',
  parsed_experience   JSONB DEFAULT '[]',
  parsed_certifications TEXT[] DEFAULT '{}',
  parsed_skills       TEXT[] DEFAULT '{}',
  ai_match_score      NUMERIC(5,2),      -- computed when matched against a job

  -- Status
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'placed', 'blacklisted', 'do_not_contact')),
  internal_notes    TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 5. SUBMISSIONS
-- A vendor submits a candidate against a specific job
-- Core dedup: UNIQUE(job_id, candidate_id)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  candidate_id     UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  vendor_id        UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  submitted_by     UUID REFERENCES profiles(id),

  -- Submission details
  cover_note       TEXT,
  availability_date DATE,

  -- Rates (for contract/temp roles)
  bill_rate        NUMERIC(10,2),
  pay_rate         NUMERIC(10,2),
  rate_type        TEXT DEFAULT 'hourly' CHECK (rate_type IN ('hourly','daily','annual')),

  -- Pipeline stage
  stage            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (stage IN (
      'submitted',          -- vendor just submitted
      'reviewing',          -- admin is reviewing
      'shortlisted',        -- admin shortlisted for client
      'interview_scheduled',-- interview set up
      'interview_completed',-- interview done, awaiting feedback
      'client_submitted',   -- forwarded to end client
      'offer_extended',     -- offer made to candidate
      'offer_accepted',     -- candidate accepted
      'placed',             -- on assignment / started
      'rejected',           -- rejected at any stage
      'withdrawn'           -- candidate or vendor withdrew
    )),

  -- Admin feedback (visible to vendor after review)
  admin_feedback        TEXT,
  admin_feedback_visible BOOLEAN DEFAULT false,
  rejection_reason      TEXT,

  -- Internal admin notes (never visible to vendor)
  internal_notes        TEXT,

  -- Timestamps
  stage_updated_at  TIMESTAMPTZ DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Hard dedup: one candidate per job across ALL vendors
  UNIQUE (job_id, candidate_id)
);


-- ──────────────────────────────────────────────────────────────
-- 6. SUBMISSION ACTIVITY LOG
-- Immutable audit trail of every state change and action
-- ──────────────────────────────────────────────────────────────
CREATE TABLE submission_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES profiles(id),
  actor_role     TEXT,                   -- snapshot of role at time of action
  action         TEXT NOT NULL,
    -- stage_changed | note_added | feedback_added | rate_updated
    -- interview_scheduled | document_added | submission_created
  from_stage     TEXT,
  to_stage       TEXT,
  note           TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 7. INTERVIEWS
-- Linked to a submission; multiple rounds supported
-- ──────────────────────────────────────────────────────────────
CREATE TABLE interviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  round_number    INTEGER DEFAULT 1,
  interview_type  TEXT DEFAULT 'video'
                    CHECK (interview_type IN ('video','phone','onsite','technical','panel','hr')),
  scheduled_at    TIMESTAMPTZ,
  duration_mins   INTEGER DEFAULT 60,
  interviewer_name TEXT,
  location_or_link TEXT,
  instructions    TEXT,
  outcome         TEXT CHECK (outcome IN ('passed','failed','rescheduled','no_show','pending')),
  outcome_notes   TEXT,
  scheduled_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 8. NOTIFICATIONS
-- In-app notifications; feed for both admin and vendor users
-- ──────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
    -- new_assignment | submission_received | stage_changed
    -- feedback_available | interview_scheduled | deadline_approaching
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,                      -- frontend route to navigate to
  read        BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────
-- 9. VENDOR PERFORMANCE SNAPSHOT (materialized-style view)
-- Refreshed on demand or via pg_cron; powers analytics dashboard
-- ──────────────────────────────────────────────────────────────
CREATE VIEW vendor_performance AS
SELECT
  v.id                                                         AS vendor_id,
  v.company_name,
  v.status                                                     AS vendor_status,
  COUNT(DISTINCT s.id)                                         AS total_submissions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.stage = 'shortlisted')  AS shortlisted,
  COUNT(DISTINCT s.id) FILTER (WHERE s.stage = 'placed')       AS placements,
  COUNT(DISTINCT s.id) FILTER (WHERE s.stage = 'rejected')     AS rejections,
  COUNT(DISTINCT s.job_id)                                     AS jobs_worked,
  COUNT(DISTINCT s.candidate_id)                               AS unique_candidates,
  ROUND(
    100.0 * COUNT(DISTINCT s.id) FILTER (WHERE s.stage IN ('shortlisted','interview_scheduled','interview_completed','client_submitted','offer_extended','offer_accepted','placed'))
    / NULLIF(COUNT(DISTINCT s.id), 0), 1
  )                                                            AS shortlist_rate_pct,
  ROUND(
    100.0 * COUNT(DISTINCT s.id) FILTER (WHERE s.stage = 'placed')
    / NULLIF(COUNT(DISTINCT s.id), 0), 1
  )                                                            AS placement_rate_pct
FROM vendors v
LEFT JOIN submissions s ON s.vendor_id = v.id
GROUP BY v.id, v.company_name, v.status;


-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_profiles_vendor_id       ON profiles(vendor_id);
CREATE INDEX idx_profiles_role            ON profiles(role);
CREATE INDEX idx_jva_job_id               ON job_vendor_assignments(job_id);
CREATE INDEX idx_jva_vendor_id            ON job_vendor_assignments(vendor_id);
CREATE INDEX idx_candidates_vendor_id     ON candidates(vendor_id);
CREATE INDEX idx_candidates_email         ON candidates(email);
CREATE INDEX idx_candidates_resume_hash   ON candidates(resume_hash);
CREATE INDEX idx_submissions_job_id       ON submissions(job_id);
CREATE INDEX idx_submissions_vendor_id    ON submissions(vendor_id);
CREATE INDEX idx_submissions_candidate_id ON submissions(candidate_id);
CREATE INDEX idx_submissions_stage        ON submissions(stage);
CREATE INDEX idx_sub_activity_sub_id      ON submission_activity(submission_id);
CREATE INDEX idx_notifications_user_id    ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_candidates_skills        ON candidates USING GIN(skills);
CREATE INDEX idx_candidates_parsed_skills ON candidates USING GIN(parsed_skills);


-- ──────────────────────────────────────────────────────────────
-- AUTO-UPDATED updated_at TRIGGERS
-- ──────────────────────────────────────────────────────────────
CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-update stage_updated_at when stage changes
CREATE OR REPLACE FUNCTION update_stage_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER submissions_stage_timestamp
  BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_stage_timestamp();


-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get current user's vendor_id
CREATE OR REPLACE FUNCTION auth_vendor_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT vendor_id FROM profiles WHERE id = auth.uid()
$$;

-- ── PROFILES ──
CREATE POLICY "Admin reads all profiles"
  ON profiles FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY "Vendor reads own profile"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "User updates own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- ── VENDORS ──
CREATE POLICY "Admin full access to vendors"
  ON vendors FOR ALL USING (auth_role() = 'admin');
CREATE POLICY "Vendor reads own vendor record"
  ON vendors FOR SELECT USING (id = auth_vendor_id());

-- ── JOB_VENDOR_ASSIGNMENTS ──
CREATE POLICY "Admin full access to assignments"
  ON job_vendor_assignments FOR ALL USING (auth_role() = 'admin');
CREATE POLICY "Vendor reads own assignments"
  ON job_vendor_assignments FOR SELECT
  USING (vendor_id = auth_vendor_id() AND status = 'active');

-- ── JOBS (extend existing RLS) ──
-- Vendors can read jobs assigned to them
CREATE POLICY "Vendor reads assigned jobs"
  ON jobs FOR SELECT
  USING (
    auth_role() = 'vendor' AND
    id IN (
      SELECT job_id FROM job_vendor_assignments
      WHERE vendor_id = auth_vendor_id() AND status = 'active'
    )
  );
CREATE POLICY "Admin full access to jobs"
  ON jobs FOR ALL USING (auth_role() = 'admin');

-- ── CANDIDATES ──
CREATE POLICY "Vendor manages own candidates"
  ON candidates FOR ALL USING (vendor_id = auth_vendor_id());
CREATE POLICY "Admin reads all candidates"
  ON candidates FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY "Admin updates any candidate"
  ON candidates FOR UPDATE USING (auth_role() = 'admin');

-- ── SUBMISSIONS ──
CREATE POLICY "Vendor manages own submissions"
  ON submissions FOR ALL USING (vendor_id = auth_vendor_id());
CREATE POLICY "Admin full access to submissions"
  ON submissions FOR ALL USING (auth_role() = 'admin');

-- ── SUBMISSION ACTIVITY ──
CREATE POLICY "Admin reads all activity"
  ON submission_activity FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY "Admin inserts activity"
  ON submission_activity FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "Vendor reads own submission activity"
  ON submission_activity FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE vendor_id = auth_vendor_id()
    )
  );
CREATE POLICY "Vendor inserts own submission activity"
  ON submission_activity FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE vendor_id = auth_vendor_id()
    )
  );

-- ── INTERVIEWS ──
CREATE POLICY "Admin full access to interviews"
  ON interviews FOR ALL USING (auth_role() = 'admin');
CREATE POLICY "Vendor reads own submission interviews"
  ON interviews FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE vendor_id = auth_vendor_id()
    )
  );

-- ── NOTIFICATIONS ──
CREATE POLICY "User reads own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "User updates own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT WITH CHECK (true); -- backend service-role only


-- ──────────────────────────────────────────────────────────────
-- SUPABASE STORAGE BUCKET
-- Run separately in Supabase dashboard or via management API:
--   Storage → New Bucket → "resumes" → Private
-- ──────────────────────────────────────────────────────────────
-- Storage path convention:
--   resumes/{vendor_id}/{candidate_id}/{filename}
-- RLS on storage: vendors can only read/write their own prefix
