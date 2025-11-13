CREATE TABLE IF NOT EXISTS post_tel_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tel TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_seller_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  bank_id TEXT,
  bank_name TEXT,
  seller_account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- เพิ่ม field ใหม่ใน posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS first_last_name TEXT,
  ADD COLUMN IF NOT EXISTS id_card TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS province_id UUID,
  ADD COLUMN IF NOT EXISTS detail TEXT;
