import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey

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
