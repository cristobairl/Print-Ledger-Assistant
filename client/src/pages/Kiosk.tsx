import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LandingState } from '../types'

type SwipeResponse = {
  authorized?: boolean
  first_name?: string
  card_id?: string
  student_id?: string
  error?: string
  is_admin?: boolean
  created?: boolean
}

type SwipeState = 'idle' | 'reading' | 'success' | 'error'

export function Kiosk() {
  const navigate = useNavigate()
  const buffer = useRef('')
  const lastKeyTime = useRef(Date.now())
  const [swipeData, setSwipeData] = useState<SwipeResponse | null>(null)
  const [swipeState, setSwipeState] = useState<SwipeState>('idle')
  const [readerHint, setReaderHint] = useState('Waiting for card swipe')

  useEffect(() => {
    let resetTimer: number | undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now()

      if (now - lastKeyTime.current > 100) {
        buffer.current = ''
        setSwipeState('idle')
        setReaderHint('Waiting for card swipe')
      }

      lastKeyTime.current = now

      if (event.key === 'Enter') {
        const raw = buffer.current
        buffer.current = ''

        if (raw.startsWith('%B')) {
          void handleSwipe(raw)
        } else if (raw.length > 0) {
          setSwipeState('error')
          setSwipeData({ error: 'Card data was received, but the swipe format was invalid.' })
          setReaderHint('Swipe could not be parsed')
        }
        return
      }

      if (event.key.length === 1) {
        buffer.current += event.key
        if (buffer.current.startsWith('%B')) {
          setSwipeState('reading')
          setReaderHint('Reading magnetic stripe data')
        }
      }

      if (resetTimer) {
        window.clearTimeout(resetTimer)
      }

      resetTimer = window.setTimeout(() => {
        if (buffer.current.length === 0 && swipeState === 'reading') {
          setSwipeState('idle')
          setReaderHint('Waiting for card swipe')
        }
      }, 1200)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (resetTimer) {
        window.clearTimeout(resetTimer)
      }
    }
  }, [swipeState])

  async function handleSwipe(raw: string) {
    setSwipeState('reading')
    setReaderHint('Checking authorization')

    try {
      const response = await fetch('http://localhost:3000/auth/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })

      const data = (await response.json()) as SwipeResponse
      setSwipeData(data)
      if (response.ok && data.authorized) {
        setSwipeState('success')
        setReaderHint('Card authorized')
        const nextState: LandingState = {
          firstName: data.first_name ?? 'Student',
          cardId: data.card_id ?? data.student_id ?? 'Unknown card',
          studentId: data.student_id,
          isAdmin: Boolean(data.is_admin),
          created: Boolean(data.created),
        }

        window.setTimeout(() => {
          navigate(Boolean(data.is_admin) ? '/admin' : '/student', {
            state: nextState,
          })
        }, 450)
      } else {
        setSwipeState('error')
        setReaderHint('Card not authorized')
      }
    } catch {
      setSwipeData({
        authorized: true,
        first_name: 'Demo',
      })
      setSwipeState('success')
      setReaderHint('Backend offline, showing demo success')
      const nextState: LandingState = {
        firstName: 'Demo',
        cardId: 'DEMO-0001',
        studentId: 'demo-student',
        isAdmin: false,
        created: true,
      }

      window.setTimeout(() => {
        navigate('/student', {
          state: nextState,
        })
      }, 450)
    }
  }

  return (
    <main className="kiosk-screen">
      <section className={`kiosk-panel kiosk-panel--${swipeState}`}>
        <div className="kiosk-panel__header">
          <p className="kiosk-panel__eyebrow">Print Ledger Assistant</p>
          <h1>Swipe your student ID</h1>
          <p className="kiosk-panel__lead">
            Use the reader to begin your print session.
          </p>
        </div>

        <div className="reader-display" aria-live="polite">
          <div className={`reader-display__pulse reader-display__pulse--${swipeState}`} />
          <div>
            <p className="reader-display__label">Reader status</p>
            <p className="reader-display__value">{readerHint}</p>
          </div>
        </div>

        <div className="swipe-card">
          {swipeData ? (
            <>
              <p className="swipe-card__label">Latest result</p>
              {swipeData.authorized ? (
                <>
                  <p className="swipe-card__name">{swipeData.first_name}</p>
                  <p className="swipe-card__message">
                    {swipeData.created
                      ? 'First swipe recorded. Student added and authorized.'
                      : `Authorization accepted${swipeData.is_admin ? ' with admin access' : ''}.`}
                  </p>
                </>
              ) : (
                <>
                  <p className="swipe-card__name">Swipe denied</p>
                  <p className="swipe-card__message">
                    {swipeData.error ?? 'This card could not be matched to an authorized student.'}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p className="swipe-card__label">Ready</p>
              <p className="swipe-card__name">Present card to reader</p>
            </>
          )}
        </div>

        <div className="kiosk-notes">
          <div className="kiosk-note">
            <span>i</span>
            <p>If the reader does not respond, click anywhere on this screen once and swipe again.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
