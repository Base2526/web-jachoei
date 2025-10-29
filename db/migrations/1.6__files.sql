-- Files table for file manager
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,          -- stored file name on disk
  original_name TEXT,              -- original client name
  mimetype TEXT,
  size BIGINT,
  checksum TEXT,
  relpath TEXT NOT NULL,           -- relative path under STORAGE_DIR
  created_by INT NULL,             -- user id if available (FK to users.id)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_files_created_at ON files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING GIN (LOWER(original_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_filename_trgm ON files USING GIN (LOWER(filename) gin_trgm_ops);
