import React from 'react'
import { Clock } from 'lucide-react'
import Card from './Card'

export default function FooterHours() {
    return (
        <Card className="p-4">
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-[#F3F4F6]">
                    <Clock size={18} />
                </div>
                <div>
                    <div className="text-sm font-semibold">Library Hours</div>
                    <div className="text-xs text-gray-500 mt-1">
                        Mon–Fri: 7:00 AM – 8:00 PM<br />
                        Saturday: 8:00 AM – 5:00 PM<br />
                        Sunday: Closed
                    </div>
                </div>
            </div>
        </Card>
    )
}
