// This dispatcher chooses the real API or a lightweight mock implementation.
// If the database is empty or not yet configured, it falls back to the seeded
// mock data so the app still works for development and demo credentials.
import * as Real from './api_real'
import * as Mock from './mockApi'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

async function maybeFallback<T>(fn: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn()
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? '')
    const shouldFallback = !USE_MOCK && (
      msg.includes('Invalid credentials') ||
      msg.includes('No rows returned') ||
      msg.includes('PGRST116') ||
      msg.includes('does not exist') ||
      msg.includes('not found')
    )

    if (shouldFallback) {
      // eslint-disable-next-line no-console
      console.warn(`Falling back to mock data for ${label}.`)
      return await fallback()
    }

    throw error
  }
}

const API = USE_MOCK ? Mock : Real

export const formatDate = API.formatDate
export const addDays = API.addDays
export const computeLoanStatus = API.computeLoanStatus
export const daysOverdue = API.daysOverdue
export const login = async (emailOrId: string, password: string, role: any) => {
  if (USE_MOCK) return Mock.login(emailOrId, password, role)
  return maybeFallback(() => Real.login(emailOrId, password, role), () => Mock.login(emailOrId, password, role), 'login')
}
export const fetchBooks = USE_MOCK ? Mock.fetchBooks : ((...args: any[]) => maybeFallback(() => Real.fetchBooks(...args), () => Mock.fetchBooks(...args), 'books')) as typeof Real.fetchBooks
export const fetchStudents = USE_MOCK ? Mock.fetchStudents : ((...args: any[]) => maybeFallback(() => Real.fetchStudents(...args), () => Mock.fetchStudents(...args), 'students')) as typeof Real.fetchStudents
export const fetchLibraryCards = USE_MOCK ? Mock.fetchLibraryCards : ((...args: any[]) => maybeFallback(() => Real.fetchLibraryCards(...args), () => Mock.fetchLibraryCards(...args), 'library cards')) as typeof Real.fetchLibraryCards
export const fetchSettings = USE_MOCK ? Mock.fetchSettings : ((...args: any[]) => maybeFallback(() => Real.fetchSettings(...args), () => Mock.fetchSettings(...args), 'settings')) as typeof Real.fetchSettings
export const fetchAllBorrowingRecords = USE_MOCK ? Mock.fetchAllBorrowingRecords : ((...args: any[]) => maybeFallback(() => Real.fetchAllBorrowingRecords(...args), () => Mock.fetchAllBorrowingRecords(...args), 'all borrowing records')) as typeof Real.fetchAllBorrowingRecords
export const fetchStudentBorrowingRecords = USE_MOCK ? Mock.fetchStudentBorrowingRecords : ((...args: any[]) => maybeFallback(() => Real.fetchStudentBorrowingRecords(...args), () => Mock.fetchStudentBorrowingRecords(...args), 'student borrowing records')) as typeof Real.fetchStudentBorrowingRecords
export const fetchActiveBorrowingRecords = USE_MOCK ? Mock.fetchActiveBorrowingRecords : ((...args: any[]) => maybeFallback(() => Real.fetchActiveBorrowingRecords(...args), () => Mock.fetchActiveBorrowingRecords(...args), 'active borrowing records')) as typeof Real.fetchActiveBorrowingRecords
export const fetchReturnedRecords = USE_MOCK ? Mock.fetchReturnedRecords : ((...args: any[]) => maybeFallback(() => Real.fetchReturnedRecords(...args), () => Mock.fetchReturnedRecords(...args), 'returned records')) as typeof Real.fetchReturnedRecords
export const upsertBook = USE_MOCK ? Mock.upsertBook : ((...args: any[]) => maybeFallback(() => Real.upsertBook(...args), () => Mock.upsertBook(...args), 'upsert book')) as typeof Real.upsertBook
export const deleteBook = USE_MOCK ? Mock.deleteBook : ((...args: any[]) => maybeFallback(() => Real.deleteBook(...args), () => Mock.deleteBook(...args), 'delete book')) as typeof Real.deleteBook
export const upsertStudent = USE_MOCK ? Mock.upsertStudent : ((...args: any[]) => maybeFallback(() => Real.upsertStudent(...args), () => Mock.upsertStudent(...args), 'upsert student')) as typeof Real.upsertStudent
export const upsertAppUser = USE_MOCK ? Mock.upsertAppUser : ((...args: any[]) => maybeFallback(() => Real.upsertAppUser(...args), () => Mock.upsertAppUser(...args), 'upsert app user')) as typeof Real.upsertAppUser
export const deleteStudent = USE_MOCK ? Mock.deleteStudent : ((...args: any[]) => maybeFallback(() => Real.deleteStudent(...args), () => Mock.deleteStudent(...args), 'delete student')) as typeof Real.deleteStudent
export const issueLibraryCard = USE_MOCK ? Mock.issueLibraryCard : ((...args: any[]) => maybeFallback(() => Real.issueLibraryCard(...args), () => Mock.issueLibraryCard(...args), 'issue library card')) as typeof Real.issueLibraryCard
export const updateLibraryCard = USE_MOCK ? Mock.updateLibraryCard : ((...args: any[]) => maybeFallback(() => Real.updateLibraryCard(...args), () => Mock.updateLibraryCard(...args), 'update library card')) as typeof Real.updateLibraryCard
export const deleteLibraryCard = USE_MOCK ? Mock.deleteLibraryCard : ((...args: any[]) => maybeFallback(() => Real.deleteLibraryCard(...args), () => Mock.deleteLibraryCard(...args), 'delete library card')) as typeof Real.deleteLibraryCard
export const borrowBook = USE_MOCK ? Mock.borrowBook : ((...args: any[]) => maybeFallback(() => Real.borrowBook(...args), () => Mock.borrowBook(...args), 'borrow book')) as typeof Real.borrowBook
export const processReturn = USE_MOCK ? Mock.processReturn : ((...args: any[]) => maybeFallback(() => Real.processReturn(...args), () => Mock.processReturn(...args), 'process return')) as typeof Real.processReturn
export const markReminderSent = USE_MOCK ? Mock.markReminderSent : ((...args: any[]) => maybeFallback(() => Real.markReminderSent(...args), () => Mock.markReminderSent(...args), 'mark reminder sent')) as typeof Real.markReminderSent
export const updateStudentProfile = USE_MOCK ? Mock.updateStudentProfile : ((...args: any[]) => maybeFallback(() => Real.updateStudentProfile(...args), () => Mock.updateStudentProfile(...args), 'update student profile')) as typeof Real.updateStudentProfile
export const saveSettings = USE_MOCK ? Mock.saveSettings : ((...args: any[]) => maybeFallback(() => Real.saveSettings(...args), () => Mock.saveSettings(...args), 'save settings')) as typeof Real.saveSettings
export const refreshLoanStatuses = USE_MOCK ? Mock.refreshLoanStatuses : ((...args: any[]) => maybeFallback(() => Real.refreshLoanStatuses(...args), () => Mock.refreshLoanStatuses(...args), 'refresh loan statuses')) as typeof Real.refreshLoanStatuses
export const loadDashboardData = USE_MOCK ? Mock.loadDashboardData : ((...args: any[]) => maybeFallback(() => Real.loadDashboardData(...args), () => Mock.loadDashboardData(...args), 'dashboard data')) as typeof Real.loadDashboardData
