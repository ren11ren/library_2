import supabase from '../src/supabaseClient.js'

async function main() {
    try {
        const { data, error } = await supabase.from('students').select('*').limit(1)
        console.log('students sample:', error ?? data)
    } catch (e) { console.error('err', e) }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
