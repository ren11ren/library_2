import { useState, useEffect, type ReactNode } from 'react'
import { login, fetchStudentBorrowingRecords, loadDashboardData } from './lib/api'
import { supabase } from './lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'student' | 'admin'
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
  | 'students'
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
const borrowedBooks = [
  { id: 1, title: 'Introduction to Algorithms', author: 'Cormen et al.', borrowDate: 'Jul 25, 2025', dueDate: 'Aug 8, 2025', status: 'overdue' },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin', borrowDate: 'Aug 1, 2025', dueDate: 'Aug 15, 2025', status: 'due-soon' },
  { id: 3, title: 'Design Patterns', author: 'Gang of Four', borrowDate: 'Aug 5, 2025', dueDate: 'Aug 19, 2025', status: 'active' },
]

const searchResults = [
  { id: 'BK-001', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest', category: 'Computer Science', copies: 3, available: 2 },
  { id: 'BK-002', title: 'The Art of Computer Programming', author: 'Donald E. Knuth', category: 'Computer Science', copies: 2, available: 0 },
  { id: 'BK-003', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Engineering', copies: 4, available: 3 },
  { id: 'BK-004', title: 'Design Patterns', author: 'Gang of Four', category: 'Software Engineering', copies: 2, available: 1 },
  { id: 'BK-005', title: 'Structure and Interpretation', author: 'Abelson & Sussman', category: 'Computer Science', copies: 1, available: 1 },
  { id: 'BK-006', title: 'Database System Concepts', author: 'Silberschatz et al.', category: 'Database', copies: 5, available: 4 },
]

const adminBooks = [
  { id: 'BK-001', title: 'Introduction to Algorithms', author: 'Cormen et al.', category: 'Computer Science', copies: 3, available: 2 },
  { id: 'BK-002', title: 'The Art of Computer Programming', author: 'Donald E. Knuth', category: 'Computer Science', copies: 2, available: 0 },
  { id: 'BK-003', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Engineering', copies: 4, available: 3 },
  { id: 'BK-004', title: 'Design Patterns', author: 'Gang of Four', category: 'Software Engineering', copies: 2, available: 1 },
  { id: 'BK-005', title: 'Computer Networks', author: 'Andrew Tanenbaum', category: 'Networking', copies: 3, available: 3 },
  { id: 'BK-006', title: 'Database System Concepts', author: 'Silberschatz et al.', category: 'Database', copies: 5, available: 4 },
]

const adminStudents = [
  { id: 'STU-2021-001', name: 'Maria Santos', course: 'BSCS', card: 'LC-0042', email: 'maria.santos@college.edu', status: 'active' },
  { id: 'STU-2021-002', name: 'Juan dela Cruz', course: 'BSIT', card: 'LC-0043', email: 'juan.delacruz@college.edu', status: 'active' },
  { id: 'STU-2022-015', name: 'Ana Reyes', course: 'BSCS', card: 'LC-0061', email: 'ana.reyes@college.edu', status: 'suspended' },
  { id: 'STU-2023-008', name: 'Carlo Bautista', course: 'BSECE', card: 'LC-0089', email: 'carlo.bautista@college.edu', status: 'active' },
  { id: 'STU-2023-019', name: 'Lena Villanueva', course: 'BSME', card: 'LC-0104', email: 'lena.villanueva@college.edu', status: 'active' },
]

const borrowingRecords = [
  { txn: 'TXN-2025-001', student: 'Maria Santos', card: 'LC-0042', book: 'Introduction to Algorithms', borrow: 'Jul 25, 2025', due: 'Aug 8, 2025', status: 'overdue' },
  { txn: 'TXN-2025-002', student: 'Juan dela Cruz', card: 'LC-0043', book: 'Clean Code', borrow: 'Aug 1, 2025', due: 'Aug 15, 2025', status: 'due-soon' },
  { txn: 'TXN-2025-003', student: 'Carlo Bautista', card: 'LC-0089', book: 'Design Patterns', borrow: 'Aug 5, 2025', due: 'Aug 19, 2025', status: 'active' },
  { txn: 'TXN-2025-004', student: 'Lena Villanueva', card: 'LC-0104', book: 'Database System Concepts', borrow: 'Aug 3, 2025', due: 'Aug 17, 2025', status: 'active' },
  { txn: 'TXN-2025-005', student: 'Ana Reyes', card: 'LC-0061', book: 'The Art of Computer Programming', borrow: 'Jul 10, 2025', due: 'Jul 24, 2025', status: 'overdue' },
]

const overdueRecords = [
  { student: 'Maria Santos', email: 'maria.santos@college.edu', book: 'Introduction to Algorithms', due: 'Aug 8, 2025', daysOverdue: 4, notified: true },
  { student: 'Ana Reyes', email: 'ana.reyes@college.edu', book: 'The Art of Computer Programming', due: 'Jul 24, 2025', daysOverdue: 19, notified: false },
  { student: 'Juan dela Cruz', email: 'juan.delacruz@college.edu', book: 'Operating System Concepts', due: 'Jul 30, 2025', daysOverdue: 13, notified: true },
]

const historyBooks = [
  { title: 'Operating System Concepts', author: 'Silberschatz', borrowDate: 'Jun 1, 2025', returnDate: 'Jun 15, 2025', status: 'returned' },
  { title: 'Discrete Mathematics', author: 'Kenneth Rosen', borrowDate: 'May 10, 2025', returnDate: 'May 22, 2025', status: 'returned' },
  { title: 'Software Engineering', author: 'Ian Sommerville', borrowDate: 'Apr 3, 2025', returnDate: 'Apr 17, 2025', status: 'returned' },
  { title: 'Computer Organization', author: 'William Stallings', borrowDate: 'Mar 5, 2025', returnDate: 'Mar 20, 2025', status: 'returned' },
]

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white">
              <Icons.Library />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-green-900">Library Management System</h1>
              <p className="text-sm text-gray-500 mt-0.5">Greenfield College Library</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {role === 'student' ? 'Email / Student ID' : 'Email'}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'student' ? 'e.g. 2021-001 or maria@college.edu' : 'librarian@college.edu'}
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
          © 2025 Greenfield College Library. All rights reserved.
        </p>
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
    <aside className="w-60 shrink-0 bg-green-900 min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-green-800">
        <div className="flex items-center gap-2.5 text-white">
          <Icons.Library />
          <div>
            <div className="text-sm font-bold leading-tight">Library MS</div>
            <div className="text-xs text-green-300 font-normal">{title}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full ${active === item.id
                ? 'bg-green-600 text-white'
                : 'text-green-200 hover:bg-green-800 hover:text-white'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-green-800">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-200 hover:bg-green-800 hover:text-white transition-colors w-full"
        >
          <Icons.LogOut />
          Logout
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

const allBorrowedEntries = [
  { book: 'Introduction to Algorithms', borrowDate: 'Jul 25, 2025', returnDate: 'Aug 8, 2025', status: 'overdue' },
  { book: 'Clean Code', borrowDate: 'Aug 1, 2025', returnDate: 'Aug 15, 2025', status: 'due-soon' },
  { book: 'Design Patterns', borrowDate: 'Aug 5, 2025', returnDate: 'Aug 19, 2025', status: 'active' },
  { book: 'Operating System Concepts', borrowDate: 'Jun 1, 2025', returnDate: 'Jun 15, 2025', status: 'returned' },
  { book: 'Discrete Mathematics', borrowDate: 'May 10, 2025', returnDate: 'May 22, 2025', status: 'returned' },
  { book: 'Software Engineering', borrowDate: 'Apr 3, 2025', returnDate: 'Apr 17, 2025', status: 'returned' },
  { book: 'Computer Organization', borrowDate: 'Mar 5, 2025', returnDate: 'Mar 20, 2025', status: 'returned' },
]

function StudentBorrowerCard() {
  return (
    <div>
      <PageHeader title="Borrower Card" subtitle="Your official library borrower record card." />
      <div className="max-w-lg">
        {/* Card */}
        <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm">
          {/* Header band */}
          <div className="bg-green-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white">
              <Icons.Library />
              <div>
                <div className="font-bold text-sm leading-tight">Greenfield College Library</div>
                <div className="text-green-200 text-xs tracking-wide">BORROWER'S CARD</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-green-200 text-xs">Card No.</div>
              <div className="font-mono font-bold text-white text-sm">LC-0042</div>
            </div>
          </div>

          {/* Student info strip */}
          <div className="px-6 py-4 bg-green-50 border-b border-green-100 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium block">Name</span>
              <span className="font-semibold text-green-900">Maria Santos</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium block">Student ID</span>
              <span className="font-mono text-gray-700">STU-2021-001</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium block">Course</span>
              <span className="text-gray-700">BS Computer Science</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium block">AY</span>
              <span className="text-gray-700">2025 – 2026</span>
            </div>
          </div>

          {/* Borrowing log table */}
          <div className="px-0">
            <div className="grid grid-cols-12 px-5 py-2 bg-green-800 text-white text-xs font-semibold uppercase tracking-wide">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5 pl-2">Book Title</div>
              <div className="col-span-3 text-center">Date Borrowed</div>
              <div className="col-span-3 text-center">Date Returned</div>
            </div>
            {allBorrowedEntries.map((entry, i) => (
              <div
                key={i}
                className={`grid grid-cols-12 px-5 py-2.5 text-xs border-b border-green-50 items-center ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/60'
                  }`}
              >
                <div className="col-span-1 text-center text-gray-400 font-mono">{i + 1}</div>
                <div className="col-span-5 pl-2 font-medium text-gray-800 leading-snug">{entry.book}</div>
                <div className="col-span-3 text-center text-gray-500">{entry.borrowDate}</div>
                <div className={`col-span-3 text-center font-medium ${entry.status === 'overdue'
                    ? 'text-red-600'
                    : entry.status === 'due-soon'
                      ? 'text-orange-500'
                      : entry.status === 'active'
                        ? 'text-green-600'
                        : 'text-gray-500'
                  }`}>
                  {entry.status === 'active' || entry.status === 'due-soon' || entry.status === 'overdue'
                    ? entry.returnDate
                    : entry.returnDate}
                </div>
              </div>
            ))}
            {/* Empty ruled lines */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`empty-${i}`} className={`grid grid-cols-12 px-5 py-2.5 border-b border-green-50 ${i % 2 === 0 ? 'bg-white' : 'bg-green-50/60'}`}>
                <div className="col-span-1 text-center text-gray-300 text-xs font-mono">{allBorrowedEntries.length + i + 1}</div>
                <div className="col-span-5 pl-2 border-b border-dashed border-gray-200 h-4" />
                <div className="col-span-3 border-b border-dashed border-gray-200 mx-2 h-4" />
                <div className="col-span-3 border-b border-dashed border-gray-200 mx-2 h-4" />
              </div>
            ))}
          </div>

          {/* Legend & signature strip */}
          <div className="px-6 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Due Soon</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Overdue</span>
            </div>
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-400 w-28 text-center">Librarian's Signature</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Print Card
          </button>
          <button className="flex-1 py-2.5 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

function StudentDashboard({ onNavigate }: { onNavigate: (v: StudentView) => void }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-green-900">Welcome back, Maria!</h2>
        <p className="text-sm text-gray-500 mt-0.5">Here's an overview of your library activity.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Currently Borrowed" value={3} color="text-green-700" />
        <StatCard label="Due Soon" value={1} color="text-orange-500" />
        <StatCard label="Overdue" value={1} color="text-red-600" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-green-900">Recent Borrowed Books</h3>
          <button onClick={() => onNavigate('borrowed')} className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
            View all <Icons.ChevronRight />
          </button>
        </div>
        <Table headers={['Book Title', 'Author', 'Borrow Date', 'Due Date', 'Status']}>
          {borrowedBooks.map((b) => (
            <Tr key={b.id}>
              <Td className="font-medium text-gray-900">{b.title}</Td>
              <Td>{b.author}</Td>
              <Td>{b.borrowDate}</Td>
              <Td>{b.dueDate}</Td>
              <Td><StatusBadge status={b.status} /></Td>
            </Tr>
          ))}
        </Table>
      </div>
    </div>
  )
}

function SearchBooks() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [borrowModal, setBorrowModal] = useState<typeof searchResults[0] | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const categories = ['All', 'Computer Science', 'Software Engineering', 'Database', 'Networking']
  const filtered = searchResults.filter((b) => {
    const q = query.toLowerCase()
    const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    const matchC = category === 'All' || b.category === category
    return matchQ && matchC
  })

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
              <p className="text-sm text-gray-500">You have successfully borrowed <span className="font-medium text-gray-700">{borrowModal.title}</span>. Return by <span className="font-medium text-gray-700">Aug 26, 2025</span>.</p>
              <button onClick={() => { setBorrowModal(null); setConfirmed(false) }} className="mt-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                Back to Search
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-green-900 mb-4">Confirm Borrowing</h3>
              <div className="flex flex-col gap-3 text-sm mb-6">
                {[
                  ['Student Name', 'Maria Santos'],
                  ['Library Card No.', 'LC-0042'],
                  ['Book Title', borrowModal.title],
                  ['Author', borrowModal.author],
                  ['Borrow Date', 'Aug 12, 2025'],
                  ['Due Date', 'Aug 26, 2025'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmed(true)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded-lg transition-colors"
                >
                  Confirm Borrow
                </button>
                <button
                  onClick={() => setBorrowModal(null)}
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
      <Table headers={['Book ID', 'Title', 'Author', 'Category', 'Availability', 'Action']}>
        {filtered.map((b) => (
          <Tr key={b.id}>
            <Td className="text-gray-400 font-mono text-xs">{b.id}</Td>
            <Td className="font-medium text-gray-900">{b.title}</Td>
            <Td>{b.author}</Td>
            <Td>
              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-md font-medium">{b.category}</span>
            </Td>
            <Td>
              {b.available > 0
                ? <span className="text-green-600 font-medium">{b.available} / {b.copies} available</span>
                : <span className="text-red-500 font-medium">Not available</span>}
            </Td>
            <Td>
              {b.available > 0 ? (
                <button
                  onClick={() => setBorrowModal(b)}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Borrow
                </button>
              ) : (
                <button className="px-3 py-1.5 border border-gray-200 text-gray-400 text-xs font-medium rounded-lg cursor-not-allowed" disabled>
                  Unavailable
                </button>
              )}
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

// ─── Borrower Card Component ───────────────────────────────────────────────────
type BorrowEntry = typeof borrowedBooks[0]

function BorrowerCardSlip({
  book,
  studentName,
  studentId,
  cardNo,
  course,
  onClose,
}: {
  book: BorrowEntry
  studentName: string
  studentId: string
  cardNo: string
  course: string
  onClose: () => void
}) {
  const txnId = `TXN-2025-00${book.id}`
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
                <span className="font-semibold text-gray-800 text-right">{book.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Author</span>
                <span className="text-gray-700">{book.author}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Loan Period</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">Borrow Date</div>
                <div className="text-sm font-bold text-green-800">{book.borrowDate}</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${book.status === 'overdue' ? 'bg-red-50' : book.status === 'due-soon' ? 'bg-orange-50' : 'bg-green-50'}`}>
                <div className="text-xs text-gray-400 mb-1">Due Date</div>
                <div className={`text-sm font-bold ${book.status === 'overdue' ? 'text-red-600' : book.status === 'due-soon' ? 'text-orange-600' : 'text-green-800'}`}>
                  {book.dueDate}
                </div>
              </div>
            </div>
          </div>

          {/* Status & barcode strip */}
          <div className="flex items-center justify-between py-3 border-t border-green-100">
            <StatusBadge status={book.status} />
            <div className="flex gap-0.5 items-end">
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} style={{ width: i % 3 === 0 ? 3 : 1.5, height: i % 4 === 0 ? 24 : 18, background: '#15803d', opacity: i % 5 === 0 ? 0.35 : 1 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
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

function MyBorrowedBooks() {
  const [selected, setSelected] = useState<BorrowEntry | null>(null)
  return (
    <div>
      <PageHeader title="My Borrowed Books" subtitle="Track your active loans and due dates." />
      <Table headers={['Book Title', 'Author', 'Borrow Date', 'Due Date', 'Status', 'Action']}>
        {borrowedBooks.map((b) => (
          <Tr key={b.id}>
            <Td className="font-medium text-gray-900">{b.title}</Td>
            <Td>{b.author}</Td>
            <Td>{b.borrowDate}</Td>
            <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>
              {b.dueDate}
            </Td>
            <Td><StatusBadge status={b.status} /></Td>
            <Td>
              <button
                onClick={() => setSelected(b)}
                className="px-3 py-1.5 border border-green-200 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 transition-colors"
              >
                Borrower Card
              </button>
            </Td>
          </Tr>
        ))}
      </Table>
      {selected && (
        <BorrowerCardSlip
          book={selected}
          studentName="Maria Santos"
          studentId="STU-2021-001"
          cardNo="LC-0042"
          course="BS Computer Science"
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function BorrowingHistory() {
  return (
    <div>
      <PageHeader title="Borrowing History" subtitle="Your complete library borrowing history." />
      <Table headers={['Book Title', 'Author', 'Borrow Date', 'Return Date', 'Status']}>
        {historyBooks.map((b, i) => (
          <Tr key={i}>
            <Td className="font-medium text-gray-900">{b.title}</Td>
            <Td>{b.author}</Td>
            <Td>{b.borrowDate}</Td>
            <Td>{b.returnDate}</Td>
            <Td><StatusBadge status={b.status} /></Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function LibraryCard() {
  return (
    <div>
      <PageHeader title="Library Card" subtitle="Your digital library identification card." />
      <div className="max-w-sm">
        <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm">
          {/* Card header */}
          <div className="bg-green-700 px-6 py-4">
            <div className="flex items-center gap-2 text-white">
              <Icons.Library />
              <div>
                <div className="font-bold text-sm leading-tight">Greenfield College</div>
                <div className="text-green-200 text-xs">Library Management System</div>
              </div>
            </div>
          </div>

          <div className="p-6 flex gap-5">
            {/* Photo placeholder */}
            <div className="flex-shrink-0">
              <div className="w-20 h-24 bg-green-100 rounded-lg flex flex-col items-center justify-center text-green-400 border border-green-200">
                <Icons.User />
                <span className="text-xs mt-1 text-green-300">Photo</span>
              </div>
            </div>
            {/* Student info */}
            <div className="flex-1 flex flex-col gap-1.5 text-sm">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Student Name</div>
                <div className="font-bold text-green-900">Maria Santos</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Student ID</div>
                <div className="font-mono font-semibold text-gray-700">STU-2021-001</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Course</div>
                <div className="text-gray-700">BS Computer Science</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Card No.</div>
                <div className="font-mono font-bold text-green-700">LC-0042</div>
              </div>
            </div>
          </div>

          {/* QR / barcode area */}
          <div className="border-t border-green-100 px-6 py-4 flex items-center justify-between bg-green-50">
            <div className="text-green-600">
              <Icons.QrCode />
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} style={{ width: i % 3 === 0 ? 3 : 1.5, height: 32, background: '#15803d', opacity: (i % 5 === 0 ? 0.4 : 1) }} />
                ))}
              </div>
              <span className="font-mono text-xs text-green-700 tracking-widest">LC-0042</span>
            </div>
          </div>

          {/* Status */}
          <div className="px-6 py-3 flex items-center justify-between border-t border-green-100">
            <span className="text-xs text-gray-500">Valid AY 2025–2026</span>
            <StatusBadge status="active" />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Download Card
          </button>
          <button className="flex-1 py-2.5 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

function Profile() {
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
            <div className="font-bold text-green-900 text-lg">Maria Santos</div>
            <div className="text-sm text-gray-500">STU-2021-001 · BS Computer Science</div>
          </div>
        </div>
        <div className="grid gap-4">
          {[
            { label: 'Full Name', value: 'Maria Santos' },
            { label: 'Student ID', value: 'STU-2021-001' },
            { label: 'Email', value: 'maria.santos@college.edu' },
            { label: 'Course / Year', value: 'BS Computer Science — 4th Year' },
            { label: 'Library Card', value: 'LC-0042' },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <input
                type="text"
                defaultValue={value}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
          ))}
          <button className="mt-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Admin Views ───────────────────────────────────────────────────────────────

function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-green-900">Admin Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Library overview and statistics — August 2025.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Books" value={1248} color="text-green-700" />
        <StatCard label="Available Books" value={974} color="text-green-600" />
        <StatCard label="Borrowed Books" value={237} color="text-blue-600" />
        <StatCard label="Overdue Books" value={37} color="text-red-600" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-base font-semibold text-green-900 mb-3">Recent Borrowing Records</h3>
          <Table headers={['Student', 'Book', 'Due Date', 'Status']}>
            {borrowingRecords.slice(0, 4).map((r) => (
              <Tr key={r.txn}>
                <Td className="font-medium">{r.student}</Td>
                <Td className="text-gray-500 text-xs">{r.book}</Td>
                <Td>{r.due}</Td>
                <Td><StatusBadge status={r.status} /></Td>
              </Tr>
            ))}
          </Table>
        </div>
        <div>
          <h3 className="text-base font-semibold text-green-900 mb-3">Overdue Alert</h3>
          <Table headers={['Student', 'Book', 'Days Overdue']}>
            {overdueRecords.map((r, i) => (
              <Tr key={i}>
                <Td className="font-medium">{r.student}</Td>
                <Td className="text-gray-500 text-xs">{r.book}</Td>
                <Td className="text-red-600 font-semibold">{r.daysOverdue}d</Td>
              </Tr>
            ))}
          </Table>
        </div>
      </div>
    </div>
  )
}

function AdminBooks() {
  const [query, setQuery] = useState('')
  const filtered = adminBooks.filter((b) =>
    !query || b.title.toLowerCase().includes(query.toLowerCase()) || b.author.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div>
      <PageHeader title="Book Management" subtitle="Manage the library's book inventory." />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
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
        <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />
          Add Book
        </button>
      </div>
      <Table headers={['Book ID', 'Title', 'Author', 'Category', 'Copies', 'Status', 'Actions']}>
        {filtered.map((b) => (
          <Tr key={b.id}>
            <Td className="font-mono text-xs text-gray-400">{b.id}</Td>
            <Td className="font-medium text-gray-900">{b.title}</Td>
            <Td>{b.author}</Td>
            <Td><span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-md font-medium">{b.category}</span></Td>
            <Td>{b.available} / {b.copies}</Td>
            <Td><StatusBadge status={b.available > 0 ? 'active' : 'unavailable'} /></Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Icons.Edit /></button>
                <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function AdminStudents() {
  return (
    <div>
      <PageHeader title="Student Management" subtitle="View and manage registered library students." />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />
          Add Student
        </button>
      </div>
      <Table headers={['Student ID', 'Name', 'Course', 'Card No.', 'Email', 'Status', 'Actions']}>
        {adminStudents.map((s) => (
          <Tr key={s.id}>
            <Td className="font-mono text-xs text-gray-400">{s.id}</Td>
            <Td className="font-medium text-gray-900">{s.name}</Td>
            <Td>{s.course}</Td>
            <Td className="font-mono text-xs text-green-700 font-semibold">{s.card}</Td>
            <Td>{s.email}</Td>
            <Td><StatusBadge status={s.status} /></Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <button className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Icons.Eye /></button>
                <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Icons.Edit /></button>
                <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function AdminBorrowingRecords() {
  return (
    <div>
      <PageHeader title="Borrowing Records" subtitle="All active and historical borrowing transactions." />
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
        <input
          type="text"
          placeholder="Search by student or book..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition max-w-sm"
        />
      </div>
      <Table headers={['Txn ID', 'Student', 'Card No.', 'Book', 'Borrow Date', 'Due Date', 'Status']}>
        {borrowingRecords.map((r) => (
          <Tr key={r.txn}>
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
    </div>
  )
}

function AdminReturns() {
  return (
    <div>
      <PageHeader title="Returns" subtitle="Process book returns and record them." />
      <div className="max-w-lg bg-white rounded-xl border border-green-100 shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-green-900 mb-4">Process Return</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Library Card No. / Student ID</label>
            <input type="text" placeholder="e.g. LC-0042" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Book ID or Title</label>
            <input type="text" placeholder="e.g. BK-001 or Introduction to Algorithms" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
          </div>
          <button className="py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Process Return
          </button>
        </div>
      </div>
      <Table headers={['Student', 'Card No.', 'Book', 'Due Date', 'Return Date', 'Condition']}>
        {[
          { student: 'Carlo Bautista', card: 'LC-0089', book: 'Discrete Mathematics', due: 'Aug 10, 2025', returned: 'Aug 10, 2025', condition: 'Good' },
          { student: 'Lena Villanueva', card: 'LC-0104', book: 'Operating Systems', due: 'Aug 5, 2025', returned: 'Aug 7, 2025', condition: 'Good' },
        ].map((r, i) => (
          <Tr key={i}>
            <Td className="font-medium">{r.student}</Td>
            <Td className="font-mono text-xs text-green-700">{r.card}</Td>
            <Td>{r.book}</Td>
            <Td>{r.due}</Td>
            <Td>{r.returned}</Td>
            <Td><span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-md font-medium">{r.condition}</span></Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function AdminOverdueBooks() {
  return (
    <div>
      <PageHeader title="Overdue Books" subtitle="Students with overdue borrowed books." />
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
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">
                <Icons.Mail />
                Send Reminder
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
  const allCards = [
    ...borrowedBooks,
    { id: 4, title: 'Computer Networks', author: 'Andrew Tanenbaum', borrowDate: 'Aug 3, 2025', dueDate: 'Aug 17, 2025', status: 'active' },
    { id: 5, title: 'Operating System Concepts', author: 'Silberschatz et al.', borrowDate: 'Jul 10, 2025', dueDate: 'Jul 24, 2025', status: 'overdue' },
  ]
  const studentMap: Record<number, { name: string; id: string; card: string; course: string }> = {
    1: { name: 'Maria Santos', id: 'STU-2021-001', card: 'LC-0042', course: 'BSCS' },
    2: { name: 'Juan dela Cruz', id: 'STU-2021-002', card: 'LC-0043', course: 'BSIT' },
    3: { name: 'Carlo Bautista', id: 'STU-2023-008', card: 'LC-0089', course: 'BSECE' },
    4: { name: 'Lena Villanueva', id: 'STU-2023-019', card: 'LC-0104', course: 'BSME' },
    5: { name: 'Ana Reyes', id: 'STU-2022-015', card: 'LC-0061', course: 'BSCS' },
  }

  return (
    <div>
      <PageHeader title="Borrower Cards" subtitle="View and print individual borrower cards for all active loans." />
      <Table headers={['Txn ID', 'Borrower', 'Card No.', 'Book Title', 'Borrow Date', 'Due Date', 'Status', 'Action']}>
        {allCards.map((b) => {
          const stu = studentMap[b.id]
          return (
            <Tr key={b.id}>
              <Td className="font-mono text-xs text-gray-400">TXN-2025-00{b.id}</Td>
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
          studentName={studentMap[selected.id].name}
          studentId={studentMap[selected.id].id}
          cardNo={studentMap[selected.id].card}
          course={studentMap[selected.id].course}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function AdminLibraryCards() {
  return (
    <div>
      <PageHeader title="Library Cards" subtitle="Manage student library cards." />
      <div className="flex justify-between items-center mb-5">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
          <input type="text" placeholder="Search by card or student..." className="pl-10 pr-4 py-2.5 rounded-lg border border-green-200 bg-white text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Icons.Plus />Issue Card
        </button>
      </div>
      <Table headers={['Card No.', 'Student', 'Student ID', 'Course', 'Issue Date', 'Expiry', 'Status', 'Actions']}>
        {adminStudents.map((s, i) => (
          <Tr key={i}>
            <Td className="font-mono text-green-700 font-semibold text-sm">{s.card}</Td>
            <Td className="font-medium">{s.name}</Td>
            <Td className="font-mono text-xs text-gray-400">{s.id}</Td>
            <Td>{s.course}</Td>
            <Td>Aug 1, 2025</Td>
            <Td>Aug 1, 2026</Td>
            <Td><StatusBadge status={s.status} /></Td>
            <Td>
              <div className="flex gap-1.5">
                <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Icons.Edit /></button>
                <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Icons.Trash /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}

function AdminReports() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export library activity reports." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Monthly Borrowing Report', desc: 'Summary of all borrowings for August 2025', icon: <Icons.BarChart /> },
          { title: 'Overdue Report', desc: 'All overdue books and penalty computations', icon: <Icons.AlertCircle /> },
          { title: 'Book Inventory Report', desc: 'Current stock and availability status', icon: <Icons.Book /> },
          { title: 'Student Activity Report', desc: 'Per-student borrowing and return statistics', icon: <Icons.Users /> },
          { title: 'Popular Books Report', desc: 'Most borrowed books this semester', icon: <Icons.FileText /> },
          { title: 'Annual Summary Report', desc: 'Full-year library operations summary', icon: <Icons.History /> },
        ].map((r) => (
          <div key={r.title} className="bg-white rounded-xl border border-green-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="text-green-600">{r.icon}</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{r.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
            </div>
            <button className="mt-auto py-2 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
              Generate PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminSettings() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure library system settings." />
      <div className="max-w-lg bg-white rounded-xl border border-green-100 shadow-sm p-6">
        <div className="flex flex-col gap-5">
          {[
            { label: 'Library Name', value: 'Greenfield College Library' },
            { label: 'Borrow Period (days)', value: '14' },
            { label: 'Max Books Per Student', value: '3' },
            { label: 'Fine Per Day (₱)', value: '5.00' },
            { label: 'Admin Email', value: 'librarian@greenfield.edu' },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <input
                type="text"
                defaultValue={value}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
              />
            </div>
          ))}
          <button className="mt-2 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Student Layout ────────────────────────────────────────────────────────────
function StudentLayout({ onLogout }: { onLogout: () => void }) {
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
      case 'dashboard': return <StudentDashboard onNavigate={setView} />
      case 'search': return <SearchBooks />
      case 'borrowed': return <MyBorrowedBooks />
      case 'history': return <BorrowingHistory />
      case 'borrower-card': return <StudentBorrowerCard />
      case 'card': return <LibraryCard />
      case 'profile': return <Profile />
    }
  }

  return (
    <div className="flex min-h-screen bg-green-50">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as StudentView)}
        onLogout={onLogout}
        title="Student Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl">{renderView()}</div>
      </main>
    </div>
  )
}

// ─── Admin Layout ──────────────────────────────────────────────────────────────
function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<AdminView>('dashboard')

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard /> },
    { id: 'books', label: 'Books', icon: <Icons.Book /> },
    { id: 'students', label: 'Students', icon: <Icons.Users /> },
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
      case 'dashboard': return <AdminDashboard />
      case 'books': return <AdminBooks />
      case 'students': return <AdminStudents />
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
    <div className="flex min-h-screen bg-green-50">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as AdminView)}
        onLogout={onLogout}
        title="Librarian Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-6xl">{renderView()}</div>
      </main>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState<{ role: Role; userId?: string; studentId?: string } | null>(null)
  const [dashboard, setDashboard] = useState<any | null>(null)

  // handle login using API.login
  async function handleLogin(role: Role, email: string, password: string) {
    const res = await login(email, password, role)
    setAuth({ role, userId: res.user?.id, studentId: res.student?.id })
  }

  // load dashboard data for admin
  useEffect(() => {
    if (!auth) return

    let sub: any
    if (auth.role === 'admin') {
      loadDashboardData().then((d) => setDashboard(d)).catch(() => { })
      // subscribe to realtime changes for borrowing_records and books
      sub = supabase
        .channel('public:borrowing_records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records' }, () => {
          loadDashboardData().then((d) => setDashboard(d)).catch(() => { })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
          loadDashboardData().then((d) => setDashboard(d)).catch(() => { })
        })
        .subscribe()
    }

    return () => {
      if (sub) supabase.removeChannel(sub)
    }
  }, [auth])

  // student realtime: subscribe to student's borrowing records
  useEffect(() => {
    if (!auth || auth.role !== 'student' || !auth.studentId) return
    let sub: any
    fetchStudentBorrowingRecords(auth.studentId).then(() => { })
    sub = supabase
      .channel(`student:${auth.studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrowing_records', filter: `student_id=eq.${auth.studentId}` }, () => {
        fetchStudentBorrowingRecords(auth.studentId).then(() => { })
      })
      .subscribe()

    return () => { if (sub) supabase.removeChannel(sub) }
  }, [auth])

  if (!auth) return <LoginPage onLogin={handleLogin} />
  if (auth.role === 'student') return <StudentLayout onLogout={() => setAuth(null)} />
  return <AdminLayout onLogout={() => setAuth(null)} />
}
