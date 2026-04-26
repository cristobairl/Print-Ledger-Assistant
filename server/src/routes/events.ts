import { Router } from 'express'
import { supabase } from '../db'

const router = Router()

type EventRow = {
  id: string | number
  event_type: string | null
  printer_id: string | number | null
  student_id: string | number | null
  created_at: string | null
}

type PrinterLookupRow = {
  id: string | number
  name: string | null
}

type StudentLookupRow = {
  id: string | number
  first_name: string | null
  last_name: string | null
  card_id: string | null
}

router.get('/', async (req, res) => {
  const eventType = typeof req.query.eventType === 'string' ? req.query.eventType.trim().toLowerCase() : ''
  const limit = clampLimit(req.query.limit)

  let query = supabase
    .from('events')
    .select('id, event_type, printer_id, student_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Events] Failed to load events.', error)
    return res.status(500).json({ error: 'Failed to load events.' })
  }

  const rows = (data ?? []) as EventRow[]
  const printerIds = uniqueIds(rows.map((row) => row.printer_id))
  const studentIds = uniqueIds(rows.map((row) => row.student_id))

  const [printersById, studentsById] = await Promise.all([
    loadPrintersById(printerIds),
    loadStudentsById(studentIds),
  ])

  return res.json(
    rows.map((row) => mapEventRow(row, printersById, studentsById)),
  )
})

async function loadPrintersById(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, PrinterLookupRow>()
  }

  const { data, error } = await supabase
    .from('printers')
    .select('id, name')
    .in('id', ids)

  if (error) {
    console.error('[Events] Failed to load printer names for events.', error)
    return new Map<string, PrinterLookupRow>()
  }

  return new Map(
    ((data ?? []) as PrinterLookupRow[]).map((row) => [String(row.id), row]),
  )
}

async function loadStudentsById(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, StudentLookupRow>()
  }

  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, card_id')
    .in('id', ids)

  if (error) {
    console.error('[Events] Failed to load student names for events.', error)
    return new Map<string, StudentLookupRow>()
  }

  return new Map(
    ((data ?? []) as StudentLookupRow[]).map((row) => [String(row.id), row]),
  )
}

function mapEventRow(
  row: EventRow,
  printersById: Map<string, PrinterLookupRow>,
  studentsById: Map<string, StudentLookupRow>,
) {
  const printerId = row.printer_id === null ? null : String(row.printer_id)
  const studentId = row.student_id === null ? null : String(row.student_id)
  const printer = printerId ? printersById.get(printerId) ?? null : null
  const student = studentId ? studentsById.get(studentId) ?? null : null
  const printerName = printer?.name?.trim() || (printerId ? `Printer ${printerId.slice(0, 8)}` : 'Unknown printer')
  const studentLabel = formatStudentLabel(studentId, student)
  const eventType = normalizeEventType(row.event_type)

  return {
    id: String(row.id),
    type: eventType,
    timestamp: row.created_at ?? new Date(0).toISOString(),
    printerId,
    printerName,
    studentId,
    studentLabel,
    title: buildEventTitle(eventType, printerName),
    detail: buildEventDetail(eventType, studentLabel),
  }
}

function normalizeEventType(value: string | null) {
  if (value === 'snipe') {
    return 'snipe' as const
  }

  if (value === 'security') {
    return 'security' as const
  }

  if (value === 'auth') {
    return 'auth' as const
  }

  return 'system' as const
}

function buildEventTitle(eventType: 'auth' | 'security' | 'system' | 'snipe', printerName: string) {
  if (eventType === 'snipe') {
    return `${printerName} auto-sniped`
  }

  if (eventType === 'security') {
    return `${printerName} security event`
  }

  if (eventType === 'auth') {
    return `${printerName} authorization event`
  }

  return `${printerName} system event`
}

function buildEventDetail(eventType: 'auth' | 'security' | 'system' | 'snipe', studentLabel: string | null) {
  if (eventType === 'snipe') {
    if (studentLabel) {
      return `The watchdog sent ~M26 after unauthorized printer activity was detected. Related student record: ${studentLabel}.`
    }

    return 'The watchdog sent ~M26 after unauthorized printer activity was detected with no authorized student session attached.'
  }

  return studentLabel ? `Related student record: ${studentLabel}.` : 'No student record attached to this event.'
}

function formatStudentLabel(studentId: string | null, student: StudentLookupRow | null) {
  if (!studentId) {
    return null
  }

  const nameParts = [student?.first_name?.trim(), student?.last_name?.trim()].filter(Boolean)
  if (nameParts.length > 0) {
    if (student?.card_id) {
      return `${nameParts.join(' ')} (card ${student.card_id})`
    }

    return nameParts.join(' ')
  }

  if (student?.card_id) {
    return `Card ${student.card_id}`
  }

  return `Student ${studentId}`
}

function clampLimit(value: unknown) {
  if (typeof value !== 'string') {
    return 25
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return 25
  }

  return Math.min(Math.max(parsed, 1), 100)
}

function uniqueIds(values: Array<string | number | null>) {
  return [...new Set(values.filter((value): value is string | number => value !== null).map((value) => String(value)))]
}

export default router
