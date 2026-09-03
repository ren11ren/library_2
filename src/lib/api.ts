import supabase from '../supabaseClient'
import type { AuthSession, UserRole } from './database.types'

function normalizeStudentCode(value: string): string {
    const cleaned = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    return cleaned.startsWith('STU-') ? cleaned : `STU-${cleaned}`
}

function buildStudentEmailFromCode(value: string): string {
    const code = normalizeStudentCode(value).replace(/^STU-/i, '')
    return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

export * from './mockApi'

// Prefer Supabase-backed implementations for some read operations.
export {
    getBooks as fetchBooks,
    getUserBorrowedBooks as fetchStudentBorrowingRecords,
} from '../services/libraryService'

// Prefer Supabase-backed borrow/return so availability matches DB state.
import { borrowBook as sbBorrowBook, returnBook as sbReturnBook } from '../services/libraryService'

export async function borrowBook(studentId: string | undefined, bookId: string) {
    try {
        // services/libraryService.borrowBook expects only bookId and uses supabase auth to get user.
        // Call it directly; if it fails (no auth), fall back to mock implementation.
        return await sbBorrowBook(bookId)
    } catch (err) {
        console.debug('[api] supabase borrow failed, falling back to mock', err)
        const { borrowBook: mockBorrow } = await import('./mockApi')
        // If Supabase didn't authenticate or returned no book, try mapping the DB id to an ISBN/book_code
        try {
            const { data: bookRow, error: fetchErr } = await supabase.from('books').select('isbn, book_code, title').eq('id', bookId).maybeSingle()
            if (!fetchErr && bookRow) {
                const identifier = (bookRow as any).isbn ?? (bookRow as any).book_code ?? bookId
                console.debug('[api] mapping book id to identifier for mock fallback', { bookId, identifier })
                return await mockBorrow(studentId as string, identifier)
            }
        } catch (mapErr) {
            console.debug('[api] error mapping book id for mock fallback', mapErr)
        }

        // fallback to original id if mapping failed
        return await mockBorrow(studentId as string, bookId)
    }
}

export async function returnBook(recordId: string) {
    try {
        return await sbReturnBook(recordId)
    } catch (err) {
        console.debug('[api] supabase return failed, falling back to mock', err)
        const { processReturn: mockReturn } = await import('./mockApi')
        return await mockReturn(recordId, '')
    }
}

export async function login(emailOrId: string, password: string, role: UserRole): Promise<AuthSession> {
    const identifier = String(emailOrId || '').trim()
    try {
        // Use Supabase auth to sign in. Accept either email or student code.
        let emailToUse = identifier
        let studentCode: string | null = null
        if (!identifier.includes('@')) {
            studentCode = normalizeStudentCode(identifier)
            const { data: sRow } = await supabase.from('students').select('email, student_code').eq('student_code', studentCode).maybeSingle()
            if (sRow && sRow.email) {
                emailToUse = sRow.email
            } else {
                emailToUse = buildStudentEmailFromCode(studentCode)
                const { data: derivedRow } = await supabase.from('students').select('email').eq('email', emailToUse).maybeSingle()
                if (!derivedRow) {
                    throw new Error('Invalid email or student ID')
                }
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
