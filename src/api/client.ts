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

export type DuplicateJobStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface DuplicateJobProgress {
  phase: 'hashing' | 'comparing' | 'saving'
  current: number
  total: number
  message: string
}

export interface DuplicateJobState {
  status: DuplicateJobStatus
  startedAt?: number
  finishedAt?: number
  progress?: DuplicateJobProgress
  error?: string
  pairsFound?: number
  listingsCompared?: number
  listingsEligible?: number
}

export interface DuplicateListingSummary {
  id: string
  url: string
  title?: string
  ownerId?: string
  thumbnailUrl?: string
  price?: number
  currency?: string
  district?: string
}

export interface DuplicatePair {
  id: string
  matchRatio: number
  avgSimilarity: number
  comparedAt: number
  listingA: DuplicateListingSummary
  listingB: DuplicateListingSummary
}

export async function fetchDuplicateStatus(): Promise<DuplicateJobState> {
  return getJson('/api/duplicates/status')
}

export async function fetchDuplicates(): Promise<{
  pairs: DuplicatePair[]
  byListingId: Record<string, string[]>
  job: DuplicateJobState
}> {
  return getJson('/api/duplicates')
}

export async function startDuplicateDetection(): Promise<DuplicateJobState> {
  const res = await fetch(`${apiBase()}/api/duplicates/detect`, { method: 'POST' })
  const data = (await res.json()) as DuplicateJobState & { error?: string }
  if (res.status === 409) return data
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}
