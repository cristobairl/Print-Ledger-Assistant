import { Navigate, useLocation, useNavigate } from 'react-router-dom'

type StudentLandingState = {
  firstName?: string
  isAdmin?: boolean
  created?: boolean
}

export function StudentLanding() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as StudentLandingState | null) ?? null

  if (!state?.firstName) {
    return <Navigate to="/kiosk" replace />
  }

  return (
    <main className="student-screen">
      <section className="student-panel">
        <p className="student-panel__eyebrow">Student profile</p>
        <h1>{state.firstName}</h1>
        <p className="student-panel__lead">
          {state.created
            ? 'Your profile was created from this swipe and you are cleared to continue.'
            : 'You are signed in and cleared to continue.'}
        </p>

        <div className="student-badges">
          <span className="student-badge">Authorized</span>
          {state.isAdmin && <span className="student-badge student-badge--admin">Admin</span>}
        </div>

        <button
          type="button"
          className="student-panel__action"
          onClick={() => navigate('/kiosk', { replace: true })}
        >
          Return to swipe screen
        </button>
      </section>
    </main>
  )
}
