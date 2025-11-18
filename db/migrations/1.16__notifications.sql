CREATE TABLE notifications (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL,
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  data            JSONB,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created_at
  ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_is_read
  ON notifications (user_id, is_read);

CREATE TABLE user_notification_settings (
  user_id         UUID PRIMARY KEY,
  chat_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  post_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled   BOOLEAN NOT NULL DEFAULT FALSE
);
