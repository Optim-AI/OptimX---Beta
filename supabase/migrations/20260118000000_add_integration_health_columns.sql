-- Add health tracking columns to integrations table
-- Date: 2026-01-18

-- Add health_status column with default value
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'healthy';

-- Add health_error_message column
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS health_error_message text;

-- Add last_health_check column
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS last_health_check timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.integrations.health_status IS 'Current health status of the integration: healthy, unhealthy, or unknown';
COMMENT ON COLUMN public.integrations.health_error_message IS 'Error message if health_status is unhealthy';
COMMENT ON COLUMN public.integrations.last_health_check IS 'Timestamp of the last health check performed';
