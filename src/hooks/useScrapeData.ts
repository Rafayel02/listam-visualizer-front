import { useCallback, useEffect, useState } from 'react'
import { fetchListings, fetchOwners, fetchSearchListings, isApiConfigured } from '../api/client'
import type { Listing, Owner, SearchListing } from '../types'

export function useScrapeData(searchId?: string) {
  const [listings, setListings] = useState<Listing[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [searchListings, setSearchListings] = useState<SearchListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setLoading(false)
      setError('Set VITE_API_URL in .env')
      return
    }

    setLoading(true)
    try {
      const [nextListings, nextOwners, nextSearchListings] = await Promise.all([
        fetchListings(searchId),
        fetchOwners(),
        fetchSearchListings(searchId),
      ])
      setListings(nextListings)
      setOwners(nextOwners)
      setSearchListings(nextSearchListings)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [searchId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { listings, owners, searchListings, loading, error, refresh }
}
