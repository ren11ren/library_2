import React from 'react'
import StatsGrid from '../components/StatsGrid'
import ActiveLoansCard from '../components/ActiveLoansCard'
import AnnouncementsCard from '../components/AnnouncementsCard'
import QuickActions from '../components/QuickActions'
import FooterHours from '../components/FooterHours'
import MobileSidebar from '../components/MobileSidebar'
import { fetchStudentBorrowingRecords } from '../lib/api'
import supabase from '../supabaseClient'
import { LayoutDashboard, Search, Bookmark, RotateCcw, Users, Library, User } from 'lucide-react'

type AnnouncementItem = {
    title: string
    text: string
    date?: string
}

async function loadAnnouncementItems(): Promise<AnnouncementItem[]> {
    try {
        const { data, error } = await supabase
            .from('library_announcements')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && Array.isArray(data)) {
            return (data as any[]).map((item: any) => ({
                title: String(item.title ?? 'Library notice'),
                text: String(item.text ?? item.message ?? ''),
                date: String(item.date ?? item.created_at?.slice(0, 10) ?? ''),
            })).filter((item) => item.title || item.text)
        }
    } catch {
        // ignore and fall back to local storage next
    }

    if (typeof window === 'undefined') return []

    try {
        const raw = window.localStorage.getItem('library-announcements-v1')
        if (!raw) return []

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.map((item: any) => ({
                title: String(item.title ?? 'Library notice'),
                text: String(item.text ?? item.message ?? ''),
                date: String(item.date ?? item.created_at?.slice(0, 10) ?? ''),
            })).filter((item) => item.title || item.text)
            : []
    } catch {
        return []
    }
}

export default function StudentMobileDashboard({ onNavigate, onLogout, userProfile, currentView }: { onNavigate?: (id: string) => void; onLogout?: () => void; userProfile?: any; currentView?: string } = {}) {
    const items = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'search', label: 'Search Books', icon: <Search size={18} /> },
        { id: 'borrowed', label: 'My Borrowed Books', icon: <Bookmark size={18} /> },
        { id: 'history', label: 'Borrowing History', icon: <RotateCcw size={18} /> },
        { id: 'borrower-card', label: 'Borrower Card', icon: <Users size={18} /> },
        { id: 'card', label: 'Library Card', icon: <Library size={18} /> },
        { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    ]

    const [active, setActive] = React.useState(currentView ?? 'dashboard')
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
    const [loanRows, setLoanRows] = React.useState<Array<{ id: string; title: string; dueDate: string; status: string }>>([])
    const [announcementItems, setAnnouncementItems] = React.useState<AnnouncementItem[]>([])

    const normalizeLoanStatus = (dueDate: string) => {
        if (!dueDate) return 'active'
        const due = new Date(`${dueDate}T00:00:00`)
        if (Number.isNaN(due.getTime())) return 'active'
        const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (diffDays < 0) return 'overdue'
        if (diffDays <= 7) return 'due-soon'
        return 'active'
    }

    React.useEffect(() => {
        if (currentView && currentView !== active) setActive(currentView)
    }, [currentView])

    React.useEffect(() => {
        let active = true

        async function syncAnnouncements() {
            const next = await loadAnnouncementItems()
            if (active) setAnnouncementItems(next)
        }

        void syncAnnouncements()

        const handleUpdated = () => { void syncAnnouncements() }
        window.addEventListener('lms-announcements-updated', handleUpdated)
        return () => {
            active = false
            window.removeEventListener('lms-announcements-updated', handleUpdated)
        }
    }, [])

    React.useEffect(() => {
        const studentKey = String(userProfile?.studentId ?? userProfile?.studentCode ?? userProfile?.email ?? '').trim()
        if (!studentKey) {
            setLoanRows([])
            return
        }

        let activeFlag = true
        async function loadLoans() {
            const records = await fetchStudentBorrowingRecords(studentKey)
            if (!activeFlag) return

            const mapped = records.map((record: any) => ({
                id: String(record.id ?? `${record.title}-${record.dueDate}`),
                title: record.title ?? 'Unknown book',
                dueDate: record.dueDate ?? record.due_date ?? 'N/A',
                status: normalizeLoanStatus(record.dueDate ?? record.due_date ?? '')
            }))
            setLoanRows(mapped)
        }

        void loadLoans()
        return () => { activeFlag = false }
    }, [userProfile?.studentId, userProfile?.studentCode, userProfile?.email])

    const handleNavigate = (id: string) => {
        console.log('[MobileDashboard] navigate ->', id)
        try {
            setActive(id)
            setMobileMenuOpen(false)
            onNavigate?.(id)
        } catch (err) {
            console.error('navigate handler error', err)
        }
    }

    const currentlyBorrowed = loanRows.length
    const overdueCount = loanRows.filter((row) => row.status === 'overdue').length
    const dueSoonCount = loanRows.filter((row) => row.status === 'due-soon').length
    const nextDue = [...loanRows].filter((row) => row.dueDate && row.dueDate !== 'N/A').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null
    const fines = loanRows.reduce((sum, row) => {
        if (row.status !== 'overdue' || !row.dueDate || row.dueDate === 'N/A') return sum
        const due = new Date(`${row.dueDate}T00:00:00`)
        const diffDays = Math.max(0, Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)))
        return sum + diffDays * 5
    }, 0)

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex justify-center">
            <div className="w-full max-w-4xl p-0">
                <div className="mt-1 flex min-w-0 items-start justify-center sm:gap-2">
                    <main className="w-full min-w-0 max-w-md p-2 sm:p-3">

                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 mb-2 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Next due</div>
                                    <div className="text-sm font-semibold text-gray-800 truncate">{nextDue ? nextDue.title : 'No active loans'}</div>
                                    <div className="text-xs text-gray-500 mt-1">{nextDue ? nextDue.dueDate : 'N/A'}</div>
                                </div>
                                <div className="rounded-full bg-[#E6F4EA] px-2 py-1 text-[10px] font-medium text-[#00A86B] shrink-0">
                                    {nextDue ? (nextDue.status === 'overdue' ? 'Overdue' : nextDue.status === 'due-soon' ? 'Due soon' : 'Active') : 'None'}
                                </div>
                            </div>
                        </div>

                        <div className="mb-2"><StatsGrid currentlyBorrowed={currentlyBorrowed} dueSoonCount={dueSoonCount} overdueCount={overdueCount} fines={fines} /></div>

                        <div className="mb-2"><ActiveLoansCard rows={loanRows} onViewCard={() => onNavigate?.('card')} /></div>

                        <div className="mb-2"><QuickActions onSearch={() => onNavigate?.('search')} onViewBorrower={() => onNavigate?.('borrower-card')} onMyCard={() => onNavigate?.('card')} /></div>

                        <div className="mb-2"><AnnouncementsCard items={announcementItems} /></div>

                        <div className="mb-8"><FooterHours /></div>
                    </main>
                </div>
            </div>

            <MobileSidebar
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                items={items}
                active={active}
                onSelect={(id) => handleNavigate(id)}
                onLogout={() => {
                    setMobileMenuOpen(false)
                    onLogout?.()
                }}
                title="Student Portal"
            />
        </div>
    )
}
