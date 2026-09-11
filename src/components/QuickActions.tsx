import React from 'react'
import { Search } from 'lucide-react'
import Card from './Card'

export default function QuickActions({ onSearch, onViewBorrower, onMyCard }: { onSearch?: () => void; onViewBorrower?: () => void; onMyCard?: () => void } = {}) {
    return (
        <div>
            <button onClick={() => onSearch?.()} className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2" style={{ background: '#00A86B' }}>
                <Search size={16} />
                <span>Search & Borrow Books</span>
            </button>

            <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={() => onViewBorrower?.()} className="h-12 rounded-xl border border-[#E5E7EB]">View Borrower Card</button>
                <button onClick={() => onMyCard?.()} className="h-12 rounded-xl border border-[#E5E7EB]">My Library Card</button>
            </div>
        </div>
    )
}
