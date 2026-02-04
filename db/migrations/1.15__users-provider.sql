ALTER TABLE users
ADD COLUMN provider TEXT NOT NULL DEFAULT 'password',  -- password | google | facebook
ADD COLUMN provider_id TEXT;                           -- google.sub | facebook.id
