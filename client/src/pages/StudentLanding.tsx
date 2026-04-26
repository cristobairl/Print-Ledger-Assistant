import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { LandingState, Printer } from '../types'

export function StudentLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [timeLabel, setTimeLabel] = useState(() => formatClock(new Date()))
  const [printers, setPrinters] = useState<Printer[]>([])
  const [startPressed, setStartPressed] = useState(false)

  if (!state?.firstName) {
    return <Navigate to="/kiosk" replace />
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeLabel(formatClock(new Date()))
    }, 1000)

    return () => {
      window.clearInterval(interval)
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
        }
      } catch {
        if (active) {
          setPrinters([])
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

  const availabilityCards = printers.length > 0 ? printers : getFallbackPrinters()

  return (
    <main className="student-screen">
      <section className="student-shell">
        <header className="student-topbar">
          <div className="student-brand">
            <span className="student-brand__mark">PLA</span>
            <div>
              <p className="student-panel__eyebrow">Print Ledger Assistant</p>
              <p className="student-brand__subtle">USF 3D Print Lab</p>
            </div>
          </div>
          <div className="student-clock" aria-label={`Current time ${timeLabel}`}>
            {timeLabel}
          </div>
        </header>

        <section className="student-hero">
          <div className="student-hero__copy">
            <p className="student-panel__eyebrow">Authorized access</p>
            <h1>Welcome, {state.firstName}</h1>
            <p className="student-hero__id">
              {state.cardId ? `Card ${state.cardId}` : 'Card recognized'}
            </p>
          </div>

          <div className="student-badges">
            <span className="student-badge">Authorized</span>
            {state.created ? <span className="student-badge">New profile</span> : null}
            {state.isAdmin ? <span className="student-badge student-badge--admin">Admin</span> : null}
          </div>
        </section>

        <section className="student-action-card">
          <div className="student-action-card__copy">
            <p className="student-panel__eyebrow">Print session</p>
            <h2>Ready to print?</h2>
          </div>

          <button
            type="button"
            className={`student-start-button ${startPressed ? 'student-start-button--active' : ''}`}
            onClick={() => setStartPressed(true)}
          >
            {startPressed ? 'Print Session Ready' : 'Start Print Session'}
          </button>
        </section>

        <section className="student-printer-strip" aria-label="Printer availability">
          {availabilityCards.map((printer) => {
            const availability = mapPrinterAvailability(printer)

            return (
              <article
                key={printer.id}
                className={`student-printer-tile student-printer-tile--${availability.tone}`}
              >
                <div className="student-printer-tile__header">
                  <span
                    className={`student-printer-dot student-printer-dot--${availability.tone}`}
                    aria-hidden="true"
                  />
                  <span className="student-printer-tile__status">{availability.label}</span>
                </div>
                <p className="student-printer-tile__name">{printer.name}</p>
              </article>
            )
          })}
        </section>

        <footer className="student-footer">
          <button
            type="button"
            className="student-footer__link"
            onClick={() => navigate('/kiosk', { replace: true })}
          >
            Not you? Switch user
          </button>

          {state.isAdmin ? (
            <button
              type="button"
              className="student-footer__admin"
              onClick={() => navigate('/admin', { state })}
            >
              Admin Dashboard
            </button>
          ) : null}
        </footer>
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

function getFallbackPrinters(): Printer[] {
  return [
    {
      id: 'fallback-1',
      name: 'Printer A',
      ip: '',
      authorization: { state: 'unauthorized' },
      connectivity: { state: 'offline', lastSeenAt: null, lastError: null, lastPort: null },
      activity: {
        state: 'unknown',
        source: 'm27-status',
        reason: 'Printer status unavailable.',
        command: '~M27',
        rawResponse: null,
      },
      telemetry: {
        command: '~M105',
        rawResponse: null,
        nozzle: { current: null, target: null },
        bed: { current: null, target: null },
      },
      enforcement: {
        mode: 'observe-only',
        state: 'idle',
        lastAction: 'none',
        reason: 'Watchdog status unavailable.',
      },
    },
    {
      id: 'fallback-2',
      name: 'Printer B',
      ip: '',
      authorization: { state: 'unauthorized' },
      connectivity: { state: 'offline', lastSeenAt: null, lastError: null, lastPort: null },
      activity: {
        state: 'unknown',
        source: 'm27-status',
        reason: 'Printer status unavailable.',
        command: '~M27',
        rawResponse: null,
      },
      telemetry: {
        command: '~M105',
        rawResponse: null,
        nozzle: { current: null, target: null },
        bed: { current: null, target: null },
      },
      enforcement: {
        mode: 'observe-only',
        state: 'idle',
        lastAction: 'none',
        reason: 'Watchdog status unavailable.',
      },
    },
    {
      id: 'fallback-3',
      name: 'Printer C',
      ip: '',
      authorization: { state: 'unauthorized' },
      connectivity: { state: 'offline', lastSeenAt: null, lastError: null, lastPort: null },
      activity: {
        state: 'unknown',
        source: 'm27-status',
        reason: 'Printer status unavailable.',
        command: '~M27',
        rawResponse: null,
      },
      telemetry: {
        command: '~M105',
        rawResponse: null,
        nozzle: { current: null, target: null },
        bed: { current: null, target: null },
      },
      enforcement: {
        mode: 'observe-only',
        state: 'idle',
        lastAction: 'none',
        reason: 'Watchdog status unavailable.',
      },
    },
  ]
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
