import { createClient } from "@supabase/supabase-js";
import { createMockSupabaseClient, isE2EMockAuth } from "./mockAuth";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!isE2EMockAuth && (!url || !anonKey)) {
    throw new Error(
        "Missing Supabase configuration. Copy .env.example to .env and add your project values."
    );
}

export const supabase = isE2EMockAuth ? createMockSupabaseClient() : createClient(url, anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
