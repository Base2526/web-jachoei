BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expired_at TIMESTAMP NOT NULL
);

-- ล้าง session ที่หมดอายุอัตโนมัติ (รันด้วย cron/job ฝั่งแอปก็ได้)
-- DELETE FROM sessions WHERE expired_at <= NOW();

COMMIT;
