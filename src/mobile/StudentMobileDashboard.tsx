import React from 'react'
import StatsGrid from '../components/StatsGrid'
import ActiveLoansCard from '../components/ActiveLoansCard'
import AnnouncementsCard from '../components/AnnouncementsCard'
import QuickActions from '../components/QuickActions'
import FooterHours from '../components/FooterHours'
import MobileSidebar from '../components/MobileSidebar'
import { LayoutDashboard, Search, Bookmark, RotateCcw, Users, Library, User } from 'lucide-react'

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

    React.useEffect(() => {
        if (currentView && currentView !== active) setActive(currentView)
    }, [currentView])

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

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex justify-center">
            <div className="w-full max-w-4xl p-0">
                <div className="mt-1 flex min-w-0 items-start justify-center sm:gap-2">
                    <main className="w-full min-w-0 max-w-md p-2 sm:p-3">

                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 mb-2 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-lg font-semibold">Welcome back!</div>
                                    <div className="text-xs text-gray-500">Your library dashboard is ready.</div>
                                </div>
                                <div className="text-xs text-gray-500 bg-[#F3F4F6] px-2 py-1 rounded">Live data only</div>
                            </div>
                        </div>

                        <div className="mb-2"><StatsGrid /></div>

                        <div className="mb-2"><ActiveLoansCard onViewCard={() => onNavigate?.('card')} /></div>

                        <div className="mb-2"><QuickActions onSearch={() => onNavigate?.('search')} onViewBorrower={() => onNavigate?.('borrower-card')} onMyCard={() => onNavigate?.('card')} /></div>

                        <div className="mb-2"><AnnouncementsCard /></div>

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
