import supabase from '../src/supabaseClient.js'

async function main() {
  console.log('Fetching latest announcements (up to 10)...')
  const { data, error } = await supabase.from('library_announcements').select('*').order('created_at', { ascending: false }).limit(10)
  if (error) {
    console.error('Fetch error:', error)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('No announcements found.')
    return
  }

  console.log('Found announcements:')
  data.forEach((a, i) => console.log(i + 1, a))

  const target = data[0]
  console.log('\nAttempting to delete the most recent announcement:')
  console.log(target)

  const { error: delErr } = await supabase.from('library_announcements').delete().eq('id', target.id)
  if (delErr) {
    console.error('Delete error:', delErr)
    process.exit(1)
  }

  console.log('Delete request sent — now refetching...')
  const { data: after, error: afterErr } = await supabase.from('library_announcements').select('*').order('created_at', { ascending: false }).limit(10)
  if (afterErr) {
    console.error('Refetch error:', afterErr)
    process.exit(1)
  }

  console.log('Announcements after delete:')
  console.log(after || [])
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
