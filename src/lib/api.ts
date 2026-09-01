import supabase from '../supabaseClient'
import type { AuthSession, UserRole } from './database.types'

export * from './mockApi'

// Prefer Supabase-backed implementations for some read operations.
export {
    getBooks as fetchBooks,
    getUserBorrowedBooks as fetchStudentBorrowingRecords,
} from '../services/libraryService'

export async function login(emailOrId: string, password: string, role: UserRole): Promise<AuthSession> {
    const identifier = String(emailOrId || '').trim()
    try {
        // Use Supabase auth to sign in. Accept either email or student code.
        let emailToUse = identifier
        if (!identifier.includes('@')) {
            // Treat as student code (e.g. STU-2021-001 or 2021-001)
            const code = identifier.toUpperCase().startsWith('STU-') ? identifier.toUpperCase() : `STU-${identifier}`
            const { data: sRow } = await supabase.from('students').select('email').eq('student_code', code).maybeSingle()
            if (sRow && sRow.email) {
                emailToUse = sRow.email
            } else {
                // No matching student; fail fast so UI shows invalid identifier
                throw new Error('Invalid email or student ID')
            }
        }

        const authClient: any = supabase.auth
        let signInRes: any
        if (typeof authClient.signInWithPassword === 'function') {
            signInRes = await authClient.signInWithPassword({ email: emailToUse, password })
        } else if (typeof authClient.signIn === 'function') {
            signInRes = await authClient.signIn({ email: emailToUse, password })
        } else {
            throw new Error('Supabase auth not available')
        }

        if (signInRes.error) throw signInRes.error
        const user = signInRes.data?.user ?? signInRes.user ?? signInRes
        if (!user || !user.email) throw new Error('Invalid credentials')

        // fetch app_user by email
        const { data: appUser, error: appErr } = await supabase.from('app_users').select('*').eq('email', user.email).maybeSingle()
        if (appErr) console.debug('[login] app_user fetch error', appErr)

        // fetch student row either by appUser.student_id or email
        let student = null
        if (appUser?.student_id) {
            const { data: sData } = await supabase.from('students').select('*').eq('id', appUser.student_id).maybeSingle()
            student = sData ?? null
        } else {
            const { data: sData } = await supabase.from('students').select('*').eq('email', user.email).maybeSingle()
            student = sData ?? null
        }

        // fetch library card
        const { data: cardData } = await supabase.from('library_cards').select('*').eq('student_id', student?.id).maybeSingle()
        const card = (cardData as any) ?? null

        return { user: (appUser ?? user) as any, student, card }
    } catch (err: any) {
        // Log the Supabase error for debugging.
        console.debug('[login] supabase auth error, falling back to mock', err)
        // Fall back to the local mock implementation so development credentials still work.
        const { login: mockLogin } = await import('./mockApi')
        try {
            return await mockLogin(emailOrId, password, role)
        } catch (mockErr) {
            // If mock also fails, surface the original Supabase error to the caller/UI.
            throw err
        }
    }
}
