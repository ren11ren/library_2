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

async function hashPassword(value: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }
    return value
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
    try {
        // services/libraryService.borrowBook expects only bookId and uses supabase auth to get user.
        // For the custom student-login flow there may be no Supabase auth session, so we handle the DB flow directly below.
        return await sbBorrowBook(bookId)
    } catch (err) {
        console.debug('[api] supabase borrow failed, using custom student-login fallback', err)

        if (!trimmedStudentId) {
            throw new Error('Student not found')
        }

        try {
            const normalizedStudentCode = trimmedStudentId.startsWith('STU-') ? trimmedStudentId : `STU-${trimmedStudentId}`
            let studentRow: any = null
            const { data: existingStudent, error: studentErr } = await supabase
                .from('students')
                .select('*')
                .or(`student_code.eq.${normalizedStudentCode},id.eq.${trimmedStudentId}`)
                .maybeSingle()

            if (studentErr) throw studentErr
            studentRow = existingStudent

            if (!studentRow) {
                const { data: loginRow, error: loginErr } = await supabase
                    .from('student_login_accounts')
                    .select('*')
                    .or(`student_id.eq.${trimmedStudentId},student_code.eq.${normalizedStudentCode}`)
                    .maybeSingle()
                if (loginErr) throw loginErr
                if (!loginRow) throw new Error('Student not found')

                const studentPayload = {
                    id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `student-${Date.now()}`,
                    student_code: loginRow.student_code ?? normalizedStudentCode,
                    name: loginRow.full_name ?? 'Student',
                    email: `${(loginRow.student_code ?? normalizedStudentCode).replace(/^STU-/i, '').replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`,
                    course: loginRow.course ?? 'Unassigned',
                    year_level: loginRow.year_level ?? '1st Year',
                    status: 'active',
                }

                const { data: createdStudent, error: createErr } = await supabase.from('students').upsert([studentPayload], { onConflict: 'student_code' }).select().maybeSingle()
                if (createErr) throw createErr
                if (!createdStudent) throw new Error('Student not found')
                studentRow = createdStudent
            }

            const { data: bookRow, error: bookErr } = await supabase
                .from('books')
                .select('*')
                .or(`id.eq.${bookId},book_code.eq.${bookId},isbn.eq.${bookId}`)
                .maybeSingle()
            if (bookErr) throw bookErr
            if (!bookRow) throw new Error(`Book not found: ${bookId}`)

            const { data: activeLoans, error: activeErr } = await supabase
                .from('borrowing_records')
                .select('id')
                .eq('student_id', studentRow.id)
                .is('return_date', null)
            if (activeErr) throw activeErr

            const settingsRes = await supabase.from('settings').select('*').maybeSingle()
            const maxBooks = Number((settingsRes.data as any)?.max_books_per_student ?? 3)
            if ((activeLoans ?? []).length >= maxBooks) {
                throw new Error(`Maximum of ${maxBooks} books can be borrowed at once`)
            }

            if (Number(bookRow.available ?? 0) <= 0) {
                throw new Error('This book is currently unavailable.')
            }

            const borrowDate = new Date().toISOString().slice(0, 10)
            const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const payload = {
                id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `loan-${Date.now()}`,
                txn_code: `TXN-${Date.now()}`,
                student_id: studentRow.id,
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

            const { error: updateBookErr } = await supabase.from('books').update({ available: Math.max(Number(bookRow.available ?? 0) - 1, 0) }).eq('id', bookRow.id)
            if (updateBookErr) throw updateBookErr

            return inserted
        } catch (dbErr: any) {
            console.debug('[api] custom student-login borrow failed', dbErr)
            const { borrowBook: mockBorrow } = await import('./mockApi')
            return await mockBorrow(trimmedStudentId, bookId)
        }
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
    const normalizedInput = identifier.includes('@') ? identifier : normalizeStudentCode(identifier)
    const loginQueryValue = normalizedInput || identifier

    try {
        const { data: loginRows, error: loginError } = await supabase
            .from('student_login_accounts')
            .select('*')
            .or(`student_id.eq.${loginQueryValue},student_code.eq.${loginQueryValue}`)
            .limit(10)

        if (!loginError && loginRows && loginRows.length > 0) {
            const row = loginRows.find((candidate: any) => {
                const studentIdMatch = String(candidate.student_id ?? '').toUpperCase() === String(loginQueryValue).toUpperCase()
                const studentCodeMatch = String(candidate.student_code ?? '').toUpperCase() === String(loginQueryValue).toUpperCase()
                return studentIdMatch || studentCodeMatch
            }) ?? loginRows[0]

            if (row) {
                const hashedInput = await hashPassword(password)
                const passwordMatches = row.password_hash === password || row.password_hash === hashedInput
                if (passwordMatches) {
                    const studentCode = row.student_code ?? row.student_id ?? normalizedInput
                    const { data: student } = await supabase
                        .from('students')
                        .select('*')
                        .eq('student_code', studentCode)
                        .maybeSingle()

                    const { data: cardData } = await supabase
                        .from('library_cards')
                        .select('*')
                        .eq('student_id', student?.id ?? '')
                        .maybeSingle()

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

                    const resolvedStudent = student ?? {
                        id: row.student_id ?? row.student_code ?? studentCode,
                        student_code: studentCode,
                        name: row.full_name,
                        email: buildStudentEmailFromCode(studentCode),
                        course: row.course,
                        year_level: row.year_level,
                        status: row.status,
                    }

                    return { user: loginUser as any, student: resolvedStudent, card: (cardData as any) ?? null, loginAccount: row }
                }
            }
        }

        // Fallback to Supabase Auth for generated-internal emails or legacy account records.
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

        const { data: appUser, error: appErr } = await supabase.from('app_users').select('*').eq('email', user.email).maybeSingle()
        if (appErr) console.debug('[login] app_user fetch error', appErr)

        let loginAccount = null
        if (studentCode) {
            const { data: loginRow } = await supabase.from('student_login_accounts').select('*').eq('student_code', studentCode).maybeSingle()
            loginAccount = loginRow ?? null
        }

        let student = null
        if (appUser?.student_id) {
            const { data: sData } = await supabase.from('students').select('*').eq('id', appUser.student_id).maybeSingle()
            student = sData ?? null
        } else if (loginAccount?.student_code) {
            const { data: sData } = await supabase.from('students').select('*').eq('student_code', loginAccount.student_code).maybeSingle()
            student = sData ?? null
        } else {
            const { data: sData } = await supabase.from('students').select('*').eq('email', user.email).maybeSingle()
            student = sData ?? null
        }

        const { data: cardData } = await supabase.from('library_cards').select('*').eq('student_id', student?.id).maybeSingle()
        const card = (cardData as any) ?? null

        return { user: (loginAccount ?? appUser ?? user) as any, student, card, loginAccount }
    } catch (err: any) {
        console.debug('[login] student login failed', err)
        throw err
    }
}
