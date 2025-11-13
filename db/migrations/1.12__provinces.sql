BEGIN;

-- ใช้ UUID ถ้าจำเป็น
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) ตาราง provinces
CREATE TABLE IF NOT EXISTS provinces (
  id UUID PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT
);

-- 2) เพิ่มคอลัมน์อ้างอิงใน posts (ถ้ายังไม่มี)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS province_id UUID;

-- 3) FK (ถ้ายังไม่ได้เพิ่ม)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_province_id_fkey'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_province_id_fkey
      FOREIGN KEY (province_id) REFERENCES provinces(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Seed ข้อมูล (UPSERT ตาม id)
INSERT INTO provinces (id, name_th, name_en) VALUES
  ('a0f9a3b6-3a42-4c61-924d-14e3a9e4c2d1','กรุงเทพมหานคร','Bangkok'),
  ('b27f6c4a-7f53-4a77-bb12-83211d9e62a3','เชียงใหม่','Chiang Mai'),
  ('c913aef8-4581-4b40-90d8-5c3efde0b61a','ขอนแก่น','Khon Kaen'),
  ('d57a89e3-f2e4-4fa4-a38a-14cc6bcbf879','ภูเก็ต','Phuket'),
  ('e89db1cf-9a12-4e7f-b354-67a8e1b58a50','ชลบุรี','Chonburi')
ON CONFLICT (id) DO UPDATE
SET name_th = EXCLUDED.name_th,
    name_en = EXCLUDED.name_en;

COMMIT;
