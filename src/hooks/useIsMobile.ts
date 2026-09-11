import { useEffect, useState } from 'react'

export default function useIsMobile(breakpoint = 430) {
    const getInitial = () => {
        if (typeof window === 'undefined') return false
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`).matches
        const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
        const isUaMobile = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        const hasTouch = typeof navigator !== 'undefined' && ('maxTouchPoints' in navigator ? (navigator as any).maxTouchPoints > 0 : 'ontouchstart' in window)
        return mq || isUaMobile || Boolean(hasTouch)
    }

    const [isMobile, setIsMobile] = useState<boolean>(getInitial)

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches || /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || ('maxTouchPoints' in navigator ? (navigator as any).maxTouchPoints > 0 : 'ontouchstart' in window))
        try {
            mq.addEventListener('change', handler)
        } catch (e) {
            // Safari fallback
            // @ts-ignore
            mq.addListener(handler)
        }
        // also listen for resize as a fallback
        const onResize = () => setIsMobile(getInitial())
        window.addEventListener('resize', onResize)

        return () => {
            try {
                mq.removeEventListener('change', handler)
            } catch (e) {
                // @ts-ignore
                mq.removeListener(handler)
            }
            window.removeEventListener('resize', onResize)
        }
    }, [breakpoint])

    return isMobile
}
