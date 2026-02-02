-- Add brand_snapshot column to profiles table for Creative Studio

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'brand_snapshot'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN brand_snapshot JSONB;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.brand_snapshot IS 'Stores the user brand snapshot for Creative Studio (name, description, audience, offering, tone, logo, colors, etc.)';
