import { supabase } from './db'
import type { PrinterStatusSnapshot } from './printer-status'

export const FILAMENT_SAFETY_BUFFER_GRAMS = 5
export const FILAMENT_NO_DEDUCTION_PROGRESS_THRESHOLD = 0.1

type FilamentSpoolRow = {
  id: string | number
  brand: string | null
  material: string | null
  total_weight_grams: number | string | null
  remaining_weight_grams: number | string | null
  reserved_weight_grams: number | string | null
  active_printer_id: string | number | null
  color_name: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type FilamentSpool = {
  id: string
  brand: string
  material: string
  totalWeightGrams: number
  remainingWeightGrams: number
  reservedWeightGrams: number
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

type FilamentEventRow = {
  id: string | number
  spool_id: string | number | null
  event_type: string | null
  grams: number | string | null
  printer_id: string | number | null
  job_id: string | number | null
  student_id: string | number | null
  note: string | null
  created_at: string | null
}

export async function fetchFilamentSpools() {
  const { data, error } = await supabase
    .from('filament_spools')
    .select(
      'id, brand, material, total_weight_grams, remaining_weight_grams, reserved_weight_grams, active_printer_id, color_name, notes, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? [])
    .map((row) => mapFilamentSpoolRow(row as Partial<FilamentSpoolRow>))
    .filter((row): row is FilamentSpool => row !== null)
}

export async function fetchFilamentEvents(limit = 20) {
  const { data, error } = await supabase
    .from('filament_events')
    .select('id, spool_id, event_type, grams, printer_id, job_id, student_id, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => mapFilamentEventRow(row as Partial<FilamentEventRow>))
}

export async function fetchFilamentSpoolById(spoolId: string) {
  const { data, error } = await supabase
    .from('filament_spools')
    .select(
      'id, brand, material, total_weight_grams, remaining_weight_grams, reserved_weight_grams, active_printer_id, color_name, notes, created_at, updated_at',
    )
    .eq('id', spoolId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapFilamentSpoolRow(data as Partial<FilamentSpoolRow>) : null
}

export async function fetchActiveSpoolsByPrinter() {
  const spools = await fetchFilamentSpools()
  const map = new Map<string, FilamentSpool>()

  for (const spool of spools) {
    if (spool.activePrinterId) {
      map.set(spool.activePrinterId, spool)
    }
  }

  return map
}

export async function reserveFilamentForJob(input: {
  spoolId: string
  printerId: string
  jobId: string
  studentId?: string | null
  grams: number
}) {
  const spool = await fetchFilamentSpoolById(input.spoolId)
  if (!spool) {
    return { ok: false as const, reason: 'Active spool was not found.' }
  }

  const usableWeightGrams = getUsableWeightGrams(spool)
  if (usableWeightGrams < input.grams) {
    return {
      ok: false as const,
      reason: `Only ${usableWeightGrams.toFixed(1)} g is usable on the active spool.`,
    }
  }

  const nextReservedWeight = roundToTwo(spool.reservedWeightGrams + input.grams)
  const { error } = await supabase
    .from('filament_spools')
    .update({
      reserved_weight_grams: nextReservedWeight,
      updated_at: new Date().toISOString(),
    })
    .eq('id', spool.id)

  if (error) {
    throw error
  }

  await recordFilamentEvent({
    spoolId: spool.id,
    eventType: 'reserve',
    grams: input.grams,
    printerId: input.printerId,
    jobId: input.jobId,
    studentId: input.studentId ?? null,
    note: `Reserved at print start for ${spool.brand} ${spool.material}.`,
  })

  return {
    ok: true as const,
    spool,
    reservedGrams: input.grams,
  }
}

export async function settleFilamentReservation(input: {
  spoolId: string
  printerId: string
  jobId: string
  studentId?: string | null
  reservedGrams: number
  consumedGrams: number
}) {
  const spool = await fetchFilamentSpoolById(input.spoolId)
  if (!spool) {
    return { ok: false as const, reason: 'Reserved spool was not found.' }
  }

  const safeReserved = Math.max(0, roundToTwo(input.reservedGrams))
  const safeConsumed = Math.max(0, Math.min(safeReserved, roundToTwo(input.consumedGrams)))
  const releasedGrams = roundToTwo(safeReserved - safeConsumed)
  const nextRemainingWeight = Math.max(0, roundToTwo(spool.remainingWeightGrams - safeConsumed))
  const nextReservedWeight = Math.max(0, roundToTwo(spool.reservedWeightGrams - safeReserved))

  const { error } = await supabase
    .from('filament_spools')
    .update({
      remaining_weight_grams: nextRemainingWeight,
      reserved_weight_grams: nextReservedWeight,
      updated_at: new Date().toISOString(),
    })
    .eq('id', spool.id)

  if (error) {
    throw error
  }

  if (safeConsumed > 0) {
    await recordFilamentEvent({
      spoolId: spool.id,
      eventType: 'consume',
      grams: safeConsumed,
      printerId: input.printerId,
      jobId: input.jobId,
      studentId: input.studentId ?? null,
      note: `Consumed after the print stopped or completed.`,
    })
  }

  if (releasedGrams > 0) {
    await recordFilamentEvent({
      spoolId: spool.id,
      eventType: 'release',
      grams: releasedGrams,
      printerId: input.printerId,
      jobId: input.jobId,
      studentId: input.studentId ?? null,
      note: 'Unused reservation returned to the spool.',
    })
  }

  return {
    ok: true as const,
    consumedGrams: safeConsumed,
    releasedGrams,
  }
}

export async function recordFilamentEvent(input: {
  spoolId: string
  eventType: FilamentEvent['eventType']
  grams: number
  printerId?: string | null
  jobId?: string | null
  studentId?: string | null
  note?: string | null
}) {
  const { error } = await supabase
    .from('filament_events')
    .insert({
      spool_id: input.spoolId,
      event_type: input.eventType,
      grams: roundToTwo(input.grams),
      printer_id: input.printerId ?? null,
      job_id: input.jobId ?? null,
      student_id: input.studentId ?? null,
      note: input.note ?? null,
    })

  if (error) {
    throw error
  }
}

export function mapFilamentSpoolRow(row: Partial<FilamentSpoolRow>): FilamentSpool | null {
  const brand = typeof row.brand === 'string' ? row.brand.trim() : ''
  const material = typeof row.material === 'string' ? row.material.trim() : ''
  const totalWeightGrams = toPositiveNumber(row.total_weight_grams)
  const remainingWeightGrams = toNonNegativeNumber(row.remaining_weight_grams)

  if (!row.id || !brand || !material || totalWeightGrams === null || remainingWeightGrams === null) {
    return null
  }

  return {
    id: String(row.id),
    brand,
    material,
    totalWeightGrams,
    remainingWeightGrams,
    reservedWeightGrams: toNonNegativeNumber(row.reserved_weight_grams) ?? 0,
    activePrinterId: row.active_printer_id === null || row.active_printer_id === undefined ? null : String(row.active_printer_id),
    colorName: typeof row.color_name === 'string' && row.color_name.trim().length > 0 ? row.color_name.trim() : null,
    notes: typeof row.notes === 'string' && row.notes.trim().length > 0 ? row.notes.trim() : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export function mapFilamentEventRow(row: Partial<FilamentEventRow>): FilamentEvent {
  return {
    id: String(row.id ?? ''),
    spoolId: String(row.spool_id ?? ''),
    eventType: isFilamentEventType(row.event_type) ? row.event_type : 'adjust',
    grams: toNonNegativeNumber(row.grams) ?? 0,
    printerId: row.printer_id === null || row.printer_id === undefined ? null : String(row.printer_id),
    jobId: row.job_id === null || row.job_id === undefined ? null : String(row.job_id),
    studentId: row.student_id === null || row.student_id === undefined ? null : String(row.student_id),
    note: typeof row.note === 'string' && row.note.trim().length > 0 ? row.note.trim() : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

export function buildPrinterFilamentSnapshot(spool: FilamentSpool | null): PrinterStatusSnapshot['filament'] {
  if (!spool) {
    return {
      state: 'unassigned',
      reason: 'No active spool is assigned to this printer.',
      activeSpoolId: null,
      brand: null,
      material: null,
      colorName: null,
      totalWeightGrams: null,
      remainingWeightGrams: null,
      reservedWeightGrams: null,
      usableWeightGrams: null,
      safetyBufferGrams: FILAMENT_SAFETY_BUFFER_GRAMS,
    }
  }

  const usableWeightGrams = getUsableWeightGrams(spool)
  if (spool.remainingWeightGrams <= 0) {
    return {
      state: 'out',
      reason: 'The active spool is empty.',
      activeSpoolId: spool.id,
      brand: spool.brand,
      material: spool.material,
      colorName: spool.colorName,
      totalWeightGrams: spool.totalWeightGrams,
      remainingWeightGrams: spool.remainingWeightGrams,
      reservedWeightGrams: spool.reservedWeightGrams,
      usableWeightGrams,
      safetyBufferGrams: FILAMENT_SAFETY_BUFFER_GRAMS,
    }
  }

  const lowThreshold = Math.max(FILAMENT_SAFETY_BUFFER_GRAMS * 2, 25)
  if (usableWeightGrams <= 0 || usableWeightGrams <= lowThreshold) {
    return {
      state: usableWeightGrams <= 0 ? 'out' : 'low',
      reason:
        usableWeightGrams <= 0
          ? 'The active spool does not have enough usable filament left.'
          : 'The active spool is getting low.',
      activeSpoolId: spool.id,
      brand: spool.brand,
      material: spool.material,
      colorName: spool.colorName,
      totalWeightGrams: spool.totalWeightGrams,
      remainingWeightGrams: spool.remainingWeightGrams,
      reservedWeightGrams: spool.reservedWeightGrams,
      usableWeightGrams,
      safetyBufferGrams: FILAMENT_SAFETY_BUFFER_GRAMS,
    }
  }

  return {
    state: 'ready',
    reason: 'The active spool has enough usable filament for normal jobs.',
    activeSpoolId: spool.id,
    brand: spool.brand,
    material: spool.material,
    colorName: spool.colorName,
    totalWeightGrams: spool.totalWeightGrams,
    remainingWeightGrams: spool.remainingWeightGrams,
    reservedWeightGrams: spool.reservedWeightGrams,
    usableWeightGrams,
    safetyBufferGrams: FILAMENT_SAFETY_BUFFER_GRAMS,
  }
}

export function getUsableWeightGrams(spool: Pick<FilamentSpool, 'remainingWeightGrams' | 'reservedWeightGrams'>) {
  return Math.max(
    0,
    roundToTwo(spool.remainingWeightGrams - spool.reservedWeightGrams - FILAMENT_SAFETY_BUFFER_GRAMS),
  )
}

function isFilamentEventType(value: string | null | undefined): value is FilamentEvent['eventType'] {
  return value === 'reserve' ||
    value === 'release' ||
    value === 'consume' ||
    value === 'adjust' ||
    value === 'assign' ||
    value === 'unassign'
}

function toPositiveNumber(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toNonNegativeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}
