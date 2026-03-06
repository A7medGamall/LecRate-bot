import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase URL or Key is missing from .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
