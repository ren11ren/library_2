import { useState, useEffect, useRef, type ReactNode } from 'react'
import MobileDashboard from './mobile/StudentMobileDashboard'
import TopHeader from './components/TopHeader'
import MobileSidebar from './components/MobileSidebar'
import useIsMobile from './hooks/useIsMobile'
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

// ─── Mobile Bottom Navigation Component ──────────────────────────────────────
function MobileNav({ items, active, onSelect }: { items: { id: string; label: string; icon: ReactNode }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="mobile-bottom-nav hide-on-desktop show-on-mobile" role="navigation" aria-label="Primary mobile navigation">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onSelect(it.id)}
          aria-label={it.label}
          className={`touch-target ${active === it.id ? 'active' : ''}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 20 }}>{it.icon}</div>
            <div style={{ fontSize: 10, color: 'inherit' }}>{it.label}</div>
          </div>
        </button>
      ))}
    </nav>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const libraryClassificationCategories = [
  'All',
  'Q - Science',
  'Computer Science',
  'Database',
  'J - Political Science',
  'Software Engineering',
  'Mathematics',
  'History',
  'Literature',
  'Arts',
  'Education',
  'Law',
  'Medicine',
  'Agriculture',
  'Technology',
  'General Works',
  'Philosophy',
  'Geography',
  'Social Sciences',
  'Music',
  'Fine Arts',
  'Language and Literature',
  'Military Science',
  'Naval Science',
  'Bibliography',
]

function normalizeCategoryName(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const withoutDetails = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return withoutDetails || raw
}

function buildCategoryOptions(books: Array<{ category?: string | null }> = []): string[] {
  const categorySet = new Set<string>()

  libraryClassificationCategories.forEach((category) => categorySet.add(category))

  books.forEach((book) => {
    const category = normalizeCategoryName(book?.category)
    if (category) categorySet.add(category)
  })

  return Array.from(categorySet)
}

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

  if (Number.isFinite(explicitAvailable) && explicitAvailable >= 0) {
    if (explicitAvailable > 0) return Math.max(0, Math.min(explicitAvailable, totalCopies))
    if (totalCopies > 0) return totalCopies
  }

  const activeBorrowCount = (borrowRows ?? []).filter((row: any) => {
    const matchesBook = String(row?.book_id ?? row?.bookId ?? '').trim() === String(book?.id ?? '').trim()
    const isActive = !row?.return_date && String(row?.status ?? '').toLowerCase() !== 'returned'
    return matchesBook && isActive
  }).length

  return Math.max(0, totalCopies - activeBorrowCount)
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
    'return_requested': { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700' },
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
                      id,
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
    <aside className="sidebar-minimal hidden lg:flex flex-col lg:w-64 lg:min-h-screen lg:shrink-0">
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

async function fetchStudentBorrowingLog(studentKey?: string): Promise<Array<{ book: string; author: string; borrowDate: string; returnDate: string; status: string; cover_url?: string | null }>> {
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

    const { data: studentRows, error: studentError } = await supabase.from('students').select('*').limit(200)
    if (studentError) throw studentError

    const studentRow = (studentRows ?? []).find((student: any) => {
      const safeStudentCode = String(student?.student_code ?? '').trim().toUpperCase()
      const safeStudentId = String(student?.id ?? '').trim().toUpperCase()
      const safeLoginCode = String(loginRow?.student_code ?? loginRow?.student_id ?? '').trim().toUpperCase()
      const safeLoginId = String(loginRow?.id ?? '').trim().toUpperCase()
      const safeEmail = String(loginRow?.email ?? '').trim().toLowerCase()
      return safeStudentCode === safeLoginCode || safeStudentId === safeLoginId || String(student?.email ?? '').trim().toLowerCase() === safeEmail
    }) ?? null

    const targetStudentId = String(studentRow?.id ?? loginRow?.id ?? '').trim()
    if (!targetStudentId) return []

    const { data: recordRows, error: recordError } = await supabase
      .from('borrowing_records')
      .select('*')
      .eq('student_id', targetStudentId)
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
        cover_url: book?.cover_url ?? book?.coverUrl ?? null,
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
  const [dueReminderOpen, setDueReminderOpen] = useState(false)

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
            cover_url: row.cover_url ?? row.coverUrl ?? null,
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
  const dueReminderBooks = rows.filter((row) => row.status === 'due-soon' || row.status === 'overdue')
  const borrowLimit = 5
  const currentlyBorrowed = rows.length
  const borrowProgress = Math.min((currentlyBorrowed / borrowLimit) * 100, 100)
  const nextDue = [...rows].filter((row) => row.dueDate).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null

  useEffect(() => {
    if (dueReminderBooks.length > 0) {
      setDueReminderOpen(true)
    }
  }, [dueReminderBooks.length])

  const fines = rows.reduce((sum, row) => {
    if (row.status !== 'overdue' || !row.dueDate) return sum
    const due = new Date(`${row.dueDate}T00:00:00`)
    const diffDays = Math.max(0, Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)))
    return sum + diffDays * 5
  }, 0)

  return (
    <div>
      {dueReminderOpen && dueReminderBooks.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-700">
                  <Icons.AlertCircle />
                  <span className="text-lg font-bold">Due Date Reminder</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Some of your borrowed books are due soon or already overdue.</p>
              </div>
              <button type="button" onClick={() => setDueReminderOpen(false)} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">Close</button>
            </div>

            <div className="mt-4 space-y-3">
              {dueReminderBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{book.title}</div>
                    <div className="text-xs text-slate-500">Due: {book.dueDate || 'N/A'}</div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${book.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {book.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setDueReminderOpen(false)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                I understand
              </button>
            </div>
          </div>
        </div>
      )}

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
              <Table headers={["Cover", "Book Title", "Due Date", "Status"]}>
                {rows.map((b) => (
                  <Tr key={b.id}>
                    <Td className="w-20">
                      {(b as any).cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(b as any).cover_url} alt={b.title} className="h-12 w-10 rounded-md border border-gray-200 object-cover shadow-sm" />
                      ) : (
                        <div className="h-12 w-10 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-600">No Cover</div>
                      )}
                    </Td>
                    <Td className="font-medium text-gray-900">{b.title}</Td>
                    <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>{b.dueDate || 'N/A'}</Td>
                    <Td><StatusBadge status={b.status} /></Td>
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
            <div className="text-sm text-gray-500">Borrowing Limit</div>
            <div className="mt-3 flex items-center justify-between text-sm font-medium text-gray-700">
              <span>{currentlyBorrowed}/{borrowLimit}</span>
              <span>{Math.round(borrowProgress)}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-green-100">
              <div className="h-full rounded-full bg-green-600 transition-all duration-300" style={{ width: `${borrowProgress}%` }} />
            </div>
          </div>

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
  const [detailBook, setDetailBook] = useState<any | null>(null)

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
      cover_url: r.coverUrl ?? r.cover_url ?? null,
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
              <tr key={b.id} onClick={() => setDetailBook(b)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailBook(b) } }} className="bg-white hover:bg-green-50/50 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {(b as any).cover_url ? (
                      <img src={(b as any).cover_url} alt={b.title} className="h-12 w-10 rounded-md border border-gray-200 object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-12 w-10 items-center justify-center rounded-md border border-gray-200 bg-gradient-to-br from-sky-50 to-blue-100 text-[9px] font-bold text-blue-700 shadow-sm">
                        {b.title.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'BK'}
                      </div>
                    )}
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

      {detailBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex gap-4">
              <div className="shrink-0">
                {(detailBook as any).cover_url ? (
                  <img src={(detailBook as any).cover_url} alt={detailBook.title} className="h-36 w-28 rounded-md object-cover border" />
                ) : (
                  <div className="h-36 w-28 rounded-md border bg-gray-50 flex items-center justify-center text-sm font-bold">No Cover</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{detailBook.title}</h3>
                <div className="text-sm text-gray-600">{detailBook.author}</div>
                <div className="mt-2 text-sm">ISBN: <span className="font-mono">{detailBook.isbn}</span></div>
                <div className="mt-1 text-sm">Publisher: {detailBook.publisher || '—'}</div>
                <div className="mt-1 text-sm">Category: <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{detailBook.category}</span></div>
                <div className="mt-2 text-sm">Available: <span className="font-medium text-green-700">{detailBook.available} / {detailBook.copies}</span></div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setBorrowModal(detailBook); setDetailBook(null) }} className="rounded-md bg-green-600 px-4 py-2 text-sm text-white">Borrow</button>
                  <button onClick={() => setDetailBook(null)} className="rounded-md border px-4 py-2 text-sm">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <Table headers={['Cover', 'Book Title', 'Author', 'Borrow Date', 'Due Date', 'Status', 'Action']}>
          {rows.map((b) => (
            <Tr key={`${b.studentId ?? 'student'}-${b.id}`}>
              <Td className="w-20">
                {(b as any).cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String((b as any).cover_url)} alt={b.title} className="w-12 h-16 object-cover rounded" />
                ) : (
                  <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-600">No cover</div>
                )}
              </Td>
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
  const [historyRows, setHistoryRows] = useState<Array<{ title: string; author: string; borrowDate: string; returnDate: string; status: string; cover_url?: string | null }>>([])

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
        cover_url: entry.cover_url ?? null,
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
        <Table headers={['Cover', 'Book Title', 'Author', 'Borrow Date', 'Return Date', 'Status']}>
          {historyRows.map((b, i) => (
            <Tr key={`${b.title}-${b.borrowDate}-${i}`}>
              <Td className="w-20">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(b.cover_url)} alt={b.title} className="w-12 h-16 object-cover rounded" />
                ) : (
                  <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-600">No cover</div>
                )}
              </Td>
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

function LibraryCard({ userProfile }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string; avatar_url?: string | null } }) {
  const student = {
    name: userProfile?.name ?? 'Juan Dela Cruz',
    id: userProfile?.studentId ?? userProfile?.studentCode ?? 'N/A',
    course: userProfile?.course ?? 'BSCS 3',
    cardNo: userProfile?.card ?? 'N/A',
    avatar_url: userProfile?.avatar_url ?? null,
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
            <div className="school-logo">SCHOOL<br />LOGO</div>
            <div className="school-name">SAINT JOHN BOSCO COLLEGE OF NORTHERN LUZON, INC.</div>
            <div className="school-department">College Department</div>
            <div className="school-info">Library Department<br />School Library</div>
            <div className="qr">QR CODE</div>
          </div>

          <div className="green-strip"></div>

          <div className="main">
            <div className="title">LIBRARY CARD</div>
            <div className="photo-box">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>PHOTO</span>
              )}
            </div>
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

function Profile({ userProfile, onProfileSave }: { userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string; program?: string; yearLevel?: string; membershipStatus?: string; borrowedBooks?: number; activeHolds?: number; finesDue?: number; avatar_url?: string | null }; onProfileSave?: (nextProfile: any) => void }) {
  const defaults = {
    name: 'Student',
    studentId: 'STU-2024-118',
    email: 'student@example.edu',
    course: 'Computer Science',
    program: 'Computer Science',
    yearLevel: '2nd Year',
    card: 'LIB-284920',
    borrowedBooks: 0,
    activeHolds: 0,
    finesDue: 0,
    membershipStatus: 'Active',
    avatar_url: null,
  }

  const [profile, setProfile] = useState({ ...defaults, ...(userProfile ?? {}) })
  const [originalProfile, setOriginalProfile] = useState({ ...defaults, ...(userProfile ?? {}) })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})
  const [avatarPreview, setAvatarPreview] = useState<string | null>((userProfile as any)?.avatar_url ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    let ignore = false

    async function loadProfileFromSupabase() {
      try {
        const localAuthRaw = window.localStorage.getItem('lms-auth')
        const localAuth = localAuthRaw ? JSON.parse(localAuthRaw) : null
        const lookupCode = String(userProfile?.studentCode ?? userProfile?.studentId ?? localAuth?.studentCode ?? localAuth?.studentId ?? localAuth?.email ?? '').trim()
        const lookupId = String(localAuth?.studentId ?? userProfile?.studentId ?? '').trim()

        const loginLookup = lookupCode || lookupId
        const fallback = { ...defaults, ...(userProfile ?? {}) }

        if (!loginLookup) {
          if (!ignore) {
            setProfile(fallback)
            setOriginalProfile(fallback)
            setAvatarPreview(fallback.avatar_url ?? null)
          }
          return
        }

        let loginRow: any = null
        if (lookupCode || lookupId) {
          const { data, error } = await supabase
            .from('student_login_accounts')
            .select('*')
            .or(`student_code.eq.${lookupCode},student_id.eq.${lookupCode},student_id.eq.${lookupId}`)
            .limit(1)

          if (!error && Array.isArray(data) && data.length > 0) {
            loginRow = data[0]
          }
        }

        let studentRow: any = null
        const studentCode = String(loginRow?.student_code ?? userProfile?.studentCode ?? localAuth?.studentCode ?? '').trim()
        if (studentCode) {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('student_code', studentCode)
            .maybeSingle()

          if (!error) {
            studentRow = data
          }
        }

        const nextProfile = {
          ...defaults,
          ...(userProfile ?? {}),
          name: String(studentRow?.name ?? loginRow?.full_name ?? userProfile?.name ?? localAuth?.name ?? defaults.name).trim() || defaults.name,
          studentId: String(studentRow?.student_code ?? loginRow?.student_code ?? loginRow?.student_id ?? userProfile?.studentId ?? userProfile?.studentCode ?? localAuth?.studentCode ?? defaults.studentId).trim() || defaults.studentId,
          email: String(studentRow?.email ?? loginRow?.email ?? userProfile?.email ?? localAuth?.email ?? defaults.email).trim() || defaults.email,
          course: String(studentRow?.course ?? loginRow?.course ?? userProfile?.course ?? localAuth?.course ?? defaults.course).trim() || defaults.course,
          program: String(studentRow?.course ?? loginRow?.course ?? userProfile?.program ?? userProfile?.course ?? localAuth?.course ?? defaults.program).trim() || defaults.program,
          yearLevel: String(studentRow?.year_level ?? loginRow?.year_level ?? userProfile?.yearLevel ?? localAuth?.yearLevel ?? defaults.yearLevel).trim() || defaults.yearLevel,
          card: String(userProfile?.card ?? localAuth?.card ?? defaults.card).trim() || defaults.card,
          borrowedBooks: Number(userProfile?.borrowedBooks ?? localAuth?.borrowedBooks ?? defaults.borrowedBooks) || 0,
          activeHolds: Number(userProfile?.activeHolds ?? localAuth?.activeHolds ?? defaults.activeHolds) || 0,
          finesDue: Number(userProfile?.finesDue ?? localAuth?.finesDue ?? defaults.finesDue) || 0,
          membershipStatus: String(localAuth?.membershipStatus ?? defaults.membershipStatus).trim() || defaults.membershipStatus,
          avatar_url: studentRow?.avatar_url ?? loginRow?.avatar_url ?? userProfile?.avatar_url ?? localAuth?.avatar_url ?? null,
        }

        if (!ignore) {
          setProfile(nextProfile)
          setOriginalProfile(nextProfile)
          setAvatarPreview(nextProfile.avatar_url ?? null)
        }
      } catch (error: any) {
        console.error('Unable to load profile data from Supabase', error)
        if (!ignore) {
          const fallback = { ...defaults, ...(userProfile ?? {}) }
          setProfile(fallback)
          setOriginalProfile(fallback)
          setAvatarPreview(fallback.avatar_url ?? null)
          setSaveError(error?.message || 'Unable to load profile data.')
        }
      }
    }

    void loadProfileFromSupabase()
    return () => { ignore = true }
  }, [userProfile])

  function handleFieldChange(field: 'name' | 'email' | 'program' | 'yearLevel', value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
    setSaveMessage(null)
    setSaveError(null)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validateProfile() {
    const nextErrors: { name?: string; email?: string } = {}

    if (!profile.name.trim()) {
      nextErrors.name = 'Full name is required.'
    }

    if (!profile.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSaveProfile() {
    if (!validateProfile()) return

    setSaveError(null)
    setSaveMessage(null)
    setSaveState('saving')
    setIsSavingProfile(true)

    try {
      setUploadingAvatar(true)

      const rawLocalAuth = window.localStorage.getItem('lms-auth')
      const localAuth = rawLocalAuth ? JSON.parse(rawLocalAuth) : null
      const candidateStudentCode = String(profile.studentId || userProfile?.studentCode || localAuth?.studentCode || '').trim()
      const candidateStudentId = String(localAuth?.studentId || userProfile?.studentId || '').trim()

      if (!candidateStudentCode && !candidateStudentId) {
        setSaveError('No student record is available to update. Please log in again.')
        setSaveState('idle')
        return
      }

      const isRemoteAvatar = typeof avatarPreview === 'string' && /^(https?:\/\/)/.test(avatarPreview)
      let avatarUrl = isRemoteAvatar ? avatarPreview : (profile.avatar_url ?? null)

      if (avatarFile) {
        const localAvatarUrl = String(avatarPreview ?? profile.avatar_url ?? '').trim()
        if (localAvatarUrl) {
          avatarUrl = localAvatarUrl
        }
        setAvatarFile(null)
      }

      const loginUpdatePayload = {
        full_name: profile.name.trim(),
        course: String(profile.program || profile.course || '').trim() || 'Unassigned',
        year_level: String(profile.yearLevel || '').trim() || '1st Year',
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }

      const exactLoginRows = await supabase.from('student_login_accounts').select('*').limit(200)
      const exactLoginRow = !exactLoginRows.error ? (exactLoginRows.data ?? []).find((row: any) => {
        const rowStudentCode = String(row?.student_code ?? '').trim().toUpperCase()
        const rowStudentId = String(row?.student_id ?? '').trim().toUpperCase()
        const rowEmail = String(row?.email ?? '').trim().toLowerCase()
        const targetCode = String(candidateStudentCode ?? '').trim().toUpperCase()
        const targetId = String(candidateStudentId ?? '').trim().toUpperCase()
        const targetEmail = String(profile.email ?? '').trim().toLowerCase()
        return rowStudentCode === targetCode || rowStudentId === targetId || rowEmail === targetEmail
      }) ?? null : null

      if (exactLoginRow) {
        const { error: loginError } = await supabase
          .from('student_login_accounts')
          .update(loginUpdatePayload)
          .eq('id', exactLoginRow.id)

        if (loginError) {
          console.warn('Unable to update student_login_accounts', loginError)
        }
      }

      const studentUpdatePayload = {
        name: profile.name.trim(),
        email: profile.email.trim(),
        course: String(profile.program || profile.course || '').trim() || null,
        year_level: String(profile.yearLevel || '').trim() || null,
        avatar_url: avatarUrl,
      }

      const exactStudentRows = await supabase.from('students').select('*').limit(200)
      const exactStudentRow = !exactStudentRows.error ? (exactStudentRows.data ?? []).find((row: any) => {
        const rowStudentCode = String(row?.student_code ?? '').trim().toUpperCase()
        const rowStudentId = String(row?.id ?? '').trim().toUpperCase()
        const rowEmail = String(row?.email ?? '').trim().toLowerCase()
        const targetCode = String(candidateStudentCode ?? '').trim().toUpperCase()
        const targetId = String(candidateStudentId ?? '').trim().toUpperCase()
        const targetEmail = String(profile.email ?? '').trim().toLowerCase()
        return rowStudentCode === targetCode || rowStudentId === targetId || rowEmail === targetEmail
      }) ?? null : null

      if (exactStudentRow) {
        const { error: studentUpdateError } = await supabase
          .from('students')
          .update(studentUpdatePayload)
          .eq('id', exactStudentRow.id)

        if (studentUpdateError) {
          console.warn('Unable to update students table', studentUpdateError)
        }
      }

      const nextProfile = {
        ...profile,
        course: profile.program || profile.course,
        program: profile.program || profile.course,
        avatar_url: avatarUrl,
      }

      onProfileSave?.(nextProfile)
      setProfile(nextProfile)
      setOriginalProfile(nextProfile)
      setAvatarPreview(avatarUrl)
      setSaveMessage('Profile updated successfully.')
      setSaveState('saved')
    } catch (error: any) {
      console.error('Profile update failed', error)
      setSaveError(error?.message || 'Unable to save profile changes.')
      setSaveState('idle')
    } finally {
      setUploadingAvatar(false)
      setIsSavingProfile(false)
    }
  }

  function handleReset() {
    setProfile({ ...originalProfile })
    setAvatarPreview(originalProfile.avatar_url ?? null)
    setAvatarFile(null)
    setFieldErrors({})
    setSaveMessage(null)
    setSaveError(null)
    setSaveState('idle')
  }

  async function copyValue(value: string) {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(value)
      setSaveMessage('Copied to clipboard.')
      setSaveError(null)
    } catch {
      setSaveMessage('Copy failed. Please try again.')
      setSaveError(null)
    }
  }

  const initials = (profile.name || 'Student')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'S'

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Manage your account information and library status." />

      <div className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-green-50 via-emerald-50 to-white p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="group relative h-20 w-20 shrink-0">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full rounded-2xl object-cover shadow-md" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-2xl font-bold text-white shadow-md">
                    {initials}
                  </div>
                )}
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900/55 opacity-0 transition group-hover:opacity-100">
                  <div className="flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Upload
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    if (!f) return
                    setAvatarFile(f)
                    const reader = new FileReader()
                    reader.onload = () => setAvatarPreview(String(reader.result))
                    reader.readAsDataURL(f)
                  }} />
                </label>
                {avatarPreview && (
                  <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); setProfile((c) => ({ ...c, avatar_url: undefined })) }} className="absolute -right-2 -bottom-2 rounded-full bg-white p-1 text-xs shadow">Remove</button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">{profile.name}</h2>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    Active
                  </span>
                </div>
                <p className="text-sm text-slate-500">{profile.studentId} · {profile.program || profile.course}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    Verified Student
                  </span>
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Good Standing
                  </span>
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Library Membership Status: {profile.membershipStatus}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-100 ${fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-100 ${fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student ID</label>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-500">
                      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span>{profile.studentId}</span>
                  </div>
                  <button type="button" onClick={() => copyValue(String(profile.studentId))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300">Copy</button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Library Card</label>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-500">
                      <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span>{profile.card}</span>
                  </div>
                  <button type="button" onClick={() => copyValue(String(profile.card))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300">Copy</button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Course / Program</label>
                <select
                  value={profile.program || profile.course}
                  onChange={(e) => handleFieldChange('program', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-100"
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Business Administration">Business Administration</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Education">Education</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year Level</label>
                <select
                  value={profile.yearLevel}
                  onChange={(e) => handleFieldChange('yearLevel', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-100"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="5th Year">5th Year</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleReset} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200">Cancel</button>
              <button type="button" onClick={handleSaveProfile} disabled={isSavingProfile || uploadingAvatar} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-3 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70">
                {isSavingProfile ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save Changes'}
              </button>
            </div>

            {saveMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveMessage}
              </div>
            )}

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Membership</div>
              <div className="mt-3 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Active / Verified Student
              </div>
              <div className="mt-3 text-sm leading-6 text-emerald-900">No overdue fines and borrowing privileges are enabled.</div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Borrowed Books</div>
                <div className="mt-3 text-4xl font-black leading-none text-slate-900">{profile.borrowedBooks}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active Holds</div>
                <div className="mt-3 text-4xl font-black leading-none text-slate-900">{profile.activeHolds}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fines Due</div>
                <div className="mt-3 text-4xl font-black leading-none text-red-600">₱{Number(profile.finesDue).toFixed(2)}</div>
              </div>
            </div>
          </aside>
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
  const categoryOptions = buildCategoryOptions(books)
  const defaultCategory = libraryClassificationCategories.find((category) => category !== 'All') ?? 'Uncategorized'
  const selectedCategoryValue = categoryOptions.includes('Q - Science') ? 'Q - Science' : categoryOptions.find((category) => category !== 'All') ?? 'Uncategorized'

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
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverFileName, setCoverFileName] = useState('No file chosen')
  const [form, setForm] = useState({
    book_code: '',
    title: '',
    author: '',
    isbn: '',
    published_year: '2024',
    category: selectedCategoryValue,
    publisher: '',
    price: '0.00',
    copies: '1',
    damaged: '0',
    lost: '0',
    cover_url: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<typeof adminBooks[number] | null>(null)
  const [historyBook, setHistoryBook] = useState<typeof adminBooks[number] | null>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const filtered = books.filter((b) => {
    const matchQuery = !query || b.title.toLowerCase().includes(query.toLowerCase()) || b.author.toLowerCase().includes(query.toLowerCase())
    const normalizedBookCategory = normalizeCategoryName(b.category)
    const normalizedFilterCategory = normalizeCategoryName(categoryFilter)
    const matchCategory = categoryFilter === 'All'
      || normalizedBookCategory === normalizedFilterCategory
      || (!normalizedBookCategory && normalizedFilterCategory === 'Uncategorized')
      || (normalizedBookCategory && normalizedFilterCategory && normalizedBookCategory.toLowerCase().includes(normalizedFilterCategory.toLowerCase()))
    return matchQuery && matchCategory
  })

  function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setCoverFile(null)
      setCoverPreview(null)
      setCoverFileName('No file chosen')
      setForm((current) => ({ ...current, cover_url: '' }))
      return
    }

    setCoverFile(file)

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
      category: defaultCategory,
      publisher: '',
      price: '0.00',
      copies: '1',
      damaged: '0',
      lost: '0',
      cover_url: '',
    })
    setCoverPreview(null)
    setCoverFile(null)
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
    const selectedBookCategory = normalizeCategoryName(book.category)
    const nextCategory = categoryOptions.includes(selectedBookCategory) ? selectedBookCategory : defaultCategory
    setEditingId(book.id)
    setForm({
      book_code: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      published_year: '2024',
      category: nextCategory,
      publisher: book.publisher || '',
      price: '0.00',
      copies: String(book.copies),
      damaged: '0',
      lost: '0',
      cover_url: coverUrl || '',
    })
    setCoverFile(null)
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

      const coverUrl = (form.cover_url || '').trim()

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
        cover_url: coverUrl || null,
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

  useEffect(() => {
    if (!historyBook) {
      setHistoryRows([])
      return
    }

    async function loadHistory() {
      try {
        const [{ data: loginRows }, { data: studentRows }] = await Promise.all([
          supabase.from('student_login_accounts').select('id, student_id, student_code, full_name').limit(200),
          supabase.from('students').select('id, student_code, name').limit(200),
        ])

        const nameMap = new Map<string, string>()
        for (const row of [...(loginRows ?? []), ...(studentRows ?? [])]) {
          const rowName = row?.full_name ?? row?.name
          if (!rowName) continue
          for (const key of [row?.id, row?.student_id, row?.student_code]) {
            const normalized = String(key ?? '').trim()
            if (normalized) nameMap.set(normalized, String(rowName))
          }
        }

        const { data, error } = await supabase
          .from('borrowing_records')
          .select('*')
          .eq('book_id', historyBook.id)
          .order('borrow_date', { ascending: false })

        if (error) throw error

        setHistoryRows((data ?? []).map((row: any) => {
          const studentId = String(row.student_id ?? '').trim()
          const studentName = nameMap.get(studentId) ?? 'Unknown student'

          return {
            id: row.id,
            studentId,
            studentName,
            borrowDate: row.borrow_date ?? 'N/A',
            dueDate: row.due_date ?? 'N/A',
            returnDate: row.return_date ?? '—',
            status: String(row.status ?? 'borrowed').replace(/_/g, ' '),
          }
        }))
      } catch (err) {
        console.error('[AdminBooks] unable to load borrowing history', err)
        setHistoryRows([])
      }
    }

    void loadHistory()
  }, [historyBook])

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
                      <select
                        value={categoryOptions.includes(form.category) ? form.category : defaultCategory}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      >
                        {categoryOptions.filter((category) => category !== 'All').map((category) => (
                          <option key={category} value={category}>{category}</option>
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
      <div className="flex flex-col gap-3 mb-5 md:flex-row">
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
        <div className="flex items-center gap-2 md:ml-2 md:items-stretch md:w-auto w-full">
          <div className="hidden md:flex items-center px-3 text-gray-600"><Icons.Filter /></div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:min-w-[220px] py-2.5 px-3 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 transition"
          >
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />
          Add Book
        </button>
      </div>
      {/* Mobile: card list (stacked) */}
      <div className="block md:hidden space-y-3">
        {filtered.map((b) => (
          <article
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => startEditBook(b)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditBook(b) } }}
            className="rounded-xl border border-green-100 bg-white p-3 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-100"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {(b as any).cover_url ? (
                  <img src={(b as any).cover_url} alt={b.title} className="h-20 w-14 rounded-md border border-gray-200 object-cover shadow-sm" />
                ) : (
                  <div className="flex h-20 w-14 items-center justify-center rounded-md border border-gray-200 bg-gradient-to-br from-white to-blue-50 text-sm font-bold text-blue-700 shadow-sm">
                    {b.title.split(' ').map((word: string) => word[0]).slice(0, 2).join('').toUpperCase() || 'BK'}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setHistoryBook(b) }}
                      className="font-medium text-gray-900 underline-offset-2 hover:text-green-700 hover:underline"
                    >
                      <span className="truncate block">{b.title}</span>
                    </button>
                    <div className="text-xs text-gray-600">{b.author}</div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${b.available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {b.available > 0 ? 'Available' : 'Unavailable'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono">{b.isbn}</span>
                  <span className="mx-1">•</span>
                  <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 truncate">{b.category}</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); startEditBook(b) }} className="rounded-lg bg-orange-400 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(b) }} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop: table view */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-green-100 bg-white">
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
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setHistoryBook(b) }}
                        className="font-medium text-gray-900 underline-offset-2 hover:text-green-700 hover:underline"
                      >
                        {b.title}
                      </button>
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
                    <button onClick={(e) => { e.stopPropagation(); setHistoryBook(b) }} className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100">History</button>
                    <button onClick={(e) => { e.stopPropagation(); startEditBook(b) }} className="rounded-lg bg-orange-400 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(b) }} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">Delete</button>
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

      {historyBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-green-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{historyBook.title}</h3>
                <p className="text-xs text-gray-500">Borrowing history</p>
              </div>
              <button onClick={() => setHistoryBook(null)} className="text-gray-400 hover:text-gray-700"><Icons.X /></button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              {historyRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-green-200 bg-green-50 p-4 text-sm text-gray-600">No borrowing history has been recorded for this book yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-green-50 text-left text-xs font-semibold uppercase tracking-wide text-green-800">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Borrowed</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2">Returned</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {historyRows.map((row) => (
                        <tr key={row.id} className="align-top">
                          <td className="px-3 py-2 text-sm font-medium text-gray-700">{row.studentName || 'Unknown student'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.borrowDate}</td>
                          <td className="px-3 py-2 text-gray-700">{row.dueDate}</td>
                          <td className="px-3 py-2 text-gray-700">{row.returnDate}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${row.status.toLowerCase() === 'returned' ? 'bg-green-100 text-green-700' : row.status.toLowerCase() === 'borrowed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-5 py-3">
              <button onClick={() => setHistoryBook(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

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
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between"><span className="text-gray-500">Active Borrowings</span><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getActiveBorrowingDetails(selected, borrowingRt ?? [], booksRt ?? []).count > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{getActiveBorrowingDetails(selected, borrowingRt ?? [], booksRt ?? []).count}</span></div>
                {getActiveBorrowingDetails(selected, borrowingRt ?? [], booksRt ?? []).titles.length > 0 ? (
                  <div className="text-xs text-slate-600 leading-5">{getActiveBorrowingDetails(selected, borrowingRt ?? [], booksRt ?? []).titles.slice(0, 3).join(', ')}</div>
                ) : (
                  <div className="text-xs text-slate-500">No active book</div>
                )}
              </div>
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
  const { data: borrowingRt } = useSupabaseRealtime('borrowing_records')
  const { data: booksRt } = useSupabaseRealtime('books')
  const [users, setUsers] = useState(() => [])
  const [studentMap, setStudentMap] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const getActiveBorrowingDetails = (user: any, rows: any[] = [], books: any[] = []) => {
    const studentId = String(user?.studentId ?? user?.student_id ?? '').trim()
    const studentCode = String(user?.studentCode ?? user?.student_code ?? '').trim()
    const userId = String(user?.id ?? '').trim()

    const activeRecords = (rows ?? []).filter((record: any) => {
      const recordStatus = String(record?.status ?? '').trim().toLowerCase()
      const hasReturnDate = !!(record?.return_date ?? record?.returnDate)
      if (hasReturnDate || ['returned'].includes(recordStatus)) return false

      const rowStudentId = String(record?.student_id ?? record?.studentId ?? '').trim()
      const rowStudentCode = String(record?.student_code ?? record?.studentCode ?? '').trim()
      const rowLoginId = String(record?.login_id ?? record?.loginId ?? '').trim()

      return (
        rowStudentId === studentId
        || rowStudentCode === studentCode
        || rowLoginId === userId
        || rowStudentId === userId
        || rowStudentCode === userId
      )
    })

    const titles = activeRecords.map((record: any) => {
      const bookId = String(record?.book_id ?? record?.bookId ?? '').trim()
      const book = (books ?? []).find((item: any) => String(item?.id ?? '').trim() === bookId)
      return String(book?.title ?? record?.book_title ?? record?.bookTitle ?? 'Unknown book').trim() || 'Unknown book'
    }).filter(Boolean)

    return {
      count: activeRecords.length,
      titles,
    }
  }

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
          avatarUrl: u.avatar_url ?? null,
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
      avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
    }))

    setUsers(mapped)
  }, [usersRt])

  async function handleToggleStatus(user: any) {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended'
    try {
      setUpdatingId(user.id)
      setMessage(null)

      const { error } = await supabase
        .from('student_login_accounts')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) throw error

      setUsers((current) => current.map((row: any) => row.id === user.id ? { ...row, status: nextStatus } : row))
      setMessage(`${user.fullName || 'This account'} has been ${nextStatus === 'suspended' ? 'deactivated' : 'reactivated'}.`)
    } catch (err: any) {
      console.error('[AdminUsers] toggle status failed', err)
      setMessage(err?.message || 'Unable to update account status.')
    } finally {
      setUpdatingId(null)
    }
  }

  // The live app uses student_login_accounts as the student source of truth.
  // Keep the display local and avoid querying legacy students rows that do not exist.
  useEffect(() => {
    setStudentMap({})
  }, [users])

  return (
    <div>
      <PageHeader title="Users" subtitle="Student login accounts (student_login_accounts table)" />
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}
      <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm">
        <Table headers={["Photo", "Row ID", "Full Name", "Student ID", "Student Code", "Course", "Year Level", "Active Borrowing", "Status", "Action"]}>
          {users.map((u: any) => {
            const initials = (u.fullName || 'ST')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part: string) => part[0]?.toUpperCase() ?? '')
              .join('') || 'ST'
            const activeBorrowing = getActiveBorrowingDetails(u, borrowingRt ?? [], booksRt ?? [])

            return (
              <Tr key={u.id}>
                <Td>
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName || 'Student'} className="h-10 w-10 rounded-full object-cover border border-green-100 shadow-sm" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-xs font-bold text-white shadow-sm">
                      {initials}
                    </div>
                  )}
                </Td>
                <Td className="font-mono text-xs">{u.id}</Td>
                <Td>{u.fullName || '—'}</Td>
                <Td className="font-mono text-xs">{u.studentId ?? 'NULL'}</Td>
                <Td className="font-mono text-xs">{u.studentCode ? (studentMap[u.studentCode] ?? u.studentCode) : 'NULL'}</Td>
                <Td>{u.course || '—'}</Td>
                <Td>{u.yearLevel || '—'}</Td>
                <Td>
                  {activeBorrowing.count > 0 ? (
                    <div className="space-y-1">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {activeBorrowing.count}
                      </span>
                      <div className="text-xs text-slate-600 leading-4">
                        {activeBorrowing.titles.slice(0, 2).join(', ')}
                        {activeBorrowing.titles.length > 2 ? ' + more' : ''}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No active book</span>
                  )}
                </Td>
                <Td><StatusBadge status={u.status || 'active'} /></Td>
                <Td>
                  <button
                    onClick={() => handleToggleStatus(u)}
                    disabled={updatingId === u.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${u.status === 'suspended' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {updatingId === u.id ? 'Updating...' : u.status === 'suspended' ? 'Activate' : 'Deactivate'}
                  </button>
                </Td>
              </Tr>
            )
          })}
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

function buildReminderMailtoLink(email: string, studentName: string, bookTitle: string, dueDate: string, daysOverdue: number) {
  const subject = 'Library due date reminder'
  const body = [
    `Dear ${studentName},`,
    '',
    'This is a reminder that your borrowed book is now overdue.',
    `Book: ${bookTitle}`,
    `Due date: ${dueDate}`,
    `Days overdue: ${daysOverdue}`,
    '',
    'Please return the book to the library as soon as possible or contact the library staff for assistance.',
    '',
    'Thank you,',
    'Library Management Office',
  ].join('\n')

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function AdminOverdueBooks() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadOverdueRows() {
      try {
        const [{ data: loanRows, error: loanError }, { data: bookRows, error: bookError }, { data: loginRows, error: loginError }, { data: studentRows, error: studentError }] = await Promise.all([
          supabase.from('borrowing_records').select('*').order('due_date', { ascending: true }).limit(200),
          supabase.from('books').select('*').limit(200),
          supabase.from('student_login_accounts').select('*').limit(200),
          supabase.from('students').select('*').limit(200),
        ])

        if (loanError || bookError || loginError || studentError) {
          throw new Error('Unable to load overdue records.')
        }

        const bookMap = new Map((bookRows ?? []).map((book: any) => [String(book.id ?? '').trim(), book]))
        const nameMap = new Map<string, string>()
        const emailMap = new Map<string, string>()

        for (const row of [...(loginRows ?? []), ...(studentRows ?? [])]) {
          const name = String(row?.full_name ?? row?.name ?? '').trim()
          const email = String(row?.email ?? '').trim()
          if (name) {
            for (const key of [row?.id, row?.student_id, row?.student_code]) {
              const normalized = String(key ?? '').trim()
              if (normalized) nameMap.set(normalized, name)
            }
          }
          if (email) {
            for (const key of [row?.id, row?.student_id, row?.student_code]) {
              const normalized = String(key ?? '').trim()
              if (normalized) emailMap.set(normalized, email)
            }
          }
        }

        const now = new Date()
        const overdue = (loanRows ?? []).filter((row: any) => {
          const hasNoReturn = !row?.return_date
          const dueDate = row?.due_date ? new Date(row.due_date) : null
          const isPastDue = !!dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now
          return hasNoReturn && isPastDue
        }).map((row: any) => {
          const studentId = String(row?.student_id ?? '').trim()
          const book = bookMap.get(String(row?.book_id ?? '').trim())
          const dueDate = row?.due_date ? new Date(row.due_date) : null
          const daysOverdue = dueDate ? Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0

          return {
            id: row?.id ?? `overdue-${Math.random()}`,
            student: nameMap.get(studentId) || nameMap.get(String(row?.student_id ?? '')) || 'Unknown student',
            email: emailMap.get(studentId) || emailMap.get(String(row?.student_id ?? '')) || 'N/A',
            book: book?.title ?? 'Unknown book',
            due: row?.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : 'N/A',
            daysOverdue,
            notified: Boolean(row?.notified),
          }
        })

        if (!ignore) setRows(overdue)
      } catch (error) {
        console.error('[AdminOverdueBooks] unable to load overdue rows', error)
        if (!ignore) setRows([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadOverdueRows()
    return () => { ignore = true }
  }, [])

  async function handleSendReminder(recordId: string) {
    const row = rows.find((item) => String(item.id) === String(recordId))
    const email = String(row?.email ?? '').trim()

    if (!email || email === 'N/A') {
      setMessage('This student does not have a valid email address on file.')
      return
    }

    try {
      setRemindingId(recordId)
      const mailtoLink = buildReminderMailtoLink(email, row?.student ?? 'Student', row?.book ?? 'Book', row?.due ?? 'N/A', Number(row?.daysOverdue ?? 0))
      window.location.href = mailtoLink
      await markReminderSent(recordId)
      setRows((current) => current.map((item) => item.id === recordId ? { ...item, notified: true } : item))
      setMessage(`Reminder email opened for ${email}.`)
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
      {loading ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-8 text-center text-sm text-gray-500">Loading overdue books...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-green-200 bg-white p-8 text-center text-sm text-gray-500">No overdue books found.</div>
      ) : (
        <Table headers={['Student', 'Email', 'Book', 'Due Date', 'Days Overdue', 'Notified', 'Action']}>
          {rows.map((r) => (
            <Tr key={r.id}>
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
                <button onClick={() => handleSendReminder(String(r.id))} disabled={remindingId === String(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
                  <Icons.Mail />
                  {remindingId === String(r.id) ? 'Sending...' : 'Send Reminder'}
                </button>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
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
  const [generating, setGenerating] = useState<string | null>(null)

  function printReport(title: string, html: string) {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) {
      window.alert('Please allow pop-ups to generate the report.')
      return
    }

    const css = `
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { font-size: 24px; margin-bottom: 12px; }
        .meta { color: #4b5563; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 12px; }
        th { background: #f3f4f6; }
        .kpi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; background: #f9fafb; }
        .card strong { display: block; font-size: 18px; margin-top: 8px; }
      </style>
    `

    printWindow.document.write(`<!doctype html><html><head><title>${title}</title>${css}</head><body>${html}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  async function handleGenerate(reportName: string) {
    try {
      setGenerating(reportName)

      const [booksResult, loansResult, studentsResult] = await Promise.all([
        supabase.from('books').select('*').limit(200),
        supabase.from('borrowing_records').select('*').limit(300),
        supabase.from('students').select('*').limit(200),
      ])

      const books = booksResult.data ?? []
      const loans = loansResult.data ?? []
      const students = studentsResult.data ?? []

      const now = new Date()
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthlyBorrowing = monthLabels.map((month, index) => {
        const count = (loans as any[]).filter((row) => {
          if (!row?.borrow_date) return false
          const date = new Date(row.borrow_date)
          return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === index
        }).length

        return { month, count }
      })

      const overdueLoans = (loans as any[]).filter((row) => {
        if (!row?.due_date || row?.return_date) return false
        const due = new Date(row.due_date)
        return !Number.isNaN(due.getTime()) && due < now
      })

      const popularBooks = books
        .map((book: any) => ({
          title: book.title,
          author: book.author,
          borrowCount: (loans as any[]).filter((row) => row?.book_id === book.id).length,
          available: Number(book.available_copies ?? 0),
          total: Number(book.total_copies ?? 0),
        }))
        .sort((a, b) => b.borrowCount - a.borrowCount)
        .slice(0, 10)

      const studentActivity = students
        .map((student: any) => ({
          name: student.name ?? student.full_name ?? 'Unknown student',
          studentCode: student.student_code ?? student.studentId ?? 'N/A',
          borrowCount: (loans as any[]).filter((row) => String(row.student_id) === String(student.id)).length,
        }))
        .sort((a, b) => b.borrowCount - a.borrowCount)
        .slice(0, 10)

      const totalAvailable = books.reduce((sum, book: any) => sum + Number(book.available_copies ?? 0), 0)
      const totalCopies = books.reduce((sum, book: any) => sum + Number(book.total_copies ?? 0), 0)

      const damageRows = books.filter((book: any) => Number(book.damaged ?? 0) > 0 || Number(book.lost ?? 0) > 0)

      const reportMap: Record<string, string> = {
        'Monthly Borrowing Report': `
          <h1>Monthly Borrowing Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div class="card">Total Borrowings<strong>${loans.length}</strong></div>
            <div class="card">Students<strong>${students.length}</strong></div>
            <div class="card">Books<strong>${books.length}</strong></div>
          </div>
          <table>
            <thead><tr><th>Month</th><th>Borrowings</th></tr></thead>
            <tbody>
              ${monthlyBorrowing.map((entry) => `<tr><td>${entry.month}</td><td>${entry.count}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
        'Damage Report': `
          <h1>Damage Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div class="card">Damaged Titles<strong>${damageRows.length}</strong></div>
            <div class="card">Total Damaged Copies<strong>${damageRows.reduce((sum, book: any) => sum + Number(book.damaged ?? 0), 0)}</strong></div>
            <div class="card">Lost Copies<strong>${damageRows.reduce((sum, book: any) => sum + Number(book.lost ?? 0), 0)}</strong></div>
          </div>
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Damaged</th><th>Lost</th></tr></thead>
            <tbody>
              ${damageRows.length ? damageRows.map((book: any) => `<tr><td>${book.title}</td><td>${book.category}</td><td>${book.damaged ?? 0}</td><td>${book.lost ?? 0}</td></tr>`).join('') : '<tr><td colspan="4">No damaged or lost books found.</td></tr>'}
            </tbody>
          </table>
        `,
        'Overdue Report': `
          <h1>Overdue Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div class="card">Overdue Items<strong>${overdueLoans.length}</strong></div>
            <div class="card">Active Loans<strong>${loans.filter((row: any) => !row.return_date).length}</strong></div>
            <div class="card">Late Fees<strong>₱${(overdueLoans.length * 5).toFixed(2)}</strong></div>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Book</th><th>Due Date</th><th>Days Late</th></tr></thead>
            <tbody>
              ${overdueLoans.length ? overdueLoans.map((row: any) => {
          const due = new Date(row.due_date)
          const book = books.find((b: any) => b.id === row.book_id)
          const student = students.find((s: any) => s.id === row.student_id)
          const daysLate = Math.max(0, Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
          return `<tr><td>${student?.name ?? 'Unknown student'}</td><td>${book?.title ?? 'Unknown book'}</td><td>${due.toLocaleDateString()}</td><td>${daysLate}</td></tr>`
        }).join('') : '<tr><td colspan="4">No overdue records found.</td></tr>'}
            </tbody>
          </table>
        `,
        'Book Inventory Report': `
          <h1>Book Inventory Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div class="card">Total Copies<strong>${totalCopies}</strong></div>
            <div class="card">Available<strong>${totalAvailable}</strong></div>
            <div class="card">Titles<strong>${books.length}</strong></div>
          </div>
          <table>
            <thead><tr><th>Title</th><th>Category</th><th>Available</th><th>Total</th></tr></thead>
            <tbody>
              ${books.map((book: any) => `<tr><td>${book.title}</td><td>${book.category}</td><td>${book.available_copies ?? 0}</td><td>${book.total_copies ?? 0}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
        'Student Activity Report': `
          <h1>Student Activity Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>Student</th><th>ID</th><th>Borrow Count</th></tr></thead>
            <tbody>
              ${studentActivity.map((student) => `<tr><td>${student.name}</td><td>${student.studentCode}</td><td>${student.borrowCount}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
        'Popular Books Report': `
          <h1>Popular Books Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>Rank</th><th>Title</th><th>Author</th><th>Borrow Count</th></tr></thead>
            <tbody>
              ${popularBooks.map((book, index) => `<tr><td>${index + 1}</td><td>${book.title}</td><td>${book.author}</td><td>${book.borrowCount}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
        'Annual Summary Report': `
          <h1>Annual Summary Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="kpi">
            <div class="card">Borrowed<strong>${loans.length}</strong></div>
            <div class="card">Returned<strong>${loans.filter((row: any) => row.return_date).length}</strong></div>
            <div class="card">Overdue<strong>${overdueLoans.length}</strong></div>
          </div>
          <table>
            <thead><tr><th>Month</th><th>Borrowings</th></tr></thead>
            <tbody>
              ${monthlyBorrowing.map((entry) => `<tr><td>${entry.month}</td><td>${entry.count}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
      }

      const content = reportMap[reportName]
      if (!content) {
        throw new Error(`Report not available: ${reportName}`)
      }

      printReport(reportName, content)
    } catch (error: any) {
      window.alert(error?.message || 'Unable to generate the report.')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export library activity reports." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Monthly Borrowing Report', desc: 'Summary of all borrowings for the current period', icon: <Icons.BarChart /> },
          { title: 'Damage Report', desc: 'Damaged and lost book inventory overview', icon: <Icons.AlertCircle /> },
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
            <button onClick={() => handleGenerate(r.title)} disabled={generating === r.title} className="mt-auto py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
              {generating === r.title ? 'Generating...' : 'Generate PDF'}
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
    max_books_per_student: '5',
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
          max_books_per_student: String(settings.max_books_per_student ?? 5),
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
        max_books_per_student: Number(form.max_books_per_student) || 5,
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
function StudentLayout({ onLogout, studentId, userProfile, onProfileUpdate }: { onLogout: () => void; studentId?: string; userProfile?: { name?: string; studentId?: string; email?: string; course?: string; card?: string; studentCode?: string; avatar_url?: string | null }; onProfileUpdate?: (nextProfile: any) => void }) {
  const [view, setView] = useState<StudentView>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isMobile = useIsMobile(900)

  const handleStudentNav = (id: string) => {
    setView(id as StudentView)
    setMobileNavOpen(false)
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard /> },
    { id: 'search', label: 'Search Books', icon: <Icons.Search /> },
    { id: 'borrowed', label: 'My Borrowed Books', icon: <Icons.Book /> },
    { id: 'history', label: 'Borrowing History', icon: <Icons.History /> },
    { id: 'card', label: 'Library Card', icon: <Icons.IdCard /> },
    { id: 'profile', label: 'Profile', icon: <Icons.User /> },
  ]

  const renderMobileView = () => {
    switch (view) {
      case 'dashboard':
        return <MobileDashboard currentView={view} onNavigate={(id) => setView(id as StudentView)} onLogout={onLogout} userProfile={userProfile} />
      case 'search':
        return <SearchBooks studentId={studentId} userProfile={userProfile} />
      case 'borrowed':
        return <MyBorrowedBooks userProfile={userProfile} />
      case 'history':
        return <BorrowingHistory userProfile={userProfile} />
      case 'card':
        return <LibraryCard userProfile={userProfile} />
      case 'profile':
        return <Profile userProfile={userProfile} onProfileSave={onProfileUpdate} />
      default:
        return <MobileDashboard currentView={view} onNavigate={(id) => setView(id as StudentView)} onLogout={onLogout} userProfile={userProfile} />
    }
  }

  if (isMobile) {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB]">
        <TopHeader
          onMenuClick={() => setMobileNavOpen(true)}
          userName={userProfile?.name ?? 'Student'}
          onProfileClick={() => {
            setView((current) => current === 'profile' ? 'dashboard' : 'profile')
            setMobileNavOpen(false)
          }}
        />
        <main className="w-full pb-20 pt-2">
          {renderMobileView()}
        </main>

        <MobileSidebar
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          items={navItems}
          active={view}
          onSelect={handleStudentNav}
          onLogout={onLogout}
          title="Student Portal"
        />
      </div>
    )
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <StudentDashboard onNavigate={setView} userProfile={userProfile} />
      case 'search': return <SearchBooks studentId={studentId} userProfile={userProfile} />
      case 'borrowed': return <MyBorrowedBooks userProfile={userProfile} />
      case 'history': return <BorrowingHistory userProfile={userProfile} />
      case 'card': return <LibraryCard userProfile={userProfile} />
      case 'profile': return <Profile userProfile={userProfile} onProfileSave={onProfileUpdate} />
    }
  }

  const desktopNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard /> },
    { id: 'search', label: 'Search Books', icon: <Icons.Search /> },
    { id: 'borrowed', label: 'My Borrowed Books', icon: <Icons.Book /> },
    { id: 'history', label: 'Borrowing History', icon: <Icons.History /> },
    { id: 'card', label: 'Library Card', icon: <Icons.IdCard /> },
    { id: 'profile', label: 'Profile', icon: <Icons.User /> },
  ]

  return (
    <div className="min-h-screen w-full app-root">
      <TopHeader
        onMenuClick={() => setMobileNavOpen(true)}
        userName={userProfile?.name ?? 'Student'}
        onProfileClick={() => {
          setView('profile')
          setMobileNavOpen(false)
        }}
      />
      <div className="flex">
        <Sidebar
          items={desktopNavItems}
          active={view}
          onSelect={handleStudentNav}
          onLogout={onLogout}
          title="Student Portal"
        />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8">{renderView()}</div>
        </main>
      </div>

      <MobileSidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        items={desktopNavItems}
        active={view}
        onSelect={handleStudentNav}
        onLogout={onLogout}
        title="Student Portal"
      />
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
      case 'borrowing-records': return <AdminBorrowingRecords />
      case 'returns': return <AdminReturns />
      case 'overdue': return <AdminOverdueBooks />
      case 'reports': return <AdminReports />
      case 'settings': return <AdminSettings />
    }
  }

  return (
    <div className="min-h-screen w-full app-root">
      <TopHeader />
      <div className="flex">
        <Sidebar
          items={navItems}
          active={view}
          onSelect={(id) => setView(id as AdminView)}
          onLogout={onLogout}
          title="Librarian Portal"
        />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">{renderView()}</div>
        </main>
      </div>
    </div>
  )
}

function AdminDashboard({ dashboard }: { dashboard?: any | null }) {
  const stats = dashboard?.stats ?? null
  const recent = dashboard?.records ?? borrowingRecords
  const overdue = dashboard?.overdue ?? overdueRecords

  const [recentRecords, setRecentRecords] = useState<Array<any>>(recent?.slice(0, 5) ?? [])
  const [page, setPage] = useState<number>(0)
  const pageSize = 5
  const [totalCount, setTotalCount] = useState<number>(0)

  const normalizeRecentBorrowRow = (row: any) => {
    const studentId = String(row?.student_id ?? row?.studentId ?? row?.student_code ?? row?.studentCode ?? '').trim()
    const bookId = String(row?.book_id ?? row?.bookId ?? '').trim()
    const dashboardStudent = Array.isArray(dashboard?.students)
      ? dashboard.students.find((student: any) => String(student?.id ?? student?.student_id ?? student?.studentCode ?? '').trim() === studentId || String(student?.id ?? '').trim() === studentId)
      : null
    const dashboardBook = Array.isArray(dashboard?.books)
      ? dashboard.books.find((book: any) => String(book?.id ?? '').trim() === bookId || String(book?.book_code ?? '').trim() === bookId)
      : null

    const studentName = String(
      row?.student_name ?? row?.studentName ?? row?.full_name ?? row?.fullName ?? row?.name ?? dashboardStudent?.name ?? ''
    ).trim() ||
      (row?.login_full_name ?? '') ||
      (row?.student?.name ?? '') ||
      'Unknown student'

    const bookTitle = String(
      row?.book_title ?? row?.bookTitle ?? row?.title ?? row?.book_name ?? row?.book?.title ?? dashboardBook?.title ?? ''
    ).trim() || 'Unknown book'

    const dueValue = row?.due_date ?? row?.dueDate ?? row?.return_due_date ?? row?.returnDate ?? 'N/A'
    const statusValue = String(row?.status ?? '').trim().toLowerCase() || inferLoanStatus(String(dueValue))

    return {
      id: row?.id,
      txn: row?.txn_code ?? row?.txn ?? row?.id,
      student: studentName || 'Unknown student',
      book: bookTitle || 'Unknown book',
      due: dueValue,
      status: statusValue,
    }
  }

  const sortRecentBorrowRows = (rows: any[]) => [...rows].sort((a: any, b: any) => {
    const getSortTime = (value: any) => {
      const raw = value?.created_at ?? value?.createdAt ?? value?.borrow_date ?? value?.borrowDate ?? value?.due_date ?? value?.dueDate ?? value?.id ?? ''
      const time = Date.parse(String(raw))
      return Number.isNaN(time) ? 0 : time
    }

    const aTime = getSortTime(a)
    const bTime = getSortTime(b)

    if (aTime === bTime) return String(b?.id ?? '').localeCompare(String(a?.id ?? ''))
    return bTime - aTime
  })

  useEffect(() => {
    let active = true

    async function loadRecent() {
      try {
        const start = page * pageSize
        const end = start + pageSize - 1

        const [{ data: borrowRows, error: borrowErr, count }, { data: bookRows }, { data: loginRows }] = await Promise.all([
          supabase
            .from('borrowing_records')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end),
          supabase.from('books').select('id, title, cover_url').limit(10),
          supabase.from('student_login_accounts').select('*').limit(200),
        ])

        if (borrowErr) throw borrowErr

        const fallbackRecords = Array.isArray(dashboard?.records) ? dashboard.records : []
        const resolvedBorrowRows = Array.isArray(borrowRows) && borrowRows.length > 0 ? borrowRows : fallbackRecords

        if (!resolvedBorrowRows || resolvedBorrowRows.length === 0) {
          if (active) {
            setRecentRecords([])
            setTotalCount(0)
          }
          return
        }

        const bookMap = new Map<string, any>()
          ; (bookRows ?? []).forEach((book: any) => {
            const id = String(book?.id ?? '').trim()
            if (id) bookMap.set(id, book)
          })

        const loginMap = new Map<string, any>()
          ; (loginRows ?? []).forEach((login: any) => {
            const id = String(login?.id ?? '').trim()
            const studentId = String(login?.student_id ?? '').trim()
            const studentCode = String(login?.student_code ?? '').trim()
            if (id) loginMap.set(id, login)
            if (studentId) loginMap.set(studentId, login)
            if (studentCode) loginMap.set(studentCode, login)
          })

        const resolveStudentName = (row: any) => {
          const direct = String(row?.student_name ?? row?.studentName ?? row?.full_name ?? row?.fullName ?? row?.name ?? '').trim()
          if (direct) return direct

          const keys = [
            String(row?.student_id ?? row?.studentId ?? '').trim(),
            String(row?.student_code ?? row?.studentCode ?? '').trim(),
            String(row?.id ?? '').trim(),
          ].filter(Boolean)

          for (const key of keys) {
            const loginRow = loginMap.get(key)
            if (loginRow?.full_name) return String(loginRow.full_name).trim()
          }

          return 'Unknown student'
        }

        const resolveBookMeta = (row: any) => {
          const directTitle = String(row?.book_title ?? row?.bookTitle ?? row?.title ?? row?.book_name ?? '').trim()
          const directCover = String(row?.cover_url ?? row?.coverUrl ?? '').trim()

          const keys = [
            String(row?.book_id ?? row?.bookId ?? '').trim(),
            String(row?.book_code ?? row?.bookCode ?? '').trim(),
          ].filter(Boolean)

          for (const key of keys) {
            const book = bookMap.get(key)
            if (book) {
              const fallbackTitle = directTitle || 'Unknown book'
              const fallbackCover = directCover || ''
              return {
                title: String(book.title ?? fallbackTitle).trim(),
                cover_url: String((book.cover_url ?? book.coverUrl) ?? fallbackCover).trim(),
              }
            }
          }

          return {
            title: directTitle || 'Unknown book',
            cover_url: directCover || '',
          }
        }

        const mapped = (resolvedBorrowRows || []).map((record: any) => {
          const dueValue = record?.due_date ?? record?.dueDate ?? record?.return_due_date ?? record?.returnDate ?? 'N/A'
          const computedStatus = String(record?.status ?? '').trim().toLowerCase() || inferLoanStatus(String(dueValue))
          const bookMeta = resolveBookMeta(record)

          return {
            id: record?.id,
            txn: record?.txn_code ?? record?.txn ?? record?.id,
            student: resolveStudentName(record),
            book: bookMeta.title,
            cover_url: bookMeta.cover_url,
            due: dueValue,
            status: computedStatus,
          }
        })

        const sorted = sortRecentBorrowRows(mapped)

        if (active) {
          setRecentRecords(sorted.slice(0, 5))
          setTotalCount(count ?? sorted.length)
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const currentMonthIndex = new Date().getMonth()
  const monthlyLabels = Array.from({ length: 12 }, (_, offset) => {
    const index = (currentMonthIndex - (11 - offset) + 12) % 12
    return monthNames[index]
  })
  const chartValues = monthlyBorrowings.length > 0 ? monthlyBorrowings.slice(-12) : Array(12).fill(0)
  const chartMax = Math.max(40, ...chartValues, 1)
  const yTicks = [0, 10, 20, 30, 40]
  const chartPadding = { top: 12, right: 10, bottom: 18, left: 18 }
  const chartWidth = 100
  const chartHeight = 100
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const chartPoints = chartValues.map((value, index) => {
    const x = chartPadding.left + (index / Math.max(chartValues.length - 1, 1)) * chartInnerWidth
    const y = chartHeight - chartPadding.bottom - ((value / chartMax) * chartInnerHeight)
    return { x, y, value }
  })
  const chartPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const chartAreaPath = `${chartPath} L ${chartWidth - chartPadding.right} ${chartHeight - chartPadding.bottom} L ${chartPadding.left} ${chartHeight - chartPadding.bottom} Z`
  const gridLines = yTicks.map((tick) => {
    const y = chartHeight - chartPadding.bottom - ((tick / chartMax) * chartInnerHeight)
    return { tick, y }
  })

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
          <div className="bg-white rounded-xl border border-green-100 p-5 shadow-sm flex flex-col h-[340px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Monthly Borrowings</h3>
              <div className="text-sm text-gray-400">{monthlyBorrowings.length > 0 ? 'Live trend' : 'No data yet'}</div>
            </div>

            {chartValues.some((value) => value > 0) ? (
              <div className="relative flex-1 w-full overflow-hidden rounded-lg">
                <svg viewBox="0 0 100 100" className="block h-full w-full" preserveAspectRatio="none" aria-label="Monthly borrowing trend">
                  <defs>
                    <linearGradient id="lineChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {gridLines.map((line) => (
                    <g key={line.tick}>
                      <line x1={chartPadding.left} y1={line.y} x2={chartWidth - chartPadding.right} y2={line.y} stroke="#d1d5db" strokeDasharray="2 2" strokeWidth="0.5" />
                      <text x={4} y={line.y + 1.5} fontSize="3.2" fill="#6b7280">{line.tick}</text>
                    </g>
                  ))}
                  {chartPoints.map((point, index) => {
                    const x = chartPadding.left + (index / Math.max(chartValues.length - 1, 1)) * (chartWidth - chartPadding.left - chartPadding.right)
                    const isLast = index === chartPoints.length - 1
                    return (
                      <g key={`${point.x}-${point.y}`}>
                        {index === 0 ? (
                          <line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke="#9ca3af" strokeWidth="0.7" />
                        ) : null}
                        {!isLast ? (
                          <line x1={x} y1={chartPadding.top} x2={x} y2={chartHeight - chartPadding.bottom} stroke="#e5e7eb" strokeDasharray="1.5 2" strokeWidth="0.4" />
                        ) : null}
                        <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke="#9ca3af" strokeWidth="0.7" />
                        <circle cx={point.x} cy={point.y} r="1.4" fill="#16a34a" />
                        <text x={point.x} y={Math.max(point.y - 4, 12)} textAnchor="middle" fontSize="3.2" fill="#16a34a">{point.value}</text>
                        <text x={point.x} y="97" textAnchor="middle" fontSize="3.4" fill="#6b7280">{monthlyLabels[index]?.slice(0, 3) ?? `M${index + 1}`}</text>
                      </g>
                    )
                  })}
                  <path d={chartAreaPath} fill="url(#lineChartFill)" />
                  <path d={chartPath} fill="none" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <button onClick={() => {/* view all placeholder - can navigate to records page */ }} className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">View all <Icons.ChevronRight /></button>
              </div>
            </div>
            <Table headers={["Student", "Book", "Due Date", "Status"]}>
              {recentRecords.slice(0, 5).map((r: any, idx: number) => (
                <Tr key={r.txn ?? r.id ?? idx}>
                  <Td className="font-medium">{r.student}</Td>
                  <Td className="text-gray-500 text-xs">
                    <div className="flex items-center gap-3">
                      {r.cover_url ? (
                        <img src={String(r.cover_url)} alt={String(r.book || 'Book cover')} className="h-12 w-9 rounded-md border border-gray-200 object-cover shadow-sm" />
                      ) : (
                        <div className="h-12 w-9 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] font-semibold text-gray-500">No cover</div>
                      )}
                      <span>{r.book}</span>
                    </div>
                  </Td>
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
  avatar_url?: string | null
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [dashboard, setDashboard] = useState<any | null>(null)

  // The live project uses the custom student_login_accounts flow.
  // Do not trigger the legacy students/library_cards sync because those tables are not present.
  useEffect(() => {
    startAuthSync()
  }, [])

  // Persist custom auth to localStorage so app-managed logins survive refresh
  useEffect(() => {
    try {
      if (auth) {
        window.localStorage.setItem('lms-auth', JSON.stringify(auth))
      } else {
        window.localStorage.removeItem('lms-auth')
      }
    } catch (e) {
      // ignore
    }
  }, [auth])

  async function hydrateAuthFromDatabase(nextAuth: AuthState | null): Promise<AuthState | null> {
    if (!nextAuth || nextAuth.role !== 'student') return nextAuth

    const lookupKey = String(nextAuth.studentCode ?? nextAuth.studentId ?? nextAuth.email ?? '').trim()
    if (!lookupKey) return nextAuth

    try {
      const { data: loginRows, error: loginError } = await supabase
        .from('student_login_accounts')
        .select('*')
        .or(`student_id.eq.${lookupKey},student_code.eq.${lookupKey}`)
        .limit(1)

      if (loginError) {
        console.warn('[auth-hydrate] login lookup failed', loginError)
        return nextAuth
      }

      const loginRow = Array.isArray(loginRows) && loginRows.length > 0 ? loginRows[0] : null
      const candidateStudentCode = String(loginRow?.student_code ?? nextAuth.studentCode ?? nextAuth.studentId ?? '').trim()

      let studentRow: any = null
      if (candidateStudentCode) {
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('*')
          .or(`student_code.eq.${candidateStudentCode},email.eq.${nextAuth.email ?? ''}`)
          .limit(1)

        if (!studentError && Array.isArray(studentRows) && studentRows.length > 0) {
          studentRow = studentRows[0]
        }
      }

      const hydrated: AuthState = {
        ...nextAuth,
        studentCode: String(studentRow?.student_code ?? loginRow?.student_code ?? nextAuth.studentCode ?? nextAuth.studentId ?? '').trim() || nextAuth.studentCode,
        studentId: String(studentRow?.id ?? loginRow?.id ?? nextAuth.studentId ?? nextAuth.studentCode ?? '').trim() || nextAuth.studentId,
        name: String(studentRow?.name ?? loginRow?.full_name ?? nextAuth.name ?? 'Student').trim() || 'Student',
        email: String(studentRow?.email ?? nextAuth.email ?? '').trim() || nextAuth.email,
        course: String(studentRow?.course ?? loginRow?.course ?? nextAuth.course ?? 'Unassigned').trim() || 'Unassigned',
        card: String(nextAuth.card ?? '').trim() || (candidateStudentCode ? `CARD-${candidateStudentCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) || 'STUDENT'}` : 'N/A'),
        avatar_url: studentRow?.avatar_url ?? loginRow?.avatar_url ?? nextAuth.avatar_url ?? null,
      }

      return hydrated
    } catch (err) {
      console.warn('[auth-hydrate] failed', err)
      return nextAuth
    }
  }

  // Restore app-managed auth from localStorage when no Supabase auth present
  useEffect(() => {
    let mounted = true

      ; (async () => {
        try {
          if (!auth) {
            const raw = window.localStorage.getItem('lms-auth')
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed && typeof parsed === 'object') {
                const hydrated = await hydrateAuthFromDatabase(parsed)
                if (mounted) setAuth(hydrated)
              }
            }
          }
        } catch (e) {
          // ignore
        }
      })()

    return () => { mounted = false }
  }, [])

  // Try to restore Supabase auth session on load and hydrate profile/avatar
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const { data } = await supabase.auth.getUser()
          const user = (data as any)?.user ?? null
          if (!user) return

          // Try to load profile row (auth-linked) and student record
          let profileRow: any = null
          try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
            profileRow = p ?? null
          } catch (e) {
            profileRow = null
          }

          let studentRow: any = null
          try {
            const studentId = profileRow?.student_id ?? null
            if (studentId) {
              const { data: s } = await supabase.from('students').select('*').or(`student_code.eq.${studentId},id.eq.${studentId}`).maybeSingle()
              studentRow = s ?? null
            }
          } catch (e) {
            studentRow = null
          }

          if (!mounted) return

          // Build auth state similar to handleLogin
          const name = profileRow?.full_name ?? user?.user_metadata?.full_name ?? user?.email?.split('@')[0]
          const studentCode = studentRow?.student_code ?? profileRow?.student_id ?? undefined
          setAuth({
            role: 'student',
            userId: user.id,
            studentId: studentCode ?? undefined,
            email: profileRow?.email ?? user.email ?? undefined,
            name: name,
            studentCode: studentCode ?? undefined,
            course: studentRow?.course ?? undefined,
            card: studentRow?.card ?? undefined,
            avatar_url: profileRow?.avatar_url ?? studentRow?.avatar_url ?? null,
          })
        } catch (err) {
          // ignore
        }
      })()
    return () => { mounted = false }
  }, [])

  async function handleLogin(role: Role, email: string, password: string) {
    const res = await login(email, password, role)
    const student = res.student ?? null
    const card = res.card ?? null
    const effectiveStudentCode = student?.student_code ?? res.user?.student_code ?? res.user?.student_id ?? email
    const effectiveStudentId = student?.id ?? res.user?.student_id ?? effectiveStudentCode
    const derivedCard = card?.card_no ?? (effectiveStudentCode ? `CARD-${String(effectiveStudentCode).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12) || 'STUDENT'}` : 'N/A')

    setAuth({
      role,
      userId: res.user?.id,
      studentId: effectiveStudentId,
      email: res.user?.email ?? email,
      name: student?.name ?? (res.user?.email ? res.user.email.split('@')[0] : 'Student'),
      studentCode: effectiveStudentCode,
      course: student?.course ?? 'Unassigned',
      card: derivedCard,
      avatar_url: (student as any)?.avatar_url ?? (res.user as any)?.avatar_url ?? null,
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
  if (auth.role === 'student') {
    const handleStudentProfileUpdate = (nextProfile: any) => {
      setAuth((current) => {
        if (!current || current.role !== 'student') return current
        return {
          ...current,
          name: nextProfile?.name ?? current.name,
          email: nextProfile?.email ?? current.email,
          course: nextProfile?.course ?? current.course,
          card: nextProfile?.card ?? current.card,
          studentCode: nextProfile?.studentCode ?? nextProfile?.studentId ?? current.studentCode,
          avatar_url: nextProfile?.avatar_url ?? current.avatar_url,
        }
      })
    }

    return <StudentLayout onLogout={() => setAuth(null)} studentId={auth.studentId} userProfile={{ name: auth.name, studentId: auth.studentCode ?? auth.studentId, email: auth.email, course: auth.course, card: auth.card, studentCode: auth.studentCode, avatar_url: (auth as any).avatar_url ?? null }} onProfileUpdate={handleStudentProfileUpdate} />
  }

  return <AdminLayout onLogout={() => setAuth(null)} dashboard={dashboard} />
}
