-- Allow the frontend (anon key) to update and delete jobs
-- This is appropriate for an internal recruiting portal.
-- Add Supabase Auth (email/password) later if you need to restrict access.

CREATE POLICY "Allow update"
  ON jobs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete"
  ON jobs FOR DELETE
  USING (true);
