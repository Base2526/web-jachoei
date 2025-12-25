-- 001_create_email_templates.sql
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL,              -- e.g. "auth.verify", "auth.reset"
  locale        TEXT NOT NULL DEFAULT 'en', -- e.g. "en", "th"
  version       INT  NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,

  subject_tpl   TEXT NOT NULL,              -- handlebars template
  html_tpl      TEXT NOT NULL,              -- handlebars template
  text_tpl      TEXT,                       -- optional

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(key, locale, version)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ช่วยให้ query เร็ว
CREATE INDEX IF NOT EXISTS idx_email_templates_lookup
ON email_templates (key, locale, is_active, is_published, version DESC);
