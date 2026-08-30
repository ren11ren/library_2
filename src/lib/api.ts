export * from './mockApi'

// Prefer Supabase-backed implementations for user-facing actions so
// changes made in the user area persist to the remote database.
export {
    getBooks as fetchBooks,
    getUserBorrowedBooks as fetchStudentBorrowingRecords,
    borrowBook,
    returnBook as processReturn,
} from '../services/libraryService'
