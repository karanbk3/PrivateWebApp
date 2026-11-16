
import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Your Supabase project URL
const SUPABASE_URL =
    "https://tsogqnomyeahmrodwuvq.supabase.co";

// Your Supabase publishable key
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_N2yG_85AK88GPO4rvw3g0g_1sCTTCoC";

// Connect PrivateSpace to Supabase
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
