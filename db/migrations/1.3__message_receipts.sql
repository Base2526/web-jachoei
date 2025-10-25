-- 001_message_receipts.sql
BEGIN;

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_read_null
  ON message_receipts (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_message ON message_receipts (message_id);

CREATE OR REPLACE FUNCTION trg_messages_after_insert__create_receipts()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO message_receipts (message_id, user_id)
  SELECT NEW.id, cm.user_id
  FROM chat_members cm
  WHERE cm.chat_id = NEW.chat_id
    AND cm.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_after_insert__create_receipts ON messages;
CREATE TRIGGER messages_after_insert__create_receipts
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION trg_messages_after_insert__create_receipts();

COMMIT;
