export type Printer = {
  id: string
  name: string
  ip: string
  authorization: {
    state: 'authorized' | 'unauthorized'
  }
  connectivity: {
    state: 'online' | 'offline'
    lastSeenAt: string | null
    lastError: string | null
    lastPort: number | null
  }
  activity: {
    state: 'idle' | 'heating' | 'printing' | 'unknown'
    source: 'm27-status' | 'temperature-heuristic'
    reason: string
    command: '~M27'
    rawResponse: string | null
  }
  telemetry: {
    command: '~M105'
    rawResponse: string | null
    nozzle: {
      current: number | null
      target: number | null
    }
    bed: {
      current: number | null
      target: number | null
    }
  }
  enforcement: {
    mode: 'observe-only'
    state: 'idle' | 'monitoring'
    lastAction: 'none'
    reason: string
  }
}

export type JobStatus = 'queued' | 'printing' | 'completed' | 'sniped'

export type Job = {
  id: string
  studentName: string
  studentId: string
  printerName: string
  fileName: string
  status: JobStatus
  startedAt: string
  estimatedTime: string
  reason: string
}

export type EventType = 'auth' | 'security' | 'system'

export type EventItem = {
  id: string
  timestamp: string
  type: EventType
  title: string
  detail: string
  printerName: string
}
