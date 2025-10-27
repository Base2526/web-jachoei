-- 002_views_and_helpers.sql
BEGIN;

CREATE OR REPLACE VIEW chat_unread_counts AS
SELECT
  cm.user_id,
  m.chat_id,
  COUNT(*)::BIGINT AS unread_count
FROM messages m
JOIN chat_members cm ON cm.chat_id = m.chat_id
LEFT JOIN message_receipts r
  ON r.message_id = m.id AND r.user_id = cm.user_id
WHERE cm.user_id <> m.sender_id
  AND (r.read_at IS NULL)
GROUP BY cm.user_id, m.chat_id;

CREATE OR REPLACE VIEW chat_last_read AS
SELECT
  r.user_id,
  m.chat_id,
  MAX(r.read_at) AS last_read_at
FROM message_receipts r
JOIN messages m ON m.id = r.message_id
GROUP BY r.user_id, m.chat_id;

COMMIT;
