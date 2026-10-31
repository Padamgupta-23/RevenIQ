import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://owqoorexzuvwziketnpg.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cW9vcmV4enV2d3ppa2V0bnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MTYzMDksImV4cCI6MjEwODk5MjMwOX0.hGPHdePGZTXBVcNVtV38ykQdkYeogcU9Kg3j46xetkQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;

