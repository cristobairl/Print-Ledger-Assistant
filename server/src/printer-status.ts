export type AuthorizationState = 'authorized' | 'unauthorized'
export type AuthorizationSessionState = 'idle' | 'pending_start' | 'active_print'
export type ConnectivityState = 'online' | 'offline'
export type ActivityState = 'idle' | 'heating' | 'printing' | 'unknown'
export type EnforcementMode = 'auto-snipe'
export type EnforcementState = 'idle' | 'monitoring' | 'aborting' | 'aborted' | 'error'
export type ActivitySource = 'm27-status' | 'temperature-heuristic'
export type FilamentState = 'ready' | 'low' | 'out' | 'unassigned' | 'unknown'

export type TemperatureTelemetry = {
  current: number | null
  target: number | null
}

export type PrinterStatusSnapshot = {
  id: string
  name: string
  ip: string
  authorization: {
    state: AuthorizationState
    sessionState: AuthorizationSessionState
    grantedAt: string | null
    expiresAt: string | null
    activatedAt: string | null
    studentId: string | null
    cardId: string | null
    firstName: string | null
    jobId: string | null
  }
  connectivity: {
    state: ConnectivityState
    lastSeenAt: string | null
    lastError: string | null
    lastPort: number | null
  }
  activity: {
    state: ActivityState
    source: ActivitySource
    reason: string
    command: '~M27'
    rawResponse: string | null
  }
  telemetry: {
    command: '~M105'
    rawResponse: string | null
    nozzle: TemperatureTelemetry
    bed: TemperatureTelemetry
  }
  enforcement: {
    mode: EnforcementMode
    state: EnforcementState
    lastAction: 'none' | 'abort_sent' | 'abort_failed'
    reason: string
  }
  filament: {
    state: FilamentState
    reason: string
    activeSpoolId: string | null
    brand: string | null
    material: string | null
    colorName: string | null
    totalWeightGrams: number | null
    remainingWeightGrams: number | null
    reservedWeightGrams: number | null
    usableWeightGrams: number | null
    safetyBufferGrams: number
  }
}
