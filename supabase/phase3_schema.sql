-- ================================================================
-- PHASE 3: Storage policies + Auto-notification triggers
-- Run in Supabase SQL Editor AFTER vendor_module_schema.sql
-- ================================================================


-- ──────────────────────────────────────────────────────────────
-- 1. STORAGE BUCKET POLICIES (run after creating "resumes" bucket
--    in Supabase Dashboard → Storage → New Bucket → "resumes" → Private)
-- ──────────────────────────────────────────────────────────────

-- Vendors can upload/read/delete files under their own vendor_id prefix
CREATE POLICY "Vendors manage own resumes"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = (
      SELECT vendor_id::TEXT FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = (
      SELECT vendor_id::TEXT FROM profiles WHERE id = auth.uid()
    )
  );

-- Admins can read all resumes
CREATE POLICY "Admins read all resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );


-- ──────────────────────────────────────────────────────────────
-- 2. AUTO-NOTIFICATION TRIGGER
-- Fires when a submission's stage changes → notifies the vendor user
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_vendor_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  vendor_user_id UUID;
  candidate_name TEXT;
  job_title      TEXT;
BEGIN
  -- Only fire on stage change
  IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;

  -- Get the vendor's user (profile linked to the vendor)
  SELECT p.id INTO vendor_user_id
  FROM profiles p
  WHERE p.vendor_id = NEW.vendor_id
  LIMIT 1;

  IF vendor_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get candidate name and job title
  SELECT c.first_name || ' ' || c.last_name INTO candidate_name
  FROM candidates c WHERE c.id = NEW.candidate_id;

  SELECT j.title INTO job_title
  FROM jobs j WHERE j.id = NEW.job_id;

  -- Insert notification
  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    vendor_user_id,
    'stage_changed',
    'Submission Update: ' || COALESCE(candidate_name, 'Candidate'),
    COALESCE(candidate_name, 'Candidate') || ' moved to ' ||
      REPLACE(NEW.stage, '_', ' ') || ' for ' || COALESCE(job_title, 'a job'),
    '/vendor/submissions',
    jsonb_build_object(
      'submission_id', NEW.id,
      'from_stage',    OLD.stage,
      'to_stage',      NEW.stage
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_submission_stage_change
  AFTER UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION notify_vendor_stage_change();


-- ──────────────────────────────────────────────────────────────
-- 3. AUTO-NOTIFICATION TRIGGER
-- Fires when an interview is inserted → notifies the vendor user
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_vendor_interview_scheduled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  vendor_user_id UUID;
  vendor_id_val  UUID;
  candidate_name TEXT;
  job_title      TEXT;
BEGIN
  -- Look up vendor from submission
  SELECT s.vendor_id INTO vendor_id_val
  FROM submissions s WHERE s.id = NEW.submission_id;

  SELECT p.id INTO vendor_user_id
  FROM profiles p WHERE p.vendor_id = vendor_id_val LIMIT 1;

  IF vendor_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT c.first_name || ' ' || c.last_name INTO candidate_name
  FROM submissions s
  JOIN candidates c ON c.id = s.candidate_id
  WHERE s.id = NEW.submission_id;

  SELECT j.title INTO job_title
  FROM submissions s
  JOIN jobs j ON j.id = s.job_id
  WHERE s.id = NEW.submission_id;

  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    vendor_user_id,
    'interview_scheduled',
    'Interview Scheduled',
    COALESCE(candidate_name, 'Candidate') || ' has a ' ||
      NEW.interview_type || ' interview for ' || COALESCE(job_title, 'a job') ||
      CASE WHEN NEW.scheduled_at IS NOT NULL
        THEN ' on ' || TO_CHAR(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY')
        ELSE '' END,
    '/vendor/submissions',
    jsonb_build_object('interview_id', NEW.id, 'submission_id', NEW.submission_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_interview_scheduled
  AFTER INSERT ON interviews
  FOR EACH ROW EXECUTE FUNCTION notify_vendor_interview_scheduled();


-- ──────────────────────────────────────────────────────────────
-- 4. AUTO-NOTIFICATION when admin assigns a job to vendor
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_vendor_job_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  vendor_user_id UUID;
  job_title      TEXT;
BEGIN
  -- Only on new active assignments
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  SELECT p.id INTO vendor_user_id
  FROM profiles p WHERE p.vendor_id = NEW.vendor_id LIMIT 1;

  IF vendor_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT title INTO job_title FROM jobs WHERE id = NEW.job_id;

  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    vendor_user_id,
    'new_assignment',
    'New Job Assigned',
    'You have been assigned to: ' || COALESCE(job_title, 'a new job'),
    '/vendor/jobs',
    jsonb_build_object('job_id', NEW.job_id, 'assignment_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_job_assigned
  AFTER INSERT ON job_vendor_assignments
  FOR EACH ROW EXECUTE FUNCTION notify_vendor_job_assigned();
