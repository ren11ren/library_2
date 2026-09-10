import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-xl border border-[#E5E7EB] shadow-sm ${className}`}>{children}</div>
    )
}
