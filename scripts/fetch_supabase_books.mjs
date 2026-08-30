import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const supabaseUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
    try {
        const { data, error } = await supabase.from('books').select('*').limit(500)
        if (error) {
            console.error('Supabase error:', error)
            process.exit(2)
        }
        console.log(JSON.stringify(data ?? [], null, 2))
    } catch (err) {
        console.error('Unexpected error:', err)
        process.exit(3)
    }
}

main()
