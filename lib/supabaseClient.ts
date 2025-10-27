// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://jjfoymnhchfpjstomipr.supabase.co',         // e.g., https://xyz.supabase.co
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NTk1MDUsImV4cCI6MjA3NzAzNTUwNX0.VaUzagxiKKxzA6r9EFkdPN42_3mT8JjfKO-oG1WjiSY'       // found in your Supabase API settings
);


// This is the file where things are going to be imported