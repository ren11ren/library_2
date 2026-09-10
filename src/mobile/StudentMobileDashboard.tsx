import React from 'react'
import {
  LayoutDashboard,
  Search,
  Bookmark,
  RotateCcw,
  Users,
  Library,
  User,
  LogOut,
  ChevronRight,
} from 'lucide-react'

export default function StudentMobileDashboard() {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'my', label: 'My', icon: <Bookmark size={18} /> },
    { id: 'borrowing', label: 'Borrowing', icon: <RotateCcw size={18} /> },
    { id: 'borrower', label: 'Borrower', icon: <Users size={18} /> },
    { id: 'library', label: 'Library', icon: <Library size={18} /> },
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
  ]

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex justify-center">
      <div className="w-full max-w-md p-4">
        {/* Header & Branding */}
        <header className="flex flex-col items-center text-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981] flex items-center justify-center text-white"> 
              <Library size={18} />
            </div>
            <div className="text-sm font-semibold uppercase">LIBRARY sjbcni</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">Student Portal</div>
        </header>

        {/* Top Navigation Bar (wrapped buttons) */}
        <nav className="w-full border-t border-b border-[#E6F4EA] py-2 mb-2">
          <div className="flex flex-wrap gap-2 justify-between">
            {navItems.slice(0, 7).map((it, idx) => {
              const active = it.id === 'dashboard'
              return (
                <button
                  key={it.id}
                  className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg ${active ? 'text-white' : 'text-[#065f46]'} `}
                  style={active ? { backgroundColor: '#10B981', minHeight: 44 } : { backgroundColor: 'transparent', minHeight: 44 }}
                >
                  <span className="opacity-90">{it.icon}</span>
                  <span className="font-medium">{it.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Logout (centered link) */}
        <div className="text-center mb-3">
          <button className="text-[#10B981] text-sm font-medium">Logout</button>
        </div>

        {/* Welcome Header */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Welcome back!</div>
              <div className="text-xs text-gray-500">Your library dashboard is ready.</div>
            </div>
            <div className="text-xs text-gray-500 bg-[#F3F4F6] px-2 py-1 rounded">Live data only</div>
          </div>
        </div>

        {/* Stats Grid (2x2) */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center"> <Library size={16} className="text-[#10B981]" /> </div>
              <div>
                <div className="text-xs text-gray-500">Currently Borrowed</div>
                <div className="text-xl font-semibold">1</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FFF7ED] flex items-center justify-center"> <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> </div>
              <div>
                <div className="text-xs text-gray-500">Due Soon</div>
                <div className="text-xl font-semibold text-[#D97706]">0</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#FEE2E2] flex items-center justify-center"> <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v2" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 13h1" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> </div>
              <div>
                <div className="text-xs text-gray-500">Overdue</div>
                <div className="text-xl font-semibold text-[#EF4444]">0</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center"> <span className="text-[#10B981]">₱</span> </div>
              <div>
                <div className="text-xs text-gray-500">Accrued Fines</div>
                <div className="text-xl font-semibold text-[#EF4444]">₱0.00</div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Loans Section */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Active Loans</div>
            <a className="text-xs text-[#10B981] flex items-center gap-1">View all <ChevronRight size={14} /></a>
          </div>

          <div className="text-xs text-gray-500 uppercase mb-2 grid grid-cols-4 gap-2">
            <div className="col-span-2">BOOK TITLE</div>
            <div className="text-right">DUE DATE</div>
            <div className="text-right">ACTION</div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-[#F3F4F6]">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Structure and Interpretation</div>
              <div className="text-xs text-gray-500">2026-09-22</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs px-2 py-1 rounded-full bg-[#E6F4EA] text-[#10B981]">Active</div>
                <button className="ml-auto h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm">View Card</button>
              </div>
            </div>
          </div>
        </div>

        {/* Library Announcements */}
        <div className="bg-[#F0FDF4] rounded-xl border border-[#E5E7EB] p-3 mb-20">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">clearance signing</div>
              <div className="text-xs text-gray-500 mt-1">for cs 1-4 pm</div>
            </div>
            <div className="text-xs text-gray-500">2026-09-07</div>
          </div>
        </div>

      </div>
    </div>
  )
}
