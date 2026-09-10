import React, { useState } from 'react'
import { Library, Search, Bell, User, ChevronDown, Menu } from 'lucide-react'
import MobileSidebar from './MobileSidebar'

export default function TopNav() {
    const [mobileOpen, setMobileOpen] = useState(false)

    const items = [
        { id: 'dashboard', label: 'Dashboard', icon: <Menu size={16} /> },
        { id: 'search', label: 'Search', icon: <Search size={16} /> },
        { id: 'my', label: 'My', icon: <Library size={16} /> },
        { id: 'borrowing', label: 'Borrowing', icon: <Library size={16} /> },
        { id: 'borrower', label: 'Borrower', icon: <User size={16} /> },
        { id: 'library', label: 'Library', icon: <Library size={16} /> },
        { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    ]
    return (
        <header className="w-full bg-transparent py-3 border-b border-[#E5E7EB]">
            <div className="max-w-4xl mx-auto px-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileOpen(true)} className="sm:hidden p-2 rounded-md bg-white border border-[#E5E7EB] mr-2">
                        <Menu size={18} />
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-[#00A86B] flex items-center justify-center text-white">
                        <Library size={18} />
                    </div>
                    <div className="hidden sm:block">
                        <div className="text-sm font-semibold uppercase text-[#065f46]">Library Portal</div>
                        <div className="text-xs text-gray-500">Student Portal</div>
                    </div>
                </div>

                <div className="flex-1 px-4">
                    <div className="max-w-md mx-auto">
                        <div className="relative">
                            <input placeholder="Search books, authors..." className="w-full rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E6F4EA]" />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="relative w-9 h-9 rounded-lg bg-white flex items-center justify-center border border-[#E5E7EB]">
                        <Bell size={16} />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    </button>
                    <button className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-full px-3 py-1">
                        <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center text-sm font-semibold">JR</div>
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>
            <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} items={items} active={'dashboard'} onSelect={() => { }} onLogout={() => { }} title={'Student Portal'} />
        </header>
    )
}
