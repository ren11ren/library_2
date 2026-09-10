import React from 'react'
import TopHeader from '../components/TopHeader'
import StatsGrid from '../components/StatsGrid'
import ActiveLoansCard from '../components/ActiveLoansCard'
import AnnouncementsCard from '../components/AnnouncementsCard'
import QuickActions from '../components/QuickActions'
import FooterHours from '../components/FooterHours'
import MobileInlineSidebar from '../components/MobileInlineSidebar'
import { LayoutDashboard, Search, Bookmark, RotateCcw, Users, Library, User } from 'lucide-react'

export default function StudentMobileDashboard() {
    const items = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'search', label: 'Search', icon: <Search size={18} /> },
        { id: 'my', label: 'My', icon: <Bookmark size={18} /> },
        { id: 'borrowing', label: 'Borrowing', icon: <RotateCcw size={18} /> },
        { id: 'borrower', label: 'Borrower', icon: <Users size={18} /> },
        { id: 'library', label: 'Library', icon: <Library size={18} /> },
        { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    ]

    const [active, setActive] = React.useState('dashboard')
    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex justify-center">
            <div className="w-full max-w-4xl p-2">
                <TopHeader />

                <div className="flex gap-3 mt-3 justify-center">
                    <MobileInlineSidebar items={items} active={active} onSelect={(id) => setActive(id)} />

                    <main className="w-full max-w-md p-4">

                        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-lg font-semibold">Welcome back!</div>
                                    <div className="text-xs text-gray-500">Your library dashboard is ready.</div>
                                </div>
                                <div className="text-xs text-gray-500 bg-[#F3F4F6] px-2 py-1 rounded">Live data only</div>
                            </div>
                        </div>

                        <div className="mb-4"><StatsGrid /></div>

                        <div className="mb-4"><ActiveLoansCard /></div>

                        <div className="mb-4"><QuickActions /></div>

                        <div className="mb-4"><AnnouncementsCard /></div>

                        <div className="mb-20"><FooterHours /></div>
                    </main>
                </div>
            </div>
        </div>
    )
}
