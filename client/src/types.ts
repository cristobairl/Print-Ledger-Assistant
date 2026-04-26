export type LandingState = {
  firstName?: string
  cardId?: string
  studentId?: string
  isAdmin?: boolean
  created?: boolean
}

export type Printer = {
  id: string
  name: string
  ip: string
  authorization: {
    state: 'authorized' | 'unauthorized'
    sessionState: 'idle' | 'pending_start' | 'active_print'
    grantedAt: string | null
    expiresAt: string | null
    activatedAt: string | null
    studentId: string | null
    cardId: string | null
    firstName: string | null
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

export type StudentJob = {
  id: string
  studentId: string | null
  printerId: string | null
  fileName: string | null
  fileSize: number | string | null
  estimatedTime: number | string | null
  estimatedWeightGrams: number | string | null
  jobReason: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string | null
  status: string | null
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
