BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) เพิ่มคอลัมน์ (ยังไม่ NOT NULL เพื่อกัน error ในช่วงเปลี่ยนผ่าน)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2) เซ็ตค่าชั่วคราวให้ทุกคน (ผู้ใช้ควรเปลี่ยนรหัสผ่านหลังจากนี้)
UPDATE users
SET password_hash = crypt('changeme', gen_salt('bf'))
WHERE password_hash IS NULL;

-- 3) บังคับ NOT NULL เมื่อทุกแถวมีค่าแล้ว
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- 4) อัปเดตเวอร์ชัน
CREATE TABLE IF NOT EXISTS schema_version (
  id INT PRIMARY KEY DEFAULT 1,
  version TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO schema_version (id, version) VALUES (1, '1.0')
ON CONFLICT (id) DO NOTHING;

UPDATE schema_version SET version='1.1', applied_at=NOW() WHERE id=1;

COMMIT;
