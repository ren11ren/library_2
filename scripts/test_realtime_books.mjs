import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrbWN0bGRtaWtwa2d6dXlwaGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Nzc2NjcsImV4cCI6MjEwMzA1MzY2N30.0Xz9sgKpFkFF4w82eCfBvAaIDImzFrV2YB2KcOLgfU4'

const supabaseUrl = process.env.VITE_SUPABASE_URL || defaultSupabaseUrl
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { events: 'postgres_changes' } },
})

async function main() {
  console.log('Subscribing to books changes...')

  const channel = supabase
    .channel('public:books')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, (payload) => {
      console.log('Realtime event:', JSON.stringify(payload, null, 2))
    })
    .subscribe()

  // wait for client to connect
  await new Promise((res) => setTimeout(res, 1500))

  // pick a book with available_copies > 0
  const { data: books } = await supabase.from('books').select('id, available_copies, title').limit(100)
  if (!books || books.length === 0) {
    console.error('No books found to update')
    process.exit(2)
  }

  const book = books.find((b) => Number(b.available_copies ?? 0) > 0) ?? books[0]
  console.log('Selected book for update:', book)

  const newVal = Math.max(Number(book.available_copies ?? 0) - 1, 0)
  console.log(`Updating book ${book.id} available_copies -> ${newVal}`)

  const { data, error } = await supabase.from('books').update({ available_copies: newVal }).eq('id', book.id).select().maybeSingle()
  if (error) {
    console.error('Update error:', error)
    process.exit(3)
  }

  console.log('Update result:', data)

  // wait to receive realtime event
  await new Promise((res) => setTimeout(res, 2500))

  try {
    await supabase.removeChannel(channel)
  } catch (e) {
    // ignore
  }

  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
