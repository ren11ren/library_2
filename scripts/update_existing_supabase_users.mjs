#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || defaultSupabaseUrl
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
    console.error('Missing Supabase service-role key. Set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY before running this script.')
    process.exit(1)
}

function normalizeStudentCode(value = '') {
    const cleaned = String(value).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    return cleaned.startsWith('STU-') ? cleaned : `STU-${cleaned}`
}

function buildStudentEmailFromCode(value = '') {
    const code = normalizeStudentCode(value).replace(/^STU-/i, '')
    return `${code.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sjbcnl.local`
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
    const { data: students, error: studentError } = await supabase.from('students').select('*')
    if (studentError) {
        throw studentError
    }

    for (const student of students ?? []) {
        const studentCode = student.student_code ? normalizeStudentCode(student.student_code) : null
        const derivedEmail = studentCode ? buildStudentEmailFromCode(studentCode) : null

        if (studentCode && student.email !== derivedEmail) {
            const { error: updateStudentErr } = await supabase
                .from('students')
                .update({ student_code: studentCode, email: derivedEmail })
                .eq('id', student.id)

            if (updateStudentErr) {
                console.error('Failed to update student row:', student.id, updateStudentErr)
            } else {
                console.log('Updated student:', student.id, '->', derivedEmail)
            }
        }

        if (!studentCode) continue

        const { data: appUsers, error: appUserError } = await supabase
            .from('app_users')
            .select('*')
            .or(`student_id.eq.${student.id},email.eq.${student.email},email.eq.${derivedEmail}`)

        if (appUserError) {
            console.error('Failed to find app_users for student:', student.id, appUserError)
            continue
        }

        for (const appUser of appUsers ?? []) {
            const nextEmail = derivedEmail
            const nextPayload = {
                email: nextEmail,
                student_id: student.id,
                role: appUser.role || 'student',
            }

            const { error: updateAppUserErr } = await supabase
                .from('app_users')
                .update(nextPayload)
                .eq('id', appUser.id)

            if (updateAppUserErr) {
                console.error('Failed to update app_user:', appUser.id, updateAppUserErr)
            } else {
                console.log('Updated app_user:', appUser.id, '->', nextEmail)
            }

            const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(appUser.id, {
                email: nextEmail,
            })

            if (updateAuthErr) {
                console.error('Failed to update auth user email:', appUser.id, updateAuthErr)
            } else {
                console.log('Updated auth email:', appUser.id, '->', nextEmail)
            }
        }
    }

    console.log('Student user normalization complete.')
}

main().catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
})
