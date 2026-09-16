import { useCallback, useState } from 'react'

export function ShareLinkButton() {
  const [copied, setCopied] = useState(false)

  const copyLink = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('textarea')
      input.value = url
      input.setAttribute('readonly', '')
      input.style.position = 'absolute'
      input.style.left = '-9999px'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <button
      type="button"
      className={copied ? 'nav-share nav-share-copied' : 'nav-share'}
      onClick={() => void copyLink()}
      title="Copy link with current tab, filters, and sort"
    >
      {copied ? 'Link copied' : 'Share link'}
    </button>
  )
}
