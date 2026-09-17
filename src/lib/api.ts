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

function findBookMatch(allBooks: any[], target: string): any {
    const trimmedTarget = String(target ?? '').trim()
    if (!trimmedTarget) return null

    const targetNormalized = normalizeBookReference(trimmedTarget)
    return (allBooks ?? []).find((book: any) => {
        const candidates = [
            book?.id,
            book?.book_code,
            book?.bookId,
            book?.isbn,
            book?.code,
            book?.title,
        ].filter((candidate) => candidate != null && String(candidate).trim() !== '')

        return candidates.some((candidate) => {
            const candidateText = String(candidate).trim()
            const normalizedCandidate = normalizeBookReference(candidateText)
            return normalizedCandidate === targetNormalized
                || candidateText.toLowerCase() === trimmedTarget.toLowerCase()
                || candidateText.replace(/-/g, '').toLowerCase() === trimmedTarget.replace(/-/g, '').toLowerCase()
                || (typeof book?.title === 'string' && normalizeBookReference(book.title).includes(targetNormalized))
        })
    }) ?? null
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

export async function requestReturn(recordId: string, requestedReturnDate?: string, remark?: string) {
    // Do NOT set `return_date` yet — admin must confirm the return.
    // Persist only the return request state and optional condition/remark.
    const payload: Record<string, any> = {
        status: 'return_requested',
    }

    const notes = String(remark ?? '').trim()
    if (notes) {
        payload.condition = notes
    } else {
        payload.condition = null
    }

    const { data, error } = await supabase
        .from('borrowing_records')
        .update(payload)
        .eq('id', recordId)
        .select('*')
        .maybeSingle()

    if (error) throw new Error(error.message)
    return data
}

export async function processReturn(recordIdOrCard: string, finalReturnDate?: string, finalRemark?: string) {
    const recordId = String(recordIdOrCard ?? '').trim()

    if (recordId && looksLikeUuid(recordId)) {
        const { data: existingRecord, error: lookupError } = await supabase
            .from('borrowing_records')
            .select('*')
            .eq('id', recordId)
            .maybeSingle()

        if (lookupError) throw new Error(lookupError.message)
        if (!existingRecord) throw new Error('Borrow record not found.')

        const returnDate = String(finalReturnDate ?? existingRecord.return_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
        const tempRemark = String(finalRemark ?? existingRecord.condition ?? 'Returned').trim() || 'Returned.'

        const { data: updatedRecord, error: updateError } = await supabase
            .from('borrowing_records')
            .update({
                return_date: returnDate,
                status: 'returned',
                condition: tempRemark,
            })
            .eq('id', recordId)
            .select('*')
            .maybeSingle()

        if (updateError) throw new Error(updateError.message)

        if (updatedRecord?.book_id) {
            const { data: bookRow, error: bookLookupError } = await supabase
                .from('books')
                .select('id, available_copies, available')
                .eq('id', updatedRecord.book_id)
                .maybeSingle()

            if (!bookLookupError && bookRow) {
                const currentAvailable = Number(bookRow.available_copies ?? bookRow.available ?? 0)
                const next = Math.max(currentAvailable + 1, 0)
                await supabase
                    .from('books')
                    .update({ available_copies: next, available: next })
                    .eq('id', bookRow.id)
            }
        }

        return updatedRecord
    }

    if (!finalRemark) {
        throw new Error('Return requires either a borrowing record ID or a student ID and book reference.')
    }

    const cardOrStudentValue = recordIdOrCard.trim()
    const bookQuery = String(finalRemark ?? '').trim()
    const { data: loginRows, error: loginErr } = await supabase.from('student_login_accounts').select('*').limit(200)
    if (loginErr) throw loginErr

    const matchedStudent = (loginRows ?? []).find((row: any) => {
        const values = [row?.student_id, row?.student_code, row?.id, row?.full_name].filter(Boolean)
        return values.some((value) => String(value).trim().toLowerCase() === cardOrStudentValue.trim().toLowerCase())
    })

    if (!matchedStudent) throw new Error('Student not found. Please choose a valid student record.')

    const { data: allBooks, error: bookErr } = await supabase.from('books').select('*').limit(200)
    if (bookErr) throw bookErr

    const matchedBook = findBookMatch(allBooks ?? [], bookQuery)
    if (!matchedBook) throw new Error(`Book not found: ${bookQuery}`)

    const { data: activeRecord, error: recordErr } = await supabase
        .from('borrowing_records')
        .select('*')
        .eq('student_id', matchedStudent.id)
        .eq('book_id', matchedBook.id)
        .is('return_date', null)
        .order('borrow_date', { ascending: false })
        .maybeSingle()

    if (recordErr) throw new Error(recordErr.message)
    if (!activeRecord) throw new Error('No active loan found for this student and book.')

    const updated = await processReturn(String(activeRecord.id), finalReturnDate, finalRemark)
    return updated
}

export * from './mockApi'

export async function fetchStudentBorrowingRecords(studentId?: string) {
    const trimmedStudentId = String(studentId ?? '').trim()
    if (!trimmedStudentId) return []

    try {
        const targetIdentifiers = buildStudentIdentifierSet(trimmedStudentId)
        const { data: loginRows, error: loginErr } = await supabase
            .from('student_login_accounts')
            .select('*')
            .limit(200)

        if (loginErr) throw loginErr

        const matchedLogin = (loginRows ?? []).find((row: any) => rowMatchesStudentIdentifier(row, targetIdentifiers)) ?? null
        if (!matchedLogin?.id) return []

        const { data: allRecords, error } = await supabase
            .from('borrowing_records')
            .select('*')
            .order('borrow_date', { ascending: false })

        if (error) throw error

        const studentMatchValues = new Set([
            String(matchedLogin.id ?? '').trim(),
            String(matchedLogin.student_id ?? '').trim(),
            String(matchedLogin.student_code ?? '').trim(),
            String(matchedLogin.full_name ?? '').trim(),
        ].filter(Boolean))

        const matchingRecords = (allRecords ?? []).filter((record: any) => {
            const studentId = String(record?.student_id ?? '').trim()
            return studentMatchValues.has(studentId) || studentId === String(matchedLogin.id ?? '').trim()
        }).filter((record: any) => !record?.return_date || record.return_date === null || record.return_date === undefined || record.return_date === '')

        if (!matchingRecords.length) return []

        const bookIds = [...new Set(matchingRecords.map((record: any) => String(record.book_id ?? '').trim()).filter(Boolean))]
        const { data: bookRows } = await supabase
            .from('books')
            .select('*')
            .in('id', bookIds.length ? bookIds : ['00000000-0000-0000-0000-000000000000'])

        const bookMap = new Map((bookRows ?? []).map((book: any) => [String(book.id ?? '').trim(), book]))

        return matchingRecords.map((record: any) => {
            const book = bookMap.get(String(record.book_id ?? '').trim())
            return {
                id: record.id,
                title: book?.title ?? 'Unknown book',
                author: book?.author ?? 'Unknown author',
                borrowDate: record.borrow_date ?? record.created_at ?? '',
                dueDate: record.due_date ?? '',
                status: record.status ?? 'active',
                studentId: record.student_id,
                cardNo: record.card_no ?? null,
                cover_url: book?.cover_url ?? book?.coverUrl ?? null,
            }
        })
    } catch (err) {
        console.debug('[api] fetchStudentBorrowingRecords failed', err)
        return []
    }
}

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

        const { data: allBooks, error: listErr } = await supabase.from('books').select('*').limit(200)
        if (listErr) throw listErr

        const normalizedBookId = String(bookId ?? '').trim()
        const bookRow = findBookMatch(allBooks ?? [], normalizedBookId)

        if (!bookRow) throw new Error(`Book not found: ${bookId}`)

        const borrowDate = new Date().toISOString().slice(0, 10)
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const payload = {
            id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `loan-${Date.now()}`,
            txn_code: `TXN-${Date.now()}`,
            student_id: String(loginRow.id),
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
                    const current = Number(bookRow.available_copies ?? bookRow.available ?? 0)
                    const next = current + 1
                    await supabase.from('books').update({ available_copies: next, available: next }).eq('id', bookRow.id)
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

        const accountStatus = String(row.status ?? 'active').toLowerCase()
        if (accountStatus === 'suspended') {
            throw new Error('This account has been deactivated by the library admin.')
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
