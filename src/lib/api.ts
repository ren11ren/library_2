import supabase from '../supabaseClient'
import type { AuthSession, UserRole } from './database.types'

function normalizeStudentCode(value: string): string {
    const cleaned = String(value ?? '').trim().replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
    const withoutPrefix = cleaned.replace(/^STU-?/i, '')
    return withoutPrefix ? `STU-${withoutPrefix}` : 'STU'
}

function buildStudentIdentifierSet(value: string): string[] {
    const trimmed = String(value ?? '').trim()
    const variants = new Set<string>()
    if (!trimmed) return []

    const direct = [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()]
    direct.forEach((variant) => variants.add(variant))

    const normalizedCode = normalizeStudentCode(trimmed)
    variants.add(normalizedCode)
    variants.add(normalizedCode.replace(/^STU-/i, ''))

    return [...variants].filter(Boolean)
}

function rowMatchesStudentIdentifier(row: any, identifiers: string[]): boolean {
    const allValues = [
        row?.id,
        row?.student_code,
        row?.student_id,
        row?.email,
        row?.name,
    ].filter((value) => typeof value === 'string' && value.trim())

    return allValues.some((value) =>
        identifiers.some((identifier) => String(value).trim().toUpperCase() === String(identifier).trim().toUpperCase())
    )
}

function buildStudentEmailFromCode(value: string): string {
    const code = normalizeStudentCode(value).replace(/^STU-/i, '')
    return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

function isMissingTableError(error: any): boolean {
    const message = String(error?.message ?? '')
    return message.includes('Could not find the table') || message.includes('does not exist') || message.includes('relation') && message.includes('does not exist')
}

function looksLikeUuid(value: string | null | undefined): boolean {
    return !!String(value ?? '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
}

async function ensureStudentRecordForLoginRow(loginRow: any): Promise<any> {
    const studentCode = String(loginRow?.student_code ?? loginRow?.student_id ?? '').trim()
    const lookupCode = studentCode || String(loginRow?.id ?? '').trim()
    if (!lookupCode) throw new Error('Missing student code for borrow record.')

    const { data: existingStudent, error: lookupError } = await supabase
        .from('students')
        .select('*')
        .eq('student_code', lookupCode)
        .maybeSingle()

    if (lookupError) throw lookupError
    if (existingStudent) return existingStudent

    const generatedId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `stu-${Date.now()}`
    const { data: createdStudent, error: createError } = await supabase
        .from('students')
        .upsert([
            {
                id: generatedId,
                student_code: studentCode,
                name: loginRow?.full_name ?? 'Student',
                email: buildStudentEmailFromCode(studentCode),
                course: loginRow?.course ?? 'Unassigned',
                year_level: loginRow?.year_level ?? '1st Year',
                status: loginRow?.status ?? 'active',
            },
        ], { onConflict: 'student_code' })
        .select()
        .maybeSingle()

    if (createError) throw createError
    return createdStudent
}

function normalizeBookReference(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function hashPassword(value: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    return value
}

async function passwordMatchesStoredValue(storedValue: unknown, inputPassword: string): Promise<boolean> {
    const normalizedStored = String(storedValue ?? '').trim()
    const hashedInput = await hashPassword(inputPassword)

    if (!normalizedStored) return false
    if (normalizedStored === inputPassword || normalizedStored === hashedInput) return true

    const [storedLower, inputLower] = [normalizedStored.toLowerCase(), inputPassword.toLowerCase()]
    if (storedLower === inputLower) return true

    return false
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
    const trimmedStudentId = String(studentId ?? '').trim()
    if (!trimmedStudentId) throw new Error('Student not found. Please log in with a valid student account.')

    try {
        const identifiers = buildStudentIdentifierSet(trimmedStudentId)
        const { data: loginRows, error: loginErr } = await supabase
            .from('student_login_accounts')
            .select('*')
            .limit(50)

        if (loginErr) throw loginErr

        const loginRow = (loginRows ?? []).find((row: any) => rowMatchesStudentIdentifier(row, identifiers)) ?? null
        if (!loginRow) throw new Error('Student not found. Please register this student first.')

        const studentRecord = await ensureStudentRecordForLoginRow(loginRow)
        if (!studentRecord?.id) throw new Error('Student profile is missing a UUID record.')

        const { data: allBooks, error: listErr } = await supabase.from('books').select('*').limit(200)
        if (listErr) throw listErr

        const normalizedBookId = String(bookId ?? '').trim()
        const bookRow = (allBooks ?? []).find((book: any) => {
            const candidates = [book?.id, book?.book_code, book?.isbn, book?.title]
            const normalizedTarget = normalizeBookReference(normalizedBookId)
            return candidates.some((candidate) => {
                if (candidate == null || candidate === '') return false
                const normalizedCandidate = normalizeBookReference(candidate)
                return normalizedCandidate === normalizedTarget || String(candidate).trim() === normalizedBookId || String(candidate).trim().toLowerCase() === normalizedBookId.toLowerCase()
            })
        }) ?? null

        if (!bookRow) throw new Error(`Book not found: ${bookId}`)

        const borrowDate = new Date().toISOString().slice(0, 10)
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const payload = {
            id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `loan-${Date.now()}`,
            txn_code: `TXN-${Date.now()}`,
            student_id: String(studentRecord.id),
            book_id: bookRow.id,
            borrow_date: borrowDate,
            due_date: dueDate,
            return_date: null,
            status: 'active',
            notified: false,
            condition: 'Good',
            created_at: new Date().toISOString(),
        }

        const { data: inserted, error: insertErr } = await supabase.from('borrowing_records').insert([payload]).select().maybeSingle()
        if (insertErr) throw insertErr

        const currentAvailable = Number(bookRow.available_copies ?? bookRow.available ?? 0)
        await supabase.from('books').update({ available_copies: Math.max(currentAvailable - 1, 0), available: Math.max(currentAvailable - 1, 0) }).eq('id', bookRow.id)
        return inserted
    } catch (err) {
        console.debug('[api] student_login_accounts borrow failed; falling back to mock borrow', err)
        const { borrowBook: mockBorrow, upsertStudent } = await import('./mockApi')
        const studentCode = normalizeStudentCode(trimmedStudentId)
        await upsertStudent({
            id: crypto?.randomUUID ? crypto.randomUUID() : `mock-student-${Date.now()}`,
            student_code: studentCode,
            name: 'Current Student',
            email: buildStudentEmailFromCode(studentCode),
            course: 'Unassigned',
            year_level: '1st Year',
            status: 'active',
        })
        return await mockBorrow(studentCode, bookId)
    }
}

export async function returnBook(recordId: string) {
    try {
        return await sbReturnBook(recordId)
    } catch (err) {
        console.debug('[api] supabase return failed, using custom student-login fallback', err)
        try {
            const returnDate = new Date().toISOString().slice(0, 10)
            const { data: updatedRecord, error } = await supabase
                .from('borrowing_records')
                .update({ return_date: returnDate, status: 'returned' })
                .eq('id', recordId)
                .select()
                .maybeSingle()

            if (error) throw error
            if (updatedRecord?.book_id) {
                const { data: bookRow } = await supabase.from('books').select('*').eq('id', updatedRecord.book_id).maybeSingle()
                if (bookRow) {
                    await supabase.from('books').update({ available: Number(bookRow.available ?? 0) + 1 }).eq('id', bookRow.id)
                }
            }
            return updatedRecord
        } catch (dbErr: any) {
            console.debug('[api] custom student-login return failed', dbErr)
            const { processReturn: mockReturn } = await import('./mockApi')
            return await mockReturn(recordId, '')
        }
    }
}

export async function login(emailOrId: string, password: string, role: UserRole): Promise<AuthSession> {
    const identifier = String(emailOrId || '').trim()
    const inputValue = identifier.includes('@') ? identifier : normalizeStudentCode(identifier)

    try {
        const targetIdentifiers = buildStudentIdentifierSet(identifier)
        const { data: loginRows, error: loginError } = await supabase
            .from('student_login_accounts')
            .select('*')
            .limit(50)

        if (loginError) throw loginError

        const row = (loginRows ?? []).find((candidate: any) => rowMatchesStudentIdentifier(candidate, targetIdentifiers)) ?? (loginRows ?? [])[0]

        if (!row) {
            throw new Error('Student not found. Please register this student first.')
        }

        const passwordMatches = await passwordMatchesStoredValue(row.password_hash, password)
        if (!passwordMatches) {
            throw new Error('Invalid credentials')
        }

        const studentCode = row.student_code ?? row.student_id ?? inputValue
        const student = {
            id: row.student_id ?? row.student_code ?? studentCode,
            student_code: studentCode,
            name: row.full_name ?? 'Student',
            email: buildStudentEmailFromCode(studentCode),
            course: row.course ?? 'Unassigned',
            year_level: row.year_level ?? '1st Year',
            status: row.status ?? 'active',
        }

        const loginUser = {
            id: row.id,
            email: buildStudentEmailFromCode(studentCode),
            student_id: row.student_id,
            student_code: studentCode,
            full_name: row.full_name,
            course: row.course,
            year_level: row.year_level,
            status: row.status,
        }

        return { user: loginUser as any, student, card: null, loginAccount: row }
    } catch (err: any) {
        console.debug('[login] student_login_accounts login failed', err)
        throw err
    }
}
