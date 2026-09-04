#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || defaultSupabaseUrl
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
    console.error('Missing service role key. Set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY before running this script.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

function normalizeStudentCode(value = '') {
    const cleaned = String(value).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    return cleaned.startsWith('STU-') ? cleaned : `STU-${cleaned}`
}

function hashPassword(value = '') {
    return createHash('sha256').update(String(value)).digest('hex')
}

async function main() {
    const rows = [
        {
            student_id: 'ADMIN-001',
            student_code: 'STU-ADMIN-001',
            full_name: 'Admin User',
            course: 'Administration',
            year_level: 'Admin',
            password_hash: hashPassword('admin123'),
            status: 'active',
        },
        {
            student_id: 'USER1-001',
            student_code: 'STU-USER1-001',
            full_name: 'Sample User',
            course: 'BSCS',
            year_level: '1st Year',
            password_hash: hashPassword('user123'),
            status: 'active',
        },
    ]

    for (const row of rows) {
        const { data, error } = await supabase
            .from('student_login_accounts')
            .upsert([row], { onConflict: 'student_id' })
            .select()
            .maybeSingle()

        if (error) {
            console.error('Insert failed for:', row.student_id, error)
            continue
        }

        console.log('Seeded:', data)
    }

    console.log('Seeding complete.')
}

main().catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
})
