import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { LandingState, Printer } from '../types'

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000

export function AdminLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [lastInteractionMs, setLastInteractionMs] = useState(() => Date.now())
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closingSession, setClosingSession] = useState(false)

  if (!state?.firstName) {
    return <Navigate to="/kiosk" replace />
  }

  if (!state.isAdmin) {
    return <Navigate to="/student" replace state={state} />
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const markInteraction = () => {
      setLastInteractionMs(Date.now())
    }

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focusin']
    events.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction)
    })

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction)
      })
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadPrinters = async () => {
      try {
        const response = await fetch('http://localhost:3000/printers/status')
        if (!response.ok) {
          throw new Error(`Printer status request failed with ${response.status}`)
        }

        const data = (await response.json()) as Printer[]
        if (active) {
          setPrinters(data)
          setError(null)
        }
      } catch (fetchError) {
        if (!active) {
          return
        }

        setPrinters([])
        setError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load printer status.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadPrinters()
    const interval = window.setInterval(() => {
      void loadPrinters()
    }, 2000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const metrics = useMemo(() => {
    const online = printers.filter((printer) => printer.connectivity.state === 'online').length
    const available = printers.filter(
      (printer) => printer.connectivity.state === 'online' && printer.activity.state === 'idle',
    ).length
    const monitored = printers.filter((printer) => printer.enforcement.state !== 'idle').length

    return {
      online,
      available,
      monitored,
    }
  }, [printers])

  const monitoredPrinters = printers.filter((printer) => printer.enforcement.state !== 'idle')
  const timeLabel = formatClock(new Date(nowMs))
  const inactivityRemainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - (nowMs - lastInteractionMs))

  useEffect(() => {
    if (inactivityRemainingMs > 0 || closingSession) {
      return
    }

    void handleCloseSession()
  }, [closingSession, inactivityRemainingMs])

  async function handleCloseSession() {
    if (closingSession) {
      return
    }

    setClosingSession(true)
    navigate('/kiosk', { replace: true })
  }

  return (
    <main className="admin-screen">
      <section className="admin-shell">
        <header className="student-topbar">
          <div className="student-brand">
            <span className="student-brand__mark">PLA</span>
            <div>
              <p className="student-panel__eyebrow">Print Ledger Assistant</p>
              <p className="student-brand__subtle">Admin station</p>
            </div>
          </div>
          <div className="student-clock" aria-label={`Current time ${timeLabel}`}>
            {timeLabel}
          </div>
        </header>

        <section className="session-guard">
          <div className="session-guard__copy">
            <p className="session-guard__eyebrow">Kiosk session</p>
            <p className="session-guard__message">
              Session will be closed automatically in {formatCountdown(inactivityRemainingMs)} if this screen stays inactive.
            </p>
          </div>

          <div className="session-guard__actions">
            <div className="session-guard__timer" aria-live="polite">
              <span className="label">Auto close</span>
              <strong>{formatCountdown(inactivityRemainingMs)}</strong>
            </div>
            <button
              type="button"
              className="session-guard__button"
              disabled={closingSession}
              onClick={() => {
                void handleCloseSession()
              }}
            >
              {closingSession ? 'Closing Session...' : 'Close Session'}
            </button>
          </div>
        </section>

        <section className="admin-hero">
          <div className="admin-hero__copy">
            <p className="student-panel__eyebrow">Admin access</p>
            <h1>Welcome back, {state.firstName}</h1>
            <p className="admin-hero__id">
              {state.cardId ? `Card ${state.cardId}` : 'Card recognized'}
            </p>
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={() => navigate('/printers')}
            >
              Open Printer Diagnostics
            </button>
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={() => navigate('/kiosk', { replace: true })}
            >
              Return to Swipe Screen
            </button>
          </div>
        </section>

        <section className="admin-metrics">
          <article className="admin-metric">
            <span>Online printers</span>
            <strong>{metrics.online}</strong>
          </article>
          <article className="admin-metric">
            <span>Available now</span>
            <strong>{metrics.available}</strong>
          </article>
          <article className="admin-metric">
            <span>Watchdog alerts</span>
            <strong>{metrics.monitored}</strong>
          </article>
        </section>

        <section className="admin-panels">
          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Fleet overview</p>
                <h2>Live printer status</h2>
              </div>
            </div>

            {loading && printers.length === 0 ? <p className="admin-empty">Loading printer status...</p> : null}
            {error ? <p className="admin-empty admin-empty--error">{error}</p> : null}

            <div className="admin-printer-list">
              {printers.map((printer) => {
                const availability = mapPrinterAvailability(printer)

                return (
                  <article key={printer.id} className="admin-printer-row">
                    <div className="admin-printer-row__header">
                      <div className="admin-printer-row__title">
                        <span
                          className={`student-printer-dot student-printer-dot--${availability.tone}`}
                          aria-hidden="true"
                        />
                        <p className="admin-printer-row__name">{printer.name}</p>
                      </div>
                      <span className={`status-pill status-pill--${printer.activity.state}`}>
                        {availability.label}
                      </span>
                    </div>
                    <p className="admin-printer-row__meta">
                      {printer.ip} | {printer.authorization.state} | port {printer.connectivity.lastPort ?? 'n/a'}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Security watch</p>
                <h2>Current attention needed</h2>
              </div>
            </div>

            {monitoredPrinters.length === 0 ? (
              <p className="admin-empty">No printers are currently flagged by the watchdog.</p>
            ) : (
              <div className="admin-alert-list">
                {monitoredPrinters.map((printer) => (
                  <article key={printer.id} className="admin-alert-item">
                    <p className="admin-alert-item__title">{printer.name}</p>
                    <p className="admin-alert-item__detail">{printer.activity.reason}</p>
                  </article>
                ))}
              </div>
            )}

            <button
              type="button"
              className="admin-button admin-button--secondary admin-button--full"
              onClick={() => navigate('/student', { state })}
            >
              Open Student Landing
            </button>
          </section>
        </section>
      </section>
    </main>
  )
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function mapPrinterAvailability(printer: Printer) {
  if (printer.connectivity.state !== 'online') {
    return {
      label: 'Offline',
      tone: 'offline' as const,
    }
  }

  if (printer.activity.state === 'idle') {
    return {
      label: 'Available',
      tone: 'available' as const,
    }
  }

  return {
    label: 'In Use',
    tone: 'busy' as const,
  }
}

function formatCountdown(remainingMs: number) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
