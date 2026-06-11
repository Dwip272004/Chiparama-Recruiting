-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS watched_senders (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  label      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_digests (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id   TEXT        UNIQUE,
  from_address TEXT        NOT NULL,
  from_name    TEXT,
  subject      TEXT,
  received_at  TIMESTAMPTZ,
  body_text    TEXT,
  summary      TEXT,
  action_items JSONB       DEFAULT '[]',
  is_read      BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_digests_received ON email_digests (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_digests_unread   ON email_digests (is_read) WHERE is_read = false;

ALTER TABLE watched_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_digests   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_watched_senders" ON watched_senders
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_email_digests" ON email_digests
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
