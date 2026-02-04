
-- 003_messages_soft_delete.sql
BEGIN;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_messages_chat_deleted ON messages (chat_id, deleted_at);
COMMIT;
