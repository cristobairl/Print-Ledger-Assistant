import { useEffect, useState } from 'react'
import { PrinterCard } from '../components/PrinterCard'
import type { Printer } from '../types'

export function PrinterStatus() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadStatus = async () => {
      try {
        const response = await fetch('http://localhost:3000/printers/status')
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}`)
        }

        const data = (await response.json()) as Printer[]
        if (!active) {
          return
        }

        setPrinters(data)
        setError(null)
      } catch (fetchError) {
        if (!active) {
          return
        }

        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load printer status.'
        setError(message)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadStatus()
    const interval = window.setInterval(() => {
      void loadStatus()
    }, 2000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  async function handleAuthorizationChange(printerId: string, authorize: boolean) {
    const endpoint = authorize ? 'authorize' : 'deauthorize'
    const response = await fetch(`http://localhost:3000/printers/${printerId}/${endpoint}`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Failed to update authorization with ${response.status}`)
    }

    const payload = (await response.json()) as { printers: Printer[] }
    setPrinters(payload.printers)
  }

  return (
    <main className="printer-screen">
      <section className="printer-page">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Watchdog diagnostics</p>
            <h1>Printer link verification</h1>
            <p className="printer-page__lead">
              This view shows the exact `~M27` activity reply and `~M105` telemetry
              reply the backend received. If either raw reply updates here, the printer
              is sending data back to your PC on the watchdog connection.
            </p>
          </div>
        </div>

        <div className="hero-stats">
          <article>
            <span>Watchdog cadence</span>
            <strong>2 sec</strong>
          </article>
          <article>
            <span>Online printers</span>
            <strong>{printers.filter((printer) => printer.connectivity.state === 'online').length}</strong>
          </article>
          <article>
            <span>Observe-only</span>
            <strong>{printers.filter((printer) => printer.enforcement.mode === 'observe-only').length}</strong>
          </article>
        </div>

        {loading && printers.length === 0 ? <p className="printer-page__message">Loading printer status...</p> : null}
        {error ? <p className="printer-page__message printer-page__message--error">{error}</p> : null}

        <div className="printer-list">
          {printers.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onAuthorizationChange={(printerId, authorize) => {
                void handleAuthorizationChange(printerId, authorize).catch((requestError) => {
                  const message =
                    requestError instanceof Error
                      ? requestError.message
                      : 'Failed to update printer authorization.'
                  setError(message)
                })
              }}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
