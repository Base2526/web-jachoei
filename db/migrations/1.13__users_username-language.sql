BEGIN;

-- ✅ เพิ่มคอลัมน์ใหม่ ถ้ายังไม่มี
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- ✅ อัปเดต username ให้ผู้ใช้เดิม (ถ้ายังไม่มี)
-- เช่น ใช้ email ก่อน @ เป็นค่าเริ่มต้น
UPDATE users
SET username = SPLIT_PART(email, '@', 1)
WHERE (username IS NULL OR username = '')
  AND email IS NOT NULL;

-- ✅ กำหนดค่า language เริ่มต้นให้ผู้ใช้เก่าที่ว่าง
UPDATE users
SET language = 'en'
WHERE language IS NULL OR language = '';

-- ✅ อัปเดต timestamp
ALTER TABLE users ALTER COLUMN language SET NOT NULL;

-- ✅ อัปเดตเวอร์ชันในตาราง schema_version
INSERT INTO schema_version (id, version, applied_at)
VALUES (1, '1.2', NOW())
ON CONFLICT (id) DO UPDATE
SET version = '1.2', applied_at = NOW();

COMMIT;
