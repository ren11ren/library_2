// This dispatcher chooses the real API or a lightweight mock implementation
import * as Real from './api_real'
import * as Mock from './mockApi'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API = USE_MOCK ? Mock : Real

export const formatDate = API.formatDate
export const addDays = API.addDays
export const computeLoanStatus = API.computeLoanStatus
export const daysOverdue = API.daysOverdue
export const login = API.login
export const fetchBooks = API.fetchBooks
export const fetchStudents = API.fetchStudents
export const fetchLibraryCards = API.fetchLibraryCards
export const fetchSettings = API.fetchSettings
export const fetchAllBorrowingRecords = API.fetchAllBorrowingRecords
export const fetchStudentBorrowingRecords = API.fetchStudentBorrowingRecords
export const fetchActiveBorrowingRecords = API.fetchActiveBorrowingRecords
export const fetchReturnedRecords = API.fetchReturnedRecords
export const upsertBook = API.upsertBook
export const deleteBook = API.deleteBook
export const upsertStudent = API.upsertStudent
export const upsertAppUser = API.upsertAppUser
export const deleteStudent = API.deleteStudent
export const issueLibraryCard = API.issueLibraryCard
export const updateLibraryCard = API.updateLibraryCard
export const deleteLibraryCard = API.deleteLibraryCard
export const borrowBook = API.borrowBook
export const processReturn = API.processReturn
export const markReminderSent = API.markReminderSent
export const updateStudentProfile = API.updateStudentProfile
export const saveSettings = API.saveSettings
export const refreshLoanStatuses = API.refreshLoanStatuses
export const loadDashboardData = API.loadDashboardData
