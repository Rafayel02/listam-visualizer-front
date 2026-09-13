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

export type HistoryEventKind = 'added' | 'removed' | 'updated'

export type OwnerActionCategory =
  | 'added'
  | 'removed'
  | 'price'
  | 'images'
  | 'title'
  | 'description'
  | 'location'
  | 'other'

export interface OwnerActionCounts {
  added: number
  removed: number
  price: number
  images: number
  title: number
  description: number
  location: number
  other: number
  total: number
}

export interface HistoryEvent {
  id: string
  kind: HistoryEventKind
  listingId: string
  title?: string
  url: string
  summary: string
  action: OwnerActionCategory
  ownerId?: string
  ownerName?: string
  ownerProfileUrl?: string
  changedAt: number
  date: string
}

export interface OwnerReputation {
  score: number
  label: string
  rating?: number
  reviewCount?: number
}

export interface OwnerDaySummary {
  ownerId: string
  ownerName?: string
  ownerProfileUrl?: string
  reputation: OwnerReputation
  counts: OwnerActionCounts
}

export interface ReputationTierBreakdown {
  tier: string
  label: string
  minScore: number | null
  maxScore: number | null
  ownerCount: number
  counts: OwnerActionCounts
}

export interface DayActivitySummary {
  totals: OwnerActionCounts
  byReputation: ReputationTierBreakdown[]
  ownerCount: number
}

export interface DayActivitySummaryPage {
  date: string
  label: string
  summary: DayActivitySummary
}

export interface DayOwnersPage {
  date: string
  label: string
  owners: OwnerDaySummary[]
  totalOwners: number
  totalActions: number
  actionOffset: number
  actionLimit: number
  nextActionOffset: number
  hasMore: boolean
  loadedActionCount: number
}

export interface OwnerDayEventsPage {
  date: string
  label: string
  ownerId: string
  ownerName?: string
  ownerProfileUrl?: string
  events: HistoryEvent[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export const UNKNOWN_OWNER_ID = '_unknown'

export interface DaySummary {
  date: string
  label: string
  totalEvents: number
}

export interface DayEventsPage {
  date: string
  label: string
  events: HistoryEvent[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export async function fetchChangeHistorySummary(days = 14): Promise<{
  days: DaySummary[]
  totalEvents: number
}> {
  return getJson(`/api/changes/history?days=${days}`)
}

export async function fetchChangeHistoryDay(
  date: string,
  page = 1,
  limit = 200,
): Promise<DayEventsPage> {
  return getJson(
    `/api/changes/history?date=${encodeURIComponent(date)}&page=${page}&limit=${limit}`,
  )
}

export async function fetchDayActivitySummary(date: string): Promise<DayActivitySummaryPage> {
  return getJson(`/api/changes/history?date=${encodeURIComponent(date)}&view=summary`)
}

export async function fetchChangeHistoryOwners(
  date: string,
  actionOffset = 0,
  actionLimit = 200,
): Promise<DayOwnersPage> {
  return getJson(
    `/api/changes/history?date=${encodeURIComponent(date)}&view=owners&actionOffset=${actionOffset}&actionLimit=${actionLimit}`,
  )
}

export async function fetchOwnerChangeHistoryDay(
  date: string,
  ownerId: string,
  page = 1,
  limit = 200,
): Promise<OwnerDayEventsPage> {
  return getJson(
    `/api/changes/history?date=${encodeURIComponent(date)}&ownerId=${encodeURIComponent(ownerId)}&page=${page}&limit=${limit}`,
  )
}

export interface ActionCorrelation {
  action: OwnerActionCategory | 'total' | 'updates'
  label: string
  r: number
  n: number
}

export interface CorrelationCell {
  x: string
  y: string
  value: number
}

export interface ReputationTierStat {
  label: string
  minScore: number
  ownerCount: number
  avgAdded: number
  avgRemoved: number
  avgPrice: number
  avgImages: number
  avgTotal: number
}

export interface ReputationScatterPoint {
  id: string
  x: number
  y: number
  label: string
}

export interface ReputationChangeCorrelation {
  days: number
  ownerCount: number
  totalEvents: number
  reputationCorrelations: ActionCorrelation[]
  correlationLabels: string[]
  correlationMatrix: CorrelationCell[]
  tiers: ReputationTierStat[]
  scatterTotal: ReputationScatterPoint[]
  scatterPrice: ReputationScatterPoint[]
}

export async function fetchChangeHistoryCorrelation(
  days = 14,
): Promise<ReputationChangeCorrelation> {
  return getJson(`/api/changes/correlation?days=${days}`)
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
  listingsWithHashes?: number
  imagesHashed?: number
  imagesFetched?: number
  imagesFailed?: number
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
  listingsWithHashes: number
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
