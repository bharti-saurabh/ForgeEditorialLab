import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Top-level safety net. If any view throws during render (e.g. an
 * incompatible persisted state from an older build), we show a recovery screen
 * with a one-click reset instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; harmless in production.
    console.error('Forge crashed during render:', error, info)
  }

  private reset = () => {
    try {
      localStorage.removeItem('forge-state-v1')
    } catch {
      /* ignore */
    }
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-crit/10 text-crit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-ink-900">Something went wrong</h1>
          <p className="mt-1 text-sm text-ink-500">
            The app hit an error while rendering — usually leftover data saved by an older version.
            Resetting local data will clear it and reload. Your API keys and settings will return to
            defaults.
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-ink-50 px-3 py-2 text-left text-[11px] text-ink-500">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-straive-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-straive-600"
          >
            Reset local data & reload
          </button>
        </div>
      </div>
    )
  }
}
