import React from 'react'
import { LayoutDashboard, Search, Bookmark, RotateCcw, Users, Library, User } from 'lucide-react'

export default function MobileInlineSidebar({ items, active, onSelect }: {
    items: { id: string; label: string; icon?: React.ReactNode }[]
    active: string
    onSelect: (id: string) => void
}) {
    return (
        <div className="flex-shrink-0 w-16 sm:w-20 lg:hidden">
            <div className="flex h-full flex-col items-center gap-2 py-3">
                {items.map((it) => (
                    <button
                        key={it.id}
                        onClick={() => onSelect(it.id)}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${active === it.id ? 'bg-[#00A86B] text-white' : 'border border-[#E5E7EB] bg-white text-gray-700'}`}
                        title={it.label}
                        aria-label={it.label}
                    >
                        {it.icon}
                    </button>
                ))}
            </div>
        </div>
    )
}
