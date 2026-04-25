import { useEffect, useRef, useState } from 'react'
import { EventLog } from '../components/EventLog'
import { PrinterCard } from '../components/PrinterCard'
import type { EventItem, Job, Printer } from '../types'

type SwipeResponse = {
  authorized?: boolean
  first_name?: string
  last_name?: string
  error?: string
}

type KioskProps = {
  printers: Printer[]
  jobs: Job[]
  events: EventItem[]
}

export function Kiosk({ printers, jobs, events }: KioskProps) {
  const buffer = useRef('')
  const lastKeyTime = useRef(Date.now())
  const [swipeData, setSwipeData] = useState<SwipeResponse | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'live' | 'offline'>('idle')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now()

      if (now - lastKeyTime.current > 100) {
        buffer.current = ''
      }

      lastKeyTime.current = now

      if (event.key === 'Enter') {
        const raw = buffer.current
        buffer.current = ''

        if (raw.startsWith('%B')) {
          void handleSwipe(raw)
        }
        return
      }

      if (event.key.length === 1) {
        buffer.current += event.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSwipe(raw: string) {
    try {
      const response = await fetch('http://localhost:3000/auth/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })

      const data = (await response.json()) as SwipeResponse
      setSwipeData(data)
      setConnectionState('live')
    } catch {
      setSwipeData({
        authorized: true,
        first_name: 'Demo',
        last_name: 'User',
      })
      setConnectionState('offline')
    }
  }

  return (
    <section className="page-grid">
      <div className="page-stack">
        <section className="surface surface--hero">
          <div className="hero-panel">
            <div>
              <p className="section-heading__eyebrow">Kiosk session</p>
              <h2>Swipe your ID to arm a printer</h2>
              <p className="hero-panel__text">
                The kiosk listens for rapid MSR90 card input, forwards the raw
                track data to `/auth/swipe`, and opens a short authorization
                window for the selected print.
              </p>
            </div>

            <div className="hero-panel__status">
              <div className="hero-panel__ring" />
              <div>
                <p className="label">Reader state</p>
                <p className="hero-panel__headline">Ready for card swipe</p>
                <p className="hero-panel__subtle">
                  {connectionState === 'live' && 'Backend connection healthy.'}
                  {connectionState === 'offline' &&
                    'Backend not detected, showing demo authorization state.'}
                  {connectionState === 'idle' &&
                    'Waiting for the first swipe event.'}
                </p>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <article>
              <span>Armed printers</span>
              <strong>{printers.filter((printer) => printer.status === 'armed').length}</strong>
            </article>
            <article>
              <span>Printing now</span>
              <strong>
                {jobs.filter((job) => job.status === 'printing').length}
              </strong>
            </article>
            <article>
              <span>Security events</span>
              <strong>
                {events.filter((event) => event.type === 'security').length}
              </strong>
            </article>
          </div>
        </section>

        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Authorization</p>
              <h2>Latest swipe</h2>
            </div>
          </div>

          <div className="swipe-result">
            {swipeData ? (
              <>
                <div>
                  <p className="label">Student</p>
                  <p className="swipe-result__name">
                    {swipeData.first_name} {swipeData.last_name}
                  </p>
                </div>
                <div>
                  <p className="label">Decision</p>
                  <p className="swipe-result__decision">
                    {swipeData.authorized ? 'Authorized' : 'Denied'}
                  </p>
                </div>
              </>
            ) : (
              <p className="hero-panel__subtle">
                No swipe captured yet. Focus the kiosk and swipe a student card
                to test the flow.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="page-stack">
        <section className="surface">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Printers</p>
              <h2>Ready to arm</h2>
            </div>
          </div>
          <div className="printer-list">
            {printers.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} />
            ))}
          </div>
        </section>

        <EventLog events={events} title="Security event log" />
      </div>
    </section>
  )
}
