import { useEffect, useState } from 'react'

export default function useIsMobile(breakpoint = 430) {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false)

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        try {
            mq.addEventListener('change', handler)
        } catch (e) {
            mq.addListener(handler)
        }
        setIsMobile(mq.matches)
        return () => {
            try {
                mq.removeEventListener('change', handler)
            } catch (e) {
                mq.removeListener(handler)
            }
        }
    }, [breakpoint])

    return isMobile
}
