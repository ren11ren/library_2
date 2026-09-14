import React from 'react'
import Card from './Card'

type AnnouncementItem = {
    title: string
    text: string
    date?: string
}

export default function AnnouncementsCard({ items = [] }: { items?: AnnouncementItem[] }) {
    const announcementList = items.length ? items : []

    if (!announcementList.length) {
        return (
            <Card className="p-3 bg-[#F0FDF4] border-[#E5E7EB]">
                <div className="text-sm text-gray-500">No announcements yet.</div>
            </Card>
        )
    }

    return (
        <div className="space-y-2">
            {announcementList.map((item, index) => (
                <Card key={`${item.title}-${index}`} className="p-3 bg-[#F0FDF4] border-[#E5E7EB]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-800 break-words">{item.title}</div>
                            <div className="text-xs text-gray-600 mt-1 break-words leading-relaxed">{item.text}</div>
                        </div>
                        {item.date && <div className="text-[11px] text-gray-500 whitespace-nowrap">{item.date}</div>}
                    </div>
                </Card>
            ))}
        </div>
    )
}
