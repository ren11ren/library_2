import React from 'react'

export default function MobileDashboard() {
    return (
        <div className="min-h-screen bg-[var(--bg)] p-4">
            {/* Top App Bar */}
            <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white font-bold">📚</div>
                    <div>
                        <div className="text-sm font-semibold text-[var(--text)]">Library Portal</div>
                        <div className="text-xs text-[var(--muted-text)]">Welcome back</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button aria-label="Search" className="w-9 h-9 rounded-lg bg-[var(--surface)] flex items-center justify-center border border-[var(--neutral-border)]">🔍</button>
                    <button aria-label="Notifications" className="w-9 h-9 rounded-lg bg-[var(--surface)] flex items-center justify-center border border-[var(--neutral-border)]">🔔</button>
                    <div className="w-9 h-9 rounded-full bg-[var(--surface)] flex items-center justify-center border border-[var(--neutral-border)] text-sm font-semibold">JR</div>
                </div>
            </header>

            {/* Welcome Banner */}
            <div className="card card-hero mb-4" style={{ background: 'var(--mint)', borderColor: 'transparent' }}>
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white">📗</div>
                    <div className="flex-1">
                        <div className="text-base font-semibold text-[var(--text)]">Welcome back, Jordan 👋</div>
                        <div className="text-sm text-[var(--muted-text)] mt-1">Your library dashboard is ready. <span className="inline-block text-xs bg-white/60 px-2 py-1 rounded">Live data only</span></div>
                    </div>
                </div>
            </div>

            {/* 2x2 Stat Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="card p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[var(--mint)] flex items-center justify-center">📚</div>
                        <div>
                            <div className="text-xs text-[var(--muted-text)]">Currently Borrowed</div>
                            <div className="text-xl font-semibold">1</div>
                        </div>
                    </div>
                </div>
                <div className="card p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[#FFF7ED] flex items-center justify-center">⏰</div>
                        <div>
                            <div className="text-xs text-[var(--muted-text)]">Due Soon</div>
                            <div className="text-xl font-semibold">0</div>
                        </div>
                    </div>
                </div>
                <div className="card p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[#FEE2E2] flex items-center justify-center">❗</div>
                        <div>
                            <div className="text-xs text-[var(--muted-text)]">Overdue</div>
                            <div className="text-xl font-semibold text-[#EF4444]">0</div>
                        </div>
                    </div>
                </div>
                <div className="card p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[var(--mint)] flex items-center justify-center">₱</div>
                        <div>
                            <div className="text-xs text-[var(--muted-text)]">Accrued Fines</div>
                            <div className="text-xl font-semibold">₱0.00</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Loans Card */}
            <div className="card p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold">Active Loans</div>
                    <a className="text-sm text-[var(--accent)]">View all →</a>
                </div>
                <div className="border-t border-[var(--neutral-border)] pt-3">
                    <div className="mb-3">
                        <div className="text-sm font-medium">Structure and Interpretation</div>
                        <div className="text-xs text-[var(--muted-text)] mt-1">Due 2026-09-22</div>
                        <div className="mt-3 flex items-center gap-2">
                            <div className="text-xs px-2 py-1 rounded-full bg-[var(--mint)] text-[var(--accent)]">Active</div>
                            <button className="ml-auto btn btn-primary" style={{ background: '#00A86B' }}>View Card</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcements */}
            <div className="card p-4 mb-4">
                <div className="text-sm font-semibold mb-2">Library Announcements</div>
                <div className="bg-[var(--mint)] p-3 rounded">clearance signing<br /><span className="text-xs text-[var(--muted-text)]">for cs 1–4 pm</span></div>
            </div>

            {/* Quick Actions */}
            <div className="mb-4">
                <button className="w-full h-12 rounded-xl text-white font-semibold" style={{ background: '#00A86B' }}>Search & Borrow Books</button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                    <button className="h-12 rounded-xl border border-[var(--neutral-border)]">View Borrower Card</button>
                    <button className="h-12 rounded-xl border border-[var(--neutral-border)]">My Library Card</button>
                </div>
            </div>

            {/* Library Hours Footer */}
            <div className="card p-4 mb-20">
                <div className="text-sm font-semibold">Library Hours</div>
                <div className="text-xs text-[var(--muted-text)] mt-2">Mon–Fri: 7:00 AM – 8:00 PM<br />Saturday: 8:00 AM – 5:00 PM<br />Sunday: Closed</div>
            </div>

        </div>
    )
}
