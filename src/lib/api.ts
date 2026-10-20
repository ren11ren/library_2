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

    variants.add(trimmed)
    variants.add(trimmed.toUpperCase())
    variants.add(trimmed.toLowerCase())

    const normalizedCode = normalizeStudentCode(trimmed)
    variants.add(normalizedCode)
    variants.add(normalizedCode.replace(/^STU-/i, ''))

    const withoutAt = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
    if (withoutAt && withoutAt !== trimmed) {
        variants.add(withoutAt)
        variants.add(withoutAt.toUpperCase())
        variants.add(withoutAt.toLowerCase())
    }

    return [...variants].filter(Boolean)
}

function rowMatchesStudentIdentifier(row: any, identifiers: string[]): boolean {
    const exactValues = [
        row?.id,
        row?.student_code,
        row?.student_id,
        row?.email,
    ].filter((value) => typeof value === 'string' && value.trim())

    return exactValues.some((value) =>
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
    if (existingStudent) {
        if (String(loginRow?.id ?? '').trim() && String(existingStudent.id ?? '').trim() !== String(loginRow.id).trim()) {
            const { error: syncError } = await supabase
                .from('student_login_accounts')
                .update({ id: existingStudent.id, updated_at: new Date().toISOString() })
                .eq('id', loginRow.id)

            if (syncError) {
                console.warn('[student-sync] login account ID could not be aligned with student row', syncError)
            }
        }
        return existingStudent
    }

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

    if (createdStudent && String(loginRow?.id ?? '').trim() && String(createdStudent.id ?? '').trim() !== String(loginRow.id).trim()) {
        const { error: syncError } = await supabase
            .from('student_login_accounts')
            .update({ id: createdStudent.id, updated_at: new Date().toISOString() })
            .eq('id', loginRow.id)

        if (syncError) {
            console.warn('[student-sync] login account ID could not be synchronized', syncError)
        }
    }

    return createdStudent
}

function normalizeBookReference(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBookMatch(allBooks: any[], target: string): any {
    const trimmedTarget = String(target ?? '').trim()
    if (!trimmedTarget) return null

    const targetNormalized = normalizeBookReference(trimmedTarget)
    const targetLower = trimmedTarget.toLowerCase()

    const exactMatches = (allBooks ?? []).filter((book: any) => {
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
            const candidateLower = candidateText.toLowerCase()
            const compactCandidate = candidateText.replace(/[-\s]/g, '').toLowerCase()
            const compactTarget = trimmedTarget.replace(/[-\s]/g, '').toLowerCase()

            return normalizedCandidate === targetNormalized
                || candidateLower === targetLower
                || compactCandidate === compactTarget
                || (typeof book?.isbn === 'string' && normalizeBookReference(book.isbn) === targetNormalized)
                || (typeof book?.title === 'string' && normalizeBookReference(book.title) === targetNormalized)
        })
    })

    if (exactMatches.length > 0) return exactMatches[0]

    const nearMatches = (allBooks ?? []).filter((book: any) => {
        const title = typeof book?.title === 'string' ? book.title.toLowerCase() : ''
        const isbn = typeof book?.isbn === 'string' ? book.isbn.toLowerCase() : ''
        const code = typeof book?.book_code === 'string' ? book.book_code.toLowerCase() : ''

        return title.includes(targetLower)
            || isbn.includes(targetLower)
            || code.includes(targetLower)
            || (targetNormalized.length > 4 && (normalizeBookReference(title).includes(targetNormalized) || normalizeBookReference(isbn).includes(targetNormalized)))
    })

    return nearMatches[0] ?? null
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
        if (String(existingRecord.status ?? '').toLowerCase() !== 'return_requested') {
            throw new Error('This return must be requested by the student and approved by the admin before it is finalized.')
        }

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

        try {
            await supabase.from('book_returns').insert([
                {
                    borrow_record_id: updatedRecord?.id ?? recordId,
                    book_id: updatedRecord?.book_id ?? null,
                    student_id: updatedRecord?.student_id ?? null,
                    return_date: returnDate,
                    returned_at: new Date().toISOString(),
                    condition: tempRemark,
                    remark: tempRemark,
                    status: 'returned',
                },
            ])
        } catch (returnLogError) {
            console.warn('[processReturn] book_returns insert failed, but loan was still marked returned.', returnLogError)
        }

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

    const { data: allBooks, error: bookErr } = await supabase.from('books').select('*')
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
    if (String(activeRecord.status ?? '').toLowerCase() !== 'return_requested') {
        throw new Error('This return has not been requested for review. The student must submit a return request first.')
    }

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

        const { data: studentRows, error: studentLookupError } = await supabase
            .from('students')
            .select('*')
            .limit(200)

        if (studentLookupError) throw studentLookupError

        const studentRow = (studentRows ?? []).find((row: any) => {
            const candidateCode = String(row?.student_code ?? '').trim().toUpperCase()
            const candidateId = String(row?.id ?? '').trim().toUpperCase()
            const loginCode = String(matchedLogin?.student_code ?? matchedLogin?.student_id ?? '').trim().toUpperCase()
            const loginId = String(matchedLogin?.id ?? '').trim().toUpperCase()
            const loginEmail = String(matchedLogin?.email ?? '').trim().toLowerCase()
            return candidateCode === loginCode || candidateId === loginId || String(row?.email ?? '').trim().toLowerCase() === loginEmail
        }) ?? null

        const targetStudentId = String(studentRow?.id ?? matchedLogin.id ?? '').trim()
        const studentMatchValues = new Set([
            String(targetStudentId ?? '').trim(),
            String(matchedLogin.id ?? '').trim(),
            String(matchedLogin.student_id ?? '').trim(),
            String(matchedLogin.student_code ?? '').trim(),
            String(matchedLogin.full_name ?? '').trim(),
        ].filter(Boolean))

        const matchingRecords = (allRecords ?? []).filter((record: any) => {
            const studentId = String(record?.student_id ?? '').trim()
            return studentMatchValues.has(studentId) || studentId === String(targetStudentId ?? '').trim() || studentId === String(matchedLogin.id ?? '').trim()
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

    const identifiers = buildStudentIdentifierSet(trimmedStudentId)
    const { data: loginRows, error: loginErr } = await supabase
        .from('student_login_accounts')
        .select('*')
        .limit(50)

    if (loginErr) throw loginErr

    const loginRow = (loginRows ?? []).find((row: any) => rowMatchesStudentIdentifier(row, identifiers)) ?? null
    if (!loginRow) throw new Error('Student not found. Please register this student first.')

    const studentRow = await ensureStudentRecordForLoginRow(loginRow)
    const studentUuid = String(studentRow?.id ?? loginRow?.id ?? '').trim()
    if (!studentUuid) throw new Error('Unable to resolve the student record for this borrow.')

    const { data: currentLoans, error: loanCountError } = await supabase
        .from('borrowing_records')
        .select('id')
        .eq('student_id', studentUuid)
        .is('return_date', null)

    if (loanCountError) throw loanCountError

    const limit = 5
    if ((currentLoans ?? []).length >= limit) {
        throw new Error(`Maximum of ${limit} books can be borrowed at once.`)
    }

    const { data: allBooks, error: listErr } = await supabase.from('books').select('*')
    if (listErr) throw listErr

    const normalizedBookId = String(bookId ?? '').trim()
    const bookRow = findBookMatch(allBooks ?? [], normalizedBookId)

    if (!bookRow) throw new Error(`Book not found: ${bookId}`)

    const borrowDate = new Date().toISOString().slice(0, 10)
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const payload = {
        id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `loan-${Date.now()}`,
        txn_code: `TXN-${Date.now()}`,
        student_id: studentUuid,
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
}

export async function returnBook(recordId: string) {
    throw new Error('Returns must be requested by the student and approved by the admin before the book is finalized as returned.')
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

        const row = (loginRows ?? []).find((candidate: any) => rowMatchesStudentIdentifier(candidate, targetIdentifiers))

        if (!row) {
            const fallbackByName = (loginRows ?? []).find((candidate: any) => {
                const fullName = String(candidate?.full_name ?? candidate?.name ?? '').trim().toLowerCase()
                return fullName && fullName === String(identifier).trim().toLowerCase()
            })

            if (!fallbackByName) {
                throw new Error('Student not found. Please log in with your exact student ID or email.')
            }

            throw new Error('Student account could not be matched securely. Please use your student ID or email instead of a name.')
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
        let studentRow: any = null
        try {
            const { data } = await supabase
                .from('students')
                .select('*')
                .or(`student_code.eq.${studentCode},id.eq.${String(row.student_id ?? '').trim() || studentCode},email.eq.${buildStudentEmailFromCode(studentCode)}`)
                .limit(1)
            studentRow = Array.isArray(data) && data.length > 0 ? data[0] : null
        } catch (e) {
            studentRow = null
        }

        const actualStudentId = String(studentRow?.id ?? row.student_id ?? row.id ?? studentCode).trim()
        const student = {
            id: actualStudentId,
            student_code: studentCode,
            name: studentRow?.name ?? row.full_name ?? 'Student',
            email: studentRow?.email ?? row.email ?? buildStudentEmailFromCode(studentCode),
            course: studentRow?.course ?? row.course ?? 'Unassigned',
            year_level: studentRow?.year_level ?? row.year_level ?? '1st Year',
            status: studentRow?.status ?? row.status ?? 'active',
            avatar_url: studentRow?.avatar_url ?? row.avatar_url ?? null,
        }

        const loginUser = {
            id: row.id,
            email: student.email,
            student_id: actualStudentId,
            student_code: studentCode,
            full_name: student.name,
            course: student.course,
            year_level: student.year_level,
            status: student.status,
            avatar_url: student.avatar_url ?? null,
        }

        return { user: loginUser as any, student, card: null, loginAccount: row }
    } catch (err: any) {
        console.debug('[login] student_login_accounts login failed', err)
        throw err
    }
}
