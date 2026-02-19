-- Add organisation details and GST number for GST invoicing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organisation_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gst_number text;
