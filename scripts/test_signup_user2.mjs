import supabase from '../src/supabaseClient.js'

async function main() {
    const email = `testuser${Date.now()}@example.com`
    const password = 'Test1234!'
    console.log('Attempting signUp for', email)
    try {
        const authClient = supabase.auth
        let res
        if (typeof authClient.signUp === 'function') {
            res = await authClient.signUp({ email, password })
        } else if (typeof authClient.signInWithPassword === 'function') {
            res = await authClient.signUp({ email, password })
        } else {
            res = await authClient.signUp({ email, password })
        }
        console.log('signUp response:', res?.error ? res.error : res?.data ?? res)
    } catch (err) {
        console.error('signUp error', err)
    }

    try {
        const { data: sData, error: sErr } = await supabase.from('students').select('*').eq('email', email).maybeSingle()
        console.log('students row:', sErr ?? sData)
    } catch (e) { console.error('students query err', e) }

    try {
        const { data: aData, error: aErr } = await supabase.from('app_users').select('*').eq('email', email).maybeSingle()
        console.log('app_users row:', aErr ?? aData)
    } catch (e) { console.error('app_users query err', e) }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
