#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://qkmctldmikpkgzuyphig.supabase.co'
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || defaultSupabaseUrl
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('Missing service role key. Set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY in your env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const [, , email, password, fullName] = process.argv
if (!email || !password) {
  console.error('Usage: node scripts/create_auth_user.mjs email password [full_name]')
  process.exit(2)
}

async function main() {
  try {
    console.log('Creating auth user for', email)
    const res = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || '' },
    })

    if (res.error) {
      console.error('Auth createUser error:', res.error)
      process.exit(3)
    }

    const user = (res as any).data?.user ?? (res as any).user ?? (res as any).data ?? null
    if (!user || !user.id) {
      console.error('Unexpected createUser response:', res)
      process.exit(4)
    }

    console.log('Created auth user:', user.id, user.email)

    // Upsert profile rows using the service role key
    const studentPayload = {
      id: user.id,
      student_code: `STU-${Date.now()}`,
      name: fullName || email.split('@')[0],
      email,
      course: 'Undeclared',
      status: 'active',
    }

    const { error: sErr } = await supabase.from('students').upsert([studentPayload], { onConflict: 'email' })
    if (sErr) {
      console.error('students upsert error:', sErr)
    } else {
      console.log('students upserted')
    }

    const appUserPayload = { email, role: 'student', student_id: user.id }
    const { error: aErr } = await supabase.from('app_users').upsert([appUserPayload], { onConflict: 'email' })
    if (aErr) {
      console.error('app_users upsert error:', aErr)
    } else {
      console.log('app_users upserted')
    }

    console.log('Done.')
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(5)
  }
}

main()
