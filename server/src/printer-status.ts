export type AuthorizationState = 'authorized' | 'unauthorized'
export type ConnectivityState = 'online' | 'offline'
export type ActivityState = 'idle' | 'heating' | 'printing' | 'unknown'
export type EnforcementMode = 'observe-only'
export type EnforcementState = 'idle' | 'monitoring'
export type ActivitySource = 'm27-status' | 'temperature-heuristic'

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
    lastAction: 'none'
    reason: string
  }
}
