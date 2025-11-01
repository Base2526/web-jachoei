-- System logs for admin settings
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',        -- debug|info|warn|error
  category TEXT NOT NULL DEFAULT 'app',      -- e.g., auth, graphql, file, chat
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_by INT NULL,                       -- user id if available
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs (category);
