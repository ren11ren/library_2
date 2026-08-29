// Note: mock data has been migrated to the Supabase schema.sql.
// This module no longer bundles the large mock JSON; it falls back to empty data.
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

// Load mock data from localStorage if available, otherwise use bundled defaults
const STORAGE_KEY = 'lms_mock_data_v1'
function loadMockData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) return JSON.parse(raw)
    } catch (e) {
        // ignore
    }
    // Return empty default shapes when no persisted local data exists.
    return {
        books: [],
        students: [],
        app_users: [],
        library_cards: [],
        borrowing_records: [],
        settings: { id: 1, library_name: 'Greenfield College Library', borrow_period_days: 14, max_books_per_student: 3, fine_per_day: 5.0, admin_email: 'librarian@college.edu' }
    }
}

function saveMockData(data: any) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
        // ignore
    }
}

const persisted = loadMockData()
const BOOKS = (persisted as any).books as Book[]
const STUDENTS = (persisted as any).students as Student[]
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

export async function fetchBooks() { return BOOKS }
export async function fetchStudents() { return STUDENTS }
export async function fetchLibraryCards() { return CARDS }
export async function fetchSettings() { return { id: 1, library_name: 'Greenfield College Library', borrow_period_days: 14, max_books_per_student: 3, fine_per_day: 5.0, admin_email: 'librarian@college.edu' } as Settings }
export async function fetchAllBorrowingRecords() { return [] as BorrowingRecordWithDetails[] }
export async function fetchStudentBorrowingRecords(_studentId: string) { return [] as BorrowingRecordWithDetails[] }
export async function fetchActiveBorrowingRecords() { return [] as BorrowingRecordWithDetails[] }
export async function fetchReturnedRecords() { return [] as BorrowingRecordWithDetails[] }

export async function upsertBook(book: Partial<Book> & Pick<Book, 'book_code' | 'title' | 'author' | 'category'>) {
    const existing = BOOKS.find((b) => b.book_code === book.book_code)
    if (existing) Object.assign(existing, book)
    else BOOKS.push({ ...(book as any), id: book.book_code })
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return BOOKS.find((b) => b.book_code === book.book_code) as Book
}

export async function deleteBook(id: string) { const idx = BOOKS.findIndex((b) => b.id === id); if (idx >= 0) BOOKS.splice(idx, 1) }
export async function upsertStudent(student: Partial<Student> & Pick<Student, 'student_code' | 'name' | 'email' | 'course'>) {
    const existing = STUDENTS.find((s) => s.student_code === student.student_code)
    if (existing) Object.assign(existing, student)
    else STUDENTS.push(student as Student)
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return STUDENTS.find((s) => s.student_code === student.student_code) as Student
}

export async function upsertAppUser(user: { email: string; password?: string; role?: UserRole; student_id?: string | null }) {
    const existing = APP_USERS.find((u) => u.email === user.email)
    const payload = { ...user, password: user.password ?? 'user123', role: user.role ?? 'student' }
    if (existing) Object.assign(existing, payload)
    else APP_USERS.push({ id: crypto.randomUUID(), ...payload })
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return APP_USERS.find((u) => u.email === user.email)
}

export async function deleteStudent(id: string) { const i = STUDENTS.findIndex(s => s.id === id); if (i >= 0) { STUDENTS.splice(i, 1); saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS }) } }

export async function issueLibraryCard(studentId: string, cardNo: string, expiryDate: string) {
    const card = { id: crypto.randomUUID(), card_no: cardNo, student_id: studentId, issue_date: new Date().toISOString().slice(0, 10), expiry_date: expiryDate, status: 'active', created_at: new Date().toISOString() }
    CARDS.push(card as any)
    saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS })
    return card as LibraryCard
}

export async function updateLibraryCard(id: string, updates: Partial<LibraryCard>) { const c = CARDS.find(cc => cc.id === id); if (c) Object.assign(c, updates); saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS }); return CARDS.find(cc => cc.id === id) as LibraryCard }

export async function deleteLibraryCard(id: string) { const i = CARDS.findIndex(c => c.id === id); if (i >= 0) { CARDS.splice(i, 1); saveMockData({ books: BOOKS, students: STUDENTS, app_users: APP_USERS, library_cards: CARDS, borrowing_records: BORROWING, settings: SETTINGS }) } }
export async function borrowBook(studentId: string, bookId: string, borrowPeriodDays = 14) {
    const student = STUDENTS.find((s) => s.id === studentId || s.student_code === studentId)
    const book = BOOKS.find((b) => b.id === bookId || b.book_code === bookId)
    if (!student) throw new Error('Student not found')
    if (!book) throw new Error('Book not found')
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
    book.available = Math.max((book.available ?? 0) - 1, 0)
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

    const returnDate = new Date().toISOString().slice(0, 10)
    loan.return_date = returnDate
    loan.status = 'returned'
    loan.condition = 'Good'
    book.available = (book.available ?? 0) + 1
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
export async function loadDashboardData() {
    await refreshLoanStatuses()
    const overdueRecords = BORROWING.filter((r) => !r.return_date && r.status === 'overdue')
    return { books: BOOKS, students: STUDENTS, records: BORROWING, settings: await fetchSettings(), stats: { totalBooks: BOOKS.reduce((s, b) => s + (b.copies || 0), 0), availableBooks: BOOKS.reduce((s, b) => s + (b.available || 0), 0), borrowedBooks: BOOKS.reduce((s, b) => s + ((b.copies || 0) - (b.available || 0)), 0), overdueBooks: overdueRecords.length, totalStudents: STUDENTS.length } }
}
