// Utility to merge arrays of records, avoiding duplicates.
// Matches records by common unique keys (id, studentCode, bookCode, email).
export function mergeRecords(prev = [], incoming = []) {
    const keyCandidates = ['id', 'studentCode', 'student_code', 'bookCode', 'book_code', 'email']
    const makeKey = (obj) => {
        if (!obj || typeof obj !== 'object') return null
        for (const k of keyCandidates) {
            if (obj[k]) return `${k}:${String(obj[k])}`
        }
        return null
    }

    const map = new Map()

    // start with previous items
    for (const p of prev) {
        const k = makeKey(p) || `__prev_${map.size}`
        map.set(k, { ...p })
    }

    // merge/override with incoming items
    for (const inc of incoming) {
        const k = makeKey(inc) || `__inc_${map.size}`
        const existing = map.get(k) || {}
        map.set(k, { ...existing, ...inc })
    }

    return Array.from(map.values())
}

export default mergeRecords
