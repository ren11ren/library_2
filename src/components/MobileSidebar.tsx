import React from 'react'
import { X } from 'lucide-react'

export default function MobileSidebar({ open, onClose, items, active, onSelect, onLogout, title }: {
    open: boolean
    onClose: () => void
    items: { id: string; label: string; icon: React.ReactNode }[]
    active: string
    onSelect: (id: string) => void
    onLogout: () => void
    title: string
}) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-lg p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-sm font-bold">LIBRARY sjbcnl</div>
                        <div className="text-xs text-gray-500">{title}</div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-md bg-gray-100">
                        <X size={18} />
                    </button>
                </div>

                <nav className="flex flex-col gap-2">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onSelect(item.id)
                                onClose()
                            }}
                            className={`flex items-center gap-3 text-left px-3 py-2 rounded-lg ${active === item.id ? 'bg-[#00A86B] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <div className="w-5 h-5">{item.icon}</div>
                            <div className="text-sm font-medium">{item.label}</div>
                        </button>
                    ))}
                </nav>

                <div className="mt-6 border-t pt-4">
                    <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                        Logout
                    </button>
                </div>
            </aside>
        </div>
    )
}
