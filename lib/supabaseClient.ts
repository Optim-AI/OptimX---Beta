// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://lkrvwszeveupyqebxehq.supabase.co',         // e.g., https://xyz.supabase.co
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ3c3pldmV1cHlxZWJ4ZWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NjEzMzEsImV4cCI6MjA3MjAzNzMzMX0.OHBB4AXCQSksIvBov3obN_hSKyyuo4nyRtAyOv0dTC0'       // found in your Supabase API settings
);


// This is the file where things are going to be imported