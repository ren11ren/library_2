import { useEffect, useState } from 'react'
import supabase, { mapKeysToCamel } from '../supabaseClient'
import mergeRecords from '../lib/mergeRecords'

type RealtimePayload = any

// Hook to fetch initial table data and subscribe to realtime changes.
export function useSupabaseRealtime(tableName: string) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<any | null>(null)

    useEffect(() => {
        let mounted = true

        async function fetchInitial() {
            setLoading(true)
            setError(null)
            try {
                const { data: initialData, error } = await supabase.from(tableName).select('*')
                if (error) {
                    console.error('Initial fetch error for', tableName, error)
                    setError(error)
                } else if (mounted) {
                    setData((initialData ?? []).map(mapKeysToCamel))
                }
            } catch (err) {
                console.error('Unexpected fetch error', err)
                setError(err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchInitial()

        console.debug(`[realtime] subscribing to public.${tableName}`)
        const channel = supabase
            .channel(`public:${tableName}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: tableName },
                (payload: RealtimePayload) => {
                    console.debug(`[realtime] ${tableName} payload:`, payload)
                    try {
                        const ev = payload.eventType || payload.event
                        const newRow = mapKeysToCamel(payload.new)
                        const oldRow = payload.old ? mapKeysToCamel(payload.old) : null

                        if (ev === 'INSERT') {
                            setData((prev) => mergeRecords(prev, [newRow]))
                        } else if (ev === 'UPDATE') {
                            setData((prev) => mergeRecords(prev, [newRow]))
                        } else if (ev === 'DELETE') {
                            setData((prev) => prev.filter((r) => r.id !== oldRow?.id))
                        }
                    } catch (err) {
                        console.error('Realtime payload handling error', err, payload)
                    }
                }
            )
            .subscribe()
        console.debug(`[realtime] channel created for public.${tableName}`)

        return () => {
            mounted = false
            try {
                supabase.removeChannel(channel)
            } catch (err) {
                // ignore cleanup errors
            }
        }
    }, [tableName])

    return { data, loading, error }
}

export default useSupabaseRealtime
