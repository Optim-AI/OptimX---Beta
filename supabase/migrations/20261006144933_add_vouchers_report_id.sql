-- Drizzle schema already selects vouchers.report_id. The original vouchers
-- table migration never added the column, so Buy Credits voucher lookups fail.
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS report_id uuid;
