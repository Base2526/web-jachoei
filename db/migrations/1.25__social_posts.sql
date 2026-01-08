-- 1) เพิ่ม toggle ใน posts
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS auto_publish boolean NOT NULL DEFAULT false;

-- 2) ตาราง mapping social posts
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  platform text NOT NULL CHECK (platform IN ('facebook','x')),
  social_post_id text,                 -- id ที่ได้จาก FB/X
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PUBLISHED','FAILED','SKIPPED')),
  last_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (post_id, platform)
);

-- 3) updated_at trigger (ถ้าคุณมีแล้วข้ามได้)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON social_posts;
CREATE TRIGGER trg_social_posts_updated_at
BEFORE UPDATE ON social_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();



ALTER TABLE social_posts
ADD COLUMN IF NOT EXISTS permalink_url text,
ADD COLUMN IF NOT EXISTS published_at timestamptz;
