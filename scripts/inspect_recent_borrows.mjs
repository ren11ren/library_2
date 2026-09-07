import supabase from '../src/supabaseClient.js'

async function main() {
  console.log('Fetching recent borrowing records (up to 10)...')
  const { data: borrowRows, error: borrowErr } = await supabase.from('borrowing_records').select('*').order('created_at', { ascending: false }).limit(10)
  if (borrowErr) {
    console.error('Error fetching borrowing_records:', borrowErr)
    process.exit(1)
  }

  if (!borrowRows || borrowRows.length === 0) {
    console.log('No borrowing_records found.')
    return
  }

  console.log('Borrowing records:')
  borrowRows.forEach((r, i) => console.log(i + 1, r))

  const bookIds = [...new Set(borrowRows.map((r) => r.book_id).filter(Boolean))]
  if (bookIds.length === 0) {
    console.log('No book_ids referenced by recent borrows.')
    return
  }

  console.log('\nFetching linked books for referenced ids...')
  const { data: bookRows, error: bookErr } = await supabase.from('books').select('*').in('id', bookIds)
  if (bookErr) {
    console.error('Error fetching books:', bookErr)
    process.exit(1)
  }

  console.log('Books:')
  console.log(JSON.stringify(bookRows || [], null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
