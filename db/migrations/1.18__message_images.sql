CREATE TABLE message_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime TEXT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_message_images_message_id
  ON message_images (message_id);

ALTER TABLE message_images
ADD COLUMN file_id INTEGER REFERENCES files(id);
