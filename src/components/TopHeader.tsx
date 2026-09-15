import React from 'react'
import { BookOpen, Search, Bell, ChevronDown, Menu } from 'lucide-react'

export default function TopHeader({ onMenuClick, userName, onProfileClick }: { onMenuClick?: () => void; userName?: string; onProfileClick?: () => void }) {
    const resolvedName = userName?.trim() || 'Student'
    const initials = resolvedName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'S'

    return (
        <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E5E7EB] px-3 py-3 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                {/* Left: Branding */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        className="mobile-menu-button flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white/95 text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A86B] focus-visible:ring-offset-2 md:hidden"
                        aria-label="Open navigation menu"
                    >
                        <Menu size={20} strokeWidth={2.2} />
                    </button>

                    <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center">
                        <BookOpen size={18} className="text-[#00A86B]" />
                    </div>
                    <div>
                        <div className="text-slate-900 font-extrabold text-lg tracking-tight">Library Management</div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button className="relative flex h-10 w-10 items-center justify-center rounded-md text-[#10B981] transition hover:bg-slate-100" aria-label="Notifications">
                        <Bell size={18} className="text-[#10B981]" />
                        <span className="absolute right-[8px] top-[7px] h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" />
                    </button>

                    <button
                        type="button"
                        onClick={onProfileClick}
                        className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1 max-w-[180px] transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A86B] focus-visible:ring-offset-2"
                        aria-label="Open profile"
                    >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">{initials}</div>
                        <span className="truncate text-sm font-medium text-slate-700">{resolvedName}</span>
                        <ChevronDown size={14} className="text-slate-500 shrink-0" />
                    </button>
                </div>
            </div>
        </header>
    )
}
