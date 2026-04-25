// In your Kiosk.tsx page
import { useEffect, useRef, useState } from 'react'

export default function Kiosk() {
  const buffer = useRef('')
  const lastKeyTime = useRef(Date.now())
  const [swipeData, setSwipeData] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      const timeSinceLast = now - lastKeyTime.current

      // If too much time passed since last key, reset buffer
      // Human typing is slow, card swipe is fast
      if (timeSinceLast > 100) {
        buffer.current = ''
      }

      lastKeyTime.current = now

      // Build the buffer
      if (e.key === 'Enter') {
        // Card swipe ends with Enter
        const raw = buffer.current
        buffer.current = ''

        // Only process if it looks like a card swipe
        if (raw.startsWith('%B')) {
          handleSwipe(raw)
        }
      } else {
        buffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSwipe = async (raw: string) => {
    // Send raw string to your Express backend
    const response = await fetch('http://localhost:3000/auth/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw })
    })
    const data = await response.json()
    setSwipeData(data)
  }

  return (
    <div>
      <h1>Swipe your ID to begin</h1>
      {swipeData && <p>Welcome {swipeData.first_name}</p>}
    </div>
  )
}