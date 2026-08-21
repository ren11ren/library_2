export type Role = "student" | "admin"
export type BorrowStatus = "active" | "due-soon" | "overdue" | "returned"
export type AccountStatus = "active" | "suspended"

export interface Profile {
  id: string
  email: string
  role: Role
  student_number: string | null
  name: string
  course: string | null
  year_level: string | null
  status: AccountStatus
}

export interface Book {
  id: string
  book_code: string
  title: string
  author: string
  category: string
  copies: number
  available: number
}

export interface LibraryCard {
  id: string
  card_number: string
  profile_id: string
  issue_date: string
  expiry_date: string
  status: AccountStatus
  profile?: Profile
}

export interface BorrowingRecord {
  id: string
  txn_id: string
  profile_id: string
  book_id: string
  borrow_date: string
  due_date: string
  return_date: string | null
  status: BorrowStatus
  notified: boolean
  profile?: Profile
  book?: Book
}

export interface LibrarySettings {
  id: number
  library_name: string
  borrow_period_days: number
  max_books_per_student: number
  fine_per_day: number
  admin_email: string
}

export interface AuthUser {
  profile: Profile
  role: Role
  cardNumber?: string
}
