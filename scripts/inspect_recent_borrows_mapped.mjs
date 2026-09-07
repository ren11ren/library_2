import supabase from '../src/supabaseClient.js'

async function main() {
  console.log('Fetching recent borrowing_records...')
  const { data: borrowRows, error: borrowErr } = await supabase
    .from('borrowing_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (borrowErr) {
    console.error('borrowErr', borrowErr)
    process.exit(1)
  }
  if (!borrowRows || borrowRows.length === 0) {
    console.log('no borrow rows')
    return
  }

  const studentIds = [...new Set(borrowRows.map((r) => String(r.student_id ?? '').trim()).filter(Boolean))]
  const bookIds = [...new Set(borrowRows.map((r) => String(r.book_id ?? '').trim()).filter(Boolean))]

  console.log('studentIds', studentIds)
  console.log('bookIds', bookIds)

  const { data: studentRows } = studentIds.length > 0 ? await supabase.from('students').select('id, name, student_code').in('id', studentIds) : { data: [] }
  const { data: loginRowsByStudentId } = studentIds.length > 0 ? await supabase.from('student_login_accounts').select('id, student_id, student_code, full_name').in('student_id', studentIds) : { data: [] }
  const { data: loginRowsById } = studentIds.length > 0 ? await supabase.from('student_login_accounts').select('id, student_id, student_code, full_name').in('id', studentIds) : { data: [] }
  const loginRows = [...(loginRowsByStudentId || []), ...(loginRowsById || [])]
  const { data: profileRows } = studentIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', studentIds) : { data: [] }
  const { data: appUserRows } = studentIds.length > 0 ? await supabase.from('app_users').select('id, email, student_id').in('student_id', studentIds) : { data: [] }
  const { data: bookRows } = bookIds.length > 0 ? await supabase.from('books').select('id, title').in('id', bookIds) : { data: [] }

  console.log('students:', studentRows)
  console.log('login accounts:', loginRows)
  console.log('books:', bookRows)

  const studentMap = new Map(((studentRows || [])).map((s) => [String(s.id || '').trim(), s]))
  const loginMap = new Map()
  ;(loginRows || []).forEach((l) => {
    if (l?.student_id) loginMap.set(String(l.student_id).trim(), l)
    if (l?.id) loginMap.set(String(l.id).trim(), l)
    if (l?.student_code) loginMap.set(String(l.student_code).trim(), l)
  })
  const profileMap = new Map(((profileRows || [])).map((p) => [String(p.id || '').trim(), p]))
  const appUserMap = new Map(((appUserRows || [])).map((a) => [String(a.student_id || '').trim(), a]))

  const bookMap = new Map((bookRows || []).map((b) => [String(b.id).trim(), b]))

  const mapped = borrowRows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: (studentMap.get(String(r.student_id ?? '').trim())?.name) || (loginMap.get(String(r.student_id ?? '').trim())?.full_name) || (profileMap.get(String(r.student_id ?? '').trim())?.full_name) || (appUserMap.get(String(r.student_id ?? '').trim())?.email) || null,
    bookId: r.book_id,
    bookTitle: bookMap.get(String(r.book_id ?? '').trim())?.title || null,
    status: r.status
  }))

  console.log('mapped recent:')
  console.log(JSON.stringify(mapped, null, 2))
}

main().catch((e) => console.error(e))
