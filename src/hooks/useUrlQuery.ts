import { useCallback, useEffect, useState } from 'react'

function getSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

export function updateSearchParams(
  updates: Record<string, string | null | undefined>,
  method: 'replace' | 'push' = 'replace',
): void {
  const params = getSearchParams()
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const search = params.toString()
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
  if (method === 'push') {
    window.history.pushState(null, '', url)
  } else {
    window.history.replaceState(null, '', url)
  }
}

export function enumParam<T extends string>(
  valid: readonly T[],
  defaultValue: T,
): {
  parse: (raw: string | null) => T | null
  serialize: (value: T) => string | null
} {
  return {
    parse: (raw) => (raw && valid.includes(raw as T) ? (raw as T) : null),
    serialize: (value) => (value === defaultValue ? null : value),
  }
}

export function optionalStringParam(): {
  parse: (raw: string | null) => string | null
  serialize: (value: string | null) => string | null
} {
  return {
    parse: (raw) => raw || null,
    serialize: (value) => value,
  }
}

export function booleanParam(
  defaultValue = false,
): {
  parse: (raw: string | null) => boolean | null
  serialize: (value: boolean) => string | null
} {
  return {
    parse: (raw) => {
      if (raw === '1' || raw === 'true') return true
      if (raw === '0' || raw === 'false') return false
      return null
    },
    serialize: (value) => (value === defaultValue ? null : value ? '1' : '0'),
  }
}

export function numberParam(
  valid: readonly number[],
  defaultValue: number,
): {
  parse: (raw: string | null) => number | null
  serialize: (value: number) => string | null
} {
  return {
    parse: (raw) => {
      if (!raw) return null
      const value = Number(raw)
      return Number.isFinite(value) && valid.includes(value) ? value : null
    },
    serialize: (value) => (value === defaultValue ? null : String(value)),
  }
}

interface SearchParamOptions<T> {
  defaultValue: T
  parse: (raw: string | null) => T | null
  serialize: (value: T) => string | null
  history?: 'replace' | 'push'
}

export function useSearchParam<T>(
  key: string,
  options: SearchParamOptions<T>,
): [T, (value: T) => void] {
  const { defaultValue, parse, serialize, history = 'replace' } = options

  const read = useCallback((): T => {
    return parse(getSearchParams().get(key)) ?? defaultValue
  }, [key, parse, defaultValue])

  const [value, setValueState] = useState<T>(read)

  const setValue = useCallback(
    (next: T) => {
      setValueState(next)
      updateSearchParams({ [key]: serialize(next) }, history)
    },
    [key, serialize, history],
  )

  useEffect(() => {
    const onPopState = () => setValueState(read())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [read])

  return [value, setValue]
}

export function useBatchSearchParams(): (
  updates: Record<string, string | null | undefined>,
) => void {
  return useCallback((updates) => {
    updateSearchParams(updates, 'replace')
  }, [])
}
