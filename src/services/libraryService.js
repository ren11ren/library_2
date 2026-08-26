import { supabase } from '../supabaseClient'

export async function getBooks(searchQuery = '') {
    let query = supabase.from('books').select('*').order('created_at', { ascending: false })

    if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim()
        query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,category.ilike.%${q}%,isbn.ilike.%${q}%`)
    }

    const { data, error } = await query

    if (error) {
        throw new Error(error.message)
    }

    return data || []
}

export async function getUserBorrowedBooks() {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
        throw new Error(userError.message)
    }

    if (!userData?.user) {
        return []
    }

    const { data, error } = await supabase
        .from('borrow_records')
        .select(`
      id,
      borrow_date,
      due_date,
      return_date,
      status,
      books:book_id (
        id,
        title,
        author,
        isbn,
        category
      )
    `)
        .eq('user_id', userData.user.id)
        .neq('status', 'returned')
        .order('borrow_date', { ascending: false })

    if (error) {
        throw new Error(error.message)
    }

    return data || []
}

export async function borrowBook(bookId) {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
        throw new Error(userError.message)
    }

    if (!userData?.user) {
        throw new Error('Please sign in first to borrow a book.')
    }

    const { data: book, error: bookError } = await supabase
        .from('books')
        .select('id, available_copies')
        .eq('id', bookId)
        .single()

    if (bookError) {
        throw new Error(bookError.message)
    }

    if (!book || book.available_copies <= 0) {
        throw new Error('This book is currently unavailable.')
    }

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('borrow_records').insert([
        {
            user_id: userData.user.id,
            book_id: bookId,
            due_date: dueDate,
            status: 'borrowed',
        },
    ])

    if (error) {
        throw new Error(error.message)
    }

    return true
}

export async function returnBook(recordId) {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
        throw new Error(userError.message)
    }

    if (!userData?.user) {
        throw new Error('Please sign in first to return a book.')
    }

    const { error } = await supabase
        .from('borrow_records')
        .update({
            return_date: new Date().toISOString(),
            status: 'returned',
        })
        .eq('id', recordId)
        .eq('user_id', userData.user.id)

    if (error) {
        throw new Error(error.message)
    }

    return true
}
