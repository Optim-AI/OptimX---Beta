import { createClient } from '@supabase/supabase-js';


export function createServerSupabase() {
const url = 'https://lkrvwszeveupyqebxehq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ3c3pldmV1cHlxZWJ4ZWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NjEzMzEsImV4cCI6MjA3MjAzNzMzMX0.OHBB4AXCQSksIvBov3obN_hSKyyuo4nyRtAyOv0dTC0';
if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
return createClient(url, key, { auth: { persistSession: false } });
}