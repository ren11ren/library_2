import mockData from './mockData.json'
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

const BOOKS = (mockData as any).books as Book[]
const STUDENTS = (mockData as any).students as Student[]
const APP_USERS = (mockData as any).app_users as any[]
const CARDS = (mockData as any).library_cards as LibraryCard[]

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
  return BOOKS.find((b) => b.book_code === book.book_code) as Book
}

export async function deleteBook(id: string) { const idx = BOOKS.findIndex((b) => b.id === id); if (idx>=0) BOOKS.splice(idx,1) }
export async function upsertStudent(student: Partial<Student> & Pick<Student, 'student_code' | 'name' | 'email' | 'course'>) { const existing = STUDENTS.find((s) => s.student_code === student.student_code); if (existing) Object.assign(existing, student); else STUDENTS.push(student as Student); return STUDENTS.find((s) => s.student_code === student.student_code) as Student }
export async function upsertAppUser(user: { email: string; password?: string; role?: UserRole; student_id?: string | null }) { const existing = APP_USERS.find((u) => u.email === user.email); if (existing) Object.assign(existing, user); else APP_USERS.push({ id: crypto.randomUUID(), ...user }); return APP_USERS.find((u)=>u.email===user.email) }
export async function deleteStudent(id: string) { const i = STUDENTS.findIndex(s=>s.id===id); if (i>=0) STUDENTS.splice(i,1) }
export async function issueLibraryCard(studentId: string, cardNo: string, expiryDate: string) { const card = { id: crypto.randomUUID(), card_no: cardNo, student_id: studentId, issue_date: new Date().toISOString().slice(0,10), expiry_date: expiryDate, status: 'active', created_at: new Date().toISOString() }; CARDS.push(card as any); return card as LibraryCard }
export async function updateLibraryCard(id: string, updates: Partial<LibraryCard>) { const c = CARDS.find(cc=>cc.id===id); if (c) Object.assign(c, updates); return CARDS.find(cc=>cc.id===id) as LibraryCard }
export async function deleteLibraryCard(id: string) { const i = CARDS.findIndex(c=>c.id===id); if (i>=0) CARDS.splice(i,1) }
export async function borrowBook() { throw new Error('Not implemented in mock') }
export async function processReturn() { throw new Error('Not implemented in mock') }
export async function markReminderSent() { throw new Error('Not implemented in mock') }
export async function updateStudentProfile(studentId: string, updates: Partial<Student>) { return upsertStudent({ ...updates, student_code: (updates as any).student_code ?? 'MOCK-' + studentId } as any) }
export async function saveSettings(updates: Partial<Settings>) { return { ...updates, id: 1 } as Settings }
export async function refreshLoanStatuses() { return }
export async function loadDashboardData() { return { books: BOOKS, students: STUDENTS, records: [], settings: await fetchSettings(), stats: { totalBooks: BOOKS.reduce((s,b)=>s+(b.copies||0),0), availableBooks: BOOKS.reduce((s,b)=>s+(b.available||0),0), borrowedBooks: BOOKS.reduce((s,b)=>s+((b.copies||0)-(b.available||0)),0), overdueBooks: 0, totalStudents: STUDENTS.length } } }
