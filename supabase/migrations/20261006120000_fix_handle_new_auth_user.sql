-- Fix handle_new_auth_user: auth.users uses raw_user_meta_data (not raw_user_meta).
-- Future signups only — does not backfill or modify existing profile rows.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), '')
  );

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, inserted_at)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- profiles.email is unique; keep auth.users.id → profiles.id even if email collides
      INSERT INTO public.profiles (id, email, full_name, inserted_at)
      VALUES (
        NEW.id,
        NULL,
        v_full_name,
        now()
      )
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Signup must still succeed; log loudly so missing profiles are visible in logs
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
