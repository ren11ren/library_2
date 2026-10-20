export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type LoanStatus = "active" | "due-soon" | "overdue" | "returned"
export type UserRole = "student" | "admin"
export type AccountStatus = "active" | "suspended"

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string
          email: string
          password: string
          role: UserRole
          student_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          password: string
          role: UserRole
          student_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          password?: string
          role?: UserRole
          student_id?: string | null
          created_at?: string
        }
      }
      students: {
        Row: {
          id: string
          student_code: string
          name: string
          email: string
          course: string
          year_level: string
          status: AccountStatus
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_code: string
          name: string
          email: string
          course: string
          year_level?: string
          status?: AccountStatus
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_code?: string
          name?: string
          email?: string
          course?: string
          year_level?: string
          status?: AccountStatus
          avatar_url?: string | null
          created_at?: string
        }
      }
      books: {
        Row: {
          id: string
          book_code: string
          isbn?: string
          publisher?: string
          title: string
          author: string
          category: string
          copies: number
          available: number
          cover_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          book_code: string
          isbn?: string
          publisher?: string
          title: string
          author: string
          category: string
          copies?: number
          available?: number
          cover_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          book_code?: string
          isbn?: string
          publisher?: string
          title?: string
          author?: string
          category?: string
          copies?: number
          available?: number
          cover_url?: string | null
          created_at?: string
        }
      }
      library_cards: {
        Row: {
          id: string
          card_no: string
          student_id: string
          issue_date: string
          expiry_date: string
          status: AccountStatus
          created_at: string
        }
        Insert: {
          id?: string
          card_no: string
          student_id: string
          issue_date?: string
          expiry_date: string
          status?: AccountStatus
          created_at?: string
        }
        Update: {
          id?: string
          card_no?: string
          student_id?: string
          issue_date?: string
          expiry_date?: string
          status?: AccountStatus
          created_at?: string
        }
      }
      borrowing_records: {
        Row: {
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
        }
        Insert: {
          id?: string
          txn_code: string
          student_id: string
          book_id: string
          borrow_date?: string
          due_date: string
          return_date?: string | null
          status?: LoanStatus
          notified?: boolean
          condition?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          txn_code?: string
          student_id?: string
          book_id?: string
          borrow_date?: string
          due_date?: string
          return_date?: string | null
          status?: LoanStatus
          notified?: boolean
          condition?: string | null
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: number
          library_name: string
          borrow_period_days: number
          max_books_per_student: number
          fine_per_day: number
          admin_email: string
        }
        Insert: {
          id?: number
          library_name: string
          borrow_period_days?: number
          max_books_per_student?: number
          fine_per_day?: number
          admin_email: string
        }
        Update: {
          id?: number
          library_name?: string
          borrow_period_days?: number
          max_books_per_student?: number
          fine_per_day?: number
          admin_email?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type AppUser = Database["public"]["Tables"]["app_users"]["Row"]
export type Student = Database["public"]["Tables"]["students"]["Row"]
export type Book = Database["public"]["Tables"]["books"]["Row"]
export type LibraryCard = Database["public"]["Tables"]["library_cards"]["Row"]
export type BorrowingRecord = Database["public"]["Tables"]["borrowing_records"]["Row"]
export type Settings = Database["public"]["Tables"]["settings"]["Row"]

export type BorrowingRecordWithDetails = BorrowingRecord & {
  student: Student
  book: Book
  card_no: string
}

export type AuthSession = {
  user: AppUser
  student: Student | null
  card: LibraryCard | null
}
