import React from 'react'
import { BookOpen, Search, Bell, ChevronDown, Menu } from 'lucide-react'

export default function TopHeader({ onMenuClick }: { onMenuClick?: () => void }) {
    return (
        <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E5E7EB] px-3 py-3 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
                {/* Left: Branding */}
                <div className="flex items-center gap-2 sm:gap-3">
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
                        <div className="text-slate-800 font-bold text-base">Library Portal</div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    <button className="relative p-2 rounded-md">
                        <Bell size={18} className="text-[#10B981]" />
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-1 ring-white" />
                    </button>

                    <button className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">JR</div>
                        <ChevronDown size={14} className="text-slate-500" />
                    </button>
                </div>
            </div>
        </header>
    )
}
