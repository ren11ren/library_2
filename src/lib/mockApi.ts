// Note: mock data has been migrated to the Supabase schema.sql.
// This module keeps a working local database state in browser storage so
// entries survive refreshes instead of resetting to an empty library.
import type {
    AuthSession,
    Book,
    BorrowingRecordWithDetails,
    LibraryCard,
    LoanStatus,
    Settings,
    Student,
    UserRole,
} from './database.types'
import { supabase } from '../supabaseClient'

const STORAGE_KEY = 'lms_mock_data_v1'

const defaultLibraryState = {
    books: [] as Book[],
    students: [] as Student[],
    app_users: [] as any[],
    library_cards: [] as any[],
    borrowing_records: [] as any[],
    settings: { id: 1, library_name: 'Campus Library', borrow_period_days: 14, max_books_per_student: 3, fine_per_day: 5.0, admin_email: 'admin@library.local' }
}

function ensureSeedUsers(data: any) {
    const currentUsers = Array.isArray(data?.app_users) ? data.app_users : []
    const merged = [...currentUsers]
    const byEmail = new Map(merged.map((user) => [String(user.email ?? '').toLowerCase(), user]))

    for (const user of defaultLibraryState.app_users) {
        const key = String(user.email ?? '').toLowerCase()
        if (!byEmail.has(key)) {
            merged.push(user)
            byEmail.set(key, user)
        }
    }

    return { ...data, app_users: merged }
}

function loadMockData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            const normalized = ensureSeedUsers(parsed)
            const reconciled = {
                ...normalized,
                books: reconcileBookAvailability(normalized.books ?? [], normalized.borrowing_records ?? []),
            }
            if (JSON.stringify(reconciled) !== JSON.stringify(normalized)) {
                saveMockData(reconciled)
            }
            return reconciled
        }
    } catch (e) {
        // ignore
    }
    saveMockData(defaultLibraryState)
    return defaultLibraryState
}

function saveMockData(data: any) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureSeedUsers(data)))
    } catch (e) {
        // ignore
    }
}

function reconcileBookAvailability(books: any[] = [], borrowingRecords: any[] = []) {
    const activeByBook = new Map<string, number>()
    for (const record of borrowingRecords) {
        if (!record || record.return_date) continue
        const key = String(record.book_id ?? record.book ?? '').trim()
        if (!key) continue
        activeByBook.set(key, (activeByBook.get(key) ?? 0) + 1)
    }

    return books.map((book: any) => {
        const bookId = String(book?.id ?? book?.book_code ?? book?.isbn ?? '').trim()
        const totalCopies = Number(book?.total_copies ?? book?.copies ?? 1)
        const activeLoans = bookId ? activeByBook.get(bookId) ?? 0 : 0
        const derivedAvailable = Math.max(0, totalCopies - activeLoans)
        const currentAvailable = Number(book?.available_copies ?? book?.available ?? totalCopies)

        const correctedAvailable = Number.isFinite(currentAvailable) && currentAvailable > 0
            ? derivedAvailable || Math.min(currentAvailable, totalCopies)
            : derivedAvailable

        return {
            ...book,
            copies: totalCopies,
            available: correctedAvailable,
            total_copies: totalCopies,
            available_copies: correctedAvailable,
        }
    })
}

const persisted = loadMockData()
let BOOKS = reconcileBookAvailability((persisted as any).books as Book[], (persisted as any).borrowing_records as any[]) as Book[]
let STUDENTS = (persisted as any).students as Student[]
const APP_USERS = (persisted as any).app_users as any[]
const CARDS = (persisted as any).library_cards as LibraryCard[]
let BORROWING = (persisted as any).borrowing_records as any[]
let SETTINGS = (persisted as any).settings as any

export function formatDate(value: string | Date) {
    const date = typeof value === 'string' ? new Date(value) : value
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

export function computeLoanStatus(dueDate: string, returnDate: string | null): LoanStatus {
    if (returnDate) return 'returned'
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 3) return 'due-soon'
    return 'active'
}

export function daysOverdue(dueDate: string) {
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    return Math.max(0, Math.ceil((today.getTime() - due.getTime()) / 86400000))
}

export async function login(emailOrId: string, password: string, role: UserRole): Promise<AuthSession> {
    const identifier = emailOrId.trim().toLowerCase()
    const candidate = APP_USERS.find((u) => u.password === password && u.role === role && (u.email.toLowerCase() === identifier || u.email.toLowerCase().includes(identifier)))
    if (!candidate) {
        // try student code
            const student = STUDENTS.find((s) => s.student_code.toLowerCase() === identifier || s.student_code.toLowerCase() === `stu-${identifier}`)
        if (student) {
            const user = APP_USERS.find((u) => u.student_id === student.id && u.password === password && u.role === role)
            if (user) return { user, student, card: CARDS.find((c) => c.student_id === student.id) ?? null }
        }
        throw new Error('Invalid credentials')
    }

    const student = STUDENTS.find((s) => s.id === candidate.student_id) ?? null
    const card = CARDS.find((c) => c.student_id === candidate.student_id) ?? null
    return { user: candidate, student, card }
}

const isUuid = (value?: string | null) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

function mapBookRow(row: any): Book {
    return {
        ...row,
        id: row.id ?? row.isbn ?? row.book_code ?? crypto.randomUUID(),
        book_code: row.book_code ?? row.isbn ?? row.id ?? crypto.randomUUID(),
        title: row.title,
        author: row.author,
        category: row.category,
        copies: Number(row.total_copies ?? row.copies ?? 1),
        available: Number(row.available_copies ?? row.available ?? Number(row.total_copies ?? row.copies ?? 1)),
        isbn: row.isbn ?? row.book_code ?? row.id ?? '',
        total_copies: Number(row.total_copies ?? row.copies ?? 1),
        available_copies: Number(row.available_copies ?? row.available ?? Number(row.total_copies ?? row.copies ?? 1)),
        cover_url: row.cover_url ?? row.coverUrl ?? null,
    } as Book
}

function mapStudentRow(row: any): Student {
    const studentCode = row.student_code ?? row.student_id ?? row.id ?? crypto.randomUUID()
    return {
        ...row,
        id: row.id ?? row.student_code ?? row.student_id ?? crypto.randomUUID(),
        student_code: studentCode,
        name: row.name ?? row.full_name ?? 'Student',
        email: row.email ?? `${String(studentCode).replace(/^STU-/i, '').toLowerCase()}@sjbcnl.local`,
        course: row.course ?? 'Unassigned',
        year_level: row.year_level ?? null,
        status: row.status ?? 'active',
    } as Student
}

function mapLoginRowToStudent(row: any): Student {
    const studentCode = row.student_code ?? row.student_id ?? row.id ?? crypto.randomUUID()
    return {
        id: row.id ?? studentCode,
        student_code: studentCode,
        name: row.full_name ?? 'Student',
        email: `${String(studentCode).replace(/^STU-/i, '').toLowerCase()}@sjbcnl.local`,
        course: row.course ?? 'Unassigned',
        year_level: row.year_level ?? null,
        status: row.status ?? 'active',
    } as Student
}

export async function fetchBooks() {
    try {
        const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false })
        if (!error && data) {
            const mapped = reconcileBookAvailability(data.map(mapBookRow), BORROWING)
            saveMockData({ books: mapped, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
            return mapped
        }
    } catch {
        // fallback to local storage-backed mock data
    }
    return reconcileBookAvailability(BOOKS, BORROWING)
}

export async function fetchStudents() {
    try {
        const { data, error } = await supabase.from('student_login_accounts').select('*').order('created_at', { ascending: false })
        if (!error && data) {
            const mapped = data.map(mapLoginRowToStudent)
            saveMockData({ books: BOOKS, students: mapped, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
            return mapped
        }
    } catch {
        // fallback to local storage-backed mock data
    }
    return STUDENTS
}

export async function fetchLibraryCards() { return CARDS }
export async function fetchSettings() { return { id: 1, library_name: 'Campus Library', borrow_period_days: 14, max_books_per_student: 3, fine_per_day: 5.0, admin_email: 'admin@library.local' } as Settings }

function withDashboardMetadata(record: any) {
    const book = (BOOKS as any[]).find((candidate: any) => {
        const recordBookId = String(record?.book_id ?? '').trim()
        if (!recordBookId) return false
        return String(candidate?.id ?? '').trim() === recordBookId || String(candidate?.book_code ?? '').trim() === recordBookId || String(candidate?.isbn ?? '').trim() === recordBookId
    })

    const student = (STUDENTS as any[]).find((candidate: any) => {
        const recordStudentId = String(record?.student_id ?? '').trim()
        if (!recordStudentId) return false
        return String(candidate?.id ?? '').trim() === recordStudentId || String(candidate?.student_code ?? '').trim() === recordStudentId
    })

    const dueDate = String(record?.due_date ?? record?.dueDate ?? '').trim() || 'N/A'
    const normalizedStatus = String(record?.status ?? '').trim().toLowerCase()
    const status = normalizedStatus || (record?.return_date ? 'returned' : (dueDate !== 'N/A' && new Date(`${dueDate}T00:00:00`) < new Date() ? 'overdue' : 'active'))

    return {
        ...record,
        book_title: book?.title ?? 'Unknown book',
        book_author: book?.author ?? 'Unknown author',
        student_name: student?.name ?? 'Unknown student',
        student_code: student?.student_code ?? '',
        due_date: dueDate,
        status,
    } as BorrowingRecordWithDetails
}

export async function fetchAllBorrowingRecords() {
    return BORROWING.map(withDashboardMetadata)
}

export async function fetchStudentBorrowingRecords(studentId: string) {
    const trimmed = String(studentId ?? '').trim()
    if (!trimmed) return [] as BorrowingRecordWithDetails[]

    const indexed = new Set([
        trimmed,
        trimmed.toUpperCase(),
        trimmed.toLowerCase(),
        trimmed.replace(/^STU-?/i, ''),
        `STU-${trimmed.replace(/^STU-?/i, '')}`,
    ])

    return BORROWING.filter((record: any) => {
        const recordStudentId = String(record?.student_id ?? '').trim()
        const student = STUDENTS.find((candidate: any) => {
            const candidateIds = [
                String(candidate?.id ?? '').trim(),
                String(candidate?.student_code ?? '').trim(),
                String(candidate?.email ?? '').trim(),
            ]
            return candidateIds.some((candidateId) => indexed.has(candidateId))
        })
        return student ? recordStudentId === String(student.id ?? '').trim() : recordStudentId === trimmed || recordStudentId === `STU-${trimmed.replace(/^STU-?/i, '')}`
    }).map(withDashboardMetadata) as BorrowingRecordWithDetails[]
}

export async function fetchActiveBorrowingRecords() {
    return BORROWING.filter((record: any) => !record?.return_date).map(withDashboardMetadata) as BorrowingRecordWithDetails[]
}

export async function fetchReturnedRecords() {
    return BORROWING.filter((record: any) => !!record?.return_date).map(withDashboardMetadata) as BorrowingRecordWithDetails[]
}

export async function upsertBook(book: Partial<Book> & Pick<Book, 'book_code' | 'title' | 'author' | 'category'>) {
    const isbn = String((book as any).isbn ?? book.book_code ?? '').trim() || `978-${Date.now()}`
    const totalCopies = Number((book as any).copies ?? (book as any).total_copies ?? 1)
    const payload = {
        id: isUuid((book as any).id) ? (book as any).id : undefined,
        title: String(book.title).trim(),
        author: String(book.author).trim(),
        isbn,
        category: String(book.category).trim(),
        total_copies: totalCopies,
        available_copies: Number((book as any).available ?? (book as any).available_copies ?? totalCopies),
        cover_url: (book as any).cover_url ?? (book as any).coverUrl ?? null,
    }

    try {
        console.debug('[supabase] upsertBook payload', payload)
        const { data, error } = await supabase
            .from('books')
            .upsert(payload, { onConflict: 'isbn' })
            .select()
            .maybeSingle()

        console.debug('[supabase] upsertBook response', { data, error })
        if (error) {
            console.error('[supabase] upsertBook error', error)
            throw error
        }

        if (data) {
            const saved = mapBookRow(data)
            const existingIndex = BOOKS.findIndex((b) => b.book_code === saved.book_code || b.id === saved.id || b.isbn === saved.isbn)
            if (existingIndex >= 0) BOOKS.splice(existingIndex, 1, saved)
            else BOOKS.push(saved)
            saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
            return saved
        }
    } catch {
        // fallback to local storage
    }

    const existing = BOOKS.find((b) => b.book_code === book.book_code || b.isbn === isbn)
    if (existing) Object.assign(existing, { ...existing, ...book, isbn, id: existing.id, book_code: book.book_code ?? existing.book_code ?? isbn, copies: Number((book as any).copies ?? existing.copies ?? 1), available: Number((book as any).available ?? existing.available ?? Number((book as any).copies ?? existing.copies ?? 1)) })
    else BOOKS.push({ ...(book as any), id: book.book_code ?? isbn, book_code: book.book_code ?? isbn, isbn, copies: Number((book as any).copies ?? 1), available: Number((book as any).available ?? Number((book as any).copies ?? 1)) } as any)
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return BOOKS.find((b) => b.book_code === (book.book_code ?? isbn) || b.isbn === isbn) as Book
}

export async function deleteBook(id: string) {
    try {
        console.debug('[supabase] deleteBook', id)
        const { data, error } = await supabase.from('books').delete().eq('id', id)
        if (error) {
            console.error('[supabase] deleteBook error', error)
            throw error
        }
        const idx = BOOKS.findIndex((b) => b.id === id)
        if (idx >= 0) {
            BOOKS.splice(idx, 1)
            saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
        }
        return data
    } catch (err) {
        console.error('[mockApi] deleteBook supabase failed', err)
        throw err
    }
}
export async function upsertStudent(student: Partial<Student> & Pick<Student, 'student_code' | 'name' | 'email' | 'course'>) {
    const normalizedStudentCode = String(student.student_code ?? student.email ?? '').trim() || `STU-${Date.now()}`
    const suppliedPasswordHash = String((student as any).password_hash ?? '').trim()
    const studentIdKey = String((student as any).student_id ?? normalizedStudentCode).trim() || normalizedStudentCode

    let persistedPasswordHash = suppliedPasswordHash
    try {
        const { data: existingLoginRow, error: existingLoginError } = await supabase
            .from('student_login_accounts')
            .select('password_hash')
            .or(`student_id.eq.${normalizedStudentCode},student_code.eq.${normalizedStudentCode}`)
            .maybeSingle()

        if (!existingLoginError && existingLoginRow && !persistedPasswordHash) {
            persistedPasswordHash = String(existingLoginRow.password_hash ?? '').trim()
        }
    } catch {
        // ignore lookup failure; the row can still be inserted if the hash is supplied elsewhere
    }

    const baseStudentRecord = {
        id: isUuid((student as any).id) ? (student as any).id : crypto.randomUUID(),
        student_code: normalizedStudentCode,
        name: student.name,
        email: student.email,
        course: student.course,
        year_level: (student as any).year_level ?? '1st Year',
        status: (student as any).status ?? 'active',
        avatar_url: (student as any).avatar_url ?? null,
    }

    const loginPayload = {
        id: isUuid((student as any).id) ? (student as any).id : crypto.randomUUID(),
        student_id: studentIdKey,
        student_code: normalizedStudentCode,
        full_name: student.name,
        course: student.course,
        year_level: (student as any).year_level ?? '1st Year',
        status: (student as any).status ?? 'active',
        avatar_url: (student as any).avatar_url ?? null,
        ...(persistedPasswordHash ? { password_hash: persistedPasswordHash } : {}),
    }

    try {
        const { data: loginData, error: loginError } = await supabase
            .from('student_login_accounts')
            .upsert(loginPayload, { onConflict: 'student_id' })
            .select()
            .maybeSingle()

        if (loginError) {
            console.error('[supabase] upsertStudent loginAccounts error', loginError)
            throw loginError
        }

        if (loginData) {
            const saved = mapLoginRowToStudent(loginData)
            const { data: studentRow, error: studentError } = await supabase.from('students').upsert([
                {
                    id: saved.id,
                    student_code: saved.student_code,
                    name: saved.name,
                    email: saved.email,
                    course: saved.course,
                    year_level: saved.year_level,
                    status: saved.status,
                    avatar_url: (student as any).avatar_url ?? loginData.avatar_url ?? null,
                },
            ], { onConflict: 'student_code' }).select().maybeSingle()

            if (studentError) {
                console.error('[supabase] upsertStudent students error', studentError)
                throw studentError
            }

            const finalSaved = {
                ...saved,
                ...(studentRow ?? {}),
                avatar_url: (studentRow as any)?.avatar_url ?? (student as any).avatar_url ?? loginData.avatar_url ?? null,
            }

            const existingIndex = STUDENTS.findIndex((s) => s.student_code === saved.student_code || s.email === saved.email)
            if (existingIndex >= 0) STUDENTS.splice(existingIndex, 1, finalSaved)
            else STUDENTS.push(finalSaved)
            saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
            return finalSaved
        }

        const { data: existingStudent, error: studentError } = await supabase
            .from('students')
            .upsert([
                {
                    id: baseStudentRecord.id,
                    student_code: baseStudentRecord.student_code,
                    name: baseStudentRecord.name,
                    email: baseStudentRecord.email,
                    course: baseStudentRecord.course,
                    year_level: baseStudentRecord.year_level,
                    status: baseStudentRecord.status,
                    avatar_url: baseStudentRecord.avatar_url,
                },
            ], { onConflict: 'student_code' })
            .select()
            .maybeSingle()

        if (studentError) {
            console.error('[mockApi] student profile upsert failed', studentError)
            throw studentError
        }

        if (existingStudent) {
            const saved = {
                ...baseStudentRecord,
                id: existingStudent.id ?? baseStudentRecord.id,
                student_code: existingStudent.student_code ?? baseStudentRecord.student_code,
                name: existingStudent.name ?? baseStudentRecord.name,
                email: existingStudent.email ?? baseStudentRecord.email,
                course: existingStudent.course ?? baseStudentRecord.course,
                year_level: existingStudent.year_level ?? baseStudentRecord.year_level,
                status: existingStudent.status ?? baseStudentRecord.status,
                avatar_url: existingStudent.avatar_url ?? null,
            } as Student

            const existingIndex = STUDENTS.findIndex((s) => s.student_code === saved.student_code || s.email === saved.email)
            if (existingIndex >= 0) STUDENTS.splice(existingIndex, 1, saved)
            else STUDENTS.push(saved)
            saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
            return saved
        }
    } catch (err) {
        console.error('[mockApi] supabase upsertStudent failed, falling back to local', err)
    }

    const existing = STUDENTS.find((s) => s.student_code === normalizedStudentCode || s.email === student.email)
    if (existing) Object.assign(existing, { ...baseStudentRecord, ...(student as any), student_code: normalizedStudentCode, email: student.email })
    else STUDENTS.push({ ...baseStudentRecord, ...(student as any), student_code: normalizedStudentCode, email: student.email } as Student)
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return STUDENTS.find((s) => s.student_code === normalizedStudentCode) as Student
}

export async function upsertAppUser(user: { email: string; password?: string; role?: UserRole; student_id?: string | null }) {
    const existing = APP_USERS.find((u) => u.email === user.email)
    const payload = { ...user, role: user.role ?? 'student' }
    if (existing) Object.assign(existing, payload)
    else APP_USERS.push({ id: crypto.randomUUID(), ...payload })
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return APP_USERS.find((u) => u.email === user.email)
}

export async function deleteStudent(id: string) {
    try {
        console.debug('[supabase] deleteStudent', id)
        const { data, error } = await supabase.from('student_login_accounts').delete().eq('id', id)
        if (error) {
            console.error('[supabase] deleteStudent error', error)
            throw error
        }
        const i = STUDENTS.findIndex((s) => s.id === id)
        if (i >= 0) {
            STUDENTS.splice(i, 1)
            saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
        }
        return data
    } catch (err) {
        console.error('[mockApi] deleteStudent supabase failed', err)
        throw err
    }
}

export async function issueLibraryCard(studentId: string, cardNo: string, expiryDate: string) {
    const card = { id: crypto.randomUUID(), card_no: cardNo, student_id: studentId, issue_date: new Date().toISOString().slice(0, 10), expiry_date: expiryDate, status: 'active', created_at: new Date().toISOString() }
    CARDS.push(card as any)
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return card as LibraryCard
}

export async function updateLibraryCard(id: string, updates: Partial<LibraryCard>) { const c = CARDS.find(cc => cc.id === id); if (c) Object.assign(c, updates); saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS }); return CARDS.find(cc => cc.id === id) as LibraryCard }

export async function deleteLibraryCard(id: string) { const i = CARDS.findIndex(c => c.id === id); if (i >= 0) { CARDS.splice(i, 1); saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS }) } }
function normalizeBookReference(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBookMatch(target: string, books: any[] = BOOKS) {
    const trimmedTarget = String(target ?? '').trim()
    if (!trimmedTarget) return null

    const targetNormalized = normalizeBookReference(trimmedTarget)
    return books.find((book) => {
        const candidates = [book?.id, book?.book_code, book?.isbn, book?.code, book?.title].filter((candidate) => candidate != null && String(candidate).trim() !== '')
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

export async function borrowBook(studentId: string, bookId: string, borrowPeriodDays = 14) {
    const student = STUDENTS.find((s) => s.id === studentId || s.student_code === studentId)
    const book = findBookMatch(bookId, BOOKS)
    if (!student) throw new Error('Student not found')
    if (!book) throw new Error(`Book not found: ${bookId}`)
    if ((book.available ?? 0) <= 0) throw new Error('Book is not available')

    const maxBooks = SETTINGS?.max_books_per_student ?? 3
    const active = BORROWING.filter((r) => r.student_id === student.id && !r.return_date).length
    if (active >= maxBooks) throw new Error(`Maximum of ${maxBooks} books can be borrowed at once`)

    const borrowDate = new Date()
    const dueDate = addDays(borrowDate, borrowPeriodDays)
    const record = {
        id: crypto.randomUUID(),
        txn_code: `TXN-${borrowDate.getFullYear()}-${String(Date.now()).slice(-6)}`,
        student_id: student.id,
        book_id: book.id,
        borrow_date: borrowDate.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
        return_date: null,
        status: 'active',
        notified: false,
        condition: 'Good',
        created_at: new Date().toISOString(),
    }

    BORROWING.unshift(record)
    const nextAvailable = Math.max((book.available ?? 0) - 1, 0)
    book.available = nextAvailable
    if ('available_copies' in book) book.available_copies = nextAvailable
    if ('total_copies' in book && typeof book.total_copies === 'number') {
        const total = Number(book.total_copies)
        book.available = Math.min(nextAvailable, total)
        if ('available_copies' in book) book.available_copies = Math.min(nextAvailable, total)
    }
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return record
}

export async function processReturn(cardOrStudentId: string, bookQuery: string) {
    const normalized = cardOrStudentId.trim()
    const cardMatch = CARDS.find((c) => c.card_no === normalized)
    const studentId = cardMatch?.student_id ?? STUDENTS.find((s) => s.student_code === normalized || s.id === normalized)?.id
    if (!studentId) throw new Error('Student or library card not found')

    const book = BOOKS.find((b) => b.book_code.toLowerCase() === bookQuery.trim().toLowerCase() || b.title.toLowerCase().includes(bookQuery.trim().toLowerCase()))
    if (!book) throw new Error('Book not found')

    const loan = BORROWING.find((r) => r.student_id === studentId && r.book_id === book.id && !r.return_date)
    if (!loan) throw new Error('No active loan found for this book')
    if (String(loan.status ?? '').toLowerCase() !== 'return_requested') {
        throw new Error('This return must be requested by the student and approved by the admin before it is finalized.')
    }

    const returnDate = new Date().toISOString().slice(0, 10)
    loan.return_date = returnDate
    loan.status = 'returned'
    loan.condition = 'Good'
    const nextAvailable = Math.min((book.available ?? 0) + 1, Number(book.total_copies ?? book.copies ?? (book.available ?? 0) + 1))
    book.available = nextAvailable
    if ('available_copies' in book) book.available_copies = nextAvailable
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return loan
}

export async function markReminderSent(recordId: string) {
    const record = BORROWING.find((r) => r.id === recordId || r.txn_code === recordId)
    if (!record) throw new Error('Loan record not found')
    record.notified = true
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return record
}

export async function updateStudentProfile(studentId: string, updates: Partial<Student>) { return upsertStudent({ ...updates, student_code: (updates as any).student_code ?? 'MOCK-' + studentId } as any) }
export async function saveSettings(updates: Partial<Settings>) {
    SETTINGS = { ...SETTINGS, ...updates, id: 1 }
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return SETTINGS as Settings
}
export async function refreshLoanStatuses() {
    BORROWING = BORROWING.map((record) => ({
        ...record,
        status: computeLoanStatus(record.due_date, record.return_date),
    }))
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return
}

async function syncLiveBorrowingStateFromSupabase() {
    try {
        const [{ data: borrowingRows, error: borrowingErr }, { data: bookRows, error: bookErr }, { data: loginRows, error: loginErr }] = await Promise.all([
            supabase.from('borrowing_records').select('*').order('created_at', { ascending: false }).limit(50),
            supabase.from('books').select('*').limit(10),
            supabase.from('student_login_accounts').select('*').limit(200),
        ])

        if (borrowingErr || bookErr || loginErr) {
            throw new Error(borrowingErr?.message ?? bookErr?.message ?? loginErr?.message ?? 'Unable to load live borrowing state.')
        }

        if (!Array.isArray(borrowingRows) || !borrowingRows.length) {
            return
        }

        BORROWING = borrowingRows.map((record: any) => ({
            ...record,
            id: record.id ?? crypto.randomUUID(),
            status: String(record.status ?? '').trim() || computeLoanStatus(record.due_date, record.return_date),
        }))

        if (Array.isArray(bookRows) && bookRows.length > 0) {
            BOOKS = reconcileBookAvailability(bookRows.map(mapBookRow), BORROWING)
        }

        if (Array.isArray(loginRows) && loginRows.length > 0) {
            STUDENTS = loginRows.map((login: any) => ({
                id: login?.id ?? login?.student_id ?? login?.student_code ?? `student-${Date.now()}`,
                student_code: login?.student_code ?? login?.student_id ?? '',
                name: login?.full_name ?? login?.name ?? 'Student',
                email: login?.email ?? '',
                course: login?.course ?? 'Unassigned',
                year_level: login?.year_level ?? '1st Year',
                status: login?.status ?? 'active',
                avatar_url: login?.avatar_url ?? login?.profile_image ?? null,
            }))
        }

        saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    } catch (error) {
        console.debug('[mockApi] live borrowing sync skipped', error)
    }
}

export async function loadDashboardData() {
    await syncLiveBorrowingStateFromSupabase()
    await refreshLoanStatuses()

    const normalizeDate = (value: string | null | undefined) => {
        if (!value) return null
        const parsed = new Date(String(value))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const currentDate = new Date()
    const monthlyBorrowings = Array.from({ length: 12 }, (_, offset) => {
        const monthIndex = (currentDate.getMonth() - (11 - offset) + 12) % 12
        const year = currentDate.getFullYear() - (currentDate.getMonth() < 11 - offset ? 1 : 0)
        const monthStart = new Date(year, monthIndex, 1)
        const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)

        return BORROWING.filter((record: any) => {
            const borrowDate = normalizeDate(record?.borrow_date ?? record?.created_at)
            return borrowDate && borrowDate >= monthStart && borrowDate <= monthEnd
        }).length
    })

    const categoryCounts = Array.from(new Map(
        BOOKS.map((book: any) => [String(book?.category ?? 'Uncategorized'), 0])
    ).keys()).map((name) => ({
        name,
        count: BOOKS.filter((book: any) => String(book?.category ?? 'Uncategorized') === name).length,
    }))

    const totalBooks = BOOKS.reduce((sum, book: any) => sum + Number(book?.total_copies ?? book?.copies ?? 1), 0)
    const availableBooks = BOOKS.reduce((sum, book: any) => sum + Number(book?.available_copies ?? book?.available ?? 0), 0)
    const overdueRecords = BORROWING.filter((record: any) => {
        if (record?.return_date) return false
        const dueDate = normalizeDate(record?.due_date ?? record?.dueDate)
        return dueDate ? dueDate < new Date() : String(record?.status ?? '').toLowerCase() === 'overdue'
    })
    const thisMonthTx = BORROWING.filter((record: any) => {
        const borrowDate = normalizeDate(record?.borrow_date ?? record?.created_at)
        if (!borrowDate) return false
        return borrowDate.getMonth() === currentDate.getMonth() && borrowDate.getFullYear() === currentDate.getFullYear()
    }).length

    const records = BORROWING.slice(0, 10).map(withDashboardMetadata)

    return {
        books: BOOKS,
        students: STUDENTS,
        records,
        settings: await fetchSettings(),
        stats: {
            totalBooks,
            availableBooks,
            borrowedBooks: Math.max(totalBooks - availableBooks, 0),
            overdueBooks: overdueRecords.length,
            totalStudents: STUDENTS.length,
            thisMonthTx,
            monthlyBorrowings,
            categoryCounts: categoryCounts.length ? categoryCounts : [],
        },
    }
}
