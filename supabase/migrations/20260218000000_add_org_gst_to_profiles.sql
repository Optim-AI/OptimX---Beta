-- Add organisation details and GST number for GST invoicing
ALTER TABLE profiles ADD COLUMN organisation_name text;
ALTER TABLE profiles ADD COLUMN gst_number text;
