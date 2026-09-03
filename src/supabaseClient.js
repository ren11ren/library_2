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

function normalizeStudentCode(value) {
    const cleaned = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    return cleaned.startsWith('STU-') ? cleaned : `STU-${cleaned}`
}

function buildStudentEmailFromCode(value) {
    const code = normalizeStudentCode(value).replace(/^STU-/i, '')
    return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

// Initialize auth -> DB sync: when a user signs in for the first time,
// ensure a corresponding `students` row exists and an `app_users` entry.
export function startAuthSync() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        try {
            console.debug('[auth] event', event)
            const user = session?.user
            if (!user || !user.email) return

            if (event === 'SIGNED_IN') {
                const studentCode = user.user_metadata?.student_id || user.user_metadata?.studentCode || null
                const normalizedStudentCode = studentCode ? normalizeStudentCode(studentCode) : null
                const derivedEmail = normalizedStudentCode ? buildStudentEmailFromCode(normalizedStudentCode) : user.email

                const lookupKey = normalizedStudentCode ? 'student_code' : 'email'
                const lookupValue = normalizedStudentCode ?? user.email
                const { data: existing, error: fetchErr } = await supabase.from('students').select('*').eq(lookupKey, lookupValue).maybeSingle()
                if (fetchErr) {
                    console.error('[auth-sync] error fetching student', fetchErr)
                    return
                }
                if (!existing) {
                    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}`
                    const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email.split('@')[0]
                    const studentPayload = {
                        id,
                        student_code: normalizedStudentCode ?? `STU-${Date.now()}`,
                        name,
                        email: derivedEmail,
                        course: 'Undeclared',
                        status: 'active',
                    }
                    console.debug('[auth-sync] creating student row', studentPayload)
                    const { data: ins, error: insErr } = await supabase.from('students').upsert([studentPayload], { onConflict: 'student_code' }).select().maybeSingle()
                    if (insErr) {
                        console.error('[auth-sync] error inserting student', insErr)
                    } else {
                        console.debug('[auth-sync] student created', ins)
                        const appUser = {
                            id: user.id ?? ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `app-user-${Date.now()}`),
                            email: derivedEmail,
                            role: 'student',
                            student_id: id,
                        }
                        const { error: appErr } = await supabase.from('app_users').upsert(appUser, { onConflict: 'email' })
                        if (appErr) console.error('[auth-sync] app_user upsert error', appErr)
                    }
                } else if (normalizedStudentCode && existing.email !== derivedEmail) {
                    await supabase.from('students').update({ email: derivedEmail }).eq('id', existing.id)
                    await supabase.from('app_users').update({ email: derivedEmail }).eq('student_id', existing.id)
                }
            }
        } catch (err) {
            console.error('[auth-sync] unexpected error', err)
        }
    })
}
