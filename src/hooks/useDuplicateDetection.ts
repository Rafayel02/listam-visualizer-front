import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchDuplicates,
  fetchDuplicateStatus,
  startDuplicateDetection,
  type DuplicatePair,
  type DuplicateJobState,
} from '../api/client'

export function useDuplicateDetection() {
  const [job, setJob] = useState<DuplicateJobState>({ status: 'idle' })
  const [pairs, setPairs] = useState<DuplicatePair[]>([])
  const [byListingId, setByListingId] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDuplicates()
      setPairs(data.pairs)
      setByListingId(data.byListingId)
      setJob(data.job)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const pollStatus = useCallback(async () => {
    try {
      const status = await fetchDuplicateStatus()
      setJob(status)
      if (status.status !== 'running') {
        stopPolling()
        await refresh()
      }
    } catch (err) {
      setError((err as Error).message)
      stopPolling()
    }
  }, [refresh, stopPolling])

  const start = useCallback(async () => {
    setError(null)
    try {
      const state = await startDuplicateDetection()
      setJob(state)
      stopPolling()
      pollRef.current = setInterval(() => void pollStatus(), 2000)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [pollStatus, stopPolling])

  useEffect(() => {
    void refresh()
    return () => stopPolling()
  }, [refresh, stopPolling])

  useEffect(() => {
    if (job.status === 'running' && !pollRef.current) {
      pollRef.current = setInterval(() => void pollStatus(), 2000)
    }
  }, [job.status, pollStatus])

  return {
    job,
    pairs,
    byListingId,
    loading,
    error,
    refresh,
    start,
    isRunning: job.status === 'running',
  }
}
