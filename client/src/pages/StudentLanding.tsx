import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { LandingState, Printer, StudentJob } from '../types'

const SESSION_MINUTES = 5

export function StudentLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [printers, setPrinters] = useState<Printer[]>([])
  const [printerError, setPrinterError] = useState<string | null>(null)
  const [selectedPrinterId, setSelectedPrinterId] = useState('')
  const [jobs, setJobs] = useState<StudentJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [sessionRequestState, setSessionRequestState] = useState<'idle' | 'submitting'>('idle')
  const [sessionError, setSessionError] = useState<string | null>(null)

  if (!state?.firstName) {
    return <Navigate to="/kiosk" replace />
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
    let active = true

    const loadPrinters = async () => {
      try {
        const response = await fetch('http://localhost:3000/printers/status')
        if (!response.ok) {
          throw new Error(`Printer status request failed with ${response.status}`)
        }

        const data = (await response.json()) as Printer[]
        if (!active) {
          return
        }

        setPrinters(data)
        setPrinterError(null)
        setSelectedPrinterId((current) => {
          if (data.some((printer) => printer.id === current)) {
            return current
          }

          const currentSessionPrinter = findCurrentSessionPrinter(data, state)
          if (currentSessionPrinter) {
            return currentSessionPrinter.id
          }

          const nextAvailable = data.find((printer) => mapPrinterAvailability(printer, state).selectable)
          return nextAvailable?.id ?? ''
        })
      } catch (fetchError) {
        if (!active) {
          return
        }

        setPrinterError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load printer status.',
        )
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
  }, [state])

  useEffect(() => {
    let active = true

    const loadJobs = async () => {
      if (!state.studentId) {
        if (active) {
          setJobs([])
          setJobsLoading(false)
          setJobsError('Student history is not available for this swipe yet.')
        }
        return
      }

      try {
        setJobsLoading(true)

        const response = await fetch(`http://localhost:3000/jobs/student/${encodeURIComponent(state.studentId)}`)
        if (!response.ok) {
          throw new Error(`Jobs request failed with ${response.status}`)
        }

        const data = (await response.json()) as StudentJob[]
        if (!active) {
          return
        }

        setJobs(data)
        setJobsError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }

        setJobs([])
        setJobsError(fetchError instanceof Error ? fetchError.message : 'Failed to load student jobs.')
      } finally {
        if (active) {
          setJobsLoading(false)
        }
      }
    }

    void loadJobs()

    return () => {
      active = false
    }
  }, [state.studentId])

  const displayPrinters = printers.length > 0 ? printers : getFallbackPrinters()
  const currentSessionPrinter = useMemo(
    () => findCurrentSessionPrinter(displayPrinters, state),
    [displayPrinters, state],
  )

  useEffect(() => {
    if (currentSessionPrinter) {
      setSelectedPrinterId(currentSessionPrinter.id)
    }
  }, [currentSessionPrinter])

  const selectedPrinter =
    displayPrinters.find((printer) => printer.id === selectedPrinterId) ?? currentSessionPrinter ?? null
  const timeLabel = formatClock(new Date(nowMs))
  const availablePrinters = displayPrinters.filter(
    (printer) => mapPrinterAvailability(printer, state).selectable,
  )
  const sessionCountdownMs =
    currentSessionPrinter?.authorization.sessionState === 'pending_start' &&
    currentSessionPrinter.authorization.expiresAt
      ? Date.parse(currentSessionPrinter.authorization.expiresAt) - nowMs
      : null
  const hasLiveSession =
    currentSessionPrinter?.authorization.state === 'authorized' &&
    currentSessionPrinter.authorization.sessionState !== 'idle'
  const canStartSession =
    Boolean(selectedPrinter) &&
    Boolean(mapPrinterAvailability(selectedPrinter, state).selectable) &&
    !hasLiveSession &&
    sessionRequestState !== 'submitting'

  async function handleStartSession() {
    if (!selectedPrinter || !canStartSession) {
      return
    }

    setSessionRequestState('submitting')
    setSessionError(null)

    try {
      const response = await fetch(
        `http://localhost:3000/printers/${encodeURIComponent(selectedPrinter.id)}/authorize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            studentId: state.studentId,
            cardId: state.cardId,
            firstName: state.firstName,
            durationMinutes: SESSION_MINUTES,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to start print session with ${response.status}`)
      }

      const payload = (await response.json()) as { printers?: Printer[] }
      if (payload.printers) {
        setPrinters(payload.printers)
      }
    } catch (requestError) {
      setSessionError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to start the print session.',
      )
    } finally {
      setSessionRequestState('idle')
    }
  }

  const sessionCopy = getSessionCopy({
    currentSessionPrinter,
    selectedPrinter,
    availableCount: availablePrinters.length,
    sessionCountdownMs,
    sessionRequestState,
  })

  return (
    <main className="student-screen">
      <section className="student-shell student-shell--log">
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
            <span className="student-badge">Ready to print</span>
            {state.created ? <span className="student-badge">New profile</span> : null}
            {state.isAdmin ? <span className="student-badge student-badge--admin">Admin</span> : null}
          </div>
        </section>

        <section className="student-session-panel">
          <div className="student-session-panel__copy">
            <p className="student-panel__eyebrow">{sessionCopy.eyebrow}</p>
            <h2>{sessionCopy.title}</h2>
            <p className="student-session-panel__detail">{sessionCopy.detail}</p>

            <button
              type="button"
              className={`student-start-button ${hasLiveSession ? 'student-start-button--active' : ''}`}
              disabled={!canStartSession}
              onClick={() => {
                void handleStartSession()
              }}
            >
              {sessionRequestState === 'submitting'
                ? 'Starting Session...'
                : currentSessionPrinter?.authorization.sessionState === 'active_print'
                  ? 'Print Session Active'
                  : currentSessionPrinter?.authorization.sessionState === 'pending_start'
                    ? 'Session Armed'
                    : 'Start Print Session'}
            </button>
          </div>

          <div className="student-session-panel__status">
            <div className="student-session-chip">
              <span className="label">Selected printer</span>
              <strong>{selectedPrinter?.name ?? 'Choose a printer'}</strong>
            </div>
            <div className="student-session-chip">
              <span className="label">Time window</span>
              <strong>
                {sessionCountdownMs !== null
                  ? formatCountdown(sessionCountdownMs)
                  : `${SESSION_MINUTES}:00`}
              </strong>
            </div>
          </div>
        </section>

        {sessionError ? <p className="student-inline-message student-inline-message--error">{sessionError}</p> : null}
        {printerError ? <p className="student-inline-message student-inline-message--warning">{printerError}</p> : null}

        <section className="student-printer-panel">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Printer availability</p>
              <h2>Select a printer</h2>
              <p className="printer-page__lead">
                Green printers are ready for a new session. Red printers are busy or reserved. Grey printers are offline.
              </p>
            </div>
          </div>

          <div className="student-printer-strip" aria-label="Printer availability">
            {displayPrinters.map((printer) => {
              const availability = mapPrinterAvailability(printer, state)
              const isSelected = selectedPrinter?.id === printer.id

              return (
                <button
                  key={printer.id}
                  type="button"
                  className={[
                    'student-printer-tile',
                    `student-printer-tile--${availability.tone}`,
                    isSelected ? 'student-printer-tile--selected' : '',
                  ].join(' ')}
                  disabled={!availability.selectable && !availability.isCurrentSession}
                  onClick={() => setSelectedPrinterId(printer.id)}
                >
                  <div className="student-printer-tile__header">
                    <span
                      className={`student-printer-dot student-printer-dot--${availability.tone}`}
                      aria-hidden="true"
                    />
                    <span className="student-printer-tile__status">{availability.label}</span>
                  </div>
                  <p className="student-printer-tile__name">{printer.name}</p>
                  <p className="student-printer-tile__meta">
                    {availability.isCurrentSession
                      ? 'This printer is reserved for your current session.'
                      : availability.selectable
                        ? 'Tap to select this printer.'
                        : printer.connectivity.state !== 'online'
                          ? 'Printer is offline right now.'
                          : 'Printer is not available for a new session.'}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="student-log-panel">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Student log</p>
              <h2>Your recent jobs</h2>
              <p className="printer-page__lead">
                Start and end timestamps will come from printer events once those signals are wired in. For now, this screen verifies that you swiped before starting a print session.
              </p>
            </div>
          </div>

          {jobsLoading ? <p className="student-empty">Loading your job history...</p> : null}
          {!jobsLoading && jobsError ? <p className="student-empty student-empty--error">{jobsError}</p> : null}
          {!jobsLoading && !jobsError && jobs.length === 0 ? (
            <p className="student-empty">
              No jobs are in the log yet for this student. Once jobs are recorded in Supabase, they will appear here automatically.
            </p>
          ) : null}

          {!jobsLoading && !jobsError && jobs.length > 0 ? (
            <div className="student-table-wrap">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>File Name</th>
                    <th>File Size</th>
                    <th>Estimated Time</th>
                    <th>Estimated Weight</th>
                    <th>Job Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{state.cardId ?? job.studentId ?? 'Unknown'}</td>
                      <td>{job.fileName ?? 'Untitled file'}</td>
                      <td>{formatFileSize(job.fileSize)}</td>
                      <td>{formatEstimatedTime(job.estimatedTime)}</td>
                      <td>{formatWeight(job.estimatedWeightGrams)}</td>
                      <td>{job.jobReason ?? 'Not provided'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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

function getSessionCopy({
  currentSessionPrinter,
  selectedPrinter,
  availableCount,
  sessionCountdownMs,
  sessionRequestState,
}: {
  currentSessionPrinter: Printer | null
  selectedPrinter: Printer | null
  availableCount: number
  sessionCountdownMs: number | null
  sessionRequestState: 'idle' | 'submitting'
}) {
  if (sessionRequestState === 'submitting' && selectedPrinter) {
    return {
      eyebrow: 'Starting session',
      title: `Authorizing ${selectedPrinter.name}`,
      detail: 'Stay on this screen while the kiosk opens your five-minute print window.',
    }
  }

  if (currentSessionPrinter?.authorization.sessionState === 'active_print') {
    return {
      eyebrow: 'Print detected',
      title: `${currentSessionPrinter.name} is now active`,
      detail: 'The print started after your swipe, so this session is locked in until the printer returns to idle.',
    }
  }

  if (currentSessionPrinter?.authorization.sessionState === 'pending_start') {
    return {
      eyebrow: 'Print window open',
      title: `Go to ${currentSessionPrinter.name} and begin your print`,
      detail: `You have ${formatCountdown(sessionCountdownMs ?? 0)} left to start the job before the session expires.`,
    }
  }

  if (selectedPrinter && mapPrinterAvailability(selectedPrinter, null).selectable) {
    return {
      eyebrow: 'Ready to print',
      title: `${selectedPrinter.name} is available`,
      detail: `Press Start Print Session, then head to the printer. The kiosk will hold the authorization for ${SESSION_MINUTES} minutes.`,
    }
  }

  if (availableCount > 0) {
    return {
      eyebrow: 'Ready to print',
      title: 'Printer is available',
      detail: 'Select a green printer below, then start your print session.',
    }
  }

  return {
    eyebrow: 'Waiting on availability',
    title: 'No printers are available right now',
    detail: 'Stay on this screen until a printer goes idle, or ask lab staff for help.',
  }
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getFallbackPrinters(): Printer[] {
  return ['Printer A', 'Printer B', 'Printer C'].map((name, index) => ({
    id: `fallback-${index + 1}`,
    name,
    ip: '',
    authorization: {
      state: 'unauthorized',
      sessionState: 'idle',
      grantedAt: null,
      expiresAt: null,
      activatedAt: null,
      studentId: null,
      cardId: null,
      firstName: null,
    },
    connectivity: {
      state: 'offline',
      lastSeenAt: null,
      lastError: null,
      lastPort: null,
    },
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
      nozzle: {
        current: null,
        target: null,
      },
      bed: {
        current: null,
        target: null,
      },
    },
    enforcement: {
      mode: 'observe-only',
      state: 'idle',
      lastAction: 'none',
      reason: 'Watchdog status unavailable.',
    },
  }))
}

function findCurrentSessionPrinter(printers: Printer[], state: LandingState | null) {
  return (
    printers.find((printer) => belongsToCurrentStudent(printer, state)) ??
    null
  )
}

function belongsToCurrentStudent(printer: Printer, state: LandingState | null) {
  if (printer.authorization.state !== 'authorized' || !state) {
    return false
  }

  if (state.studentId && printer.authorization.studentId === state.studentId) {
    return true
  }

  if (state.cardId && printer.authorization.cardId === state.cardId) {
    return true
  }

  return false
}

function mapPrinterAvailability(printer: Printer, state: LandingState | null) {
  const isCurrentSession = belongsToCurrentStudent(printer, state)

  if (printer.connectivity.state !== 'online') {
    return {
      label: 'Offline',
      tone: 'offline' as const,
      selectable: false,
      isCurrentSession,
    }
  }

  if (isCurrentSession) {
    return {
      label: printer.authorization.sessionState === 'active_print' ? 'Your Print' : 'Reserved For You',
      tone: printer.authorization.sessionState === 'active_print' ? ('busy' as const) : ('available' as const),
      selectable: true,
      isCurrentSession,
    }
  }

  if (printer.authorization.state === 'authorized') {
    return {
      label: 'Reserved',
      tone: 'busy' as const,
      selectable: false,
      isCurrentSession,
    }
  }

  if (printer.activity.state === 'idle') {
    return {
      label: 'Available',
      tone: 'available' as const,
      selectable: true,
      isCurrentSession,
    }
  }

  return {
    label: 'In Use',
    tone: 'busy' as const,
    selectable: false,
    isCurrentSession,
  }
}

function formatCountdown(remainingMs: number) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatFileSize(value: number | string | null) {
  const parsed = toNumber(value)
  if (parsed === null) {
    return value ? String(value) : 'Unknown'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let amount = parsed
  let unitIndex = 0

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }

  const digits = amount >= 100 || unitIndex === 0 ? 0 : 1
  return `${amount.toFixed(digits)} ${units[unitIndex]}`
}

function formatEstimatedTime(value: number | string | null) {
  if (value === null || value === '') {
    return 'Unknown'
  }

  if (typeof value === 'number') {
    return formatMinutes(value)
  }

  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return formatMinutes(Number.parseInt(trimmed, 10))
  }

  const isoMatch = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? '0', 10)
    const minutes = Number.parseInt(isoMatch[2] ?? '0', 10)
    const seconds = Number.parseInt(isoMatch[3] ?? '0', 10)
    return formatMinutes(hours * 60 + minutes + Math.round(seconds / 60))
  }

  return trimmed
}

function formatMinutes(totalMinutes: number) {
  const roundedMinutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${minutes} min`
}

function formatWeight(value: number | string | null) {
  const parsed = toNumber(value)
  if (parsed === null) {
    return value ? String(value) : 'Unknown'
  }

  return `${parsed.toFixed(parsed >= 10 ? 0 : 1)} g`
}

function toNumber(value: number | string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
