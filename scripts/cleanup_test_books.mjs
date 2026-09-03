import supabase from '../src/supabaseClient.js'

async function main() {
    console.log('Fetching all books to find test/temp entries...')
    const { data, error } = await supabase.from('books').select('*')
    if (error) {
        console.error('Failed to fetch books', error)
        process.exit(1)
    }

    const candidates = (data || []).filter((b) => {
        const title = (b.title || '').toLowerCase()
        const isbn = (b.isbn || '')
        const id = String(b.id || '')
        return id.startsWith('tmp-') || isbn.toUpperCase().startsWith('TEMP') || title.includes('temp') || title.includes('debug')
    })

    if (candidates.length === 0) {
        console.log('No test/temp books found.')
        process.exit(0)
    }

    console.log('Found', candidates.length, 'candidate book(s) to remove:')
    for (const c of candidates) {
        console.log('-', c.id, '|', c.title, '|', c.isbn)
    }

    // Delete them
    const ids = candidates.map((c) => c.id)
    const { error: delErr, data: delData } = await supabase.from('books').delete().in('id', ids)
    if (delErr) {
        console.error('Failed to delete test books', delErr)
        process.exit(2)
    }

    console.log('Deleted', delData?.length ?? ids.length, 'book(s).')
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(3) })
