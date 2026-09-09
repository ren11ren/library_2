import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  login,
  fetchStudentBorrowingRecords,
  loadDashboardData,
  borrowBook,
  returnBook,
  requestReturn,
  processReturn,
  saveSettings,
  fetchSettings,
  upsertBook,
  upsertStudent,
  upsertAppUser,
  deleteBook,
  deleteStudent,
  markReminderSent,
} from './lib/api'
import useSupabaseRealtime from './hooks/useSupabaseRealtime'
import mergeRecords from './lib/mergeRecords'
import { startAuthSync, mapKeysToCamel } from './supabaseClient'
import supabase from './supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'student' | 'admin'

function normalizeStudentCode(value: string): string {
  const cleaned = String(value ?? '').trim().replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
  const withoutPrefix = cleaned.replace(/^STU-?/i, '')
  return withoutPrefix ? `STU-${withoutPrefix}` : 'STU'
}

function buildStudentEmailFromCode(value: string): string {
  const code = normalizeStudentCode(value).replace(/^STU-/i, '')
  return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

function isMissingTableError(error: any): boolean {
  const message = String(error?.message ?? '')
  return message.includes('Could not find the table') || message.includes('does not exist') || (message.includes('relation') && message.includes('does not exist'))
}

async function hashPassword(value: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return value
}

type StudentView =
  | 'dashboard'
  | 'search'
  | 'borrowed'
  | 'history'
  | 'borrower-card'
  | 'card'
  | 'profile'
type AdminView =
  | 'dashboard'
  | 'books'
  | 'app-users'
  | 'library-cards'
  | 'borrower-cards'
  | 'borrowing-records'
  | 'returns'
  | 'overdue'
  | 'reports'
  | 'settings'

// ─── Icons (simple SVG line icons) ────────────────────────────────────────────
const Icons = {
  Book: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    </svg>
  ),
  IdCard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 10h2" /><path d="M16 14h2" /><circle cx="8" cy="10" r="2" /><path d="M6 14a2 2 0 0 1 4 0" />
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  AlertCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  Package: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" /><path d="M3 7.5V16.5L12 21l9-4.5V7.5" /><path d="M12 12v9" />
    </svg>
  ),
  RefreshCw: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  BarChart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Mail: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Library: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Filter: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  QrCode: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none" />
      <path d="M14 14h3v3h-3z" /><path d="M17 17h4" /><path d="M17 14v4" /><path d="M14 17h1" />
    </svg>
  ),
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const libraryClassificationCategories = [
  'All',
  'A - General Works (Encyclopedias, magazines, general periodicals)',
  'B - Philosophy, Psychology, and Religion',
  'C - Auxiliary Sciences of History',
  'D - World History and History of Europe, Asia, and Africa',
  'E - F - History of the Americas',
  'G - Geography, Anthropology, and Recreation',
  'H - Social Sciences (Economics, sociology, statistics)',
  'J - Political Science',
  'K - Law',
  'L - Education',
  'M - Music',
  'N - Fine Arts (Architecture, painting, design)',
  'P - Language and Literature',
  'Q - Science (Mathematics, physics, chemistry, biology)',
  'R - Medicine and Nursing',
  'S - Agriculture',
  'T - Technology and Engineering',
  'U - Military Science',
  'V - Naval Science',
  'Z - Bibliography and Library Science',
]

const PERSISTED_BOOKS_KEY = 'library-books-v1'
const PERSISTED_STUDENTS_KEY = 'library-students-v1'
const PERSISTED_BORROWED_BOOKS_KEY = 'library-borrowed-books-v1'
const ANNOUNCEMENTS_KEY = 'library-announcements-v1'

type LibraryAnnouncement = {
  id: string
  title: string
  date: string
  text: string
}

function readPersistedState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function savePersistedState<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore write failures from restricted browsers or storage full errors
  }
}

async function loadAnnouncements() {
  try {
    const { data, error } = await supabase
      .from('library_announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return (data as any[]).map((item: any) => ({
        id: String(item.id ?? item.uuid ?? `announcement-${Date.now()}`),
        title: String(item.title ?? 'Library notice'),
        date: String(item.date ?? item.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)),
        text: String(item.text ?? item.message ?? ''),
      }))
    }
  } catch {
    // ignore and fall back to local browser storage
  }

  return readPersistedState<LibraryAnnouncement[]>(ANNOUNCEMENTS_KEY, [])
}

async function saveAnnouncements(announcements: LibraryAnnouncement[]) {
  savePersistedState(ANNOUNCEMENTS_KEY, announcements)

  try {
    const rows = announcements.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      date: item.date,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('library_announcements').upsert(rows, { onConflict: 'id' })
    if (error) {
      console.warn('Announcement DB save fallback used.', error)
    }
  } catch (error) {
    console.warn('Announcement DB save fallback used.', error)
  }
}

async function deleteAnnouncement(id: string) {
  try {
    const { error } = await supabase.from('library_announcements').delete().eq('id', id)
    if (!error) return true
    console.warn('Delete from Supabase failed, falling back to local state.', error)
  } catch (error) {
    console.warn('Delete from Supabase failed, falling back to local state.', error)
  }

  return false
}

const borrowedBooks: any[] = []
const searchResults: any[] = []
const adminBooks: any[] = []

type StudentStatus = 'active' | 'suspended'

const adminStudents: Array<{ id: string; name: string; course: string; card: string; email: string; status: StudentStatus }> = []

const borrowingRecords: any[] = []
const overdueRecords: any[] = []
const historyBooks: any[] = []

function deriveBookAvailability(book: any, borrowRows: any[] = []) {
  const totalCopies = Number(book?.total_copies ?? book?.totalCopies ?? book?.copies ?? 1)
  const explicitAvailable = Number(book?.available_copies ?? book?.availableCopies ?? book?.available ?? totalCopies)
  const activeBorrowCount = (borrowRows ?? []).filter((row: any) => {
    const matchesBook = String(row?.book_id ?? row?.bookId ?? '').trim() === String(book?.id ?? '').trim()
    const isActive = !row?.return_date && String(row?.status ?? '').toLowerCase() !== 'returned'
    return matchesBook && isActive
  }).length

  const realAvailability = Math.max(0, totalCopies - activeBorrowCount)
  const ifBorrowHistoryExists = (borrowRows ?? []).some((row: any) => {
    const matchesBook = String(row?.book_id ?? row?.bookId ?? '').trim() === String(book?.id ?? '').trim()
    const isActive = !row?.return_date && String(row?.status ?? '').toLowerCase() !== 'returned'
    return matchesBook && isActive
  })

  if (ifBorrowHistoryExists) return realAvailability
  if (Number.isFinite(explicitAvailable) && explicitAvailable >= 0) return Math.max(0, Math.min(explicitAvailable, totalCopies))
  return totalCopies
}

function inferLoanStatus(dueDate?: string) {
  if (!dueDate) return 'active'

  const due = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return 'active'

  const today = new Date()
  const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return 'overdue'
  if (diffDays >= -3) return 'due-soon'
  return 'active'
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
    returned: { label: 'Returned', cls: 'bg-green-100 text-green-700' },
    available: { label: 'Available', cls: 'bg-green-100 text-green-700' },
    'due-soon': { label: 'Due Soon', cls: 'bg-orange-100 text-orange-600' },
    overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-600' },
    suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-600' },
    unavailable: { label: 'Unavailable', cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-green-100 p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

// ─── Login Page ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (role: Role, email: string, password: string) => Promise<void> }) {
  const [role, setRole] = useState<Role>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignup, setShowSignup] = useState(false)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [course, setCourse] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [confirm, setConfirm] = useState('')
  const [info, setInfo] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {showSignup ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Student ID Number</label>
              <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="STU-2021-001" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Course</label>
              <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BSIT" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Year Level</label>
              <input value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} placeholder="1st Year" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            {info && <div className="text-sm text-green-700">{info}</div>}
            <div>
              <button
                onClick={async () => {
                  setError(null)
                  setInfo(null)
                  const normalizedStudentId = studentId.trim()
                  if (!name || !normalizedStudentId || !course || !yearLevel || !password) return setError('Name, student ID, course, year level, and password are required')
                  if (password !== confirm) return setError('Passwords do not match')
                  setLoading(true)
                  try {
                    const studentCode = normalizeStudentCode(normalizedStudentId)
                    const internalEmail = buildStudentEmailFromCode(studentCode)
                    const passwordHash = await hashPassword(password)

                    // Prevent overwriting seeded/demo login rows with the same student code.
                    const existingLoginQuery = await supabase
                      .from('student_login_accounts')
                      .select('id, student_id, student_code')
                      .or(`student_id.eq.${studentCode},student_code.eq.${studentCode}`)
                      .limit(1)

                    if (existingLoginQuery.error && !isMissingTableError(existingLoginQuery.error)) {
                      throw new Error(existingLoginQuery.error.message ?? 'Unable to verify student ID availability.')
                    }

                    if ((existingLoginQuery.data ?? []).length > 0) {
                      setError('A student account with this ID already exists. Please sign in instead.')
                      return
                    }

                    const studentLookup = await supabase
                      .from('students')
                      .select('id, student_code')
                      .eq('student_code', studentCode)
                      .limit(1)

                    if (studentLookup.error && !isMissingTableError(studentLookup.error)) {
                      throw new Error(studentLookup.error.message ?? 'Unable to verify student profile availability.')
                    }

                    if ((studentLookup.data ?? []).length > 0) {
                      setError('This student ID already exists in the records. Please sign in instead.')
                      return
                    }

                    // Create the student profile and login account directly in the app's custom tables.
                    // This avoids the fake-email Supabase Auth issue that requires email confirmation.
                    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `id-${Date.now()}`
                    const studentPayload = { id, student_code: studentCode, name, email: internalEmail, course, year_level: yearLevel, status: 'active' }

                    const upsertErrors: string[] = []

                    const loginAccountPayload = {
                      student_id: studentCode,
                      student_code: studentCode,
                      full_name: name,
                      course,
                      year_level: yearLevel,
                      password_hash: passwordHash,
                      status: 'active',
                    }
                    const { error: loginErr } = await supabase.from('student_login_accounts').insert([loginAccountPayload])
                    if (loginErr) {
                      if (isMissingTableError(loginErr)) {
                        setError('The student login table is not available yet. Please run the Supabase schema migration first.')
                        return
                      }
                      upsertErrors.push(loginErr.message ?? JSON.stringify(loginErr))
                    }

                    const { error: studentErr } = await supabase.from('students').insert([studentPayload])
                    if (studentErr) {
                      if (isMissingTableError(studentErr)) {
                        console.warn('[signup] students table missing; continuing without profile row')
                      } else {
                        upsertErrors.push(studentErr.message ?? JSON.stringify(studentErr))
                      }
                    }

                    if (upsertErrors.length > 0) {
                      console.error('[signup] insert errors', upsertErrors)
                      setError(`Account creation failed: ${upsertErrors.join('; ')}`)
                      return
                    }

                    setShowSignup(false)
                    setError(null)
                    setInfo('Account created. Please sign in with your student ID number.')
                    setEmail('')
                    setPassword('')
                    setConfirm('')
                    setName('')
                    setStudentId('')
                    setCourse('')
                    setYearLevel('')
                    setRole('student')
                  } catch (err: any) {
                    setError(err?.message ?? 'Sign up failed')
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-sm mt-1 disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Create account'}
              </button>
            </div>
            <div className="text-center text-sm">
              <button onClick={() => setShowSignup(false)} className="text-green-600 hover:text-green-800">Back to sign in</button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
              {/* Logo */}
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white">
                  <Icons.Library />
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-bold text-green-900">LIBRARY sjbcnl</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Student Portal</p>
                </div>
              </div>

              {/* Role selector */}
              <div className="flex rounded-lg border border-green-200 overflow-hidden mb-6">
                {(['student', 'admin'] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${role === r ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-green-50'
                      }`}
                  >
                    {r === 'student' ? 'Student / User' : 'Admin / Librarian'}
                  </button>
                ))}
              </div>

              {/* Form */}
              <div className="flex flex-col gap-4">
                {info && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{info}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {role === 'student' ? 'Student ID Number' : 'Email'}
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. STU-2021-001 or 2021-001' : 'librarian@college.edu'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                  />
                </div>
                <div className="flex justify-end">
                  <button className="text-sm text-green-600 hover:text-green-800 font-medium transition-colors">
                    Forgot password?
                  </button>
                  <div className="text-center mt-2">
                    <button onClick={() => { setShowSignup(true); setError(null); setInfo(null); }} className="text-sm text-green-600 hover:text-green-800">Create account</button>
                  </div>
                </div>
                <div>
                  {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
                  <button
                    onClick={async () => {
                      setError(null)
                      setLoading(true)
                      try {
                        await onLogin(role, email, password)
                      } catch (err: any) {
                        setError(err?.message ?? 'Login failed')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    disabled={loading}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-sm mt-1 disabled:opacity-60"
                  >
                    {loading ? 'Signing in…' : 'Log In'}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-5">
              © 2025 Campus Library. All rights reserved.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  items,
  active,
  onSelect,
  onLogout,
  title,
}: {
  items: { id: string; label: string; icon: ReactNode }[]
  active: string
  onSelect: (id: string) => void
  onLogout: () => void
  title: string
}) {
  return (
    <aside className="w-full sidebar-minimal flex flex-col lg:w-64 lg:min-h-screen lg:shrink-0">
      <div className="px-4 py-4 border-b border-green-800 lg:px-5 lg:py-6">
        <div className="flex items-center justify-center gap-2.5 text-white lg:justify-start">
          <Icons.Library />
          <div>
            <div className="text-sm font-bold leading-tight">LIBRARY sjbcnl</div>
            <div className="text-xs text-green-300 font-normal">{title}</div>
          </div>
        </div>
      </div>
      <nav className="flex flex-row flex-wrap gap-2 px-3 py-3 lg:flex-col lg:gap-0.5 lg:flex-1 lg:py-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left whitespace-nowrap lg:justify-start lg:px-3 lg:py-2.5 lg:text-sm lg:w-full ${active === item.id
              ? 'bg-green-600 text-white'
              : 'text-green-200 hover:bg-green-800 hover:text-white'
              }`}
          >
            {item.icon}
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sm:hidden">{item.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-green-800 lg:py-4">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-green-200 hover:bg-green-800 hover:text-white transition-colors w-full lg:justify-start"
        >
          <Icons.LogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

// ─── Page Header ───────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-green-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Table wrapper ─────────────────────────────────────────────────────────────
function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-green-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-green-50 border-b border-green-100">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-green-800 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-green-50">{children}</tbody>
      </table>
    </div>
  )
}

function Tr({ children }: { children: ReactNode }) {
  return <tr className="bg-white hover:bg-green-50/50 transition-colors">{children}</tr>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}

// ─── Student Views ─────────────────────────────────────────────────────────────

async function fetchStudentBorrowingLog(studentKey?: string): Promise<Array<{ book: string; author: string; borrowDate: string; returnDate: string; status: string }>> {
  const resolvedStudentKey = String(studentKey ?? '').trim()
  if (!resolvedStudentKey) return []

  try {
    const { data: loginRows, error: loginError } = await supabase.from('student_login_accounts').select('*').limit(200)
    if (loginError) throw loginError

    const loginRow = (loginRows ?? []).find((row: any) => {
      const values = [row?.id, row?.student_id, row?.student_code, row?.full_name, row?.email]
      return values.some((value) => {
        const normalizedValue = String(value ?? '').trim().toLowerCase()
        const normalizedKey = resolvedStudentKey.toLowerCase()
        return normalizedValue === normalizedKey || normalizedValue === normalizeStudentCode(resolvedStudentKey).toLowerCase()
      })
    })

    if (!loginRow) return []

    const { data: recordRows, error: recordError } = await supabase
      .from('borrowing_records')
      .select('*')
      .eq('student_id', loginRow.id)
      .order('borrow_date', { ascending: false })

    if (recordError) throw recordError

    const bookIds = [...new Set((recordRows ?? []).map((row: any) => String(row?.book_id ?? '').trim()).filter(Boolean))]
    let bookMap = new Map<string, any>()

    if (bookIds.length > 0) {
      const { data: bookRows, error: bookError } = await supabase.from('books').select('*').in('id', bookIds)
      if (!bookError) {
        bookMap = new Map((bookRows ?? []).map((book: any) => [String(book.id ?? '').trim(), book]))
      }
    }

    return (recordRows ?? []).map((record: any) => {
      const book = bookMap.get(String(record?.book_id ?? '').trim())
      const status = String(record?.status ?? '').trim() || (record?.return_date ? 'returned' : 'active')
      return {
        book: book?.title ?? 'Unknown book',
        author: book?.author ?? 'Unknown author',
        borrowDate: record?.borrow_date ?? 'N/A',
        returnDate: record?.return_date ?? 'Pending',
        status,
      }
    })
  } catch (error) {
    console.error('Unable to load borrowing log for student.', error)
    return []
  }
}

function StudentBorrowerCard({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [allBorrowedEntries, setAllBorrowedEntries] = useState<Array<{ book: string; author: string; borrowDate: string; returnDate: string; status: string }>>([])
  const student = {
    name: userProfile?.name ?? 'Student',
    studentId: userProfile?.studentId ?? userProfile?.studentCode ?? 'N/A',
    course: userProfile?.course ?? 'Unassigned',
    cardNo: userProfile?.card ?? 'N/A',
  }

  useEffect(() => {
    const studentKey = String(userProfile?.studentId ?? userProfile?.studentCode ?? userProfile?.email ?? '').trim()
    void fetchStudentBorrowingLog(studentKey).then(setAllBorrowedEntries)
  }, [userProfile?.studentId, userProfile?.studentCode, userProfile?.email])

  return (
    <div>
      <PageHeader title="Borrower Card" subtitle="Your official library borrower record card." />
      <div className="max-w-6xl">
        <div className="bg-[#d9d9d9] text-black border border-black/35 print:shadow-none" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <div className="grid grid-cols-[46px_minmax(0,1fr)_46px] min-h-[640px]">
            <div className="border-r border-black/40 bg-[#d5d5d5] px-1 py-3">
              <div className="flex h-full flex-col items-center justify-between text-[8px] font-bold uppercase tracking-[0.2em] text-black">
                <div className="w-7 h-7 rounded-full border border-black/60 bg-white/20 flex items-center justify-center text-[8px] font-black">SJ</div>
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Student No.</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Course &amp; Year</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Academic Year</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Signature</div>
                </div>
              </div>
            </div>

            <div className="bg-[#d9d9d9] px-4 py-4">
              <div className="flex items-center justify-between border-b border-black/40 pb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-black">
                <div className="flex items-center gap-2">
                  <span className="text-[9px]">S J</span>
                  <span>Saint John Bosco College</span>
                </div>
                <span className="text-right">Date Borrowed</span>
              </div>

              <div className="mt-4 h-[180px] border border-black/45 bg-[#d5d5d5] flex items-center justify-center">
                <div className="w-[180px] h-[80px] border border-black/60 bg-white/10" />
              </div>

              <div className="mt-5 space-y-3 text-[12px] font-medium text-black">
                <div className="flex items-center gap-2">
                  <span className="w-[72px] font-bold">Name:</span>
                  <span className="flex-1 border-b border-black pb-1 text-sm font-semibold">{student.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-[72px] font-bold">Course:</span>
                  <span className="flex-1 border-b border-black pb-1 text-sm">{student.course}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-[72px] font-bold">Year:</span>
                  <span className="w-[44px] border-b border-black pb-1 text-center text-sm">1st</span>
                  <span className="font-bold">A.Y.</span>
                  <span className="flex-1 border-b border-black pb-1 text-sm">2025-2026</span>
                </div>
              </div>

              <div className="mt-5 border-t border-black/50 pt-2">
                <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.7fr] text-[8px] font-bold uppercase tracking-[0.18em] text-black border-b border-black/40 pb-2">
                  <div>Date Borrowed</div>
                  <div>Title of the Book</div>
                  <div>Author</div>
                  <div>Date Returned</div>
                  <div className="text-right">QR</div>
                </div>

                <div className="space-y-0 pt-2">
                  {(allBorrowedEntries.length ? allBorrowedEntries : [{ book: '', author: '', borrowDate: '', returnDate: '', status: 'active' }]).map((entry, idx) => (
                    <div key={`${entry.book}-${entry.borrowDate}-${idx}`} className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.7fr] text-[10px] text-black border-b border-black/20 pb-2 min-h-[24px]">
                      <div className="pr-2 truncate">{entry.borrowDate || ' '}</div>
                      <div className="pr-2 truncate">{entry.book || ' '}</div>
                      <div className="pr-2 truncate">{entry.author || ' '}</div>
                      <div className="truncate">{entry.returnDate || ' '}</div>
                      <div className="text-right">{idx === 0 ? '■' : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-l border-black/40 bg-[#d5d5d5] px-1 py-3">
              <div className="flex h-full items-center justify-center">
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[8px] font-bold uppercase tracking-[0.2em] text-black">
                  Library Borrower's Card
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentDashboard({ onNavigate, userProfile }: { onNavigate: (v: StudentView) => void; userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [rows, setRows] = useState<Array<{ id: string; title: string; author: string; borrowDate: string; dueDate: string; status: string }>>([])
  const [announcements, setAnnouncements] = useState<LibraryAnnouncement[]>([])

  useEffect(() => {
    let active = true

    async function syncAnnouncements() {
      const next = await loadAnnouncements()
      if (active) setAnnouncements(next)
    }

    void syncAnnouncements()

    const handleAnnouncementUpdated = async () => {
      const next = await loadAnnouncements()
      if (active) setAnnouncements(next)
    }

    window.addEventListener('lms-announcements-updated', handleAnnouncementUpdated)
    return () => {
      active = false
      window.removeEventListener('lms-announcements-updated', handleAnnouncementUpdated)
    }
  }, [])

  useEffect(() => {
    const studentKey = String(userProfile?.studentId ?? userProfile?.studentCode ?? userProfile?.email ?? '').trim()

    async function loadRows() {
      if (!studentKey) {
        setRows([])
        return
      }

      try {
        const nextRows = await fetchStudentBorrowingRecords(studentKey)
        setRows(nextRows.map((row: any) => {
          const dueDate = row.dueDate || row.due_date || ''
          const status = String(row.status ?? '').trim() || inferLoanStatus(dueDate)
          return {
            id: String(row.id ?? `${row.title}-${row.borrowDate}`),
            title: row.title ?? 'Unknown book',
            author: row.author ?? 'Unknown author',
            borrowDate: row.borrowDate ?? row.borrow_date ?? 'N/A',
            dueDate,
            status: String(status).toLowerCase(),
          }
        }))
      } catch {
        setRows([])
      }
    }

    void loadRows()
    const handleUpdated = () => { void loadRows() }
    window.addEventListener('lms-borrow-updated', handleUpdated)
    return () => window.removeEventListener('lms-borrow-updated', handleUpdated)
  }, [userProfile?.studentId, userProfile?.studentCode, userProfile?.email])

  const overdueCount = rows.filter((row) => row.status === 'overdue').length
  const dueSoonCount = rows.filter((row) => row.status === 'due-soon').length
  const currentlyBorrowed = rows.length
  const nextDue = [...rows].filter((row) => row.dueDate).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null

  const fines = rows.reduce((sum, row) => {
    if (row.status !== 'overdue' || !row.dueDate) return sum
    const due = new Date(`${row.dueDate}T00:00:00`)
    const diffDays = Math.max(0, Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)))
    return sum + diffDays * 5
  }, 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-green-900">Welcome back!</h2>
          <p className="text-sm text-gray-500 mt-0.5">Your library dashboard is ready.</p>
        </div>
        <div className="text-sm text-gray-400">Live data only</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Currently Borrowed" value={currentlyBorrowed} color="text-green-700" />
            <StatCard label="Due Soon" value={dueSoonCount} color="text-orange-500" />
            <StatCard label="Overdue" value={overdueCount} color="text-red-600" />
            <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm">
              <span className="text-sm text-gray-500 font-medium">Accrued Fines</span>
              <div className="text-2xl font-bold text-red-600 mt-2">₱{fines.toFixed(2)}</div>
            </div>
          </div>

          {overdueCount > 0 && (
            <div className="rounded-lg border border-red-100 bg-red-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-600"><Icons.AlertCircle /></div>
                <div>
                  <div className="font-semibold text-red-700">Overdue Notice</div>
                  <div className="text-sm text-red-600 mt-1">You have {overdueCount} overdue book(s). A fine of ₱5/day is applied. Please return immediately.</div>
                  <button onClick={() => onNavigate('borrowed')} className="mt-2 text-sm text-red-700 font-medium underline">View overdue books →</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Active Loans</h3>
              <button onClick={() => onNavigate('borrowed')} className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">View all <Icons.ChevronRight /></button>
            </div>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-green-200 bg-green-50 p-5 text-sm text-gray-500">No active loans yet.</div>
            ) : (
              <Table headers={["Book Title", "Due Date", "Status", "Action"]}>
                {rows.map((b) => (
                  <Tr key={b.id}>
                    <Td className="font-medium text-gray-900">{b.title}</Td>
                    <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>{b.dueDate || 'N/A'}</Td>
                    <Td><StatusBadge status={b.status} /></Td>
                    <Td>
                      <button onClick={() => onNavigate('borrower-card')} className="px-3 py-1.5 border border-green-200 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 transition-colors">View Card</button>
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </div>

          <div className="mt-4 bg-white rounded-xl border border-green-100 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-green-900 mb-3">Library Announcements</h3>
            <div className="space-y-3 text-sm text-gray-700">
              {announcements.map((a, i) => (
                <div key={i} className="rounded-lg border border-green-50 p-3 bg-green-50/40">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-800">{a.title}</div>
                    <div className="text-xs text-gray-400">{a.date}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{a.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Next Due Dates</div>
            <div className="mt-2 text-sm text-gray-500">
              {nextDue ? `${nextDue.title} · ${nextDue.dueDate}` : 'No upcoming due dates.'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-green-900">Quick Actions</h4>
            <div className="mt-3 flex flex-col gap-3">
              <button onClick={() => onNavigate('search')} className="py-2.5 bg-green-600 text-white rounded-lg">Search & Borrow Books</button>
              <button onClick={() => onNavigate('borrower-card')} className="py-2.5 border border-green-200 text-green-700 rounded-lg">View Borrower Card</button>
              <button onClick={() => onNavigate('card')} className="py-2.5 border border-green-200 text-green-700 rounded-lg">My Library Card</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Library Hours</div>
            <div className="mt-2 text-sm text-gray-700">
              <div>Mon-Fri: 7:00 AM – 8:00 PM</div>
              <div>Saturday: 8:00 AM – 5:00 PM</div>
              <div>Sunday: Closed</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function SearchBooks({ studentId, userProfile }: { studentId?: string; userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [borrowModal, setBorrowModal] = useState<any | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedBorrowStudentId = [studentId, userProfile?.studentCode, userProfile?.studentId]
    .map((value) => String(value ?? '').trim())
    .find((value) => value && !value.includes('@')) ?? ''

  const studentName = userProfile?.name ?? 'Student'
  const libraryCardNo = userProfile?.card ?? `CARD-${resolvedBorrowStudentId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) || 'STUDENT'}`
  const studentIdentifier = resolvedBorrowStudentId

  const { data: booksRt } = useSupabaseRealtime('books')
  const { data: borrowingRt } = useSupabaseRealtime('borrowing_records')

  const categories = libraryClassificationCategories

  const localBooks = (booksRt && booksRt.length > 0)
    ? (booksRt ?? []).map((r: any) => ({
      id: r.id,
      isbn: r.isbn ?? '',
      title: r.title ?? '',
      author: r.author ?? '',
      category: r.category ?? '',
      copies: Number(r.total_copies ?? r.totalCopies ?? r.copies ?? 1),
      available: deriveBookAvailability(r, borrowingRt ?? []),
    }))
    : searchResults

  const filtered = localBooks.filter((b) => {
    const q = query.toLowerCase()
    const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    const matchC = category === 'All' || b.category === category
    return matchQ && matchC
  })

  const handleConfirmBorrow = async () => {
    if (!borrowModal) return

    const borrowStudentId = [studentId, userProfile?.studentCode, userProfile?.studentId]
      .map((value) => String(value ?? '').trim())
      .find((value) => value && !value.includes('@')) ?? ''

    if (!borrowStudentId) {
      setError('Student not found in student_login_accounts. Please log in again.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      const bookReference = String(borrowModal.reference || borrowModal.isbn || borrowModal.id || '').trim()
      await borrowBook(borrowStudentId, bookReference || String(borrowModal.id || ''))
      window.dispatchEvent(new Event('lms-borrow-updated'))
      setConfirmed(true)
    } catch (e: any) {
      setError(e?.message || 'Unable to borrow this book right now.')
    } finally {
      setBusy(false)
    }
  }

  if (borrowModal) {
    return (
      <div>
        <PageHeader title="Borrow Book" subtitle="Confirm your borrowing details below." />
        <div className="max-w-md bg-white rounded-xl border border-green-100 shadow-sm p-6">
          {confirmed ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Icons.Check />
              </div>
              <h3 className="font-bold text-green-900 text-lg">Borrow Confirmed!</h3>
              <p className="text-sm text-gray-500">You have successfully borrowed <span className="font-medium text-gray-700">{borrowModal.title}</span>. Return by <span className="font-medium text-gray-700">{new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}</span>.</p>
              <button onClick={() => { setBorrowModal(null); setConfirmed(false); setError(null) }} className="mt-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                Back to Search
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-green-900 mb-4">Confirm Borrowing</h3>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              <div className="flex flex-col gap-3 text-sm mb-6">
                {[
                  ['Student Name', studentName],
                  ['Library Card No.', libraryCardNo],
                  ['Book Title', borrowModal.title],
                  ['Author', borrowModal.author],
                  ['Borrow Date', new Date().toISOString().slice(0, 10)],
                  ['Due Date', new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmBorrow}
                  disabled={busy || !studentIdentifier}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors"
                >
                  {busy ? 'Processing...' : 'Confirm Borrow'}
                </button>
                <button
                  onClick={() => { setBorrowModal(null); setError(null) }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Search Books" subtitle="Browse and borrow books from the library collection." />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input
            type="text"
            placeholder="Search by title or author..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Icons.Filter />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="py-2.5 px-3 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 transition"
          >
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-green-100 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-green-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Book</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">ISBN</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Author</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Category</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Availability</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {filtered.map((b) => (
              <tr key={b.id} className="bg-white hover:bg-green-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-10 items-center justify-center rounded-md border border-gray-200 bg-gradient-to-br from-sky-50 to-blue-100 text-[9px] font-bold text-blue-700 shadow-sm">
                      {b.title.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'BK'}
                    </div>
                    <div className="font-medium text-gray-900">{b.title}</div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.isbn}</td>
                <td className="px-4 py-3 text-gray-700">{b.author}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{b.category}</span>
                </td>
                <td className="px-4 py-3">
                  {b.available > 0 ? <span className="font-medium text-green-600">{b.available} / {b.copies} available</span> : <span className="font-medium text-red-500">Not available</span>}
                </td>
                <td className="px-4 py-3">
                  {b.available > 0 ? (
                    <button
                      onClick={() => setBorrowModal(b)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
                    >
                      Borrow
                    </button>
                  ) : (
                    <button className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400" disabled>
                      Unavailable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ─── Borrower Card Component ───────────────────────────────────────────────────
type BorrowEntry = {
  id: string | number
  title: string
  author: string
  borrowDate: string
  dueDate: string
  status: string
  studentId?: string
  cardNo?: string
}

function BorrowerCardSlip({
  book,
  studentName,
  studentId,
  cardNo,
  course,
  onClose,
}: {
  book: Partial<BorrowEntry> & { title?: string; author?: string; borrowDate?: string; dueDate?: string; status?: string; id?: string | number }
  studentName: string
  studentId: string
  cardNo: string
  course: string
  onClose: () => void
}) {
  const txnId = `TXN-${String(book.id ?? 'N/A')}`
  const normalizedStatus = book.status ?? 'active'
  const title = book.title ?? 'Unavailable'
  const author = book.author ?? 'Unknown author'
  const borrowDate = book.borrowDate ?? 'N/A'
  const dueDate = book.dueDate ?? 'N/A'
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-green-100">
        {/* Card header */}
        <div className="bg-green-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <Icons.Library />
            <div>
              <div className="font-bold text-sm leading-tight">Greenfield College</div>
              <div className="text-green-200 text-xs">Library — Borrower Card</div>
            </div>
          </div>
          <button onClick={onClose} className="text-green-300 hover:text-white transition-colors">
            <Icons.X />
          </button>
        </div>

        {/* Card body */}
        <div className="px-6 py-5">
          {/* Transaction ID */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-green-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transaction ID</span>
            <span className="font-mono text-sm font-bold text-green-700">{txnId}</span>
          </div>

          {/* Student section */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Borrower</div>
            <div className="bg-green-50 rounded-lg p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-semibold text-gray-800">{studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Student ID</span>
                <span className="font-mono text-gray-700">{studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Course</span>
                <span className="text-gray-700">{course}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Card No.</span>
                <span className="font-mono font-bold text-green-700">{cardNo}</span>
              </div>
            </div>
          </div>

          {/* Book section */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Book Details</div>
            <div className="bg-green-50 rounded-lg p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Title</span>
                <span className="font-semibold text-gray-800 text-right">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Author</span>
                <span className="text-gray-700">{author}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Loan Period</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Borrow Date</div>
                <div className="text-sm font-bold text-green-800">{borrowDate}</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${normalizedStatus === 'overdue' ? 'bg-red-50' : normalizedStatus === 'due-soon' ? 'bg-orange-50' : 'bg-green-50'}`}>
                <div className="text-xs text-gray-400 mb-1">Due Date</div>
                <div className={`text-sm font-bold ${normalizedStatus === 'overdue' ? 'text-red-600' : normalizedStatus === 'due-soon' ? 'text-orange-600' : 'text-green-800'}`}>
                  {dueDate}
                </div>
              </div>
            </div>
          </div>

          {/* Status & barcode strip */}
          <div className="flex items-center justify-between py-3 border-t border-green-100">
            <StatusBadge status={normalizedStatus} />
            <div className="flex gap-0.5 items-end">
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} style={{ width: i % 3 === 0 ? 3 : 1.5, height: i % 4 === 0 ? 24 : 18, background: '#15803d', opacity: i % 5 === 0 ? 0.35 : 1 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={() => window.print()} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
            Print Card
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

type PersistedBorrowEntry = BorrowEntry

function MyBorrowedBooks({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [selected, setSelected] = useState<BorrowEntry | null>(null)
  const [rows, setRows] = useState<PersistedBorrowEntry[]>([])
  const [returningId, setReturningId] = useState<string | null>(null)
  const [returnRequestId, setReturnRequestId] = useState<string | null>(null)
  const [returnRequestDate, setReturnRequestDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const student = {
    name: userProfile?.name ?? 'Student',
    studentId: userProfile?.studentId ?? userProfile?.studentCode ?? 'N/A',
    course: userProfile?.course ?? 'Unassigned',
    cardNo: userProfile?.card ?? 'N/A',
  }

  useEffect(() => {
    const loadRows = async () => {
      const currentStudentId = String(userProfile?.studentId ?? userProfile?.studentCode ?? userProfile?.email ?? '').trim()
      if (!currentStudentId) {
        setRows([])
        return
      }

      try {
        const nextRows = await fetchStudentBorrowingRecords(currentStudentId)
        setRows(nextRows)
      } catch {
        setRows([])
      }
    }

    loadRows()
    const handleBorrowUpdated = () => { void loadRows() }
    window.addEventListener('lms-borrow-updated', handleBorrowUpdated)
    return () => window.removeEventListener('lms-borrow-updated', handleBorrowUpdated)
  }, [userProfile?.studentId, userProfile?.studentCode, userProfile?.email])

  const handleReturnBook = async (recordId: string) => {
    try {
      setReturningId(recordId)
      await requestReturn(recordId, returnRequestDate)
      // Keep the loan visible for the student, mark it as 'return_requested'
      setRows((current) => (current || []).map((row) => (String(row.id) === String(recordId) ? { ...row, status: 'return_requested' } : row)))
      setReturnRequestId(null)
      setReturnRequestDate(new Date().toISOString().slice(0, 10))
      window.dispatchEvent(new Event('lms-borrow-updated'))
    } catch (error: any) {
      console.error('Return book failed', error)
      window.alert(error?.message || 'Unable to return this book right now.')
    } finally {
      setReturningId(null)
    }
  }

  return (
    <div>
      <PageHeader title="My Borrowed Books" subtitle="Track your active loans and due dates." />
      {returnRequestId && (
        <div className="mb-5 rounded-xl border border-green-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-4">Request Return</h3>
          <div className="grid gap-4 md:grid-cols-1">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Return Date</label>
              <input type="date" value={returnRequestDate} onChange={(e) => setReturnRequestDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
            </div>
            <p className="text-sm text-gray-600">The admin will add the final remark after reviewing the returned book.</p>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={() => handleReturnBook(returnRequestId)} disabled={returningId === returnRequestId} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
              {returningId === returnRequestId ? 'Sending...' : 'Send to Admin'}
            </button>
            <button onClick={() => { setReturnRequestId(null); setReturnRequestDate(new Date().toISOString().slice(0, 10)); }} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-6 text-sm text-gray-500">No borrowed books yet for this student.</div>
      ) : (
        <Table headers={['Book Title', 'Author', 'Borrow Date', 'Due Date', 'Status', 'Action']}>
          {rows.map((b) => (
            <Tr key={`${b.studentId ?? 'student'}-${b.id}`}>
              <Td className="font-medium text-gray-900">{b.title}</Td>
              <Td>{b.author}</Td>
              <Td>{b.borrowDate}</Td>
              <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>
                {b.dueDate}
              </Td>
              <Td><StatusBadge status={b.status} /></Td>
              <Td className="space-x-2">
                <button
                  onClick={() => setSelected(b)}
                  className="px-3 py-1.5 border border-green-200 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 transition-colors"
                >
                  Borrower Card
                </button>
                <button
                  onClick={() => {
                    setReturnRequestId(String(b.id))
                    setReturnRequestDate(new Date().toISOString().slice(0, 10))
                  }}
                  disabled={returningId === String(b.id)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {returningId === String(b.id) ? 'Sending...' : 'Return'}
                </button>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
      {selected && (
        <BorrowerCardSlip
          book={selected}
          studentName={student.name}
          studentId={student.studentId}
          cardNo={student.cardNo}
          course={student.course}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function BorrowingHistory({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [historyRows, setHistoryRows] = useState<Array<{ title: string; author: string; borrowDate: string; returnDate: string; status: string }>>([])

  useEffect(() => {
    const studentKey = String(userProfile?.studentId ?? userProfile?.studentCode ?? userProfile?.email ?? '').trim()

    async function loadHistory() {
      const entries = await fetchStudentBorrowingLog(studentKey)
      setHistoryRows(entries.map((entry) => ({
        title: entry.book,
        author: entry.author ?? 'Unknown author',
        borrowDate: entry.borrowDate,
        returnDate: entry.returnDate,
        status: entry.status,
      })))
    }

    void loadHistory()
    const handleUpdated = () => { void loadHistory() }
    window.addEventListener('lms-borrow-updated', handleUpdated)
    return () => window.removeEventListener('lms-borrow-updated', handleUpdated)
  }, [userProfile?.studentId, userProfile?.studentCode, userProfile?.email])

  return (
    <div>
      <PageHeader title="Borrowing History" subtitle="Your complete library borrowing history." />
      {historyRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-6 text-sm text-gray-500">No borrowing history yet.</div>
      ) : (
        <Table headers={['Book Title', 'Author', 'Borrow Date', 'Return Date', 'Status']}>
          {historyRows.map((b, i) => (
            <Tr key={`${b.title}-${b.borrowDate}-${i}`}>
              <Td className="font-medium text-gray-900">{b.title}</Td>
              <Td>{b.author}</Td>
              <Td>{b.borrowDate}</Td>
              <Td>{b.returnDate}</Td>
              <Td><StatusBadge status={b.status} /></Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  )
}

function LibraryCard({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const student = {
    name: userProfile?.name ?? 'Juan Dela Cruz',
    id: userProfile?.studentId ?? userProfile?.studentCode ?? 'N/A',
    course: userProfile?.course ?? 'BSCS 3',
    cardNo: userProfile?.card ?? 'N/A',
  }

  function handleDownloadCard() {
    const el = document.getElementById('library-card')
    if (!el) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Library Card</title></head><body>${el.outerHTML}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `library-card-${student.id || 'card'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentYear = new Date().getFullYear()
  const ay = `${currentYear}-${currentYear + 1}`

  return (
    <div>
      <PageHeader title="Library Card" subtitle="Your digital library identification card." />
      <div className="max-w-4xl mx-auto">
        <div id="library-card" className="library-card bg-white">
          <style>{`
            .library-card { width: 1000px; height: 550px; margin: auto; background: white; border: 2px solid #777; border-radius: 8px; overflow: hidden; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header { height: 100px; position: relative; padding: 18px 25px; }
            .school-logo { width: 80px; height: 80px; border-radius: 50%; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 11px; text-align: center; color: #777; position: absolute; left: 25px; top: 10px; }
            .school-name { margin-left: 105px; font-size: 20px; font-weight: bold; color: #333; margin-top: 3px; }
            .school-department { margin-left: 105px; font-size: 12px; color: #555; margin-top: 3px; }
            .school-info { margin-left: 105px; font-size: 9px; color: #555; line-height: 1.3; margin-top: 7px; }
            .qr { position: absolute; right: 25px; top: 15px; width: 65px; height: 65px; border: 2px solid #222; display: flex; justify-content: center; align-items: center; font-size: 10px; }
            .green-strip { position: absolute; top: 87px; left: 20px; right: 20px; height: 50px; background: #dff0c9; border-radius: 2px; z-index: 0; }
            .main { position: relative; margin-top: 35px; height: 300px; padding: 20px 25px; }
            .title { text-align: center; font-size: 34px; font-weight: bold; color: #444; margin-bottom: 30px; }
            .photo-box { position: absolute; left: 25px; top: 75px; width: 250px; height: 190px; border: 1px solid #777; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 14px; }
            .information { position: absolute; left: 330px; right: 30px; top: 75px; }
            .field { display: flex; align-items: center; margin-bottom: 25px; font-size: 23px; }
            .label { width: 150px; color: #444; }
            .line { flex: 1; border-bottom: 2px solid #555; min-height: 30px; padding-left: 10px; font-style: italic; }
            .bottom { position: absolute; bottom: 0; left: 0; width: 100%; height: 100px; background: #f5f5f5; border-top: 1px solid #aaa; display: flex; align-items: center; padding: 15px 25px; }
            .student-number { display: flex; align-items: center; width: 48%; font-size: 20px; font-weight: bold; }
            .student-line { flex: 1; margin-left: 10px; border-bottom: 2px solid #555; height: 28px; }
            .signature { width: 48%; text-align: center; position: relative; height: 70px; }
            .signature-line { position: absolute; bottom: 20px; left: 20px; right: 20px; border-bottom: 2px solid #555; }
            .signature-label { position: absolute; bottom: -5px; left: 0; right: 0; font-size: 16px; }
            .borrow-section { position: absolute; right: -2px; top: 0; width: 280px; height: 100%; background: #55b9e8; border-left: 2px solid #777; padding: 20px; }
            .borrow-title { font-size: 22px; color: #333; margin-bottom: 25px; }
            .borrow-row { height: 55px; border-bottom: 1px solid rgba(0,0,0,0.3); }
            @media print { body { background: white; padding: 0; } .library-card { box-shadow: none; } }
            @media (max-width: 1050px) { .library-card { transform-origin: top left; transform: scale(0.8); } }
          `}</style>

          <div className="header">
            <div className="school-logo">SCHOOL<br/>LOGO</div>
            <div className="school-name">SAINT JOHN BOSCO COLLEGE OF NORTHERN LUZON, INC.</div>
            <div className="school-department">College Department</div>
            <div className="school-info">Library Department<br/>School Library</div>
            <div className="qr">QR CODE</div>
          </div>

          <div className="green-strip"></div>

          <div className="main">
            <div className="title">LIBRARY CARD</div>
            <div className="photo-box">PHOTO</div>
            <div className="information">
              <div className="field">
                <div className="label">Name:</div>
                <div className="line">{student.name}</div>
              </div>
              <div className="field">
                <div className="label">Course/Year:</div>
                <div className="line">{student.course}</div>
              </div>
              <div className="field">
                <div className="label">Semester:</div>
                <div className="line">1st</div>
              </div>
              <div className="field">
                <div className="label">A.Y.</div>
                <div className="line">{ay}</div>
              </div>
            </div>
          </div>

          <div className="bottom">
            <div className="student-number">Student No:
              <div className="student-line">{student.id}</div>
            </div>
            <div className="signature">
              <div className="signature-line"></div>
              <div className="signature-label">Signature</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={handleDownloadCard} className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">Download Card</button>
          <button onClick={() => window.print()} className="flex-1 py-2.5 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">Print</button>
        </div>
      </div>
    </div>
  )
}

function Profile({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const defaults = {
    name: 'Student',
    studentId: 'N/A',
    email: 'student@example.edu',
    course: 'Unassigned',
    card: 'N/A',
  }
  const [profile, setProfile] = useState({ ...defaults, ...(userProfile ?? {}) })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    setProfile((current) => ({ ...defaults, ...userProfile, ...current, ...((userProfile ?? {}) as any) }))
  }, [userProfile])

  function handleSaveProfile() {
    setSaveMessage('Profile updated successfully.')
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account information." />
      <div className="max-w-lg bg-white rounded-xl border border-green-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-green-900 text-lg">{profile.name}</div>
            <div className="text-sm text-gray-500">{profile.studentId} · {profile.course.split(' — ')[0]}</div>
          </div>
        </div>
        <div className="grid gap-4">
          {[
            { label: 'Full Name', key: 'name' },
            { label: 'Student ID', key: 'studentId' },
            { label: 'Email', key: 'email' },
            { label: 'Course / Year', key: 'course' },
            { label: 'Library Card', key: 'card' },
          ].map(({ label, key }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <input
                type="text"
                value={(profile as any)[key]}
                onChange={(e) => {
                  setProfile({ ...profile, [key]: e.target.value })
                  setSaveMessage(null)
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
          ))}
          <button onClick={handleSaveProfile} className="mt-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Save Changes
          </button>
          {saveMessage && <div className="text-sm text-green-700">{saveMessage}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Admin Views ───────────────────────────────────────────────────────────────

function AdminBooks() {
  const { data: booksRt } = useSupabaseRealtime('books')
  const [books, setBooks] = useState(() => readPersistedState(PERSISTED_BOOKS_KEY, adminBooks))
  const dbInitialized = useRef(false)

  const { data: borrowingRt } = useSupabaseRealtime('borrowing_records')

  useEffect(() => {
    // Map realtime DB rows (camelCase) to the UI's expected shape
    if (!booksRt) return
    const mapped = (booksRt ?? []).map((r: any) => ({
      id: r.id,
      isbn: r.isbn ?? '',
      title: r.title ?? '',
      author: r.author ?? '',
      publisher: r.publisher ?? '',
      category: r.category ?? '',
      copies: Number(r.total_copies ?? r.totalCopies ?? r.copies ?? 1),
      available: deriveBookAvailability(r, borrowingRt ?? []),
      rack: r.rack ?? 'R1',
      updatedOn: new Date().toISOString(),
      cover_url: r.coverUrl ?? r.cover_url ?? null,
    }))

    // On first realtime load replace persisted/local list with DB rows to avoid showing stale/test data.
    if (!dbInitialized.current) {
      setBooks(mapped)
      dbInitialized.current = true
    } else {
      // Merge realtime rows with any local-only entries to avoid dropping newly added items
      setBooks((prev) => mergeRecords(prev, mapped))
    }
  }, [booksRt, borrowingRt])

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFileName, setCoverFileName] = useState('No file chosen')
  const [form, setForm] = useState({
    book_code: '',
    title: '',
    author: '',
    isbn: '',
    published_year: '2024',
    category: 'Q - Science (Mathematics, physics, chemistry, biology)',
    publisher: '',
    price: '0.00',
    copies: '1',
    damaged: '0',
    lost: '0',
    cover_url: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<typeof adminBooks[number] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const filtered = books.filter((b) => {
    const matchQuery = !query || b.title.toLowerCase().includes(query.toLowerCase()) || b.author.toLowerCase().includes(query.toLowerCase())
    const matchCategory = categoryFilter === 'All' || b.category === categoryFilter
    return matchQuery && matchCategory
  })

  function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setCoverPreview(null)
      setCoverFileName('No file chosen')
      setForm((current) => ({ ...current, cover_url: '' }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result)
      setCoverPreview(value)
      setForm((current) => ({ ...current, cover_url: value }))
    }
    reader.readAsDataURL(file)
    setCoverFileName(file.name)
  }

  function resetForm() {
    setForm({
      book_code: '',
      title: '',
      author: '',
      isbn: '',
      published_year: '2024',
      category: 'Q - Science (Mathematics, physics, chemistry, biology)',
      publisher: '',
      price: '0.00',
      copies: '1',
      damaged: '0',
      lost: '0',
      cover_url: '',
    })
    setCoverPreview(null)
    setCoverFileName('No file chosen')
    setEditingId(null)
    setShowForm(false)
  }

  function openCreateForm() {
    resetForm()
    setShowForm(true)
    setMessage(null)
  }

  function startEditBook(book: typeof adminBooks[number]) {
    const coverUrl = (book as any).cover_url || null
    setEditingId(book.id)
    setForm({
      book_code: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      published_year: '2024',
      category: book.category,
      publisher: book.publisher || '',
      price: '0.00',
      copies: String(book.copies),
      damaged: '0',
      lost: '0',
      cover_url: coverUrl || '',
    })
    setCoverPreview(coverUrl)
    setCoverFileName(coverUrl ? 'Uploaded cover' : 'No file chosen')
    setShowForm(true)
    setMessage(null)
  }

  async function handleSaveBook() {
    const title = form.title.trim()
    const author = form.author.trim()
    if (!title || !author) {
      setMessage('Title and author are required.')
      return
    }

    let tempId: string | null = null
    try {
      setSaving(true)
      setMessage(null)

      // optimistic create for books: add temp row so UI doesn't lose entry
      tempId = `tmp-book-${Date.now()}`

      const payload = {
        book_code: form.book_code.trim() || `BK-${Date.now()}`,
        title,
        author,
        isbn: form.isbn.trim() || '978-XXXX',
        publisher: form.publisher.trim() || 'Unknown Publisher',
        category: form.category,
        copies: Number(form.copies) || 1,
        available: Number(form.copies) || 1,
        published_year: Number(form.published_year) || new Date().getFullYear(),
        price: Number(form.price) || 0,
        damaged: Number(form.damaged) || 0,
        lost: Number(form.lost) || 0,
        cover_url: form.cover_url || null,
      }
      // add optimistic temp item
      const tempItem: any = {
        id: editingId ?? tempId,
        isbn: payload.isbn,
        title: payload.title,
        author: payload.author,
        publisher: payload.publisher,
        category: payload.category,
        copies: payload.copies,
        available: payload.available,
        rack: 'R1',
        updatedOn: new Date().toISOString(),
        cover_url: payload.cover_url ?? null,
      }
      setBooks((cur) => mergeRecords(cur, [tempItem]))

      const saved = await upsertBook({
        ...payload,
        id: editingId ?? undefined,
      } as any)

      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

      setBooks((current) => mergeRecords(current, [{
        id: saved.id ?? payload.book_code,
        isbn: (saved as any).isbn ?? payload.isbn,
        title: (saved as any).title ?? title,
        author: (saved as any).author ?? author,
        publisher: (saved as any).publisher ?? payload.publisher,
        category: (saved as any).category ?? payload.category,
        copies: (saved as any).copies ?? payload.copies,
        available: (saved as any).available ?? payload.available,
        rack: 'R1',
        updatedOn: now,
        cover_url: (saved as any).cover_url ?? (saved as any).coverUrl ?? payload.cover_url ?? null,
      }]))

      const savedMessage = editingId ? 'Book updated and synced.' : 'Book saved and synced to the database.'
      setMessage(savedMessage)
      resetForm()
    } catch (err: any) {
      // remove optimistic temp item if present
      if (tempId) setBooks((cur) => cur.filter((b) => b.id !== tempId))
      setMessage(err?.message || 'Unable to save the book.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBook(bookId: string) {
    try {
      await deleteBook(bookId)
      setBooks((current) => current.filter((book) => book.id !== bookId))
      setMessage('Book deleted successfully.')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to delete the book.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader title="Book Management" subtitle="Manage the library's book inventory." />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-[1200px] max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-[#f3f3f3] shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#f7f7f7] px-5 py-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <span className="inline-flex h-5 w-5 items-center justify-center text-gray-700">
                  <Icons.Plus />
                </span>
                <span>{editingId ? 'Edit Book' : 'Add New Book'}</span>
              </div>
              <button onClick={resetForm} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700">
                <Icons.X />
              </button>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-xl border border-gray-200 bg-[#f7f7f7] p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <span className="inline-flex h-5 w-5 items-center justify-center text-orange-500">
                    <Icons.Book />
                  </span>
                  Book Cover
                </div>

                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#d6d6d6] bg-gradient-to-br from-orange-100 via-white to-sky-100">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Book cover preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-28 w-20 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-orange-300 text-center text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                      Book Cover
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                    <span>Upload Book Cover</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                  <div className="mt-3 text-xs text-gray-500">Choose File</div>
                  <div className="mt-1 text-xs text-gray-400">{coverFileName}</div>
                  <div className="mt-3 text-[11px] text-gray-400">Recommended: 300×400px, max 9MB</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-[#f7f7f7] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="inline-flex h-5 w-5 items-center justify-center text-green-600">
                      <Icons.Book />
                    </span>
                    Book Information
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Title <span className="text-red-500">*</span></label>
                      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter book title" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Author <span className="text-red-500">*</span></label>
                      <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Enter author name" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">ISBN</label>
                      <input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} placeholder="978-XXXX" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Published Year</label>
                      <input value={form.published_year} onChange={(e) => setForm({ ...form, published_year: e.target.value })} placeholder="2024" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Category <span className="text-red-500">*</span></label>
                      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100">
                        {libraryClassificationCategories.filter((category) => category !== 'All').map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Publisher</label>
                      <input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} placeholder="Publisher name" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Price ($)</label>
                      <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-[#f7f7f7] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="inline-flex h-5 w-5 items-center justify-center text-blue-600">
                      <Icons.Package />
                    </span>
                    Inventory
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Copies <span className="text-red-500">*</span></label>
                      <input type="number" min="1" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} placeholder="1" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Damaged</label>
                      <input type="number" min="0" value={form.damaged} onChange={(e) => setForm({ ...form, damaged: e.target.value })} placeholder="0" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Lost</label>
                      <input type="number" min="0" value={form.lost} onChange={(e) => setForm({ ...form, lost: e.target.value })} placeholder="0" className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-[#f7f7f7] px-4 py-3">
              <button onClick={resetForm} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveBook} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Book' : 'Save Book'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 mb-5 lg:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input
            type="text"
            placeholder="Search books..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Icons.Filter />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-w-[220px] py-2.5 px-3 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 transition"
          >
            {libraryClassificationCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />
          Add Book
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-green-100 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-green-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Book</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">ISBN</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Author</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Publisher</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Category</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Rack</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">No. of copy</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Updated On</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-green-800">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {filtered.map((b) => (
              <tr key={b.id} className="bg-white hover:bg-green-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {(b as any).cover_url ? (
                      <img src={(b as any).cover_url} alt={b.title} className="h-14 w-12 rounded-md border border-gray-200 object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-14 w-12 items-center justify-center rounded-md border border-gray-200 bg-gradient-to-br from-white to-blue-50 text-[10px] font-bold text-blue-700 shadow-sm">
                        {b.title.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'BK'}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{b.title}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.isbn}</td>
                <td className="px-4 py-3 text-gray-700">{b.author}</td>
                <td className="px-4 py-3 text-gray-700">{b.publisher}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{b.category}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{b.rack}</td>
                <td className="px-4 py-3 text-gray-700">{b.copies}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${b.available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {b.available > 0 ? 'Enable' : 'Disable'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{b.updatedOn}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditBook(b)} className="rounded-lg bg-orange-400 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500">Edit</button>
                    <button onClick={() => setDeleteTarget(b)} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
        <span>Showing 1 to {Math.min(filtered.length, 3)} of {filtered.length} entries</span>
        <div className="flex items-center gap-2">
          <button className="rounded border border-gray-200 bg-white px-3 py-1.5 text-gray-500 hover:bg-gray-50">Previous</button>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-white">1</button>
          <button className="rounded border border-gray-200 bg-white px-3 py-1.5 text-gray-500 hover:bg-gray-50">Next</button>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-red-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-700">Confirm Delete</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-700"><Icons.X /></button>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-800">{deleteTarget.title}</span>?
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => handleDeleteBook(deleteTarget.id)} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors">Delete</button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminStudents() {
  const [students, setStudents] = useState(() => readPersistedState(PERSISTED_STUDENTS_KEY, adminStudents))

  useEffect(() => {
    savePersistedState(PERSISTED_STUDENTS_KEY, students)
  }, [students])

  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<typeof adminStudents[number] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<typeof adminStudents[number] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    student_code: '',
    name: '',
    course: 'BSCS',
    card: '',
    email: '',
    status: 'active' as StudentStatus,
  })

  const filtered = students.filter((s) => {
    const q = query.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.card.toLowerCase().includes(q)
  })

  function openCreateForm() {
    setEditingId(null)
    setForm({ student_code: '', name: '', course: 'BSCS', card: '', email: '', status: 'active' as StudentStatus })
    setShowForm(true)
    setMessage(null)
  }

  function openEditForm(student: typeof adminStudents[number]) {
    setEditingId(student.id)
    setForm({
      student_code: student.id,
      name: student.name,
      course: student.course,
      card: student.card,
      email: student.email,
      status: student.status as StudentStatus,
    })
    setShowForm(true)
    setMessage(null)
  }

  async function handleSaveStudent() {
    const trimmed = {
      student_code: form.student_code.trim(),
      name: form.name.trim(),
      course: form.course.trim(),
      card: form.card.trim(),
      email: form.email.trim(),
      status: form.status,
    }

    if (!trimmed.student_code || !trimmed.name || !trimmed.email) {
      setMessage('Student ID, name, and email are required.')
      return
    }

    let tempId: string | null = null
    try {
      setSaving(true)
      setMessage(null)

      // optimistic create: add a temp entry so the UI doesn't lose the new student
      tempId = `tmp-${Date.now()}`
      const tempItem = {
        id: tempId,
        name: trimmed.name,
        course: trimmed.course,
        card: trimmed.card || 'LC-NEW',
        email: trimmed.email,
        status: trimmed.status,
      }
      console.debug('Creating optimistic student entry', tempItem)
      setStudents((cur) => mergeRecords(cur, [tempItem]))

      const saved = await upsertStudent({
        id: editingId ?? undefined,
        student_code: trimmed.student_code,
        name: trimmed.name,
        email: trimmed.email,
        course: trimmed.course,
        status: trimmed.status,
      } as any)

      console.debug('upsertStudent returned', saved)

      // The admin student form does not collect a password here, so do not create a login account
      // with a hardcoded fallback. A real password must be supplied in a dedicated student-signup flow.

      // replace optimistic entry with saved DB row, and remove duplicates
      setStudents((current) => mergeRecords(current, [{
        id: saved.id ?? trimmed.student_code,
        name: saved.name,
        course: saved.course,
        card: trimmed.card || 'LC-NEW',
        email: saved.email,
        status: saved.status ?? trimmed.status,
      }]))

      setShowForm(false)
      setEditingId(null)
      setForm({ student_code: '', name: '', course: 'BSCS', card: '', email: '', status: 'active' as StudentStatus })
      setMessage('Student saved successfully.')
    } catch (err: any) {
      console.error('Failed to save student', err)
      // remove optimistic entry if present
      if (tempId) setStudents((cur) => cur.filter((s) => s.id !== tempId))
      setMessage(err?.message || 'Unable to save the student.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteStudent(studentId: string) {
    try {
      await deleteStudent(studentId)
      setStudents((current) => current.filter((s) => s.id !== studentId))
      setMessage('Student deleted.')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to delete the student.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader title="Student Management" subtitle="View and manage registered library students." />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-4xl rounded-2xl border border-green-200 bg-white p-6 shadow-2xl shadow-green-900/10">
            <div className="mb-6 flex items-center justify-between border-b border-green-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Student record</p>
                <h3 className="text-2xl font-bold text-green-900">{editingId ? 'Edit Student' : 'Add Student'}</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700">
                <Icons.X />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Student ID</label>
                <input value={form.student_code} onChange={(e) => setForm({ ...form, student_code: e.target.value })} placeholder="STU-2024-010" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Full name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane.doe@college.edu" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Card No.</label>
                <input value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value })} placeholder="LC-0105" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Course</label>
                <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100">
                  {['BSCS', 'BSIT', 'BSECE', 'BSME', 'BSIS'].map((course) => <option key={course}>{course}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-green-100 pt-5">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveStudent} disabled={saving} className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Student' : 'Save Student'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input
            type="text"
            placeholder="Search students..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />
          Add Student
        </button>
      </div>
      <Table headers={['Student ID', 'Name', 'Course', 'Card No.', 'Email', 'Status', 'Actions']}>
        {filtered.map((s) => (
          <Tr key={s.id}>
            <Td className="font-mono text-xs text-gray-400">{s.id}</Td>
            <Td className="font-medium text-gray-900">{s.name}</Td>
            <Td>{s.course}</Td>
            <Td className="font-mono text-xs text-green-700 font-semibold">{s.card}</Td>
            <Td>{s.email}</Td>
            <Td><StatusBadge status={s.status} /></Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setSelected(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Icons.Eye /></button>
                <button onClick={() => openEditForm(s)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Icons.Edit /></button>
                <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-2xl shadow-red-900/10">
            <div className="mb-5 flex items-center justify-between border-b border-red-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Confirmation</p>
                <h3 className="text-2xl font-bold text-red-700">Delete Student</h3>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"><Icons.X /></button>
            </div>
            <p className="text-sm leading-6 text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-800">{deleteTarget.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-red-100 pt-5">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDeleteStudent(deleteTarget.id)} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-6 shadow-2xl shadow-green-900/10">
            <div className="mb-5 flex items-center justify-between border-b border-green-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Profile</p>
                <h3 className="text-2xl font-bold text-green-900">Student Details</h3>
              </div>
              <button onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"><Icons.X /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2"><span className="text-gray-500">Student ID</span><span className="font-mono font-semibold text-gray-800">{selected.id}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-500">Name</span><span className="font-medium text-gray-800">{selected.name}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-500">Course</span><span className="text-gray-800">{selected.course}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-500">Card No.</span><span className="font-mono text-green-700 font-semibold">{selected.card}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-500">Email</span><span className="text-gray-800">{selected.email}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-500">Status</span><span><StatusBadge status={selected.status} /></span></div>
            </div>
            <button onClick={() => setSelected(null)} className="mt-6 w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminUsers() {
  const { data: usersRt } = useSupabaseRealtime('student_login_accounts')
  const [users, setUsers] = useState(() => [])
  const [studentMap, setStudentMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const syncUsers = async () => {
      try {
        const { data: rows, error } = await supabase.from('student_login_accounts').select('*')
        if (error) {
          console.error('[AdminUsers] direct fetch failed', error)
          return
        }

        const mapped = (rows ?? []).map((u: any) => ({
          id: u.id,
          email: u.student_id ?? u.student_code ?? '',
          password: u.password_hash ?? '',
          role: 'student',
          studentId: u.student_id ?? null,
          studentCode: u.student_code ?? null,
          fullName: u.full_name ?? '',
          course: u.course ?? '',
          yearLevel: u.year_level ?? '',
          status: u.status ?? 'active',
        }))

        setUsers(mapped)
      } catch (err) {
        console.error('[AdminUsers] direct fetch error', err)
      }
    }

    syncUsers()
  }, [])

  useEffect(() => {
    if (!usersRt || usersRt.length === 0) return

    const mapped = (usersRt ?? []).map((u: any) => ({
      id: u.id,
      email: u.studentId ?? u.studentCode ?? '',
      password: u.passwordHash ?? '',
      role: 'student',
      studentId: u.studentId ?? null,
      studentCode: u.studentCode ?? null,
      fullName: u.fullName ?? '',
      course: u.course ?? '',
      yearLevel: u.yearLevel ?? '',
      status: u.status ?? 'active',
    }))

    setUsers(mapped)
  }, [usersRt])

  // The live app uses student_login_accounts as the student source of truth.
  // Keep the display local and avoid querying legacy students rows that do not exist.
  useEffect(() => {
    setStudentMap({})
  }, [users])

  return (
    <div>
      <PageHeader title="Users" subtitle="Student login accounts (student_login_accounts table)" />
      <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm">
        <Table headers={["Row ID", "Full Name", "Student ID", "Student Code", "Course", "Year Level", "Status"]}>
          {users.map((u: any) => (
            <Tr key={u.id}>
              <Td className="font-mono text-xs">{u.id}</Td>
              <Td>{u.fullName || '—'}</Td>
              <Td className="font-mono text-xs">{u.studentId ?? 'NULL'}</Td>
              <Td className="font-mono text-xs">{u.studentCode ? (studentMap[u.studentCode] ?? u.studentCode) : 'NULL'}</Td>
              <Td>{u.course || '—'}</Td>
              <Td>{u.yearLevel || '—'}</Td>
              <Td><StatusBadge status={u.status || 'active'} /></Td>
            </Tr>
          ))}
        </Table>
      </div>
    </div>
  )
}

function AdminBorrowingRecords() {
  const [query, setQuery] = useState('')
  const { data: borrowRows, loading: borrowLoading } = useSupabaseRealtime('borrowing_records')
  const { data: bookRows, loading: bookLoading } = useSupabaseRealtime('books')
  const [loginRows, setLoginRows] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const pageSize = 10

  useEffect(() => {
    async function loadLoginRows() {
      const { data, error } = await supabase.from('student_login_accounts').select('*').limit(200)
      if (!error) setLoginRows((data ?? []).map((row: any) => mapKeysToCamel(row)))
    }

    void loadLoginRows()
  }, [])

  const rows = (borrowRows ?? []).map((record: any) => {
    const recordStudentId = String(record?.studentId ?? record?.student_id ?? '').trim()
    const recordBookId = String(record?.bookId ?? record?.book_id ?? '').trim()
    const recordTxn = String(record?.txnCode ?? record?.txn_code ?? record?.id ?? '').trim()

    const student = (loginRows ?? []).find((item: any) => {
      const itemId = String(item?.id ?? '').trim()
      const itemStudentId = String(item?.studentId ?? item?.student_id ?? '').trim()
      const itemStudentCode = String(item?.studentCode ?? item?.student_code ?? '').trim()

      return itemId === recordStudentId
        || itemStudentId === recordStudentId
        || itemStudentCode === recordStudentId
        || String(itemId).toLowerCase() === String(recordStudentId).toLowerCase()
        || String(itemStudentId).toLowerCase() === String(recordStudentId).toLowerCase()
        || String(itemStudentCode).toLowerCase() === String(recordStudentId).toLowerCase()
    })

    const book = (bookRows ?? []).find((item: any) => {
      const itemId = String(item?.id ?? '').trim()
      return itemId === recordBookId
    })

    return {
      id: record.id,
      txn: recordTxn || record.id,
      student: student?.fullName ?? student?.full_name ?? student?.studentCode ?? (recordStudentId || 'Unknown student'),
      card: student?.studentCode ?? student?.student_code ?? 'N/A',
      book: book?.title ?? 'Unknown book',
      borrow: record.borrowDate ?? record.borrow_date ?? 'N/A',
      due: record.dueDate ?? record.due_date ?? 'N/A',
      status: record.status ?? 'active',
    }
  })

  const filtered = rows.filter((row) => {
    const q = query.toLowerCase()
    if (!q) return true
    return [row.student, row.book, row.txn].join(' ').toLowerCase().includes(q)
  })

  // sort recent first (by borrow date if available, otherwise by id)
  const sorted = filtered.slice().sort((a: any, b: any) => {
    const aTime = Number.isNaN(Date.parse(String(a.borrow))) ? 0 : Date.parse(String(a.borrow))
    const bTime = Number.isNaN(Date.parse(String(b.borrow))) ? 0 : Date.parse(String(b.borrow))
    if (aTime === bTime) return String(b.id ?? '').localeCompare(String(a.id ?? ''))
    return bTime - aTime
  })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => { setPage(0) }, [query])
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div>
      <PageHeader title="Borrowing Records" subtitle="All active and historical borrowing transactions." />
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student or book..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition max-w-sm"
        />
      </div>

      {borrowLoading ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-6 text-sm text-gray-500">Loading borrowing records…</div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-6 text-sm text-gray-500">No borrowing records found.</div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Showing {Math.min(pageSize, total - page * pageSize)} of {total} records</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} className="px-3 py-1 rounded-md border border-green-200 text-sm text-green-700 disabled:opacity-50">Prev</button>
              <div className="text-sm text-gray-600">Page {page + 1} / {totalPages}</div>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded-md border border-green-200 text-sm text-green-700 disabled:opacity-50">Next</button>
            </div>
          </div>
          <Table headers={['Txn ID', 'Student', 'Card No.', 'Book', 'Borrow Date', 'Due Date', 'Status']}>
            {pageRows.map((r) => (
              <Tr key={r.id ?? r.txn}>
                <Td className="font-mono text-xs text-gray-400">{r.txn}</Td>
                <Td className="font-medium text-gray-900">{r.student}</Td>
                <Td className="font-mono text-xs text-green-700">{r.card}</Td>
                <Td>{r.book}</Td>
                <Td>{r.borrow}</Td>
                <Td className={r.status === 'overdue' ? 'text-red-600 font-medium' : r.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>
                  {r.due}
                </Td>
                <Td><StatusBadge status={r.status} /></Td>
              </Tr>
            ))}
          </Table>
        </>
      )}
    </div>
  )
}

function AdminReturns() {
  const { data: borrowRows } = useSupabaseRealtime('borrowing_records')
  const { data: bookRows } = useSupabaseRealtime('books')
  const [loginRows, setLoginRows] = useState<any[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { returnDate: string; remark: string }>>({})

  useEffect(() => {
    async function loadLoginRows() {
      const { data, error } = await supabase.from('student_login_accounts').select('*').limit(200)
      if (!error) setLoginRows((data ?? []).map((row: any) => mapKeysToCamel(row)))
    }

    void loadLoginRows()
  }, [])

  const activeReturns = (borrowRows ?? [])
    .filter((record: any) => String(record?.status ?? '').toLowerCase() === 'return_requested' || (!record.return_date && !(record.status ?? '').toLowerCase().includes('returned')))
    .map((record: any) => {
      const recordStudentId = String(record?.studentId ?? record?.student_id ?? '').trim()
      const student = (loginRows ?? []).find((item: any) => {
        const itemId = String(item?.id ?? '').trim()
        const itemStudentId = String(item?.studentId ?? item?.student_id ?? '').trim()
        const itemStudentCode = String(item?.studentCode ?? item?.student_code ?? '').trim()
        return itemId === recordStudentId || itemStudentId === recordStudentId || itemStudentCode === recordStudentId
      })
      const book = (bookRows ?? []).find((item: any) => String(item?.id ?? '').trim() === String(record?.bookId ?? record?.book_id ?? '').trim())

      const pendingDate = String(record?.return_date ?? record?.returnDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
      const pendingRemark = String(record?.condition ?? '').trim()

      return {
        id: record.id,
        student: student?.fullName ?? student?.full_name ?? student?.studentCode ?? 'Unknown student',
        card: student?.studentCode ?? student?.student_code ?? 'N/A',
        book: book?.title ?? 'Unknown book',
        due: record.dueDate ?? record.due_date ?? 'N/A',
        returnDate: pendingDate,
        remark: pendingRemark,
        status: String(record?.status ?? '').toLowerCase(),
      }
    })

    const otherActiveReturns = activeReturns.filter((r: any) => r.status !== 'return_requested')

    const returnRequests = (borrowRows ?? [])
      .filter((record: any) => String(record?.status ?? '').toLowerCase() === 'return_requested')
      .map((record: any) => {
        const recordStudentId = String(record?.studentId ?? record?.student_id ?? '').trim()
        const student = (loginRows ?? []).find((item: any) => {
          const itemId = String(item?.id ?? '').trim()
          const itemStudentId = String(item?.studentId ?? item?.student_id ?? '').trim()
          const itemStudentCode = String(item?.studentCode ?? item?.student_code ?? '').trim()
          return itemId === recordStudentId || itemStudentId === recordStudentId || itemStudentCode === recordStudentId
        })
        const book = (bookRows ?? []).find((item: any) => String(item?.id ?? '').trim() === String(record?.bookId ?? record?.book_id ?? '').trim())
        return {
          id: record.id,
          student: student?.fullName ?? student?.full_name ?? student?.studentCode ?? 'Unknown student',
          card: student?.studentCode ?? student?.student_code ?? 'N/A',
          book: book?.title ?? 'Unknown book',
          due: record.dueDate ?? record.due_date ?? 'N/A',
          returnDate: record.return_date ?? record.returnDate ?? new Date().toISOString().slice(0, 10),
          remark: record.condition ?? record.condition ?? '',
        }
      })

  async function handleConfirmReturn(recordId: string, returnDate?: string, remark?: string) {
    try {
      setBusyId(recordId)
      setMessage(null)
      await processReturn(recordId, String(returnDate ?? '').trim() || undefined, String(remark ?? '').trim() || undefined)
      setMessage('Return confirmed and inventory updated.')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to confirm this return.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Returns" subtitle="Review active loans and confirm returns from the admin side." />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      {activeReturns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-6 text-sm text-gray-500">No active returns pending confirmation.</div>
      ) : (
        <Table headers={['Student', 'Card No.', 'Book', 'Due Date', 'Return Date', 'Remark', 'Action']}>
          {activeReturns.map((row) => {
            const currentDraft = drafts[row.id] ?? { returnDate: row.returnDate, remark: row.remark }
            return (
              <Tr key={row.id}>
                <Td className="font-medium text-gray-900">{row.student}</Td>
                <Td className="font-mono text-xs text-green-700">{row.card}</Td>
                <Td>{row.book}</Td>
                <Td>{row.due}</Td>
                <Td>
                  <input
                    type="date"
                    value={currentDraft.returnDate}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [String(row.id)]: { ...currentDraft, returnDate: e.target.value } }))}
                    className="w-full min-w-[120px] px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </Td>
                <Td>
                  <input
                    value={currentDraft.remark}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [String(row.id)]: { ...currentDraft, remark: e.target.value } }))}
                    placeholder="Remark"
                    className="w-full min-w-[150px] px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </Td>
                <Td>
                  <button
                    onClick={() => handleConfirmReturn(String(row.id), currentDraft.returnDate, currentDraft.remark)}
                    disabled={busyId === row.id}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    {busyId === row.id ? 'Confirming...' : 'Confirm Return'}
                  </button>
                </Td>
              </Tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}

function AdminOverdueBooks() {
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSendReminder(recordId: string) {
    try {
      setRemindingId(recordId)
      await markReminderSent(recordId)
      setMessage('Reminder sent and recorded.')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to send the reminder.')
    } finally {
      setRemindingId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Overdue Books" subtitle="Students with overdue borrowed books." />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      <Table headers={['Student', 'Email', 'Book', 'Due Date', 'Days Overdue', 'Notified', 'Action']}>
        {overdueRecords.map((r, i) => (
          <Tr key={i}>
            <Td className="font-medium text-gray-900">{r.student}</Td>
            <Td className="text-gray-500">{r.email}</Td>
            <Td>{r.book}</Td>
            <Td className="text-red-600 font-medium">{r.due}</Td>
            <Td>
              <span className="font-bold text-red-600">{r.daysOverdue}</span>
              <span className="text-gray-400 text-xs"> days</span>
            </Td>
            <Td>
              {r.notified
                ? <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><Icons.Check />Sent</span>
                : <span className="text-gray-400 text-xs">Pending</span>}
            </Td>
            <Td>
              <button onClick={() => handleSendReminder(String(i))} disabled={remindingId === String(i)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
                <Icons.Mail />
                {remindingId === String(i) ? 'Sending...' : 'Send Reminder'}
              </button>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function AdminBorrowerCards() {
  const [selected, setSelected] = useState<BorrowEntry | null>(null)
  const allCards: BorrowEntry[] = borrowedBooks
  const studentMap: Record<string, { name: string; id: string; card: string; course: string }> = {}

  return (
    <div>
      <PageHeader title="Borrower Cards" subtitle="View and print individual borrower cards for all active loans." />
      {allCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-8 text-center text-sm text-gray-500">
          No borrower cards available yet.
        </div>
      ) : (
        <>
          <Table headers={['Txn ID', 'Borrower', 'Card No.', 'Book Title', 'Borrow Date', 'Due Date', 'Status', 'Action']}>
            {allCards.map((b) => {
              const key = String(b.id)
              const stu = studentMap[key] ?? { name: 'Student', id: 'N/A', card: 'N/A', course: 'Unassigned' }
              return (
                <Tr key={key}>
                  <Td className="font-mono text-xs text-gray-400">TXN-{String(b.id ?? 'N/A')}</Td>
                  <Td className="font-medium text-gray-900">{stu.name}</Td>
                  <Td className="font-mono text-xs text-green-700 font-semibold">{stu.card}</Td>
                  <Td>{b.title}</Td>
                  <Td>{b.borrowDate}</Td>
                  <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>
                    {b.dueDate}
                  </Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td>
                    <button
                      onClick={() => setSelected(b)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Icons.IdCard />
                      View Card
                    </button>
                  </Td>
                </Tr>
              )
            })}
          </Table>
          {selected && (
            <BorrowerCardSlip
              book={selected}
              studentName={studentMap[String(selected.id)]?.name ?? 'Student'}
              studentId={studentMap[String(selected.id)]?.id ?? 'N/A'}
              cardNo={studentMap[String(selected.id)]?.card ?? 'N/A'}
              course={studentMap[String(selected.id)]?.course ?? 'Unassigned'}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

function AdminLibraryCards() {
  type LibraryCardRow = {
    cardNo: string
    name: string
    studentId: string
    course: string
    issueDate: string
    expiry: string
    status: StudentStatus
  }

  const [cards, setCards] = useState<LibraryCardRow[]>(() =>
    adminStudents.map((s) => ({
      cardNo: s.card,
      name: s.name,
      studentId: s.id,
      course: s.course,
      issueDate: 'Aug 1, 2025',
      expiry: 'Aug 1, 2026',
      status: s.status as StudentStatus,
    }))
  )
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<LibraryCardRow | null>(null)
  const [form, setForm] = useState<LibraryCardRow>({
    cardNo: '',
    name: '',
    studentId: '',
    course: 'BSCS',
    issueDate: 'Aug 1, 2025',
    expiry: 'Aug 1, 2026',
    status: 'active',
  })

  const filteredCards = cards.filter((card) => {
    const q = query.toLowerCase()
    return !q || card.name.toLowerCase().includes(q) || card.cardNo.toLowerCase().includes(q) || card.studentId.toLowerCase().includes(q)
  })

  function openCreateModal() {
    setEditingCard(null)
    setForm({
      cardNo: '',
      name: '',
      studentId: '',
      course: 'BSCS',
      issueDate: 'Aug 1, 2025',
      expiry: 'Aug 1, 2026',
      status: 'active',
    })
    setModalOpen(true)
  }

  function openEditModal(card: LibraryCardRow) {
    setEditingCard(card)
    setForm(card)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingCard(null)
  }

  function handleSubmitCard() {
    const card = {
      cardNo: form.cardNo.trim(),
      name: form.name.trim(),
      studentId: form.studentId.trim(),
      course: form.course.trim(),
      issueDate: form.issueDate.trim(),
      expiry: form.expiry.trim(),
      status: form.status,
    }

    if (!card.cardNo || !card.name || !card.studentId) {
      setMessage('Card number, student name, and student ID are required.')
      return
    }

    setCards((current) => {
      if (editingCard) {
        return current.map((item) =>
          item.cardNo === editingCard.cardNo ? { ...card } : item
        )
      }

      return [card, ...current]
    })

    setMessage(editingCard ? 'Library card updated successfully.' : 'Library card issued successfully.')
    closeModal()
  }

  function handleDeleteCard(cardNo: string) {
    setCards((current) => current.filter((card) => card.cardNo !== cardNo))
    setMessage('Library card deleted successfully.')
  }

  return (
    <div>
      <PageHeader title="Library Cards" subtitle="Manage student library cards." />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      <div className="flex justify-between items-center mb-5">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by card or student..."
            className="pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />Issue Card
        </button>
      </div>
      <Table headers={['Card No.', 'Student', 'Student ID', 'Course', 'Issue Date', 'Expiry', 'Status', 'Actions']}>
        {filteredCards.map((card) => (
          <Tr key={card.cardNo}>
            <Td className="font-mono text-green-700 font-semibold text-sm">{card.cardNo}</Td>
            <Td className="font-medium">{card.name}</Td>
            <Td className="font-mono text-xs text-gray-400">{card.studentId}</Td>
            <Td>{card.course}</Td>
            <Td>{card.issueDate}</Td>
            <Td>{card.expiry}</Td>
            <Td><StatusBadge status={card.status} /></Td>
            <Td>
              <div className="flex gap-1.5">
                <button onClick={() => openEditModal(card)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Icons.Edit /></button>
                <button onClick={() => handleDeleteCard(card.cardNo)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Icons.Trash /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl rounded-2xl border border-green-200 bg-white p-6 shadow-2xl shadow-green-900/10">
            <div className="mb-6 flex items-center justify-between border-b border-green-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Library card</p>
                <h3 className="text-2xl font-bold text-green-900">{editingCard ? 'Edit Library Card' : 'Issue Library Card'}</h3>
              </div>
              <button onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"><Icons.X /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Card No.</label>
                <input value={form.cardNo} onChange={(e) => setForm({ ...form, cardNo: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" placeholder="LC-0105" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Student Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" placeholder="Jane Doe" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Student ID</label>
                <input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" placeholder="STU-2024-010" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Course</label>
                <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100">
                  {['BSCS', 'BSIT', 'BSECE', 'BSME', 'BSIS'].map((course) => <option key={course} value={course}>{course}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Issue Date</label>
                <input value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Expiry</label>
                <input value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-green-100 pt-5">
              <button onClick={closeModal} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmitCard} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700">{editingCard ? 'Update Card' : 'Save Card'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminReports() {
  function handleGenerate(reportName: string) {
    window.alert(`${reportName} generated successfully.`)
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export library activity reports." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Monthly Borrowing Report', desc: 'Summary of all borrowings for the current period', icon: <Icons.BarChart /> },
          { title: 'Overdue Report', desc: 'All overdue books and penalty computations', icon: <Icons.AlertCircle /> },
          { title: 'Book Inventory Report', desc: 'Current stock and availability status', icon: <Icons.Book /> },
          { title: 'Student Activity Report', desc: 'Per-student borrowing and return statistics', icon: <Icons.Users /> },
          { title: 'Popular Books Report', desc: 'Most borrowed books across the collection', icon: <Icons.FileText /> },
          { title: 'Annual Summary Report', desc: 'Full-year library operations summary', icon: <Icons.History /> },
        ].map((r) => (
          <div key={r.title} className="bg-white rounded-xl border border-green-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="text-green-600">{r.icon}</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
            </div>
            <button onClick={() => handleGenerate(r.title)} className="mt-auto py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
              Generate PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminSettings() {
  const [form, setForm] = useState({
    library_name: 'Campus Library',
    borrow_period_days: '14',
    max_books_per_student: '3',
    fine_per_day: '5.00',
    admin_email: 'admin@library.local',
  })
  const [announcementForm, setAnnouncementForm] = useState({ title: '', text: '' })
  const [announcementList, setAnnouncementList] = useState<LibraryAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setAnnouncementList(readPersistedState<LibraryAnnouncement[]>(ANNOUNCEMENTS_KEY, []))
    fetchSettings()
      .then((settings) => {
        setForm({
          library_name: settings.library_name ?? 'Campus Library',
          borrow_period_days: String(settings.borrow_period_days ?? 14),
          max_books_per_student: String(settings.max_books_per_student ?? 3),
          fine_per_day: String(settings.fine_per_day ?? 5),
          admin_email: settings.admin_email ?? 'admin@library.local',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveSettings() {
    try {
      setSaving(true)
      setMessage(null)
      await saveSettings({
        library_name: form.library_name,
        borrow_period_days: Number(form.borrow_period_days) || 14,
        max_books_per_student: Number(form.max_books_per_student) || 3,
        fine_per_day: Number(form.fine_per_day) || 5,
        admin_email: form.admin_email,
      })
      setMessage('Library settings saved to the database.')
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAnnouncement() {
    const title = announcementForm.title.trim()
    const text = announcementForm.text.trim()
    if (!title || !text) return

    const next = [
      {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `announcement-${Date.now()}`,
        title,
        date: new Date().toISOString().slice(0, 10),
        text,
      },
      ...announcementList,
    ]

    setAnnouncementList(next)
    await saveAnnouncements(next)
    window.dispatchEvent(new Event('lms-announcements-updated'))
    setAnnouncementForm({ title: '', text: '' })
    setMessage('Library announcement added.')
  }

  async function handleDeleteAnnouncement(id: string) {
    const deletedFromDb = await deleteAnnouncement(id)
    const next = announcementList.filter((item) => item.id !== id)
    setAnnouncementList(next)
    await saveAnnouncements(next)
    if (deletedFromDb) {
      window.dispatchEvent(new Event('lms-announcements-updated'))
      return
    }
    window.dispatchEvent(new Event('lms-announcements-updated'))
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure library system settings." />
      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6">
          <div className="flex flex-col gap-5">
            {[
              { label: 'Library Name', key: 'library_name' },
              { label: 'Borrow Period (days)', key: 'borrow_period_days' },
              { label: 'Max Books Per Student', key: 'max_books_per_student' },
              { label: 'Fine Per Day (₱)', key: 'fine_per_day' },
              { label: 'Admin Email', key: 'admin_email' },
            ].map(({ label, key }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition disabled:opacity-60"
                />
              </div>
            ))}
            <button onClick={handleSaveSettings} disabled={saving || loading} className="mt-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {message && <div className="text-sm text-green-700">{message}</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-green-900 mb-4">Library Announcements</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</label>
              <input
                type="text"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                placeholder="New library notice"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</label>
              <textarea
                value={announcementForm.text}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, text: e.target.value })}
                className="w-full min-h-[100px] px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                placeholder="Write the announcement here..."
              />
            </div>

            <button onClick={handleAddAnnouncement} className="py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
              Add Announcement
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {announcementList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-green-200 bg-green-50 p-3 text-sm text-gray-500">No announcements yet.</div>
            ) : (
              announcementList.map((item) => (
                <div key={item.id} className="rounded-lg border border-green-100 bg-green-50/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-green-900">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.date}</div>
                    </div>
                    <button onClick={() => handleDeleteAnnouncement(item.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">{item.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Student Layout ────────────────────────────────────────────────────────────
function StudentLayout({ onLogout, studentId, userProfile }: { onLogout: () => void; studentId?: string; userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string } }) {
  const [view, setView] = useState<StudentView>('dashboard')

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard /> },
    { id: 'search', label: 'Search Books', icon: <Icons.Search /> },
    { id: 'borrowed', label: 'My Borrowed Books', icon: <Icons.Book /> },
    { id: 'history', label: 'Borrowing History', icon: <Icons.History /> },
    { id: 'borrower-card', label: 'Borrower Card', icon: <Icons.FileText /> },
    { id: 'card', label: 'Library Card', icon: <Icons.IdCard /> },
    { id: 'profile', label: 'Profile', icon: <Icons.User /> },
  ]

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <StudentDashboard onNavigate={setView} userProfile={userProfile} />
      case 'search': return <SearchBooks studentId={studentId} userProfile={userProfile} />
      case 'borrowed': return <MyBorrowedBooks userProfile={userProfile} />
      case 'history': return <BorrowingHistory userProfile={userProfile} />
      case 'borrower-card': return <StudentBorrowerCard userProfile={userProfile} />
      case 'card': return <LibraryCard userProfile={userProfile} />
      case 'profile': return <Profile userProfile={userProfile} />
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col app-root lg:flex-row">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as StudentView)}
        onLogout={onLogout}
        title="Student Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="w-full p-4 sm:p-6 lg:p-8">{renderView()}</div>
      </main>
    </div>
  )
}

// ─── Admin Layout ──────────────────────────────────────────────────────────────
function AdminLayout({ onLogout, dashboard }: { onLogout: () => void; dashboard?: any | null }) {
  const [view, setView] = useState<AdminView>('dashboard')

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard /> },
    { id: 'books', label: 'Books', icon: <Icons.Book /> },
    { id: 'app-users', label: 'Users', icon: <Icons.Users /> },
    { id: 'library-cards', label: 'Library Cards', icon: <Icons.IdCard /> },
    { id: 'borrower-cards', label: 'Borrower Cards', icon: <Icons.Book /> },
    { id: 'borrowing-records', label: 'Borrowing Records', icon: <Icons.FileText /> },
    { id: 'returns', label: 'Returns', icon: <Icons.RefreshCw /> },
    { id: 'overdue', label: 'Overdue Books', icon: <Icons.AlertCircle /> },
    { id: 'reports', label: 'Reports', icon: <Icons.BarChart /> },
    { id: 'settings', label: 'Settings', icon: <Icons.Settings /> },
  ]

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <AdminDashboard dashboard={dashboard} />
      case 'books': return <AdminBooks />
      case 'app-users': return <AdminUsers />
      case 'library-cards': return <AdminLibraryCards />
      case 'borrower-cards': return <AdminBorrowerCards />
      case 'borrowing-records': return <AdminBorrowingRecords />
      case 'returns': return <AdminReturns />
      case 'overdue': return <AdminOverdueBooks />
      case 'reports': return <AdminReports />
      case 'settings': return <AdminSettings />
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col app-root lg:flex-row">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as AdminView)}
        onLogout={onLogout}
        title="Librarian Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="w-full p-4 sm:p-6 lg:p-8">{renderView()}</div>
      </main>
    </div>
  )
}

function AdminDashboard({ dashboard }: { dashboard?: any | null }) {
  const stats = dashboard?.stats ?? null
  const recent = dashboard?.records ?? borrowingRecords
  const overdue = dashboard?.overdue ?? overdueRecords

  const [recentRecords, setRecentRecords] = useState<Array<any>>(recent?.slice(0, 10) ?? [])
  const [page, setPage] = useState<number>(0)
  const pageSize = 10
  const [totalCount, setTotalCount] = useState<number>(0)

  useEffect(() => {
    let active = true

    async function loadRecent() {
      try {
        // If dashboard provided recent records use them (with pagination), otherwise fetch from Supabase
        if (dashboard?.records && Array.isArray(dashboard.records) && dashboard.records.length >= 0) {
          const total = dashboard.records.length
          const start = page * pageSize
          const end = start + pageSize
          if (active) {
            setRecentRecords(dashboard.records.slice(start, end))
            setTotalCount(total)
          }
          return
        }

        const start = page * pageSize
        const end = start + pageSize - 1
        const { data: borrowRows, error: borrowErr, count } = await supabase
          .from('borrowing_records')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(start, end)

        if (borrowErr) throw borrowErr
        if (!borrowRows || borrowRows.length === 0) {
          if (active) setRecentRecords([])
          if (active) setTotalCount(count ?? 0)
          return
        }

        const studentIds = [...new Set(borrowRows.map((r: any) => String(r.student_id ?? '').trim()).filter(Boolean))]
        const bookIds = [...new Set(borrowRows.map((r: any) => String(r.book_id ?? '').trim()).filter(Boolean))]

        const { data: studentRows } = studentIds.length > 0 ? await supabase.from('students').select('id, name').in('id', studentIds) : { data: [] }
        const { data: bookRows } = bookIds.length > 0 ? await supabase.from('books').select('id, title').in('id', bookIds) : { data: [] }
        const { data: loginRowsByStudentId } = studentIds.length > 0 ? await supabase.from('student_login_accounts').select('id, student_id, student_code, full_name').in('student_id', studentIds) : { data: [] }
        const { data: loginRowsById } = studentIds.length > 0 ? await supabase.from('student_login_accounts').select('id, student_id, student_code, full_name').in('id', studentIds) : { data: [] }

        const loginRows = [...(loginRowsByStudentId ?? []), ...(loginRowsById ?? [])]

        const studentMap = new Map((studentRows ?? []).map((s: any) => [String(s.id ?? '').trim(), s]))
        const loginMap = new Map()
        ;(loginRows || []).forEach((l: any) => {
          if (l?.student_id) loginMap.set(String(l.student_id).trim(), l)
          if (l?.id) loginMap.set(String(l.id).trim(), l)
          if (l?.student_code) loginMap.set(String(l.student_code).trim(), l)
        })
        const bookMap = new Map((bookRows ?? []).map((b: any) => [String(b.id ?? '').trim(), b]))

        const mapped = (borrowRows || []).map((r: any) => ({
          id: r.id,
          txn: r.txn_code ?? r.id,
          student: (studentMap.get(String(r.student_id ?? '').trim())?.name) ?? (loginMap.get(String(r.student_id ?? '').trim())?.full_name) ?? String(r.student_id ?? '').slice(0, 8),
          book: (bookMap.get(String(r.book_id ?? '').trim())?.title) ?? String(r.book_id ?? '').slice(0, 8),
          due: r.due_date ?? r.dueDate ?? 'N/A',
          status: (r.status ?? 'active').toLowerCase(),
        }))

        if (active) {
          setRecentRecords(mapped)
          setTotalCount(count ?? 0)
        }
      } catch (err) {
        console.warn('Unable to load recent borrowing records', err)
        if (active) setRecentRecords([])
        if (active) setTotalCount(0)
      }
    }

    void loadRecent()
    return () => { active = false }
  }, [dashboard, page])

  const totalBooks = stats?.totalBooks ?? 0
  const availableBooks = stats?.availableBooks ?? 0
  const borrowedBooks = stats?.borrowedBooks ?? 0
  const overdueBooks = stats?.overdueBooks ?? overdue.length
  const totalStudents = stats?.totalStudents ?? 0
  const thisMonthTx = stats?.thisMonthTx ?? 0

  const monthlyBorrowings = stats?.monthlyBorrowings ?? []
  const categoryCounts = stats?.categoryCounts ?? []

  const maxMonth = monthlyBorrowings.length > 0 ? Math.max(...monthlyBorrowings, 1) : 1

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-green-900">Admin Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Library overview</p>
        </div>
        <div className="text-sm text-gray-400">Live data</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Books</div>
            <div className="mt-2 text-2xl font-bold text-green-800">{totalBooks}</div>
            <div className="text-xs text-gray-400 mt-1">{totalBooks > 0 ? 'titles in stock' : 'no data yet'}</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Available Books</div>
            <div className="mt-2 text-2xl font-bold text-green-700">{availableBooks}</div>
            <div className="text-xs text-gray-400 mt-1">{totalBooks > 0 ? `${Math.round((availableBooks / Math.max(totalBooks, 1)) * 100)}% available` : 'waiting for data'}</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Borrowed Books</div>
            <div className="mt-2 text-2xl font-bold text-blue-600">{borrowedBooks}</div>
            <div className="text-xs text-gray-400 mt-1">currently on loan</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Overdue Books</div>
            <div className="mt-2 text-2xl font-bold text-red-600">{overdueBooks}</div>
            <div className="text-xs text-gray-400 mt-1">require attention</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Students</div>
            <div className="mt-2 text-2xl font-bold text-indigo-600">{totalStudents}</div>
            <div className="text-xs text-gray-400 mt-1">{totalStudents > 0 ? 'registered users' : 'no data yet'}</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">This Month</div>
            <div className="mt-2 text-2xl font-bold text-green-600">{thisMonthTx}</div>
            <div className="text-xs text-gray-400 mt-1">transactions</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Monthly Borrowings</h3>
              <div className="text-sm text-gray-400">{monthlyBorrowings.length > 0 ? 'Live trend' : 'No data yet'}</div>
            </div>

            {monthlyBorrowings.length > 0 ? (
              <div className="grid grid-cols-6 gap-3 items-end h-36">
                {monthlyBorrowings.map((v: number, i: number) => {
                  const height = Math.round((v / maxMonth) * 100)
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-full flex items-end">
                        <div className="w-full rounded-t-md bg-green-600" style={{ height: `${height}%` }} />
                      </div>
                      <div className="text-xs text-gray-500">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i] ?? `M${i + 1}`}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-green-200 bg-green-50 text-sm text-gray-500">
                No borrowing data available yet.
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Recent Borrowing Records</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} className="px-3 py-1 rounded-md border border-green-200 text-sm text-green-700 disabled:opacity-50">Prev</button>
                <div className="text-sm text-gray-600">Page {page + 1} / {Math.max(1, Math.ceil((totalCount || 0) / pageSize))}</div>
                <button onClick={() => setPage((p) => Math.min(Math.max(0, Math.ceil((totalCount || 0) / pageSize) - 1), p + 1))} disabled={(page + 1) * pageSize >= (totalCount || 0)} className="px-3 py-1 rounded-md border border-green-200 text-sm text-green-700 disabled:opacity-50">Next</button>
                <button onClick={() => {/* view all placeholder - can navigate to records page */}} className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">View all <Icons.ChevronRight /></button>
              </div>
            </div>
            <Table headers={["Student", "Book", "Due Date", "Status"]}>
              {recentRecords.slice(0, 6).map((r: any, idx: number) => (
                <Tr key={r.txn ?? r.id ?? idx}>
                  <Td className="font-medium">{r.student}</Td>
                  <Td className="text-gray-500 text-xs">{r.book}</Td>
                  <Td>{r.due}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                </Tr>
              ))}
            </Table>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Books by Category</h3>
              <div className="text-xs text-gray-400">{categoryCounts.length > 0 ? `${categoryCounts.reduce((sum: number, c: any) => sum + (Number(c.count) || 0), 0)} titles` : 'No data yet'}</div>
            </div>
            {categoryCounts.length > 0 ? (
              <div className="space-y-3">
                {categoryCounts.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">{c.name}</div>
                    <div className="w-36 bg-green-50 rounded-full h-3 overflow-hidden">
                      <div className="h-3 bg-green-600" style={{ width: `${Math.min(100, (Number(c.count) / Math.max(categoryCounts[0]?.count || 1, 1)) * 100)}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{c.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-green-200 bg-green-50 p-4 text-sm text-gray-500">
                Category data will appear here after books are loaded.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm mb-4">
            <h3 className="text-base font-semibold text-green-900 mb-3">Recent Activity</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="text-gray-500">No recent activity.</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-green-900 mb-3">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button className="flex items-center gap-2 py-2.5 px-3 bg-green-600 text-white rounded-lg"> <Icons.Plus /> Add New Book</button>
              <button className="flex items-center gap-2 py-2.5 px-3 bg-green-800 text-white rounded-lg"> <Icons.User /> Add Student</button>
              <button className="flex items-center gap-2 py-2.5 px-3 border border-green-200 text-green-700 rounded-lg"> <Icons.RefreshCw /> Process Return</button>
              <button className="flex items-center gap-2 py-2.5 px-3 bg-red-500 text-white rounded-lg"> <Icons.AlertCircle /> View Overdue</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Root App ───────────────────────────────────────────────────────────────
type AuthState = {
  role: Role
  userId?: string
  studentId?: string
  email?: string
  name?: string
  studentCode?: string
  course?: string
  card?: string
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [dashboard, setDashboard] = useState<any | null>(null)

  // The live project uses the custom student_login_accounts flow.
  // Do not trigger the legacy students/library_cards sync because those tables are not present.
  useEffect(() => {
    startAuthSync()
  }, [])

  async function handleLogin(role: Role, email: string, password: string) {
    const res = await login(email, password, role)
    const student = res.student ?? null
    const card = res.card ?? null
    const effectiveStudentCode = res.user?.student_code ?? student?.student_code ?? res.user?.student_id ?? email
    const effectiveStudentId = res.user?.student_id ?? effectiveStudentCode
    const derivedCard = card?.card_no ?? (effectiveStudentCode ? `CARD-${String(effectiveStudentCode).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) || 'STUDENT'}` : 'N/A')

    setAuth({
      role,
      userId: res.user?.id,
      studentId: effectiveStudentId,
      email: res.user?.email ?? email,
      name: student?.name ?? res.user?.full_name ?? res.user?.email?.split('@')[0] ?? 'Student',
      studentCode: effectiveStudentCode,
      course: student?.course ?? res.user?.course ?? 'Unassigned',
      card: derivedCard,
    })
  }

  useEffect(() => {
    if (!auth) return

    if (auth.role === 'admin') {
      loadDashboardData().then((d) => setDashboard(d)).catch(() => { })
    }

    if (auth.role === 'student') {
      const studentLookupKey = auth.studentCode ?? auth.studentId ?? auth.email ?? ''
      if (studentLookupKey) {
        fetchStudentBorrowingRecords(studentLookupKey).then(() => { }).catch(() => { })
      }
    }
  }, [auth])

  if (!auth) return <LoginPage onLogin={handleLogin} />
  if (auth.role === 'student') return <StudentLayout onLogout={() => setAuth(null)} studentId={auth.studentId} userProfile={{ name: auth.name, studentId: auth.studentCode ?? auth.studentId, email: auth.email, course: auth.course, card: auth.card, studentCode: auth.studentCode }} />
  return <AdminLayout onLogout={() => setAuth(null)} dashboard={dashboard} />
}
