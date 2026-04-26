import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { LandingState, PrintPolicySettings, Printer, StudentJob } from '../types'

const SESSION_MINUTES = 2
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000
type StudentJobFormState = {
  studentIdentifier: string
  fileName: string
  estimatedTimeHours: string
  estimatedTimeMinutes: string
  estimatedWeightGrams: string
  jobReason: string
}
type NumericFieldOptions = {
  step: number
  min: number
  max?: number
  decimals: number
}

export function StudentLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [lastInteractionMs, setLastInteractionMs] = useState(() => Date.now())
  const [printers, setPrinters] = useState<Printer[]>([])
  const [printerError, setPrinterError] = useState<string | null>(null)
  const [selectedPrinterId, setSelectedPrinterId] = useState('')
  const [jobs, setJobs] = useState<StudentJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [sessionRequestState, setSessionRequestState] = useState<'idle' | 'submitting'>('idle')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [jobForm, setJobForm] = useState<StudentJobFormState>(() => createJobFormState(state))
  const [jobFormSubmitted, setJobFormSubmitted] = useState(false)
  const [closingSession, setClosingSession] = useState(false)
  const [printPolicy, setPrintPolicy] = useState<PrintPolicySettings>({ maxPrintHours: 5 })
  const requestedWeightGrams = toNumber(jobForm.estimatedWeightGrams)

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

          const nextAvailable = data.find((printer) => mapPrinterAvailability(printer, state, requestedWeightGrams).selectable)
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
  }, [requestedWeightGrams, state])

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
        }
      } catch (settingsError) {
        console.error('[StudentLanding] Failed to load print settings. Using defaults.', settingsError)
      }
    }

    void loadPrintPolicy()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadJobs = async (showLoading = false) => {
      if (!state.studentId) {
        if (active) {
          setJobs([])
          setJobsLoading(false)
          setJobsError('Student history is not available for this swipe yet.')
        }
        return
      }

      try {
        if (showLoading) {
          setJobsLoading(true)
        }

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
        if (active && showLoading) {
          setJobsLoading(false)
        }
      }
    }

    void loadJobs(true)
    const interval = window.setInterval(() => {
      void loadJobs(false)
    }, 5000)

    return () => {
      active = false
      window.clearInterval(interval)
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
  const estimatedMinuteMax = getEstimatedMinuteMax(jobForm, printPolicy.maxPrintHours)
  const jobFormErrors = getJobFormErrors(jobForm, printPolicy.maxPrintHours)
  const isJobFormComplete = Object.values(jobFormErrors).every((error) => error === null)
  const timeLabel = formatClock(new Date(nowMs))
  const inactivityRemainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - (nowMs - lastInteractionMs))
  const availablePrinters = displayPrinters.filter(
    (printer) => mapPrinterAvailability(printer, state, requestedWeightGrams).selectable,
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
    Boolean(mapPrinterAvailability(selectedPrinter, state, requestedWeightGrams).selectable) &&
    isJobFormComplete &&
    !hasLiveSession &&
    sessionRequestState !== 'submitting'

  useEffect(() => {
    if (inactivityRemainingMs > 0 || closingSession) {
      return
    }

    void handleCloseSession('auto')
  }, [closingSession, inactivityRemainingMs])

  useEffect(() => {
    const normalizedMinutes = clampEstimatedMinuteValue(jobForm.estimatedTimeMinutes, estimatedMinuteMax)
    if (normalizedMinutes === jobForm.estimatedTimeMinutes) {
      return
    }

    setJobForm((current) => ({ ...current, estimatedTimeMinutes: normalizedMinutes }))
  }, [estimatedMinuteMax, jobForm.estimatedTimeMinutes])

  function updateJobForm<Key extends keyof StudentJobFormState>(
    key: Key,
    value: StudentJobFormState[Key],
  ) {
    setJobForm((current) => ({ ...current, [key]: value }))
    if (sessionError) {
      setSessionError(null)
    }
  }

  async function handleCloseSession(reason: 'manual' | 'auto') {
    if (closingSession) {
      return
    }

    setClosingSession(true)

    try {
      if (
        currentSessionPrinter?.authorization.state === 'authorized' &&
        currentSessionPrinter.authorization.sessionState === 'pending_start'
      ) {
        await fetch(
          `http://localhost:3000/printers/${encodeURIComponent(currentSessionPrinter.id)}/deauthorize`,
          {
            method: 'POST',
          },
        )
      }
    } catch (closeError) {
      console.error('[StudentLanding] Failed to release pending printer reservation during close.', closeError)
    } finally {
      if (reason === 'auto') {
        navigate('/kiosk', { replace: true, state: { timeout: true } })
      } else {
        navigate('/kiosk', { replace: true })
      }
    }
  }

  async function handleStartSession() {
    setJobFormSubmitted(true)

    if (!selectedPrinter || !isJobFormComplete) {
      setSessionError('Complete the print details and choose a printer before starting a session.')
      return
    }

    if (!canStartSession) {
      return
    }

    setSessionRequestState('submitting')
    setSessionError(null)

    try {
      const jobResponse = await fetch('http://localhost:3000/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: state.studentId,
          printerId: selectedPrinter.id,
          fileName: jobForm.fileName.trim(),
          estimatedTimeMinutes: getEstimatedTimeTotalMinutes(jobForm),
          estimatedWeightGrams: jobForm.estimatedWeightGrams,
          jobReason: jobForm.jobReason.trim(),
        }),
      })

      const jobPayload = (await jobResponse.json()) as StudentJob | { error?: string }
      if (!jobResponse.ok || !('id' in jobPayload)) {
        const message =
          'error' in jobPayload && typeof jobPayload.error === 'string'
            ? jobPayload.error
            : `Failed to save job details with ${jobResponse.status}`
        throw new Error(message)
      }

      setJobs((currentJobs) => [jobPayload, ...currentJobs.filter((job) => job.id !== jobPayload.id)])
      setJobsError(null)

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
            jobId: jobPayload.id,
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
    detailsReady: isJobFormComplete,
    requestedWeightGrams,
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
              className="session-guard__button tooltip-trigger"
              data-tooltip="End this session and return to swipe."
              disabled={closingSession}
              onClick={() => {
                void handleCloseSession('manual')
              }}
            >
              {closingSession ? 'Closing Session...' : 'Close Session'}
            </button>
          </div>
        </section>

        <section className="student-details-panel">
          <div className="student-details-panel__top">
            <div className="student-details-panel__identity">
              <p className="student-panel__eyebrow">Authorized access</p>
              <h1>Welcome, {state.firstName}</h1>
              <p className="student-details-panel__id">
                {state.cardId ? `Card ${state.cardId}` : 'Card recognized'}
              </p>
            </div>

            <div className="student-badges student-badges--compact">
              <span className="student-badge">Ready to print</span>
              {state.created ? <span className="student-badge">New profile</span> : null}
              {state.isAdmin ? <span className="student-badge student-badge--admin">Admin</span> : null}
            </div>
          </div>

          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Print details</p>
              <h2>Enter your job information</h2>
              <p className="printer-page__lead">
                Enter the file name, the print time shown on the printer, the print weight, and the job reason here. Started and ended timestamps still come from the system automatically.
              </p>
            </div>
          </div>

          <div className="student-form-grid">
            <label className="student-field">
              <span className="student-field__label">Student ID</span>
              <input
                className="student-field__input"
                value={jobForm.studentIdentifier}
                readOnly
                disabled
              />
              <span className="student-field__hint">Locked from your swipe so the log stays tied to the right student.</span>
            </label>

            <label className="student-field">
              <span className="student-field__label">File Name</span>
              <input
                className="student-field__input"
                value={jobForm.fileName}
                disabled={hasLiveSession || sessionRequestState === 'submitting'}
                onChange={(event) => {
                  updateJobForm('fileName', event.target.value)
                }}
                placeholder="example-gearbox.gcode"
              />
              {jobFormSubmitted && jobFormErrors.fileName ? (
                <span className="student-field__error">{jobFormErrors.fileName}</span>
              ) : null}
            </label>

            <div className="student-field">
              <span className="student-field__label">Estimated Print Time</span>
              <div className="student-time-grid">
                <NumericField
                  label="Hours"
                  value={jobForm.estimatedTimeHours}
                  disabled={hasLiveSession || sessionRequestState === 'submitting'}
                  placeholder="0"
                  options={{ step: 1, min: 0, max: printPolicy.maxPrintHours, decimals: 0 }}
                  error={null}
                  onChange={(value) => {
                    updateJobForm('estimatedTimeHours', value)
                  }}
                />
                <NumericField
                  label="Minutes"
                  value={jobForm.estimatedTimeMinutes}
                  disabled={hasLiveSession || sessionRequestState === 'submitting'}
                  placeholder="0"
                  options={{ step: 15, min: 0, max: estimatedMinuteMax, decimals: 0 }}
                  error={null}
                  onChange={(value) => {
                    updateJobForm('estimatedTimeMinutes', value)
                  }}
                />
              </div>
              {jobFormSubmitted && jobFormErrors.estimatedTime ? (
                <span className="student-field__error">{jobFormErrors.estimatedTime}</span>
              ) : (
                <span className="student-field__hint">
                  Current maximum allowed print time is {printPolicy.maxPrintHours} hour{printPolicy.maxPrintHours === 1 ? '' : 's'}.
                </span>
              )}
            </div>

            <NumericField
              label="Estimated Weight (grams)"
              value={jobForm.estimatedWeightGrams}
              disabled={hasLiveSession || sessionRequestState === 'submitting'}
              placeholder="42"
              options={{ step: 1, min: 1, decimals: 0 }}
              hint="Use the buttons or type a value."
              fieldClassName="student-field--align-with-time"
              error={jobFormSubmitted ? jobFormErrors.estimatedWeightGrams : null}
              onChange={(value) => {
                updateJobForm('estimatedWeightGrams', value)
              }}
            />

            <label className="student-field student-field--full">
              <span className="student-field__label">Job Reason</span>
              <textarea
                className="student-field__input student-field__input--textarea"
                value={jobForm.jobReason}
                disabled={hasLiveSession || sessionRequestState === 'submitting'}
                onChange={(event) => {
                  updateJobForm('jobReason', event.target.value)
                }}
                placeholder="What are you printing this for?"
                rows={4}
              />
              {jobFormSubmitted && jobFormErrors.jobReason ? (
                <span className="student-field__error">{jobFormErrors.jobReason}</span>
              ) : null}
            </label>
          </div>
        </section>

        <section className="student-session-panel">
          <div className="student-session-panel__copy">
            <p className="student-panel__eyebrow">{sessionCopy.eyebrow}</p>
            <h2>{sessionCopy.title}</h2>
            <p className="student-session-panel__detail">{sessionCopy.detail}</p>

            <button
              type="button"
              className={`student-start-button tooltip-trigger ${hasLiveSession ? 'student-start-button--active' : ''}`}
              data-tooltip={
                hasLiveSession
                  ? 'This printer session is already active.'
                  : 'Save your job details and reserve the selected printer.'
              }
              disabled={!canStartSession}
              onClick={() => {
                void handleStartSession()
              }}
            >
              {sessionRequestState === 'submitting'
                ? 'Saving Details and Starting Session...'
                : currentSessionPrinter?.authorization.sessionState === 'active_print'
                  ? 'Print Session Active'
                  : currentSessionPrinter?.authorization.sessionState === 'pending_start'
                    ? 'Session Armed'
                    : 'Save Details and Start Print Session'}
            </button>
          </div>

          <div className="student-session-panel__status">
            <div className="student-session-chip">
              <span className="label">Selected printer</span>
              <strong>{selectedPrinter?.name ?? 'Choose a printer'}</strong>
            </div>
            <div className="student-session-chip">
              <span className="label">USB connect time</span>
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
              const availability = mapPrinterAvailability(printer, state, requestedWeightGrams)
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
                    <p className="student-printer-tile__meta">{availability.detail}</p>
                    <p className="student-printer-tile__submeta">{getFilamentAvailabilityLabel(printer)}</p>
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
            </div>
          </div>

          {jobsLoading ? <p className="student-empty">Loading your job history...</p> : null}
          {!jobsLoading && jobsError ? <p className="student-empty student-empty--error">{jobsError}</p> : null}
          {!jobsLoading && !jobsError && jobs.length === 0 ? (
            <p className="student-empty">No jobs yet.</p>
          ) : null}

          {!jobsLoading && !jobsError && jobs.length > 0 ? (
            <div className="student-table-wrap">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>File Name</th>
                    <th>Status</th>
                    <th>File Size</th>
                    <th>Estimated Time</th>
                    <th>Estimated Finish</th>
                    <th>Time Remaining</th>
                    <th>Started At</th>
                    <th>Ended At</th>
                    <th>Estimated Weight</th>
                    <th>Job Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{state.cardId ?? job.studentId ?? 'Unknown'}</td>
                      <td>{job.fileName ?? 'Untitled file'}</td>
                      <td>{formatJobStatus(job.status)}</td>
                      <td>{formatFileSize(job.fileSize)}</td>
                      <td>{formatEstimatedTime(job.estimatedTime)}</td>
                      <td>{formatEstimatedFinish(job)}</td>
                      <td>{formatJobTimeRemaining(job, nowMs)}</td>
                      <td>{formatTimestamp(job.startedAt)}</td>
                      <td>{formatTimestamp(job.endedAt)}</td>
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
              className="student-footer__admin tooltip-trigger"
              data-tooltip="Open the admin control panel."
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
  detailsReady,
  requestedWeightGrams,
}: {
  currentSessionPrinter: Printer | null
  selectedPrinter: Printer | null
  availableCount: number
  sessionCountdownMs: number | null
  sessionRequestState: 'idle' | 'submitting'
  detailsReady: boolean
  requestedWeightGrams: number | null
}) {
  if (sessionRequestState === 'submitting' && selectedPrinter) {
    return {
      eyebrow: 'Starting session',
      title: `Saving job details for ${selectedPrinter.name}`,
      detail: `Stay on this screen while the job record is saved and the kiosk opens ${SESSION_MINUTES} minutes to connect your USB drive to the printer.`,
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
      eyebrow: 'Time to connect USB drive',
      title: `Go to ${currentSessionPrinter.name} and connect your USB drive`,
      detail: `You have ${formatCountdown(sessionCountdownMs ?? 0)} left to connect your USB drive to the printer and start the job.`,
    }
  }

  if (!detailsReady) {
    return {
      eyebrow: 'Complete the checklist',
      title: 'Add your print details first',
      detail: 'Fill in the file name, print time, print weight, and job reason before the session can be armed.',
    }
  }

  if (selectedPrinter && mapPrinterAvailability(selectedPrinter, null, requestedWeightGrams).selectable) {
    return {
      eyebrow: 'Ready to print',
      title: `${selectedPrinter.name} is available`,
      detail: `Save your details, then head to the printer. You will have ${SESSION_MINUTES} minutes to connect your USB drive to the printer.`,
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
      jobId: null,
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
      mode: 'auto-snipe',
      state: 'idle',
      lastAction: 'none',
      reason: 'Auto-snipe status unavailable.',
    },
    filament: {
      state: 'unknown',
      reason: 'Filament data is unavailable.',
      activeSpoolId: null,
      brand: null,
      material: null,
      colorName: null,
      totalWeightGrams: null,
      remainingWeightGrams: null,
      reservedWeightGrams: null,
      usableWeightGrams: null,
      safetyBufferGrams: 5,
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

function mapPrinterAvailability(printer: Printer, state: LandingState | null, requestedWeightGrams: number | null) {
  const isCurrentSession = belongsToCurrentStudent(printer, state)

  if (printer.connectivity.state !== 'online') {
    return {
      label: 'Offline',
      tone: 'offline' as const,
      selectable: false,
      isCurrentSession,
      detail: 'Printer is offline right now.',
    }
  }

  if (isCurrentSession) {
    return {
      label: printer.authorization.sessionState === 'active_print' ? 'Your Print' : 'Reserved For You',
      tone: printer.authorization.sessionState === 'active_print' ? ('busy' as const) : ('available' as const),
      selectable: true,
      isCurrentSession,
      detail:
        printer.authorization.sessionState === 'active_print'
          ? 'This printer is running your current job.'
          : 'This printer is reserved for your current session.',
    }
  }

  if (printer.authorization.state === 'authorized') {
    return {
      label: 'Reserved',
      tone: 'busy' as const,
      selectable: false,
      isCurrentSession,
      detail: 'Printer is reserved for another session.',
    }
  }

  if (printer.filament.state === 'unassigned') {
    return {
      label: 'Needs Filament',
      tone: 'busy' as const,
      selectable: false,
      isCurrentSession,
      detail: 'No active spool is loaded. Ask an admin to mount filament.',
    }
  }

  if (printer.filament.state === 'out') {
    return {
      label: 'Out Of Filament',
      tone: 'busy' as const,
      selectable: false,
      isCurrentSession,
      detail: 'The active spool does not have enough usable filament left.',
    }
  }

  if (
    requestedWeightGrams !== null &&
    printer.filament.usableWeightGrams !== null &&
    printer.filament.usableWeightGrams < requestedWeightGrams
  ) {
    return {
      label: 'Not Enough Filament',
      tone: 'busy' as const,
      selectable: false,
      isCurrentSession,
      detail: `This spool has ${formatWeight(printer.filament.usableWeightGrams)} usable, which is below this job's estimate.`,
    }
  }

  if (printer.filament.state === 'low') {
    return {
      label: 'Low Filament',
      tone: 'busy' as const,
      selectable: requestedWeightGrams === null,
      isCurrentSession,
      detail:
        requestedWeightGrams === null
          ? 'Filament is running low. Enter the job weight to confirm this printer can cover it.'
          : 'Filament is running low for new jobs.',
    }
  }

  if (printer.activity.state === 'idle') {
    return {
      label: 'Available',
      tone: 'available' as const,
      selectable: true,
      isCurrentSession,
      detail:
        printer.filament.state === 'unknown'
          ? 'Filament data is unavailable right now.'
          : 'Tap to select this printer.',
    }
  }

  return {
    label: 'In Use',
    tone: 'busy' as const,
    selectable: false,
    isCurrentSession,
    detail: 'Printer is not available for a new session.',
  }
}

function getFilamentAvailabilityLabel(printer: Printer) {
  const usable = printer.filament.usableWeightGrams
  const material = printer.filament.material
  const brand = printer.filament.brand

  if (usable !== null) {
    const filamentLabel = [brand, material].filter(Boolean).join(' ')
    if (filamentLabel) {
      return `${filamentLabel} | ${formatWeight(usable)} usable`
    }

    return `${formatWeight(usable)} usable filament left`
  }

  if (printer.filament.state === 'unassigned') {
    return 'No filament assigned'
  }

  if (printer.filament.state === 'unknown') {
    return 'Filament level unavailable'
  }

  return printer.filament.reason
}

function createJobFormState(state: LandingState | null): StudentJobFormState {
  return {
    studentIdentifier: state?.cardId ?? state?.studentId ?? 'Unknown student',
    fileName: '',
    estimatedTimeHours: '',
    estimatedTimeMinutes: '',
    estimatedWeightGrams: '',
    jobReason: '',
  }
}

function getJobFormErrors(form: StudentJobFormState, maxPrintHours: number) {
  const totalEstimatedMinutes = getEstimatedTimeTotalMinutes(form)
  const minuteMax = getEstimatedMinuteMax(form, maxPrintHours)

  return {
    fileName: form.fileName.trim().length > 0 ? null : 'Enter the file name.',
    estimatedTime:
      totalEstimatedMinutes <= 0
        ? 'Enter the print time shown on the printer.'
        : totalEstimatedMinutes > maxPrintHours * 60
          ? `Print time cannot exceed ${maxPrintHours} hour${maxPrintHours === 1 ? '' : 's'}.`
          : isValidMinutePart(form.estimatedTimeMinutes, minuteMax)
            ? null
            : minuteMax === 0
              ? 'When the hours are at the limit, minutes must stay at 0.'
              : `Enter a valid minute value between 0 and ${minuteMax}.`,
    estimatedWeightGrams: isPositiveNumericString(form.estimatedWeightGrams)
      ? null
      : 'Enter the estimated weight in grams.',
    jobReason: form.jobReason.trim().length > 0 ? null : 'Enter the job reason.',
  }
}

function NumericField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  hint,
  options,
  hideLabel = false,
  fieldClassName,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
  error: string | null
  hint?: string
  options: NumericFieldOptions
  hideLabel?: boolean
  fieldClassName?: string
}) {
  const handleAdjust = (direction: 1 | -1) => {
    if (disabled) {
      return
    }

    onChange(adjustNumericValue(value, direction * options.step, options))
  }

  return (
    <label className={`student-field${fieldClassName ? ` ${fieldClassName}` : ''}`}>
      {!hideLabel ? <span className="student-field__label">{label}</span> : null}
      <div className={`student-stepper ${disabled ? 'student-stepper--disabled' : ''}`}>
        <button
          type="button"
          className="student-stepper__button"
          disabled={disabled}
          aria-label={`Decrease ${label}`}
          onClick={() => handleAdjust(-1)}
        >
          -
        </button>
        <input
          className="student-field__input student-field__input--stepper"
          inputMode={options.decimals > 0 ? 'decimal' : 'numeric'}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onBlur={() => {
            if (value.trim().length === 0) {
              return
            }

            onChange(clampNumericValue(value, options))
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="student-stepper__button"
          disabled={disabled}
          aria-label={`Increase ${label}`}
          onClick={() => handleAdjust(1)}
        >
          +
        </button>
      </div>
      {error ? <span className="student-field__error">{error}</span> : null}
      {!error && hint ? <span className="student-field__hint">{hint}</span> : null}
    </label>
  )
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
    return value ? String(value) : 'Pending system data'
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
    return 'Pending system data'
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

function formatJobStatus(value: string | null) {
  if (!value) {
    return 'Pending system data'
  }

  if (value === 'queued') {
    return 'Queued'
  }

  if (value === 'printing') {
    return 'Printing'
  }

  if (value === 'completed') {
    return 'Completed'
  }

  if (value === 'expired') {
    return 'Expired'
  }

  if (value === 'interrupted') {
    return 'Interrupted'
  }

  if (value === 'sniped') {
    return 'Sniped'
  }

  return value
}

function formatEstimatedFinish(job: StudentJob) {
  const estimatedEndAt = getEstimatedEndAt(job)
  if (!estimatedEndAt) {
    return 'Pending system data'
  }

  return formatTimestamp(estimatedEndAt)
}

function formatJobTimeRemaining(job: StudentJob, nowMs: number) {
  if (job.status === 'completed' || job.endedAt) {
    return 'Completed'
  }

  if (job.status === 'expired') {
    return 'Expired'
  }

  const estimatedEndAt = getEstimatedEndAt(job)
  if (!estimatedEndAt) {
    return 'Pending system data'
  }

  const remainingMs = Date.parse(estimatedEndAt) - nowMs
  if (!Number.isFinite(remainingMs)) {
    return 'Pending system data'
  }

  if (remainingMs <= 0) {
    return job.status === 'printing' ? 'Any moment' : 'Pending completion'
  }

  return formatRemainingClock(remainingMs)
}

function getEstimatedEndAt(job: StudentJob) {
  const estimatedMinutes = toNumber(job.estimatedTime)
  if (!job.startedAt || estimatedMinutes === null) {
    return null
  }

  const startedMs = Date.parse(job.startedAt)
  if (Number.isNaN(startedMs)) {
    return null
  }

  return new Date(startedMs + estimatedMinutes * 60_000).toISOString()
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Pending system data'
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString()
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

function formatRemainingClock(remainingMs: number) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getEstimatedTimeTotalMinutes(form: Pick<StudentJobFormState, 'estimatedTimeHours' | 'estimatedTimeMinutes'>) {
  const hours = parseNonNegativeInteger(form.estimatedTimeHours)
  const minutes = parseNonNegativeInteger(form.estimatedTimeMinutes)
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 59) : 0

  return safeHours * 60 + safeMinutes
}

function isValidMinutePart(value: string, maxMinutes = 59) {
  if (value.trim().length === 0) {
    return true
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maxMinutes
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

function isPositiveNumericString(value: string) {
  if (value.trim().length === 0) {
    return false
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0
}

function adjustNumericValue(value: string, delta: number, options: NumericFieldOptions) {
  const parsed = Number.parseFloat(value)
  const base = Number.isFinite(parsed) ? parsed : options.min
  const next = clampNumeric(base + delta, options)

  return formatNumericValue(next, options.decimals)
}

function clampNumericValue(value: string, options: NumericFieldOptions) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return ''
  }

  return formatNumericValue(clampNumeric(parsed, options), options.decimals)
}

function formatNumericValue(value: number, decimals: number) {
  return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals)
}

function clampNumeric(value: number, options: NumericFieldOptions) {
  const boundedLow = Math.max(options.min, value)
  if (typeof options.max === 'number') {
    return Math.min(options.max, boundedLow)
  }

  return boundedLow
}

function getEstimatedMinuteMax(
  form: Pick<StudentJobFormState, 'estimatedTimeHours'>,
  maxPrintHours: number,
) {
  const hours = parseNonNegativeInteger(form.estimatedTimeHours)
  return hours >= maxPrintHours ? 0 : 59
}

function clampEstimatedMinuteValue(value: string, maxMinutes: number) {
  if (value.trim().length === 0) {
    return value
  }

  return clampNumericValue(value, {
    step: 1,
    min: 0,
    max: maxMinutes,
    decimals: 0,
  })
}

function parseNonNegativeInteger(value: string) {
  const parsed = Number.parseInt(value.trim() || '0', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}
