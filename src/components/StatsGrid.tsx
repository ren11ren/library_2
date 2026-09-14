import React from 'react'
import Card from './Card'
import { Library } from 'lucide-react'

export default function StatsGrid({
    currentlyBorrowed = 0,
    dueSoonCount = 0,
    overdueCount = 0,
    fines = 0,
}: {
    currentlyBorrowed?: number
    dueSoonCount?: number
    overdueCount?: number
    fines?: number
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <Card className="p-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center text-[#00A86B]"><Library size={16} /></div>
                    <div>
                        <div className="text-xs text-gray-500">Currently Borrowed</div>
                        <div className="text-xl font-semibold">{currentlyBorrowed}</div>
                    </div>
                </div>
            </Card>

            <Card className="p-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#FFF7ED] flex items-center justify-center text-[#F97316]">⏰</div>
                    <div>
                        <div className="text-xs text-gray-500">Due Soon</div>
                        <div className="text-xl font-semibold text-[#F97316]">{dueSoonCount}</div>
                    </div>
                </div>
            </Card>

            <Card className="p-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#FEE2E2] flex items-center justify-center text-[#EF4444]">!</div>
                    <div>
                        <div className="text-xs text-gray-500">Overdue</div>
                        <div className="text-xl font-semibold text-[#EF4444]">{overdueCount}</div>
                    </div>
                </div>
            </Card>

            <Card className="p-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#E6F4EA] flex items-center justify-center text-[#00A86B]">₱</div>
                    <div>
                        <div className="text-xs text-gray-500">Accrued Fines</div>
                        <div className="text-xl font-semibold text-[#EF4444]">₱{fines.toFixed(2)}</div>
                    </div>
                </div>
            </Card>
        </div>
    )
}
