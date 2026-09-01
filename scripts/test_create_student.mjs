import supabase from '../src/supabaseClient.js'
import { randomUUID } from 'crypto'

async function run() {
    console.log('Creating test student...')
    const payload = {
        id: randomUUID(),
        student_code: `TEST-${Date.now()}`,
        name: 'Auto Test Student',
        email: `autotest+${Date.now()}@example.com`,
        course: 'BSCS',
        status: 'active'
    }

    const { data, error } = await supabase.from('students').insert([payload]).select().maybeSingle()
    console.log('Insert result:', { data, error })

    const { data: list, error: listErr } = await supabase.from('students').select('*').order('created_at', { ascending: false }).limit(5)
    console.log('Recent students:', listErr ? { error: listErr } : list)
}

run().catch((e) => { console.error(e); process.exit(1) })
