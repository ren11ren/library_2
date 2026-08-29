import { useState, useEffect, type ReactNode } from 'react'
import {
  login,
  fetchStudentBorrowingRecords,
  loadDashboardData,
  borrowBook,
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

const borrowedBooks = [
  { id: 1, title: 'Introduction to Algorithms', author: 'Cormen et al.', borrowDate: 'Jul 25, 2025', dueDate: 'Aug 8, 2025', status: 'overdue' },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin', borrowDate: 'Aug 1, 2025', dueDate: 'Aug 15, 2025', status: 'due-soon' },
  { id: 3, title: 'Design Patterns', author: 'Gang of Four', borrowDate: 'Aug 5, 2025', dueDate: 'Aug 19, 2025', status: 'active' },
]

const searchResults = [
  { id: 'BK-001', isbn: '9780262033848', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest', publisher: 'MIT Press', category: 'Q - Science (Mathematics, physics, chemistry, biology)', copies: 3, available: 2, rack: 'R2', updatedOn: '2022-06-12 11:13:27' },
  { id: 'BK-002', isbn: '9780201896831', title: 'The Art of Computer Programming', author: 'Donald E. Knuth', publisher: 'Addison Wesley', category: 'Q - Science (Mathematics, physics, chemistry, biology)', copies: 2, available: 0, rack: 'R3', updatedOn: '2022-06-12 11:06:01' },
  { id: 'BK-003', isbn: '9780132350884', title: 'Clean Code', author: 'Robert C. Martin', publisher: 'Pearson', category: 'T - Technology and Engineering', copies: 4, available: 3, rack: 'R1', updatedOn: '2022-06-12 13:29:14' },
  { id: 'BK-004', isbn: '9780201633610', title: 'Design Patterns', author: 'Gang of Four', publisher: 'Addison Wesley', category: 'T - Technology and Engineering', copies: 2, available: 1, rack: 'R2', updatedOn: '2022-06-12 12:05:10' },
  { id: 'BK-005', isbn: '9780132126953', title: 'Structure and Interpretation', author: 'Abelson & Sussman', publisher: 'MIT Press', category: 'Q - Science (Mathematics, physics, chemistry, biology)', copies: 1, available: 1, rack: 'R4', updatedOn: '2022-06-12 09:48:30' },
  { id: 'BK-006', isbn: '9780073523323', title: 'Database System Concepts', author: 'Silberschatz et al.', publisher: 'McGraw Hill', category: 'T - Technology and Engineering', copies: 5, available: 4, rack: 'R5', updatedOn: '2022-06-12 09:15:41' },
]

const adminBooks = [
  { id: 'BK-001', isbn: '9780262033848', title: 'Introduction to Algorithms', author: 'Cormen et al.', publisher: 'MIT Press', category: 'Q - Science (Mathematics, physics, chemistry, biology)', copies: 3, available: 2, rack: 'R2', updatedOn: '2022-06-12 11:13:27' },
  { id: 'BK-002', isbn: '9780201896831', title: 'The Art of Computer Programming', author: 'Donald E. Knuth', publisher: 'Addison Wesley', category: 'Q - Science (Mathematics, physics, chemistry, biology)', copies: 2, available: 0, rack: 'R3', updatedOn: '2022-06-12 11:06:01' },
  { id: 'BK-003', isbn: '9780132350884', title: 'Clean Code', author: 'Robert C. Martin', publisher: 'Pearson', category: 'T - Technology and Engineering', copies: 4, available: 3, rack: 'R1', updatedOn: '2022-06-12 13:29:14' },
  { id: 'BK-004', isbn: '9780201633610', title: 'Design Patterns', author: 'Gang of Four', publisher: 'Addison Wesley', category: 'T - Technology and Engineering', copies: 2, available: 1, rack: 'R2', updatedOn: '2022-06-12 12:05:10' },
  { id: 'BK-005', isbn: '9780132126953', title: 'Computer Networks', author: 'Andrew Tanenbaum', publisher: 'Prentice Hall', category: 'T - Technology and Engineering', copies: 3, available: 3, rack: 'R6', updatedOn: '2022-06-12 08:42:56' },
  { id: 'BK-006', isbn: '9780073523323', title: 'Database System Concepts', author: 'Silberschatz et al.', publisher: 'McGraw Hill', category: 'T - Technology and Engineering', copies: 5, available: 4, rack: 'R5', updatedOn: '2022-06-12 09:15:41' },
]

type StudentStatus = 'active' | 'suspended'

const adminStudents: Array<{ id: string; name: string; course: string; card: string; email: string; status: StudentStatus }> = [
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
    <aside className="w-64 shrink-0 bg-green-900 min-h-screen flex flex-col">
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
  const fines = 20
  const overdueCount = borrowedBooks.filter((b) => b.status === 'overdue').length
  const dueSoonCount = borrowedBooks.filter((b) => b.status === 'due-soon').length
  const currentlyBorrowed = borrowedBooks.length

  const announcements = [
    { title: 'Library Hours Extended', date: 'Aug 10, 2025', text: 'The library will be open until 9:00 PM during final exams week (Aug 18–22).' },
    { title: 'New Books Arrived', date: 'Aug 5, 2025', text: '48 new titles added to the Computer Science section. Check Search Books to explore.' },
    { title: 'Fine Waiver Program', date: 'Jul 28, 2025', text: 'Overdue fines from June 2025 are waived if books are returned before August 20.' },
  ]

  const nextDue = borrowedBooks.find((b) => b.status === 'due-soon') ?? borrowedBooks[0]

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-green-900">Welcome back, Maria!</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tuesday, August 12, 2025 — Greenfield College Library</p>
        </div>
        <div className="text-sm text-gray-400">Last updated: Aug 12, 2025</div>
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
            <Table headers={["Book Title", "Due Date", "Status", "Action"]}>
              {borrowedBooks.map((b) => (
                <Tr key={b.id}>
                  <Td className="font-medium text-gray-900">{b.title}</Td>
                  <Td className={b.status === 'overdue' ? 'text-red-600 font-medium' : b.status === 'due-soon' ? 'text-orange-500 font-medium' : ''}>{b.dueDate}</Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td>
                    <button onClick={() => onNavigate('borrower-card')} className="px-3 py-1.5 border border-green-200 text-green-700 text-xs font-medium rounded-lg hover:bg-green-50 transition-colors">View Card</button>
                  </Td>
                </Tr>
              ))}
            </Table>
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
            {nextDue ? (
              <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                <div className="text-xs text-gray-500">{nextDue.title}</div>
                <div className="text-lg font-bold text-orange-600 mt-1">{nextDue.dueDate}</div>
                <div className="text-xs text-gray-400 mt-1">Due Aug 15, 2025</div>
              </div>
            ) : <div className="mt-2 text-sm text-gray-500">No upcoming due dates.</div>}
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

function SearchBooks({ studentId }: { studentId?: string }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [borrowModal, setBorrowModal] = useState<typeof searchResults[0] | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = libraryClassificationCategories
  const filtered = searchResults.filter((b) => {
    const q = query.toLowerCase()
    const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    const matchC = category === 'All' || b.category === category
    return matchQ && matchC
  })

  const handleConfirmBorrow = async () => {
    if (!studentId || !borrowModal) return
    try {
      setBusy(true)
      setError(null)
      await borrowBook(studentId, borrowModal.id)
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
              <p className="text-sm text-gray-500">You have successfully borrowed <span className="font-medium text-gray-700">{borrowModal.title}</span>. Return by <span className="font-medium text-gray-700">Aug 26, 2025</span>.</p>
              <button onClick={() => { setBorrowModal(null); setConfirmed(false); setError(null) }} className="mt-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                Back to Search
              </button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-green-900 mb-4">Confirm Borrowing</h3>
              {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
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
                  onClick={handleConfirmBorrow}
                  disabled={busy}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium text-sm rounded-lg transition-colors"
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
  const student = {
    name: 'Maria Santos',
    id: 'STU-2021-001',
    course: 'BS Computer Science',
    cardNo: 'LC-0042',
  }

  function handleDownloadCard() {
    const content = [
      'Greenfield College Library',
      'Student Name: Maria Santos',
      'Student ID: STU-2021-001',
      'Course: BS Computer Science',
      'Card No.: LC-0042',
      'Valid AY 2025–2026',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'library-card.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Library Card" subtitle="Your digital library identification card." />
      <div className="max-w-sm">
        <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm">
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
            <div className="flex-shrink-0">
              <div className="w-20 h-24 bg-green-100 rounded-lg flex flex-col items-center justify-center text-green-400 border border-green-200">
                <Icons.User />
                <span className="text-xs mt-1 text-green-300">Photo</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 text-sm">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Student Name</div>
                <div className="font-bold text-green-900">{student.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Student ID</div>
                <div className="font-mono font-semibold text-gray-700">{student.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Course</div>
                <div className="text-gray-700">{student.course}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Card No.</div>
                <div className="font-mono font-bold text-green-700">{student.cardNo}</div>
              </div>
            </div>
          </div>

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
              <span className="font-mono text-xs text-green-700 tracking-widest">{student.cardNo}</span>
            </div>
          </div>

          <div className="px-6 py-3 flex items-center justify-between border-t border-green-100">
            <span className="text-xs text-gray-500">Valid AY 2025–2026</span>
            <StatusBadge status="active" />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={handleDownloadCard} className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Download Card
          </button>
          <button onClick={() => window.print()} className="flex-1 py-2.5 border border-green-200 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

function Profile() {
  const [profile, setProfile] = useState({
    name: 'Maria Santos',
    studentId: 'STU-2021-001',
    email: 'maria.santos@college.edu',
    course: 'BS Computer Science — 4th Year',
    card: 'LC-0042',
  })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

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
  const [books, setBooks] = useState(adminBooks)
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

    try {
      setSaving(true)
      setMessage(null)

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

      const saved = await upsertBook({
        ...payload,
        id: editingId ?? undefined,
      } as any)

      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

      setBooks((current) => {
        const next = current.filter((book) => book.id !== (saved.id ?? editingId ?? book.id))
        const item: any = {
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
        }
        return [item, ...next]
      })

      const savedMessage = editingId ? 'Book updated and synced.' : 'Book saved and synced to the database.'
      setMessage(savedMessage)
      resetForm()
    } catch (err: any) {
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
  const [students, setStudents] = useState(adminStudents)
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

    try {
      setSaving(true)
      setMessage(null)
      const saved = await upsertStudent({
        id: editingId ?? undefined,
        student_code: trimmed.student_code,
        name: trimmed.name,
        email: trimmed.email,
        course: trimmed.course,
        status: trimmed.status,
      } as any)

      await upsertAppUser({
        email: trimmed.email,
        password: 'user123',
        role: 'student',
        student_id: saved.id,
      })

      setStudents((current) => {
        const next = current.filter((s) => s.id !== (saved.id ?? editingId ?? s.id))
        const item = {
          id: saved.id ?? trimmed.student_code,
          name: saved.name,
          course: saved.course,
          card: trimmed.card || 'LC-NEW',
          email: saved.email,
          status: saved.status ?? trimmed.status,
        }
        return [item, ...next]
      })

      setShowForm(false)
      setEditingId(null)
      setForm({ student_code: '', name: '', course: 'BSCS', card: '', email: '', status: 'active' as StudentStatus })
      setMessage('Student saved successfully.')
    } catch (err: any) {
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
  const [cardNo, setCardNo] = useState('')
  const [bookQuery, setBookQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleProcessReturn() {
    if (!cardNo.trim() || !bookQuery.trim()) {
      setMessage('Card number and book details are required.')
      return
    }

    try {
      setBusy(true)
      setMessage(null)
      await processReturn(cardNo, bookQuery)
      setMessage('Return recorded and inventory updated.')
      setCardNo('')
      setBookQuery('')
    } catch (err: any) {
      setMessage(err?.message || 'Unable to process this return.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Returns" subtitle="Process book returns and record them." />
      <div className="max-w-lg bg-white rounded-xl border border-green-100 shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-green-900 mb-4">Process Return</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Library Card No. / Student ID</label>
            <input value={cardNo} onChange={(e) => setCardNo(e.target.value)} type="text" placeholder="e.g. LC-0042" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Book ID or Title</label>
            <input value={bookQuery} onChange={(e) => setBookQuery(e.target.value)} type="text" placeholder="e.g. BK-001 or Introduction to Algorithms" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition" />
          </div>
          <button onClick={handleProcessReturn} disabled={busy} className="py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
            {busy ? 'Processing...' : 'Process Return'}
          </button>
          {message && <div className="text-sm text-green-700">{message}</div>}
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
    library_name: 'Greenfield College Library',
    borrow_period_days: '14',
    max_books_per_student: '3',
    fine_per_day: '5.00',
    admin_email: 'librarian@college.edu',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        setForm({
          library_name: settings.library_name ?? 'Greenfield College Library',
          borrow_period_days: String(settings.borrow_period_days ?? 14),
          max_books_per_student: String(settings.max_books_per_student ?? 3),
          fine_per_day: String(settings.fine_per_day ?? 5),
          admin_email: settings.admin_email ?? 'librarian@college.edu',
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

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure library system settings." />
      <div className="max-w-lg bg-white rounded-xl border border-green-100 shadow-sm p-6">
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
    </div>
  )
}

// ─── Student Layout ────────────────────────────────────────────────────────────
function StudentLayout({ onLogout, studentId }: { onLogout: () => void; studentId?: string }) {
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
      case 'search': return <SearchBooks studentId={studentId} />
      case 'borrowed': return <MyBorrowedBooks />
      case 'history': return <BorrowingHistory />
      case 'borrower-card': return <StudentBorrowerCard />
      case 'card': return <LibraryCard />
      case 'profile': return <Profile />
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-green-50">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as StudentView)}
        onLogout={onLogout}
        title="Student Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="w-full p-6 lg:p-8">{renderView()}</div>
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
      case 'dashboard': return <AdminDashboard dashboard={dashboard} />
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
    <div className="flex min-h-screen w-full bg-green-50">
      <Sidebar
        items={navItems}
        active={view}
        onSelect={(id) => setView(id as AdminView)}
        onLogout={onLogout}
        title="Librarian Portal"
      />
      <main className="flex-1 overflow-auto">
        <div className="w-full p-6 lg:p-8">{renderView()}</div>
      </main>
    </div>
  )
}

function AdminDashboard({ dashboard }: { dashboard?: any | null }) {
  const stats = dashboard?.stats ?? null
  const recent = dashboard?.records ?? borrowingRecords
  const overdue = dashboard?.overdue ?? overdueRecords

  const totalBooks = stats?.totalBooks ?? adminBooks.reduce((s, b) => s + (b.copies || 0), 0)
  const availableBooks = stats?.availableBooks ?? adminBooks.reduce((s, b) => s + (b.available || 0), 0)
  const borrowedBooks = stats?.borrowedBooks ?? totalBooks - availableBooks
  const overdueBooks = stats?.overdueBooks ?? overdue.length
  const totalStudents = stats?.totalStudents ?? adminStudents.length
  const thisMonthTx = stats?.thisMonthTx ?? 87

  const monthlyBorrowings = stats?.monthlyBorrowings ?? [58, 74, 91, 67, 112, 87]
  const categoryCounts = stats?.categoryCounts ?? [
    { name: 'T - Technology', count: 11 },
    { name: 'Q - Science', count: 8 },
    { name: 'P - Language', count: 3 },
    { name: 'H - Social Sci', count: 2 },
  ]

  const maxMonth = Math.max(...monthlyBorrowings, 1)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-green-900">Admin Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Library overview — August 2025</p>
        </div>
        <div className="text-sm text-gray-400">Last updated: Aug 12, 2025 · 08:30</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Books</div>
            <div className="mt-2 text-2xl font-bold text-green-800">{totalBooks}</div>
            <div className="text-xs text-gray-400 mt-1">6 titles</div>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 lg:col-span-1">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <div className="text-sm text-gray-500">Available Books</div>
            <div className="mt-2 text-2xl font-bold text-green-700">{availableBooks}</div>
            <div className="text-xs text-gray-400 mt-1">{Math.round((availableBooks / Math.max(totalBooks, 1)) * 100)}% available</div>
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
            <div className="text-xs text-gray-400 mt-1">4 active</div>
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
              <div className="text-sm text-gray-400">Mar - Aug 2025</div>
            </div>

            <div className="grid grid-cols-6 gap-3 items-end h-36">
              {monthlyBorrowings.map((v: number, i: number) => {
                const height = Math.round((v / maxMonth) * 100)
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-full flex items-end">
                      <div className="w-full rounded-t-md bg-green-600" style={{ height: `${height}%` }} />
                    </div>
                    <div className="text-xs text-gray-500">{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][i]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl border border-green-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-green-900">Recent Borrowing Records</h3>
              <button className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1">View all <Icons.ChevronRight /></button>
            </div>
            <Table headers={["Student", "Book", "Due Date", "Status"]}>
              {recent.slice(0, 6).map((r: any, idx: number) => (
                <Tr key={r.txn ?? idx}>
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
              <div className="text-xs text-gray-400">11 titles</div>
            </div>
            <div className="space-y-3">
              {categoryCounts.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 text-sm text-gray-700">{c.name}</div>
                  <div className="w-36 bg-green-50 rounded-full h-3 overflow-hidden">
                    <div className="h-3 bg-green-600" style={{ width: `${Math.min(100, (c.count / (categoryCounts[0].count || 1)) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 w-8 text-right">{c.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm mb-4">
            <h3 className="text-base font-semibold text-green-900 mb-3">Recent Activity</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Icons.Bell /></div>
                <div>
                  <div className="font-medium text-gray-800">Maria Santos borrowed "Introduction to Algorithms"</div>
                  <div className="text-xs text-gray-400">2d ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Icons.Check /></div>
                <div>
                  <div className="font-medium text-gray-800">Carlo Bautista returned "Discrete Mathematics"</div>
                  <div className="text-xs text-gray-400">4d ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Icons.AlertCircle /></div>
                <div>
                  <div className="font-medium text-gray-800">Ana Reyes overdue reminder sent</div>
                  <div className="text-xs text-gray-400">6d ago</div>
                </div>
              </div>
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
export default function App() {
  const [auth, setAuth] = useState<{ role: Role; userId?: string; studentId?: string } | null>(null)
  const [dashboard, setDashboard] = useState<any | null>(null)

  async function handleLogin(role: Role, email: string, password: string) {
    const res = await login(email, password, role)
    setAuth({ role, userId: res.user?.id, studentId: res.student?.id })
  }

  useEffect(() => {
    if (!auth) return

    if (auth.role === 'admin') {
      loadDashboardData().then((d) => setDashboard(d)).catch(() => { })
    }

    if (auth.role === 'student' && auth.studentId) {
      fetchStudentBorrowingRecords(auth.studentId).then(() => { }).catch(() => { })
    }
  }, [auth])

  if (!auth) return <LoginPage onLogin={handleLogin} />
  if (auth.role === 'student') return <StudentLayout onLogout={() => setAuth(null)} studentId={auth.studentId} />
  return <AdminLayout onLogout={() => setAuth(null)} dashboard={dashboard} />
}
