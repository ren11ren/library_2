import React from 'react'
import Card from './Card'
import { ChevronRight } from 'lucide-react'

export default function ActiveLoansCard({ onViewCard }: { onViewCard?: () => void } = {}) {
    return (
        <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Active Loans</div>
                <a className="text-xs text-[#00A86B] flex items-center gap-1">View all <ChevronRight size={14} /></a>
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
                        <div className="text-xs px-2 py-1 rounded-full bg-[#E6F4EA] text-[#00A86B]">Active</div>
                        <button onClick={() => onViewCard?.()} className="ml-auto h-9 px-3 rounded-lg border border-[#E5E7EB] text-sm">View Card</button>
                    </div>
                </div>
            </div>
        </Card>
    )
}
