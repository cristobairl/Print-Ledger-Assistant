import { Router } from 'express'
import { supabase } from '../db'
import {
  fetchFilamentEvents,
  fetchFilamentSpoolById,
  fetchFilamentSpools,
  getUsableWeightGrams,
  recordFilamentEvent,
} from '../filament'

const router = Router()

type CreateSpoolBody = {
  brand?: string
  material?: string
  totalWeightGrams?: number | string
  remainingWeightGrams?: number | string | null
  quantity?: number | string
  activePrinterId?: string | null
  colorName?: string | null
  notes?: string | null
}

type UpdateSpoolBody = {
  brand?: string
  material?: string
  totalWeightGrams?: number | string
  remainingWeightGrams?: number | string | null
  activePrinterId?: string | null
  colorName?: string | null
  notes?: string | null
}

router.get('/spools', async (_req, res) => {
  try {
    const spools = await fetchFilamentSpools()
    return res.json(
      spools.map((spool) => ({
        ...spool,
        usableWeightGrams: getUsableWeightGrams(spool),
      })),
    )
  } catch (error) {
    return res.status(500).json({
      error: getFilamentErrorMessage(error, 'Failed to load filament spools.'),
    })
  }
})

router.get('/events', async (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '20'), 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20

  try {
    const events = await fetchFilamentEvents(limit)
    return res.json(events)
  } catch (error) {
    return res.status(500).json({
      error: getFilamentErrorMessage(error, 'Failed to load filament events.'),
    })
  }
})

router.post('/spools', async (req, res) => {
  const body = (req.body ?? {}) as CreateSpoolBody
  const brand = body.brand?.trim()
  const material = body.material?.trim()
  const totalWeightGrams = toPositiveNumber(body.totalWeightGrams)
  const requestedRemaining = toNullableNonNegativeNumber(body.remainingWeightGrams)
  const remainingWeightGrams = requestedRemaining ?? totalWeightGrams
  const quantity = toPositiveInteger(body.quantity) ?? 1
  const activePrinterId = normalizeOptionalString(body.activePrinterId)
  const colorName = normalizeOptionalString(body.colorName)
  const notes = normalizeOptionalString(body.notes)

  if (!brand) {
    return res.status(400).json({ error: 'Brand is required.' })
  }

  if (!material) {
    return res.status(400).json({ error: 'Material is required.' })
  }

  if (totalWeightGrams === null) {
    return res.status(400).json({ error: 'Total amount must be greater than zero.' })
  }

  if (remainingWeightGrams === null) {
    return res.status(400).json({ error: 'Amount left must be zero or greater.' })
  }

  if (remainingWeightGrams > totalWeightGrams) {
    return res.status(400).json({ error: 'Amount left cannot be greater than the total amount.' })
  }

  if (quantity < 1 || quantity > 50) {
    return res.status(400).json({ error: 'Quantity must be between 1 and 50.' })
  }

  try {
    if (activePrinterId) {
      await clearActivePrinterAssignment(activePrinterId)
    }

    const nowIso = new Date().toISOString()
    const insertPayload = Array.from({ length: quantity }, (_unused, index) => ({
      brand,
      material,
      total_weight_grams: roundToTwo(totalWeightGrams),
      remaining_weight_grams: roundToTwo(remainingWeightGrams),
      reserved_weight_grams: 0,
      active_printer_id: index === 0 ? activePrinterId : null,
      color_name: colorName,
      notes,
      updated_at: nowIso,
    }))

    const { data, error } = await supabase
      .from('filament_spools')
      .insert(insertPayload)
      .select(
        'id, brand, material, total_weight_grams, remaining_weight_grams, reserved_weight_grams, active_printer_id, color_name, notes, created_at, updated_at',
      )

    if (error || !data || data.length === 0) {
      throw error ?? new Error('Failed to create filament spool.')
    }

    if (activePrinterId) {
      await recordFilamentEvent({
        spoolId: String(data[0].id),
        eventType: 'assign',
        grams: 0,
        printerId: activePrinterId,
        note: 'Active spool assigned during creation.',
      })
    }

    const firstCreatedSpool = await fetchFilamentSpoolById(String(data[0].id))
    return res.status(201).json({
      spool: firstCreatedSpool ? { ...firstCreatedSpool, usableWeightGrams: getUsableWeightGrams(firstCreatedSpool) } : null,
      spools: (await fetchFilamentSpools()).map((item) => ({
        ...item,
        usableWeightGrams: getUsableWeightGrams(item),
      })),
    })
  } catch (error) {
    return res.status(500).json({
      error: getFilamentErrorMessage(error, 'Failed to create filament spool.'),
    })
  }
})

router.patch('/spools/:spoolId', async (req, res) => {
  const spoolId = req.params.spoolId?.trim()
  if (!spoolId) {
    return res.status(400).json({ error: 'Spool id is required.' })
  }

  const existingSpool = await fetchFilamentSpoolById(spoolId)
  if (!existingSpool) {
    return res.status(404).json({ error: 'Filament spool not found.' })
  }

  const body = (req.body ?? {}) as UpdateSpoolBody
  const nextBrand = body.brand === undefined ? existingSpool.brand : body.brand.trim()
  const nextMaterial = body.material === undefined ? existingSpool.material : body.material.trim()
  const nextTotalWeightGrams = body.totalWeightGrams === undefined
    ? existingSpool.totalWeightGrams
    : toPositiveNumber(body.totalWeightGrams)
  const requestedRemaining = body.remainingWeightGrams === undefined
    ? existingSpool.remainingWeightGrams
    : toNullableNonNegativeNumber(body.remainingWeightGrams)
  const nextRemainingWeightGrams = requestedRemaining ?? existingSpool.remainingWeightGrams
  const nextActivePrinterId = body.activePrinterId === undefined
    ? existingSpool.activePrinterId
    : normalizeOptionalString(body.activePrinterId)
  const nextColorName = body.colorName === undefined ? existingSpool.colorName : normalizeOptionalString(body.colorName)
  const nextNotes = body.notes === undefined ? existingSpool.notes : normalizeOptionalString(body.notes)

  if (!nextBrand) {
    return res.status(400).json({ error: 'Brand is required.' })
  }

  if (!nextMaterial) {
    return res.status(400).json({ error: 'Material is required.' })
  }

  if (nextTotalWeightGrams === null) {
    return res.status(400).json({ error: 'Total amount must be greater than zero.' })
  }

  if (nextRemainingWeightGrams === null) {
    return res.status(400).json({ error: 'Amount left must be zero or greater.' })
  }

  if (nextRemainingWeightGrams > nextTotalWeightGrams) {
    return res.status(400).json({ error: 'Amount left cannot be greater than the total amount.' })
  }

  try {
    if (nextActivePrinterId && nextActivePrinterId !== existingSpool.activePrinterId) {
      await clearActivePrinterAssignment(nextActivePrinterId, spoolId)
    }

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('filament_spools')
      .update({
        brand: nextBrand,
        material: nextMaterial,
        total_weight_grams: roundToTwo(nextTotalWeightGrams),
        remaining_weight_grams: roundToTwo(nextRemainingWeightGrams),
        active_printer_id: nextActivePrinterId,
        color_name: nextColorName,
        notes: nextNotes,
        updated_at: nowIso,
      })
      .eq('id', spoolId)

    if (error) {
      throw error
    }

    if (existingSpool.activePrinterId && existingSpool.activePrinterId !== nextActivePrinterId) {
      await recordFilamentEvent({
        spoolId,
        eventType: 'unassign',
        grams: 0,
        printerId: existingSpool.activePrinterId,
        note: 'Active spool removed from printer.',
      })
    }

    if (nextActivePrinterId && existingSpool.activePrinterId !== nextActivePrinterId) {
      await recordFilamentEvent({
        spoolId,
        eventType: 'assign',
        grams: 0,
        printerId: nextActivePrinterId,
        note: 'Active spool assigned to printer.',
      })
    }

    if (existingSpool.remainingWeightGrams !== nextRemainingWeightGrams) {
      await recordFilamentEvent({
        spoolId,
        eventType: 'adjust',
        grams: roundToTwo(Math.abs(nextRemainingWeightGrams - existingSpool.remainingWeightGrams)),
        printerId: nextActivePrinterId,
        note: 'Remaining filament was adjusted by an admin.',
      })
    }

    const updatedSpool = await fetchFilamentSpoolById(spoolId)
    return res.json({
      spool: updatedSpool ? { ...updatedSpool, usableWeightGrams: getUsableWeightGrams(updatedSpool) } : null,
      spools: (await fetchFilamentSpools()).map((item) => ({
        ...item,
        usableWeightGrams: getUsableWeightGrams(item),
      })),
    })
  } catch (error) {
    return res.status(500).json({
      error: getFilamentErrorMessage(error, 'Failed to update filament spool.'),
    })
  }
})

async function clearActivePrinterAssignment(activePrinterId: string, spoolIdToKeep?: string) {
  const query = supabase
    .from('filament_spools')
    .update({
      active_printer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('active_printer_id', activePrinterId)

  const { error } =
    spoolIdToKeep
      ? await query.neq('id', spoolIdToKeep)
      : await query

  if (error) {
    throw error
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toPositiveNumber(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function toPositiveInteger(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed)
    }
  }

  return null
}

function toNullableNonNegativeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function getFilamentErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && /filament_/i.test(error.message)) {
    return `${fallback} Run the filament SQL first.`
  }

  return error instanceof Error ? error.message : fallback
}

export default router
