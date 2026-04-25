export type PrinterStatus = 'idle' | 'armed' | 'printing' | 'sniped'

export type Printer = {
  id: string
  name: string
  ip: string
  location: string
  status: PrinterStatus
  activeJob: string
  material: string
  nozzleTemp: number
  bedTemp: number
  progress: number
  lastSeen: string
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
