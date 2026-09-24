import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-publishable-key';
export const supabase=createClient(url,key,{\n  auth:{\n    autoRefreshToken:true,\n    persistSession:true,\n    detectSessionInUrl:true,\n  },\n});
