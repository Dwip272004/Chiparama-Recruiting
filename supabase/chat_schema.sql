-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS candidate_messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id  UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  sender_id     UUID        NOT NULL,
  sender_name   TEXT        NOT NULL DEFAULT '',
  sender_role   TEXT        NOT NULL CHECK (sender_role IN ('admin', 'vendor')),
  content       TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cand_msgs ON candidate_messages (candidate_id, created_at ASC);

ALTER TABLE candidate_messages ENABLE ROW LEVEL SECURITY;

-- Admins: full access to all messages
CREATE POLICY "admin_chat_all" ON candidate_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vendors: read and write only for their own candidates
CREATE POLICY "vendor_chat_own" ON candidate_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN profiles p ON p.vendor_id = c.vendor_id
      WHERE c.id = candidate_messages.candidate_id
        AND p.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c
      JOIN profiles p ON p.vendor_id = c.vendor_id
      WHERE c.id = candidate_messages.candidate_id
        AND p.id = auth.uid()
    )
  );
