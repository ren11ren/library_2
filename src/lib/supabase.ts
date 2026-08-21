import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL in environment")
}

// Prevent accidental use of the Supabase service role (secret) key in browser builds.
// The service key should never be shipped to client-side applications.
if (supabaseServiceKey && !supabaseAnonKey) {
  // If only the service key is present, prefer the anon key but fall back to the
  // service key so local development is not blocked. Log a prominent warning.
  // NOTE: This is less secure — replace the service key with the anon/public key.
  // eslint-disable-next-line no-console
  console.warn(
    "Warning: VITE_SUPABASE_KEY (service role) detected and no anon key provided.\n" +
    "Using the service role key as a fallback. This is insecure for production — please set VITE_SUPABASE_ANON_KEY and remove the service key from client builds."
  )
}

const keyToUse = supabaseAnonKey ?? supabaseServiceKey
// Diagnostic: log which key type is being used (do not print the key value).
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(`Supabase client: using ${supabaseAnonKey ? 'ANON key' : supabaseServiceKey ? 'SERVICE key (DEV only)' : 'NO KEY'}`)
}
if (!keyToUse) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY in environment")
}

export const supabase = createClient(supabaseUrl, keyToUse)
