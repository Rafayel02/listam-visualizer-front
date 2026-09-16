import { isApiConfigured } from './api/client'
import { ShareLinkButton } from './components/ShareLinkButton'
import { useDuplicateDetection } from './hooks/useDuplicateDetection'
import { useScrapeData } from './hooks/useScrapeData'
import { enumParam, useSearchParam } from './hooks/useUrlQuery'
import { AnalyzeView } from './views/AnalyzeView'
import { HistoryView } from './views/HistoryView'
import { LatestView } from './views/LatestView'
import './App.css'

const TABS = ['analyze', 'latest', 'history'] as const
type Tab = (typeof TABS)[number]

function App() {
  const [tab, setTab] = useSearchParam<Tab>('tab', {
    defaultValue: 'analyze',
    ...enumParam(TABS, 'analyze'),
    history: 'push',
  })
  const data = useScrapeData()
  const duplicates = useDuplicateDetection()

  return (
    <div className={`app ${tab === 'analyze' ? 'app-wide' : ''}`}>
      <header>
        <h1>List.am Visualizer</h1>
        <nav>
          <button
            type="button"
            className={tab === 'analyze' ? 'active' : ''}
            onClick={() => setTab('analyze')}
          >
            Analyze
          </button>
          <button
            type="button"
            className={tab === 'latest' ? 'active' : ''}
            onClick={() => setTab('latest')}
          >
            Latest
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'active' : ''}
            onClick={() => setTab('history')}
          >
            History
          </button>
          <ShareLinkButton />
          <button type="button" onClick={() => void data.refresh()} disabled={data.loading}>
            {data.loading ? 'Loading…' : 'Refresh'}
          </button>
        </nav>
      </header>
      <main>
        {!isApiConfigured() && (
          <section className="panel">
            <p className="error">Set VITE_API_URL to your Railway backend URL.</p>
          </section>
        )}
        {data.error && (
          <section className="panel">
            <p className="error">{data.error}</p>
          </section>
        )}
        {tab === 'analyze' && (
          <AnalyzeView
            listings={data.listings}
            owners={data.owners}
            loading={data.loading}
            duplicateJob={duplicates.job}
            duplicatePairs={duplicates.pairs}
            duplicateLoading={duplicates.loading}
            duplicateError={duplicates.error}
            duplicateRunning={duplicates.isRunning}
            listingsWithHashes={duplicates.listingsWithHashes}
            onStartDuplicateDetection={() => void duplicates.start()}
          />
        )}
        {tab === 'latest' && (
          <LatestView
            listings={data.listings}
            owners={data.owners}
            searchListings={data.searchListings}
            duplicateByListingId={duplicates.byListingId}
            loading={data.loading}
          />
        )}
        {tab === 'history' && <HistoryView loading={data.loading} />}
      </main>
    </div>
  )
}

export default App
