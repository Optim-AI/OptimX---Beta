// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://jjfoymnhchfpjstomipr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NTk1MDUsImV4cCI6MjA3NzAzNTUwNX0.VaUzagxiKKxzA6r9EFkdPN42_3mT8JjfKO-oG1WjiSY';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ1OTUwNSwiZXhwIjoyMDc3MDM1NTA1fQ.Rry3VbRnWialnVj40ywzVUxsl8Jt4DXZaWWBLvDpMBE';

export const supabase = createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY));

// Server-side admin instance (use service role key)
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(String(SUPABASE_URL), String(SUPABASE_SERVICE_ROLE_KEY))
  : createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY));

export default supabase;
