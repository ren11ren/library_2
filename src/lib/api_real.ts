import { supabase } from "./supabase"
import type {
  AuthSession,
  Book,
  BorrowingRecordWithDetails,
  LibraryCard,
  LoanStatus,
  Settings,
  Student,
  UserRole,
} from "./database.types"

const MS_PER_DAY = 86_400_000

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function computeLoanStatus(dueDate: string, returnDate: string | null): LoanStatus {
  if (returnDate) return "returned"
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY)
  if (diffDays < 0) return "overdue"
  if (diffDays <= 3) return "due-soon"
  return "active"
}

export function daysOverdue(dueDate: string) {
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((today.getTime() - due.getTime()) / MS_PER_DAY))
}

async function attachDetails(records: Array<{
  id: string
  txn_code: string
  student_id: string
  book_id: string
  borrow_date: string
  due_date: string
  return_date: string | null
  status: LoanStatus
  notified: boolean
  condition: string | null
  created_at: string
}>): Promise<BorrowingRecordWithDetails[]> {
  if (!records.length) return []

  const studentIds = [...new Set(records.map((r) => r.student_id))]
  const bookIds = [...new Set(records.map((r) => r.book_id))]

  const [{ data: students }, { data: books }, { data: cards }] = await Promise.all([
    supabase.from("students").select("*").in("id", studentIds),
    supabase.from("books").select("*").in("id", bookIds),
    supabase.from("library_cards").select("*").in("student_id", studentIds),
  ])

  const studentMap = new Map((students ?? []).map((s) => [s.id, s as Student]))
  const bookMap = new Map((books ?? []).map((b) => [b.id, b as Book]))
  const cardMap = new Map((cards ?? []).map((c) => [c.student_id, c as LibraryCard]))

  return records.map((record) => ({
    ...record,
    status: computeLoanStatus(record.due_date, record.return_date),
    student: studentMap.get(record.student_id)!,
    book: bookMap.get(record.book_id)!,
    card_no: cardMap.get(record.student_id)?.card_no ?? "N/A",
  }))
}

export async function login(emailOrId: string, password: string, role: UserRole): Promise<AuthSession> {
  const identifier = emailOrId.trim()

  const { data: candidates, error: candErr } = await supabase.from("app_users").select("*").eq("password", password).eq("role", role)
  if (candErr) throw candErr
  if (!candidates || candidates.length === 0) throw new Error("Invalid credentials")

  const normalize = (s: any) => (s || "").toString().trim().toLowerCase()
  const idNorm = normalize(identifier)

  let user = (candidates as any[]).find((c) => normalize(c.email) === idNorm)

  if (!user) {
    const { data: studentByCode, error: studentErr } = await supabase.from("students").select("id, student_code").or(`student_code.eq.${identifier},student_code.eq.STU-${identifier}`).maybeSingle()
    if (studentErr) throw studentErr
    if (studentByCode?.id) {
      user = (candidates as any[]).find((c) => c.student_id === studentByCode.id)
    }
  }

  if (!user) {
    user = (candidates as any[]).find((c) => normalize(c.email).includes(idNorm) || normalize(c.email).replace(/[^a-z0-9]/g, '').includes(idNorm.replace(/[^a-z0-9]/g, '')))
  }

  if (!user) throw new Error("Invalid credentials")

  let student: Student | null = null
  let card: LibraryCard | null = null

  if (user.student_id) {
    const [{ data: studentRow }, { data: cardRow }] = await Promise.all([
      supabase.from("students").select("*").eq("id", user.student_id).maybeSingle(),
      supabase.from("library_cards").select("*").eq("student_id", user.student_id).maybeSingle(),
    ])
    student = studentRow as Student | null
    card = cardRow as LibraryCard | null
  }

  return { user, student, card }
}

export async function fetchBooks() {
  const { data, error } = await supabase.from("books").select("*").order("title")
  if (error) throw error
  return data as Book[]
}

export async function fetchStudents() {
  const { data, error } = await supabase.from("students").select("*").order("name")
  if (error) throw error
  return data as Student[]
}

export async function fetchLibraryCards() {
  const { data, error } = await supabase.from("library_cards").select("*").order("card_no")
  if (error) throw error
  return data as LibraryCard[]
}

export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle()
  if (error) throw error
  return data as Settings
}

export async function fetchAllBorrowingRecords() {
  const { data, error } = await supabase.from("borrowing_records").select("*").order("borrow_date", { ascending: false })
  if (error) throw error
  return attachDetails(data ?? [])
}

export async function fetchStudentBorrowingRecords(studentId: string) {
  const { data, error } = await supabase
    .from("borrowing_records")
    .select("*")
    .eq("student_id", studentId)
    .order("borrow_date", { ascending: false })
  if (error) throw error
  return attachDetails(data ?? [])
}

export async function fetchActiveBorrowingRecords() {
  const { data, error } = await supabase
    .from("borrowing_records")
    .select("*")
    .is("return_date", null)
    .order("borrow_date", { ascending: false })
  if (error) throw error
  return attachDetails(data ?? [])
}

export async function fetchReturnedRecords() {
  const { data, error } = await supabase
    .from("borrowing_records")
    .select("*")
    .not("return_date", "is", null)
    .order("return_date", { ascending: false })
  if (error) throw error
  return attachDetails(data ?? [])
}

export async function upsertBook(book: Partial<Book> & Pick<Book, "book_code" | "title" | "author" | "category">) {
  const payload = {
    book_code: book.book_code,
    title: book.title,
    author: book.author,
    category: book.category,
    copies: book.copies ?? 1,
    available: book.available ?? book.copies ?? 1,
    ...(book.id ? { id: book.id } : {}),
  }
  const { data, error } = await supabase.from("books").upsert(payload).select("*").single()
  if (error) throw error
  return data as Book
}

export async function deleteBook(id: string) {
  const { error } = await supabase.from("books").delete().eq("id", id)
  if (error) throw error
}

export async function upsertStudent(
  student: Partial<Student> & Pick<Student, "student_code" | "name" | "email" | "course">,
) {
  const payload = {
    student_code: student.student_code,
    name: student.name,
    email: student.email,
    course: student.course,
    year_level: student.year_level ?? "1st Year",
    status: student.status ?? "active",
    ...(student.id ? { id: student.id } : {}),
  }
  const { data, error } = await supabase.from("students").upsert(payload).select("*").single()
  if (error) throw error
  return data as Student
}

export async function upsertAppUser(user: { email: string; password?: string; role?: UserRole; student_id?: string | null }) {
  const payload = {
    email: user.email,
    password: user.password ?? 'password123',
    role: user.role ?? 'student',
    student_id: user.student_id ?? null,
  }
  const { data, error } = await supabase.from('app_users').upsert(payload).select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id)
  if (error) throw error
}

export async function issueLibraryCard(studentId: string, cardNo: string, expiryDate: string) {
  const { data, error } = await supabase
    .from("library_cards")
    .upsert({
      student_id: studentId,
      card_no: cardNo,
      expiry_date: expiryDate,
      status: "active",
    })
    .select("*")
    .single()
  if (error) throw error
  return data as LibraryCard
}

export async function updateLibraryCard(id: string, updates: Partial<LibraryCard>) {
  const { data, error } = await supabase.from("library_cards").update(updates).eq("id", id).select("*").single()
  if (error) throw error
  return data as LibraryCard
}

export async function deleteLibraryCard(id: string) {
  const { error } = await supabase.from("library_cards").delete().eq("id", id)
  if (error) throw error
}

export async function borrowBook(studentId: string, bookId: string, borrowPeriodDays = 14) {
  const [{ data: book, error: bookError }, { data: activeLoans, error: loanError }] = await Promise.all([
    supabase.from("books").select("*").eq("id", bookId).single(),
    supabase.from("borrowing_records").select("id").eq("student_id", studentId).is("return_date", null),
  ])
  if (bookError) throw bookError
  if (loanError) throw loanError
  if (!book || book.available <= 0) throw new Error("Book is not available")

  const settings = await fetchSettings()
  if ((activeLoans?.length ?? 0) >= settings.max_books_per_student) {
    throw new Error(`Maximum of ${settings.max_books_per_student} books can be borrowed at once`)
  }

  const borrowDate = new Date()
  const dueDate = addDays(borrowDate, borrowPeriodDays)
  const txnCode = `TXN-${borrowDate.getFullYear()}-${String(Date.now()).slice(-6)}`

  const { data: record, error: recordError } = await supabase
    .from("borrowing_records")
    .insert({
      txn_code: txnCode,
      student_id: studentId,
      book_id: bookId,
      borrow_date: borrowDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      status: "active",
    })
    .select("*")
    .single()
  if (recordError) throw recordError

  const { error: updateError } = await supabase
    .from("books")
    .update({ available: book.available - 1 })
    .eq("id", bookId)
  if (updateError) throw updateError

  return record
}

export async function processReturn(cardOrStudentId: string, bookQuery: string) {
  const normalized = cardOrStudentId.trim()
  const [{ data: card }, { data: studentByCode }] = await Promise.all([
    supabase.from("library_cards").select("*, students(*)").eq("card_no", normalized).maybeSingle(),
    supabase.from("students").select("*").eq("student_code", normalized).maybeSingle(),
  ])

  const studentId = card?.student_id ?? studentByCode?.id
  if (!studentId) throw new Error("Student or library card not found")

  const { data: books, error: booksError } = await supabase.from("books").select("*")
  if (booksError) throw booksError

  const book = (books ?? []).find(
    (b) =>
      b.book_code.toLowerCase() === bookQuery.trim().toLowerCase() ||
      b.title.toLowerCase().includes(bookQuery.trim().toLowerCase()),
  )
  if (!book) throw new Error("Book not found")

  const { data: loan, error: loanError } = await supabase
    .from("borrowing_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("book_id", book.id)
    .is("return_date", null)
    .maybeSingle()
  if (loanError) throw loanError
  if (!loan) throw new Error("No active loan found for this book")

  const returnDate = new Date().toISOString().slice(0, 10)
  const { error: updateLoanError } = await supabase
    .from("borrowing_records")
    .update({ return_date: returnDate, status: "returned", condition: "Good" })
    .eq("id", loan.id)
  if (updateLoanError) throw updateLoanError

  const { error: updateBookError } = await supabase
    .from("books")
    .update({ available: book.available + 1 })
    .eq("id", book.id)
  if (updateBookError) throw updateBookError
}

export async function markReminderSent(recordId: string) {
  const { error } = await supabase.from("borrowing_records").update({ notified: true }).eq("id", recordId)
  if (error) throw error
}

export async function updateStudentProfile(studentId: string, updates: Partial<Student>) {
  const { data, error } = await supabase.from("students").update(updates).eq("id", studentId).select("*").single()
  if (error) throw error
  return data as Student
}

export async function saveSettings(updates: Partial<Settings>) {
  const { data, error } = await supabase.from("settings").update(updates).eq("id", 1).select("*").single()
  if (error) throw error
  return data as Settings
}

export async function refreshLoanStatuses() {
  const { data, error } = await supabase.from("borrowing_records").select("*").is("return_date", null)
  if (error) throw error

  await Promise.all(
    (data ?? []).map((record) =>
      supabase
        .from("borrowing_records")
        .update({ status: computeLoanStatus(record.due_date, record.return_date) })
        .eq("id", record.id),
    ),
  )
}

export async function loadDashboardData() {
  await refreshLoanStatuses()
  const [books, students, records, settings] = await Promise.all([
    fetchBooks(),
    fetchStudents(),
    fetchAllBorrowingRecords(),
    fetchSettings(),
  ])

  const activeRecords = records.filter((r) => !r.return_date)
  const overdueRecords = activeRecords.filter((r) => r.status === "overdue")

  return {
    books,
    students,
    records,
    settings,
    stats: {
      totalBooks: books.reduce((sum, b) => sum + b.copies, 0),
      availableBooks: books.reduce((sum, b) => sum + b.available, 0),
      borrowedBooks: books.reduce((sum, b) => sum + (b.copies - b.available), 0),
      overdueBooks: overdueRecords.length,
      totalStudents: students.length,
    },
  }
}
