export type LandingState = {
  firstName?: string
  cardId?: string
  studentId?: string
  isAdmin?: boolean
  created?: boolean
}

export type PrintPolicySettings = {
  maxPrintHours: number
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
    jobId: string | null
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
    mode: 'auto-snipe'
    state: 'idle' | 'monitoring' | 'aborting' | 'aborted' | 'error'
    lastAction: 'none' | 'abort_sent' | 'abort_failed'
    reason: string
  }
  filament: {
    state: 'ready' | 'low' | 'out' | 'unassigned' | 'unknown'
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

export type JobStatus = 'queued' | 'printing' | 'completed' | 'sniped' | 'expired' | 'interrupted'

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

export type EventType = 'auth' | 'security' | 'system' | 'snipe'

export type EventItem = {
  id: string
  timestamp: string
  type: EventType
  title: string
  detail: string
  printerId: string | null
  printerName: string
  studentId: string | null
  studentLabel: string | null
}

export type FilamentSpool = {
  id: string
  brand: string
  material: string
  totalWeightGrams: number
  remainingWeightGrams: number
  reservedWeightGrams: number
  usableWeightGrams: number
  activePrinterId: string | null
  colorName: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type FilamentEvent = {
  id: string
  spoolId: string
  eventType: 'reserve' | 'release' | 'consume' | 'adjust' | 'assign' | 'unassign'
  grams: number
  printerId: string | null
  jobId: string | null
  studentId: string | null
  note: string | null
  createdAt: string | null
}
