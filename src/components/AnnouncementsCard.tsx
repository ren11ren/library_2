import React from 'react'
import Card from './Card'

export default function AnnouncementsCard() {
  return (
    <Card className="p-3 bg-[#F0FDF4] border-[#E5E7EB]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">clearance signing</div>
          <div className="text-xs text-gray-500 mt-1">for cs 1-4 pm</div>
        </div>
        <div className="text-xs text-gray-500">2026-09-07</div>
      </div>
    </Card>
  )
}
