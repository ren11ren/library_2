import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const supabaseUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const books = [
    {
        id: '11111111-aaaa-0000-0000-000000000101',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        category: 'Software Engineering',
        total_copies: 4,
        available_copies: 4,
        cover_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000102',
        title: 'The Pragmatic Programmer',
        author: 'Andrew Hunt',
        isbn: '978-0201616224',
        category: 'Software Engineering',
        total_copies: 3,
        available_copies: 3,
        cover_url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000103',
        title: 'Atomic Habits',
        author: 'James Clear',
        isbn: '978-0735211292',
        category: 'Self Development',
        total_copies: 5,
        available_copies: 5,
        cover_url: 'https://images.unsplash.com/photo-1516979187454-437ec7a5eb12?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000104',
        title: 'Deep Work',
        author: 'Cal Newport',
        isbn: '978-1455586691',
        category: 'Productivity',
        total_copies: 2,
        available_copies: 2,
        cover_url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000105',
        title: 'Rich Dad Poor Dad',
        author: 'Robert T. Kiyosaki',
        isbn: '978-1612680194',
        category: 'Business',
        total_copies: 3,
        available_copies: 3,
        cover_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000106',
        title: 'The Psychology of Money',
        author: 'Morgan Housel',
        isbn: '978-388786',
        category: 'Finance',
        total_copies: 4,
        available_copies: 4,
        cover_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000107',
        title: 'Effective Java',
        author: 'Joshua Bloch',
        isbn: '978-0134685991',
        category: 'Computer Science',
        total_copies: 2,
        available_copies: 2,
        cover_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000108',
        title: 'JavaScript: The Good Parts',
        author: 'Douglas Crockford',
        isbn: '978-0596517748',
        category: 'Web Development',
        total_copies: 3,
        available_copies: 3,
        cover_url: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000109',
        title: 'Algorithms to Live By',
        author: 'Brian Christian',
        isbn: '978-1627790369',
        category: 'Computer Science',
        total_copies: 2,
        available_copies: 2,
        cover_url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
    {
        id: '11111111-aaaa-0000-0000-000000000110',
        title: 'The Alchemist',
        author: 'Paulo Coelho',
        isbn: '978-0061122411',
        category: 'Fiction',
        total_copies: 5,
        available_copies: 5,
        cover_url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
        created_at: '2026-10-20T00:00:00Z',
    },
]

async function main() {
    for (const row of books) {
        const { error } = await supabase.from('books').upsert(row, { onConflict: 'isbn' })
        if (error) {
            console.error('Insert failed for:', row.title, error)
            process.exit(1)
        }
    }

    console.log(`Inserted ${books.length} demo books.`)
}

main().catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
})
