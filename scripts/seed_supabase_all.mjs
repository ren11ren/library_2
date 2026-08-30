import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const supabaseUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function upsert(table, rows, conflict) {
    for (const row of rows) {
        const { error } = await supabase.from(table).upsert(row, { onConflict: conflict })
        if (error) {
            console.error(`Failed upsert ${table}:`, error)
            process.exit(2)
        }
    }
}

async function main() {
    // books
    const books = [
        { id: '11111111-aaaa-0000-0000-000000000001', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest', isbn: 'BK-001', category: 'Computer Science', total_copies: 3, available_copies: 2, created_at: '2025-01-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000002', title: 'The Art of Computer Programming', author: 'Donald E. Knuth', isbn: 'BK-002', category: 'Computer Science', total_copies: 2, available_copies: 0, created_at: '2025-02-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000003', title: 'Clean Code', author: 'Robert C. Martin', isbn: 'BK-003', category: 'Software Engineering', total_copies: 4, available_copies: 3, created_at: '2025-03-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000004', title: 'Design Patterns', author: 'Gang of Four', isbn: 'BK-004', category: 'Software Engineering', total_copies: 2, available_copies: 1, created_at: '2025-04-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000005', title: 'Structure and Interpretation', author: 'Abelson & Sussman', isbn: 'BK-005', category: 'Computer Science', total_copies: 1, available_copies: 1, created_at: '2025-05-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000006', title: 'Database System Concepts', author: 'Silberschatz et al.', isbn: 'BK-006', category: 'Database', total_copies: 5, available_copies: 4, created_at: '2025-06-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000007', title: 'Computer Networks', author: 'Andrew Tanenbaum', isbn: 'BK-007', category: 'Networking', total_copies: 3, available_copies: 3, created_at: '2025-07-01T00:00:00Z' },
        { id: '11111111-aaaa-0000-0000-000000000008', title: 'Operating System Concepts', author: 'Silberschatz et al.', isbn: 'BK-008', category: 'Computer Science', total_copies: 2, available_copies: 2, created_at: '2025-08-01T00:00:00Z' },
    ]

    await upsert('books', books, 'id')

    // students
    const students = [
        { id: '11111111-1111-1111-1111-111111111111', student_code: 'STU-2021-001', name: 'Maria Santos', email: 'maria.santos@college.edu', course: 'BS Computer Science', year_level: '4th Year', status: 'active', created_at: '2025-01-01T00:00:00Z' },
        { id: '11111111-1111-1111-1111-222222222222', student_code: 'STU-2021-002', name: 'Juan dela Cruz', email: 'juan.delacruz@college.edu', course: 'BSIT', year_level: '4th Year', status: 'active', created_at: '2025-01-02T00:00:00Z' },
        { id: '11111111-1111-1111-1111-333333333333', student_code: 'STU-2022-015', name: 'Ana Reyes', email: 'ana.reyes@college.edu', course: 'BSCS', year_level: '3rd Year', status: 'suspended', created_at: '2026-01-01T00:00:00Z' },
        { id: '11111111-1111-1111-1111-444444444444', student_code: 'STU-2023-008', name: 'Carlo Bautista', email: 'carlo.bautista@college.edu', course: 'BSECE', year_level: '2nd Year', status: 'active', created_at: '2025-06-01T00:00:00Z' },
        { id: '11111111-1111-1111-1111-555555555555', student_code: 'STU-2023-019', name: 'Lena Villanueva', email: 'lena.villanueva@college.edu', course: 'BSME', year_level: '2nd Year', status: 'active', created_at: '2025-07-01T00:00:00Z' },
    ]

    await upsert('students', students, 'id')

    // app_users
    const appUsers = [
        { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'maria.santos@college.edu', password: 'user123', role: 'student', student_id: '11111111-1111-1111-1111-111111111111', created_at: '2025-01-01T00:00:00Z' },
        { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'juan.delacruz@college.edu', password: 'user123', role: 'student', student_id: '11111111-1111-1111-1111-222222222222', created_at: '2025-01-02T00:00:00Z' },
        { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'librarian@college.edu', password: 'admin123', role: 'admin', student_id: null, created_at: '2025-01-03T00:00:00Z' },
    ]

    await upsert('app_users', appUsers, 'email')

    // library_cards
    const cards = [
        { id: '22222222-aaaa-0000-0000-000000000001', card_no: 'LC-0042', student_id: '11111111-1111-1111-1111-111111111111', issue_date: '2025-08-01', expiry_date: '2026-08-01', status: 'active', created_at: '2025-08-01T00:00:00Z' },
        { id: '22222222-aaaa-0000-0000-000000000002', card_no: 'LC-0043', student_id: '11111111-1111-1111-1111-222222222222', issue_date: '2025-08-01', expiry_date: '2026-08-01', status: 'active', created_at: '2025-08-01T00:00:00Z' },
        { id: '22222222-aaaa-0000-0000-000000000003', card_no: 'LC-0061', student_id: '11111111-1111-1111-1111-333333333333', issue_date: '2025-08-01', expiry_date: '2026-08-01', status: 'suspended', created_at: '2025-08-01T00:00:00Z' },
        { id: '22222222-aaaa-0000-0000-000000000004', card_no: 'LC-0089', student_id: '11111111-1111-1111-1111-444444444444', issue_date: '2025-08-01', expiry_date: '2026-08-01', status: 'active', created_at: '2025-08-01T00:00:00Z' },
        { id: '22222222-aaaa-0000-0000-000000000005', card_no: 'LC-0104', student_id: '11111111-1111-1111-1111-555555555555', issue_date: '2025-08-01', expiry_date: '2026-08-01', status: 'active', created_at: '2025-08-01T00:00:00Z' },
    ]

    await upsert('library_cards', cards, 'id')

    // borrowing_records
    const borrowing = [
        { id: randomUUID(), txn_code: 'TXN-2025-001', student_id: '11111111-1111-1111-1111-111111111111', book_id: '11111111-aaaa-0000-0000-000000000001', borrow_date: '2025-07-25', due_date: '2025-08-08', return_date: null, status: 'overdue', notified: true, condition: null, created_at: '2025-07-25T00:00:00Z' },
        { id: randomUUID(), txn_code: 'TXN-2025-002', student_id: '11111111-1111-1111-1111-222222222222', book_id: '11111111-aaaa-0000-0000-000000000003', borrow_date: '2025-08-01', due_date: '2025-08-15', return_date: null, status: 'due-soon', notified: false, condition: null, created_at: '2025-08-01T00:00:00Z' },
    ]

    await upsert('borrowing_records', borrowing, 'txn_code')

    // settings
    const settings = [{ id: 1, library_name: 'Greenfield College Library', borrow_period_days: 14, max_books_per_student: 3, fine_per_day: 5.0, admin_email: 'librarian@college.edu' }]
    await upsert('settings', settings, 'id')

    console.log('Seed completed')
}

main().catch(err => { console.error(err); process.exit(1) })
