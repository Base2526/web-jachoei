-- รันอันนี้ก่อน (กันมีตารางหลงเหลือ)
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- จากนั้นสร้างใหม่ด้วยชนิด uuid
CREATE TABLE password_reset_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,      -- ใช้ timestamptz จะชัดเจนเรื่อง timezone
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_userid ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_token  ON password_reset_tokens(token);
