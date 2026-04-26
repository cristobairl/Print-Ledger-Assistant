import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { EventItem, LandingState, PrintPolicySettings, Printer } from '../types'

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000

export function AdminLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [lastInteractionMs, setLastInteractionMs] = useState(() => Date.now())
  const [printers, setPrinters] = useState<Printer[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [closingSession, setClosingSession] = useState(false)
  const [printPolicy, setPrintPolicy] = useState<PrintPolicySettings>({ maxPrintHours: 5 })
  const [policyLoading, setPolicyLoading] = useState(true)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [policySaveState, setPolicySaveState] = useState<'idle' | 'saving'>('idle')

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

  useEffect(() => {
    let active = true

    const loadPrintPolicy = async () => {
      try {
        const response = await fetch('http://localhost:3000/settings/printing')
        if (!response.ok) {
          throw new Error(`Print settings request failed with ${response.status}`)
        }

        const data = (await response.json()) as PrintPolicySettings
        if (active) {
          setPrintPolicy(data)
          setPolicyError(null)
        }
      } catch (fetchError) {
        if (!active) {
          return
        }

        setPolicyError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load print rules.',
        )
      } finally {
        if (active) {
          setPolicyLoading(false)
        }
      }
    }

    void loadPrintPolicy()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadEvents = async () => {
      try {
        const response = await fetch('http://localhost:3000/events?eventType=snipe&limit=12')
        if (!response.ok) {
          throw new Error(`Events request failed with ${response.status}`)
        }

        const data = (await response.json()) as EventItem[]
        if (!active) {
          return
        }

        setEvents(data)
        setEventsError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }

        setEvents([])
        setEventsError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load event history.',
        )
      } finally {
        if (active) {
          setEventsLoading(false)
        }
      }
    }

    void loadEvents()
    const interval = window.setInterval(() => {
      void loadEvents()
    }, 5000)

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

  const fleetPrinters = useMemo(() => [...printers].sort(compareFleetPrinters), [printers])
  const monitoredPrinters = printers.filter((printer) => printer.enforcement.state !== 'idle')
  const spotlightPrinters = useMemo(() => {
    const spotlightMap = new Map<string, Printer>()

    monitoredPrinters.forEach((printer) => {
      spotlightMap.set(printer.id, printer)
    })

    fleetPrinters.forEach((printer) => {
      if (isPrinterActivelyRunning(printer)) {
        spotlightMap.set(printer.id, printer)
      }
    })

    return [...spotlightMap.values()].sort(compareFleetPrinters)
  }, [fleetPrinters, monitoredPrinters])
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

  async function handleSavePrintPolicy() {
    setPolicySaveState('saving')
    setPolicyError(null)

    try {
      const response = await fetch('http://localhost:3000/settings/printing', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxPrintHours: printPolicy.maxPrintHours,
        }),
      })

      const payload = (await response.json()) as PrintPolicySettings | { error?: string }
      if (!response.ok || !('maxPrintHours' in payload)) {
        const message =
          'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `Failed to save print rules with ${response.status}`
        throw new Error(message)
      }

      setPrintPolicy(payload)
    } catch (saveError) {
      setPolicyError(
        saveError instanceof Error ? saveError.message : 'Failed to save print rules.',
      )
    } finally {
      setPolicySaveState('idle')
    }
  }

  return (
    <main className="admin-screen">
      <section className="admin-shell">
        <section className="admin-intro-card">
          <div className="admin-intro-card__top">
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
          </div>

          <div className="admin-intro-card__body">
            <div className="admin-intro-card__welcome">
              <p className="student-panel__eyebrow">Admin access</p>
              <h1>Welcome back, {state.firstName}</h1>
              <p className="admin-intro-card__id">
                {state.cardId ? `Card ${state.cardId}` : 'Card recognized'}
              </p>
            </div>

            <div className="admin-intro-card__session">
              <div className="admin-intro-card__session-copy">
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
                  className="session-guard__button tooltip-trigger"
                  data-tooltip="End this admin session and return to swipe."
                  disabled={closingSession}
                  onClick={() => {
                    void handleCloseSession()
                  }}
                >
                  {closingSession ? 'Closing Session...' : 'Close Session'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-overview-panel">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Overview</p>
              <h2>Admin summary</h2>
            </div>
          </div>

          <div className="admin-overview-stats">
            <article className="admin-overview-stat">
              <span>Online printers</span>
              <strong>{metrics.online}</strong>
            </article>
            <article className="admin-overview-stat">
              <span>Available now</span>
              <strong>{metrics.available}</strong>
            </article>
            <article className="admin-overview-stat">
              <span>Watchdog alerts</span>
              <strong>{metrics.monitored}</strong>
            </article>
          </div>
        </section>

        <section className="admin-priority-grid">
          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Attention</p>
                <h2>Active printers</h2>
              </div>
            </div>

            {loading && printers.length === 0 ? <p className="admin-empty">Loading active printer highlights...</p> : null}
            {error ? <p className="admin-empty admin-empty--error">{error}</p> : null}

            {spotlightPrinters.length === 0 ? (
              <p className="admin-empty">No printers need attention right now.</p>
            ) : (
              <div className="admin-printer-list">
                {spotlightPrinters.map((printer) => {
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
                      <p className="admin-alert-item__detail">{getPriorityPrinterDetail(printer)}</p>
                      <p className="admin-printer-row__meta">
                        {printer.ip} | {printer.authorization.state} | port {printer.connectivity.lastPort ?? 'n/a'}
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Admin tasks</p>
                <h2>Open tools</h2>
              </div>
            </div>

            <div className="admin-action-stack">
              <button
                type="button"
                className="admin-button admin-button--primary admin-button--full tooltip-trigger"
                data-tooltip="Open filament inventory and active spool assignments."
                onClick={() => navigate('/filament', { state })}
              >
                Open Filament Tracker
              </button>

              <div className="admin-action-grid">
                <button
                  type="button"
                  className="admin-button admin-button--secondary tooltip-trigger"
                  data-tooltip="View live printer replies and watchdog status."
                  onClick={() => navigate('/printers', { state })}
                >
                  Open Printer Diagnostics
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--secondary tooltip-trigger"
                  data-tooltip="Preview the student landing page."
                  onClick={() => navigate('/student', { state })}
                >
                  Open Student Landing
                </button>
              </div>

              <button
                type="button"
                className="admin-button admin-button--secondary admin-button--full tooltip-trigger"
                data-tooltip="Return to the swipe screen."
                onClick={() => navigate('/kiosk', { replace: true })}
              >
                Return to Swipe Screen
              </button>
            </div>
          </section>
        </section>

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
            {fleetPrinters.map((printer) => {
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

        <section className="admin-support-grid">
          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Event history</p>
                <h2>Recent snipe events</h2>
              </div>
            </div>

            {eventsLoading ? <p className="admin-empty">Loading snipe history...</p> : null}
            {!eventsLoading && eventsError ? <p className="admin-empty admin-empty--error">{eventsError}</p> : null}
            {!eventsLoading && !eventsError && events.length === 0 ? (
              <p className="admin-empty">No snipe events have been recorded yet.</p>
            ) : null}

            {!eventsLoading && !eventsError && events.length > 0 ? (
              <div className="admin-alert-list">
                {events.map((event) => (
                  <article key={event.id} className="admin-alert-item">
                    <div className="admin-alert-item__header">
                      <p className="admin-alert-item__title">{event.title}</p>
                      <p className="admin-alert-item__meta">{formatEventTimestamp(event.timestamp)}</p>
                    </div>
                    <p className="admin-alert-item__detail">
                      {event.printerName}
                      {event.studentLabel ? ` | ${event.studentLabel}` : ''}
                    </p>
                    <p className="admin-alert-item__detail">{event.detail}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="admin-panel">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Print rules</p>
                <h2>Time limit per print</h2>
              </div>
            </div>

            {policyLoading ? <p className="admin-empty">Loading print rules...</p> : null}
            {policyError ? <p className="admin-empty admin-empty--error">{policyError}</p> : null}

            {!policyLoading ? (
              <div className="admin-setting-row">
                <label className="student-field admin-setting-field">
                  <span className="student-field__label">Maximum print time (hours)</span>
                  <div className="student-stepper">
                    <button
                      type="button"
                      className="student-stepper__button"
                      onClick={() =>
                        setPrintPolicy((current) => ({
                          maxPrintHours: Math.max(1, current.maxPrintHours - 1),
                        }))
                      }
                    >
                      -
                    </button>
                    <input
                      className="student-field__input student-field__input--stepper"
                      inputMode="numeric"
                      value={String(printPolicy.maxPrintHours)}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(event.target.value, 10)
                        setPrintPolicy((current) => ({
                          maxPrintHours: Number.isFinite(nextValue)
                            ? Math.min(Math.max(nextValue, 1), 24)
                            : current.maxPrintHours,
                        }))
                      }}
                    />
                    <button
                      type="button"
                      className="student-stepper__button"
                      onClick={() =>
                        setPrintPolicy((current) => ({
                          maxPrintHours: Math.min(24, current.maxPrintHours + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </label>

                <button
                  type="button"
                  className="admin-button admin-button--primary tooltip-trigger"
                  data-tooltip="Apply this maximum print time."
                  disabled={policySaveState === 'saving'}
                  onClick={() => {
                    void handleSavePrintPolicy()
                  }}
                >
                  {policySaveState === 'saving' ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            ) : null}
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

function compareFleetPrinters(left: Printer, right: Printer) {
  const priorityDifference = getFleetPrinterPriority(left) - getFleetPrinterPriority(right)
  if (priorityDifference !== 0) {
    return priorityDifference
  }

  return left.name.localeCompare(right.name)
}

function getFleetPrinterPriority(printer: Printer) {
  if (printer.connectivity.state !== 'online') {
    return 2
  }

  if (
    printer.activity.state === 'printing' ||
    printer.activity.state === 'heating' ||
    printer.authorization.sessionState === 'active_print'
  ) {
    return 0
  }

  return 1
}

function isPrinterActivelyRunning(printer: Printer) {
  return (
    printer.connectivity.state === 'online' &&
    (
      printer.activity.state === 'printing' ||
      printer.activity.state === 'heating' ||
      printer.authorization.sessionState === 'active_print'
    )
  )
}

function getPriorityPrinterDetail(printer: Printer) {
  if (printer.enforcement.state !== 'idle') {
    return printer.enforcement.reason
  }

  return printer.activity.reason
}

function formatCountdown(remainingMs: number) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatEventTimestamp(timestamp: string) {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) {
    return timestamp
  }

  return new Date(parsed).toLocaleString()
}
