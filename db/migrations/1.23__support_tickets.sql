CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,

  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,

  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,

  ref TEXT,
  page_url TEXT,
  user_agent TEXT,
  ip TEXT,

  status TEXT NOT NULL DEFAULT 'open',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
ON support_tickets(status);
