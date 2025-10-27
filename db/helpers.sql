-- helpers.sql

-- List messages in a chat with my read flag
-- :viewer_id, :chat_id
-- SELECT m.*,
--        (r.read_at IS NOT NULL) AS is_read,
--        r.read_at
-- FROM messages m
-- LEFT JOIN message_receipts r
--   ON r.message_id = m.id AND r.user_id = :viewer_id
-- WHERE m.chat_id = :chat_id
-- ORDER BY m.created_at ASC;

-- Who has read a specific message
-- :message_id
-- SELECT u.id, u.name, u.avatar, r.read_at
-- FROM message_receipts r
-- JOIN users u ON u.id = r.user_id
-- WHERE r.message_id = :message_id AND r.read_at IS NOT NULL
-- ORDER BY r.read_at ASC;

-- Mark a single message as read
-- :viewer_id, :message_id
-- UPDATE message_receipts
-- SET read_at = COALESCE(read_at, NOW())
-- WHERE message_id = :message_id AND user_id = :viewer_id;

-- Mark all messages in a chat as read up to a cursor
-- :viewer_id, :chat_id, :cursor_created_at
-- UPDATE message_receipts r
-- SET read_at = COALESCE(r.read_at, NOW())
-- FROM messages m
-- WHERE r.message_id = m.id
--   AND r.user_id = :viewer_id
--   AND m.chat_id = :chat_id
--   AND m.created_at <= :cursor_created_at;

-- Backfill receipts when adding a new member
-- :chat_id, :new_user_id
-- INSERT INTO message_receipts (message_id, user_id, delivered_at)
-- SELECT m.id, :new_user_id, NOW()
-- FROM messages m
-- WHERE m.chat_id = :chat_id AND m.sender_id <> :new_user_id
-- ON CONFLICT (message_id, user_id) DO NOTHING;
