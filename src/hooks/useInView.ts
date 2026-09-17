import { useEffect, useState, type RefObject } from 'react'

interface UseInViewOptions {
  rootMargin?: string
  once?: boolean
}

export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = '240px', once = true }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || (once && inView)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        if (once) observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin, once, inView])

  return inView
}
