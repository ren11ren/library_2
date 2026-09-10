import React from 'react'
import { LayoutDashboard, Search, Bookmark, RotateCcw, Users, Library, User } from 'lucide-react'

export default function MobileInlineSidebar({ items, active, onSelect }: {
  items: { id: string; label: string; icon?: React.ReactNode }[]
  active: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex-shrink-0 w-20 lg:hidden">
      <div className="h-full flex flex-col items-center py-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${active === it.id ? 'bg-[#00A86B] text-white' : 'bg-white text-gray-700 border border-[#E5E7EB]'}`}
            title={it.label}
          >
            {it.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
