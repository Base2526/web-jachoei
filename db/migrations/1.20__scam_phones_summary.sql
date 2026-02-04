CREATE TABLE IF NOT EXISTS scam_phones_summary (
  phone          text PRIMARY KEY,
  report_count   integer NOT NULL DEFAULT 0,
  last_report_at timestamptz,
  risk_level     integer NOT NULL DEFAULT 0,
  post_ids       uuid[] NOT NULL DEFAULT '{}',
  is_deleted     boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);