import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { FilamentEvent, FilamentSpool, LandingState, Printer } from '../types'

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000

type SpoolFormState = {
  brand: string
  material: string
  totalWeightGrams: string
  remainingWeightGrams: string
  quantity: string
  activePrinterId: string
  colorName: string
  notes: string
}

export function FilamentInventory() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as LandingState | null) ?? null
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [lastInteractionMs, setLastInteractionMs] = useState(() => Date.now())
  const [printers, setPrinters] = useState<Printer[]>([])
  const [spools, setSpools] = useState<FilamentSpool[]>([])
  const [events, setEvents] = useState<FilamentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [closingSession, setClosingSession] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [form, setForm] = useState<SpoolFormState>(createDefaultSpoolForm())
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>({})
  const [draftRemaining, setDraftRemaining] = useState<Record<string, string>>({})

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

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focusin']
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markInteraction)
    })

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markInteraction)
      })
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        const [printerResponse, spoolResponse, eventResponse] = await Promise.all([
          fetch('http://localhost:3000/printers/status'),
          fetch('http://localhost:3000/filament/spools'),
          fetch('http://localhost:3000/filament/events?limit=12'),
        ])

        if (!printerResponse.ok) {
          throw new Error(`Printer status request failed with ${printerResponse.status}`)
        }

        if (!spoolResponse.ok) {
          const payload = (await spoolResponse.json()) as { error?: string }
          throw new Error(payload.error ?? `Filament spool request failed with ${spoolResponse.status}`)
        }

        if (!eventResponse.ok) {
          const payload = (await eventResponse.json()) as { error?: string }
          throw new Error(payload.error ?? `Filament events request failed with ${eventResponse.status}`)
        }

        const [printerData, spoolData, eventData] = await Promise.all([
          printerResponse.json() as Promise<Printer[]>,
          spoolResponse.json() as Promise<FilamentSpool[]>,
          eventResponse.json() as Promise<FilamentEvent[]>,
        ])

        if (!active) {
          return
        }

        setPrinters(printerData)
        setSpools(spoolData)
        setEvents(eventData)
        syncSpoolDrafts(spoolData, setDraftAssignments, setDraftRemaining)
        setError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load filament tracking.')
        setSpools([])
        setEvents([])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()
    const interval = window.setInterval(() => {
      void loadData()
    }, 5000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const timeLabel = formatClock(new Date(nowMs))
  const inactivityRemainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - (nowMs - lastInteractionMs))

  useEffect(() => {
    if (inactivityRemainingMs > 0 || closingSession) {
      return
    }

    void handleCloseSession()
  }, [closingSession, inactivityRemainingMs])

  useEffect(() => {
    if (!isCreateModalOpen) {
      return
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setIsCreateModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isCreateModalOpen, saving])

  const metrics = useMemo(() => {
    const totalUsableWeight = spools.reduce((sum, spool) => sum + spool.usableWeightGrams, 0)
    const assigned = spools.filter((spool) => spool.activePrinterId).length
    const lowStock = spools.filter((spool) => spool.usableWeightGrams <= 25).length

    return {
      totalSpools: spools.length,
      assigned,
      lowStock,
      totalUsableWeight,
    }
  }, [spools])
  const sortedSpools = useMemo(
    () =>
      [...spools].sort((left, right) => {
        if (left.remainingWeightGrams !== right.remainingWeightGrams) {
          return left.remainingWeightGrams - right.remainingWeightGrams
        }

        return left.brand.localeCompare(right.brand) || left.material.localeCompare(right.material)
      }),
    [spools],
  )

  async function handleCloseSession() {
    if (closingSession) {
      return
    }

    setClosingSession(true)
    navigate('/kiosk', { replace: true })
  }

  async function handleCreateSpool() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3000/filament/spools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: form.brand,
          material: form.material,
          totalWeightGrams: form.totalWeightGrams,
          remainingWeightGrams: form.remainingWeightGrams,
          quantity: form.quantity,
          activePrinterId: form.activePrinterId,
          colorName: form.colorName,
          notes: form.notes,
        }),
      })

      const payload = (await response.json()) as { error?: string } | { spools?: FilamentSpool[] }

      if (!response.ok || !('spools' in payload) || !payload.spools) {
        const message =
          'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `Failed to create spool with ${response.status}`
        throw new Error(message)
      }

      setSpools(payload.spools)
      syncSpoolDrafts(payload.spools, setDraftAssignments, setDraftRemaining)
      setForm(createDefaultSpoolForm())
      setIsCreateModalOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create spool.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSpool(spoolId: string) {
    setError(null)

    try {
      const response = await fetch(`http://localhost:3000/filament/spools/${encodeURIComponent(spoolId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activePrinterId: draftAssignments[spoolId] || null,
          remainingWeightGrams: draftRemaining[spoolId],
        }),
      })

      const payload = (await response.json()) as { error?: string } | { spools?: FilamentSpool[] }

      if (!response.ok || !('spools' in payload) || !payload.spools) {
        const message =
          'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `Failed to update spool with ${response.status}`
        throw new Error(message)
      }

      setSpools(payload.spools)
      syncSpoolDrafts(payload.spools, setDraftAssignments, setDraftRemaining)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update spool.')
    }
  }

  return (
    <main className="admin-screen">
      <section className="admin-shell">
        <header className="student-topbar">
          <div className="student-brand">
            <span className="student-brand__mark">PLA</span>
            <div>
              <p className="student-panel__eyebrow">Print Ledger Assistant</p>
              <p className="student-brand__subtle">Filament tracker</p>
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
              data-tooltip="End this admin session and return to swipe."
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
            <p className="student-panel__eyebrow">Filament inventory</p>
            <h1>Track active spools and usable grams</h1>
            <p className="admin-hero__id">One active spool per printer. Student jobs can only use what the active spool can cover.</p>
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="admin-button admin-button--secondary tooltip-trigger"
              data-tooltip="Return to the admin dashboard."
              onClick={() => navigate('/admin', { state })}
            >
              Back to Admin Dashboard
            </button>
          </div>
        </section>

        <section className="admin-metrics admin-metrics--filament">
          <article className="admin-metric">
            <span>Total spools</span>
            <strong>{metrics.totalSpools}</strong>
          </article>
          <article className="admin-metric">
            <span>Assigned now</span>
            <strong>{metrics.assigned}</strong>
          </article>
          <article className="admin-metric">
            <span>Low stock</span>
            <strong>{metrics.lowStock}</strong>
          </article>
          <article className="admin-metric">
            <span>Total usable</span>
            <strong>{formatWeight(metrics.totalUsableWeight)}</strong>
          </article>
        </section>

        {loading ? <p className="admin-empty">Loading filament tracker...</p> : null}
        {error ? <p className="admin-empty admin-empty--error">{error}</p> : null}

        <section className="admin-panel">
          <div className="admin-panel__header-row">
            <div className="section-heading">
              <div>
                <p className="section-heading__eyebrow">Inventory</p>
                <h2>Spool spreadsheet</h2>
              </div>
            </div>

            <button
              type="button"
              className="admin-button admin-button--primary tooltip-trigger"
              data-tooltip="Add one or more new spools."
              onClick={() => {
                setError(null)
                setIsCreateModalOpen(true)
              }}
            >
              Add Spools
            </button>
          </div>

          {spools.length === 0 && !loading ? <p className="admin-empty">No spools have been added yet.</p> : null}

          {spools.length > 0 ? (
            <div className="student-table-wrap">
              <table className="student-table filament-table">
                <colgroup>
                  <col className="filament-table__col filament-table__col--brand" />
                  <col className="filament-table__col filament-table__col--material" />
                  <col className="filament-table__col filament-table__col--color" />
                  <col className="filament-table__col filament-table__col--total" />
                  <col className="filament-table__col filament-table__col--left" />
                  <col className="filament-table__col filament-table__col--reserved" />
                  <col className="filament-table__col filament-table__col--usable" />
                  <col className="filament-table__col filament-table__col--status" />
                  <col className="filament-table__col filament-table__col--printer" />
                  <col className="filament-table__col filament-table__col--save" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Material</th>
                    <th>Color</th>
                    <th>Total</th>
                    <th>Grams left</th>
                    <th>Reserved</th>
                    <th>Usable</th>
                    <th>Status</th>
                    <th>Active printer</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSpools.map((spool) => {
                    const activePrinter = printers.find((printer) => printer.id === spool.activePrinterId) ?? null
                    return (
                      <tr key={spool.id}>
                        <td>{spool.brand}</td>
                        <td>{spool.material}</td>
                        <td>{spool.colorName ?? '-'}</td>
                        <td>{formatWeight(spool.totalWeightGrams)}</td>
                        <td>
                          <input
                            className="student-field__input filament-table__input"
                            inputMode="decimal"
                            value={draftRemaining[spool.id] ?? String(spool.remainingWeightGrams)}
                            onChange={(event) =>
                              setDraftRemaining((current) => ({ ...current, [spool.id]: event.target.value }))
                            }
                          />
                        </td>
                        <td>{formatWeight(spool.reservedWeightGrams)}</td>
                        <td>{formatWeight(spool.usableWeightGrams)}</td>
                        <td>{getFilamentStatusLabel(spool)}</td>
                        <td>
                          <select
                            className="student-field__input filament-select filament-table__input"
                            value={draftAssignments[spool.id] ?? ''}
                            onChange={(event) =>
                              setDraftAssignments((current) => ({ ...current, [spool.id]: event.target.value }))
                            }
                          >
                            <option value="">Not assigned</option>
                            {printers.map((printer) => (
                              <option key={printer.id} value={printer.id}>
                                {printer.name}
                              </option>
                            ))}
                          </select>
                          <p className="detail filament-table__printer">
                            {activePrinter ? activePrinter.name : 'No printer selected'}
                          </p>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-button admin-button--secondary filament-table__button"
                            onClick={() => {
                              void handleSaveSpool(spool.id)
                            }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">History</p>
              <h2>Recent filament events</h2>
            </div>
          </div>

          {events.length === 0 ? <p className="admin-empty">No filament events have been recorded yet.</p> : null}

          {events.length > 0 ? (
            <div className="admin-alert-list">
              {events.map((event) => (
                <article key={event.id} className="admin-alert-item">
                  <div className="admin-alert-item__header">
                    <p className="admin-alert-item__title">{formatFilamentEventTitle(event)}</p>
                    <p className="admin-alert-item__meta">{formatTimestamp(event.createdAt)}</p>
                  </div>
                  <p className="admin-alert-item__detail">{getFilamentEventMetricLabel(event, printers, spools)}</p>
                  {event.note ? <p className="admin-alert-item__detail">{event.note}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {isCreateModalOpen ? (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (!saving) {
                setIsCreateModalOpen(false)
              }
            }}
          >
            <section
              className="modal-card modal-card--filament"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-spool-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div className="section-heading">
                  <div>
                    <p className="section-heading__eyebrow">Add spool</p>
                    <h2 id="add-spool-title">Register new spools</h2>
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close add spool window"
                  disabled={saving}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Close
                </button>
              </div>

              {error ? <p className="admin-empty admin-empty--error">{error}</p> : null}

              <div className="student-form-grid">
                <label className="student-field">
                  <span className="student-field__label">Brand</span>
                  <input
                    className="student-field__input"
                    value={form.brand}
                    onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
                    placeholder="Polymaker"
                  />
                </label>

                <label className="student-field">
                  <span className="student-field__label">Material</span>
                  <input
                    className="student-field__input"
                    value={form.material}
                    onChange={(event) => setForm((current) => ({ ...current, material: event.target.value }))}
                    placeholder="PLA"
                  />
                </label>

                <label className="student-field">
                  <span className="student-field__label">Total amount (g)</span>
                  <input
                    className="student-field__input"
                    inputMode="decimal"
                    value={form.totalWeightGrams}
                    onChange={(event) => setForm((current) => ({ ...current, totalWeightGrams: event.target.value }))}
                    placeholder="1000"
                  />
                </label>

                <label className="student-field">
                  <span className="student-field__label">Amount left (g)</span>
                  <input
                    className="student-field__input"
                    inputMode="decimal"
                    value={form.remainingWeightGrams}
                    onChange={(event) => setForm((current) => ({ ...current, remainingWeightGrams: event.target.value }))}
                    placeholder="Leave blank to match total"
                  />
                </label>

                <label className="student-field">
                  <span className="student-field__label">How many to add</span>
                  <div className="student-stepper">
                    <button
                      type="button"
                      className="student-stepper__button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          quantity: String(Math.max(1, parseQuantity(current.quantity) - 1)),
                        }))
                      }
                    >
                      -
                    </button>
                    <input
                      className="student-field__input student-field__input--stepper"
                      inputMode="numeric"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        setForm((current) => ({
                          ...current,
                          quantity: String(parseQuantity(current.quantity)),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="student-stepper__button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          quantity: String(Math.min(50, parseQuantity(current.quantity) + 1)),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                  <span className="student-field__hint">
                    Add multiple matching spools at once. If a printer is selected, only the first spool will be assigned.
                  </span>
                </label>

                <label className="student-field">
                  <span className="student-field__label">Active printer</span>
                  <select
                    className="student-field__input filament-select"
                    value={form.activePrinterId}
                    onChange={(event) => setForm((current) => ({ ...current, activePrinterId: event.target.value }))}
                  >
                    <option value="">Not assigned</option>
                    {printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="student-field">
                  <span className="student-field__label">Color (optional)</span>
                  <input
                    className="student-field__input"
                    value={form.colorName}
                    onChange={(event) => setForm((current) => ({ ...current, colorName: event.target.value }))}
                    placeholder="White"
                  />
                </label>

                <label className="student-field student-field--full">
                  <span className="student-field__label">Notes (optional)</span>
                  <textarea
                    className="student-field__input student-field__input--textarea"
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="Optional notes for this spool."
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={saving}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  disabled={saving}
                  onClick={() => {
                    void handleCreateSpool()
                  }}
                >
                  {saving
                    ? 'Saving Spools...'
                    : parseQuantity(form.quantity) === 1
                      ? 'Add Spool'
                      : `Add ${parseQuantity(form.quantity)} Spools`}
                </button>
              </div>
            </section>
          </div>
        ) : null}
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

function formatCountdown(remainingMs: number) {
  const safeMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatWeight(value: number) {
  return `${Math.round(value)} g`
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Pending'
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString()
}

function formatFilamentEventTitle(event: FilamentEvent) {
  switch (event.eventType) {
    case 'reserve':
      return 'Filament reserved'
    case 'release':
      return 'Filament released'
    case 'consume':
      return 'Filament consumed'
    case 'assign':
      return 'Spool assigned'
    case 'unassign':
      return 'Spool unassigned'
    default:
      return 'Filament adjusted'
  }
}

function getFilamentEventPrinterLabel(event: FilamentEvent, printers: Printer[]) {
  if (!event.printerId) {
    return 'Unknown printer'
  }

  const printer = printers.find((item) => item.id === event.printerId)
  return printer?.name ?? 'Unknown printer'
}

function getFilamentEventMetricLabel(event: FilamentEvent, printers: Printer[], spools: FilamentSpool[]) {
  const printerLabel = event.printerId ? getFilamentEventPrinterLabel(event, printers) : null
  const spool = spools.find((item) => item.id === event.spoolId) ?? null

  if (event.eventType === 'assign' || event.eventType === 'unassign') {
    const parts = [spool ? `${formatWeight(spool.remainingWeightGrams)} left` : null, printerLabel].filter(Boolean)
    return parts.length > 0 ? parts.join(' | ') : 'Spool updated'
  }

  const parts = [formatWeight(event.grams), printerLabel].filter(Boolean)
  return parts.join(' | ')
}

function getFilamentStatusLabel(spool: FilamentSpool) {
  if (spool.usableWeightGrams <= 0) {
    return 'Out'
  }

  if (spool.usableWeightGrams <= 25) {
    return 'Low'
  }

  return 'Ready'
}

function createDefaultSpoolForm(): SpoolFormState {
  return {
    brand: 'Generic',
    material: 'PLA',
    totalWeightGrams: '1000',
    remainingWeightGrams: '',
    quantity: '1',
    activePrinterId: '',
    colorName: '',
    notes: '',
  }
}

function parseQuantity(value: string) {
  const parsed = Number.parseInt(value.trim() || '1', 10)
  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.min(Math.max(parsed, 1), 50)
}

function syncSpoolDrafts(
  spoolData: FilamentSpool[],
  setDraftAssignments: Dispatch<SetStateAction<Record<string, string>>>,
  setDraftRemaining: Dispatch<SetStateAction<Record<string, string>>>,
) {
  setDraftAssignments(Object.fromEntries(spoolData.map((spool) => [spool.id, spool.activePrinterId ?? ''])))
  setDraftRemaining(Object.fromEntries(spoolData.map((spool) => [spool.id, String(spool.remainingWeightGrams)])))
}
