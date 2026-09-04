import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const envSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL?.trim()
const envSupabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim()

const supabaseUrl = envSupabaseUrl || defaultSupabaseUrl
const supabaseAnonKey = envSupabaseAnonKey || defaultSupabaseAnonKey

if (!envSupabaseUrl || !envSupabaseAnonKey) {
    console.warn('[supabase] Using fallback project credentials because VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.')
}

// Create a Supabase client with realtime and auth options suitable for a SPA.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: { events: 'postgres_changes' },
    },
})

// Helper: convert snake_case keys from Postgres to camelCase used in React state
function toCamelCase(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

export function mapKeysToCamel(obj) {
    if (Array.isArray(obj)) return obj.map(mapKeysToCamel)
    if (obj === null || typeof obj !== 'object') return obj
    return Object.keys(obj).reduce((acc, key) => {
        const camelKey = toCamelCase(key)
        acc[camelKey] = mapKeysToCamel(obj[key])
        return acc
    }, {})
}

export default supabase

function normalizeStudentCode(value) {
    const cleaned = String(value ?? '').trim().replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
    const withoutPrefix = cleaned.replace(/^STU-?/i, '')
    return withoutPrefix ? `STU-${withoutPrefix}` : 'STU'
}

function buildStudentEmailFromCode(value) {
    const code = normalizeStudentCode(value).replace(/^STU-/i, '')
    return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

// The custom student login flow is the source of truth for this app.
// The legacy `students` and `library_cards` tables are not available in the live project,
// so the auth sync must not query them.
export function startAuthSync() {
    console.debug('[auth-sync] disabled: using student_login_accounts only')
}
