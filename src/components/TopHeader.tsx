import React from 'react'
import { BookOpen, Search, Bell, ChevronDown } from 'lucide-react'

export default function TopHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E5E7EB] px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center">
            <BookOpen size={18} className="text-[#00A86B]" />
          </div>
          <div>
            <div className="text-slate-800 font-bold text-base">Library Portal</div>
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 px-6">
          <div className="max-w-md mx-auto">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="search"
                placeholder="Search books, authors..."
                className="w-full rounded-full bg-[#F3F6F9] px-12 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                aria-label="Search books"
              />
            </div>
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
