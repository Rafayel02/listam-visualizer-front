import type { Listing, Owner, SavedSearch, SearchListing } from '../types'

function apiBase(): string {
  const url = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
  if (!url) throw new Error('VITE_API_URL is not set')
  return url
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_URL)
}

export async function fetchSearches(): Promise<SavedSearch[]> {
  return getJson('/api/searches')
}

export async function fetchListings(searchId?: string): Promise<Listing[]> {
  const query = searchId ? `?searchId=${encodeURIComponent(searchId)}` : ''
  return getJson(`/api/listings${query}`)
}

export async function fetchOwners(): Promise<Owner[]> {
  return getJson('/api/owners')
}

export async function fetchSearchListings(searchId?: string): Promise<SearchListing[]> {
  const query = searchId ? `?searchId=${encodeURIComponent(searchId)}` : ''
  return getJson(`/api/search-listings${query}`)
}

export async function fetchOverview(): Promise<{
  searches: number
  listings: number
  owners: number
  completedRuns: number
}> {
  return getJson('/api/stats/overview')
}
