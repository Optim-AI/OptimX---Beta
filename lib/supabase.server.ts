import { createClient } from '@supabase/supabase-js';


export function createServerSupabase() {
const url = 'https://jjfoymnhchfpjstomipr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NTk1MDUsImV4cCI6MjA3NzAzNTUwNX0.VaUzagxiKKxzA6r9EFkdPN42_3mT8JjfKO-oG1WjiSY';
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
return createClient(url, key, { auth: { persistSession: false } });
}