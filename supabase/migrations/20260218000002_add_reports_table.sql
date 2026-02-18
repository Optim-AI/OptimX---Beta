-- Create reports table for user error reports and feedback
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,            -- 'error' | 'feedback'
  message TEXT NOT NULL,
  page_url TEXT,
  images TEXT[],                 -- base64 data URLs (max 3)
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'reviewed' | 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
