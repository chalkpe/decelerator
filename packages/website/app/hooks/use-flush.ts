import { useCallback, useEffect, useState } from 'react'
import { useEventSource } from 'remix-utils/sse/react'

export function useFlush() {
  const payload = useEventSource('/home/sse', { event: 'flush' })

  const [prev, setPrev] = useState<string[]>([])
  const [current, setCurrent] = useState<string[]>([])

  useEffect(() => {
    if (payload) {
      const data = JSON.parse(payload) as string[]
      if (data.length > 0) setCurrent((prev) => [...prev, ...data])
    }
  }, [payload])

  const flush = useCallback(() => {
    setPrev(current)
    setCurrent([])
  }, [current])

  return { prev, current, flush }
}
