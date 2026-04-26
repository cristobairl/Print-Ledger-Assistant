import { Router } from 'express'
import { supabase } from '../db'
import { getPrintPolicySettings } from '../print-policy'
import { radar } from '../server'

const router = Router()

type JobRow = {
  id: string | number
  student_id: string | number | null
  printer_id: string | number | null
  file_name: string | null
  file_size: number | string | null
  estimated_time: number | string | null
  estimated_weight_grams: number | string | null
  job_reason: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string | null
  status: string | null
}

type CreateJobBody = {
  studentId?: string
  printerId?: string
  fileName?: string
  estimatedTimeMinutes?: number | string
  estimatedWeightGrams?: number | string
  jobReason?: string
  cardId?: string
  firstName?: string
  durationMinutes?: number | string
}

router.get('/student/:studentId', async (req, res) => {
  const studentId = req.params.studentId?.trim()
  if (!studentId) {
    return res.status(400).json({ error: 'Student id is required.' })
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, student_id, printer_id, file_name, file_size, estimated_time, estimated_weight_grams, job_reason, started_at, ended_at, created_at, status',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: 'Failed to load student jobs.' })
  }

  return res.json((data ?? []).map((row) => mapJobRow(row as JobRow)))
})

router.post('/', async (req, res) => {
  const body = (req.body ?? {}) as CreateJobBody
  const validation = validateCreateJobBody(body)
  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  const input = validation.value as ValidatedCreateJobInput
  const weeklyUsage = await getStudentWeeklyUsageGrams(input.studentId)
  if (!weeklyUsage.ok) {
    return res.status(500).json({ error: 'Failed to verify weekly filament usage.' })
  }

  const { maxWeeklyGrams } = getPrintPolicySettings()
  const projectedWeeklyUsage = weeklyUsage.gramsUsed + input.estimatedWeightGrams
  if (projectedWeeklyUsage > maxWeeklyGrams) {
    return res.status(400).json({
      error: `This job would exceed the weekly filament limit of ${maxWeeklyGrams} g. ${Math.round(weeklyUsage.gramsUsed)} g used so far this week.`,
    })
  }

  const createdJob = await createJobRecord(input)
  if (!createdJob.ok) {
    return res.status(500).json({ error: 'Failed to create the job record.' })
  }

  return res.status(201).json(createdJob.job)
})

router.post('/session', async (req, res) => {
  const body = (req.body ?? {}) as CreateJobBody
  const validation = validateCreateJobBody(body)
  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  const durationMinutes = toPositiveInteger(body.durationMinutes)
  const input = validation.value as ValidatedCreateJobInput
  const weeklyUsage = await getStudentWeeklyUsageGrams(input.studentId)
  if (!weeklyUsage.ok) {
    return res.status(500).json({ error: 'Failed to verify weekly filament usage.' })
  }

  const { maxWeeklyGrams } = getPrintPolicySettings()
  const projectedWeeklyUsage = weeklyUsage.gramsUsed + input.estimatedWeightGrams
  if (projectedWeeklyUsage > maxWeeklyGrams) {
    return res.status(400).json({
      error: `This job would exceed the weekly filament limit of ${maxWeeklyGrams} g. ${Math.round(weeklyUsage.gramsUsed)} g used so far this week.`,
    })
  }

  const createdJob = await createJobRecord(input)
  if (!createdJob.ok) {
    return res.status(500).json({ error: 'Failed to create the job record.' })
  }

  const authorized = radar.authorize(input.printerId, {
    studentId: input.studentId,
    cardId: body.cardId?.trim() || null,
    firstName: body.firstName?.trim() || null,
    jobId: createdJob.job.id,
    durationMinutes,
  })

  if (!authorized) {
    const rollback = await deleteJobRecord(createdJob.job.id)
    if (!rollback.ok) {
      console.error(`[Jobs] Failed to roll back job ${createdJob.job.id} after printer authorize failure.`)
    }

    return res.status(404).json({ error: 'Printer not found.' })
  }

  return res.status(201).json({
    job: createdJob.job,
    printers: radar.getStatus(),
  })
})

type ValidatedCreateJobInput = {
  studentId: string
  printerId: string
  fileName: string
  estimatedTimeMinutes: number
  estimatedWeightGrams: number
  jobReason: string
}

type CreateJobValidationResult =
  | { error: string; value?: never }
  | { error: null; value: ValidatedCreateJobInput }

function validateCreateJobBody(body: CreateJobBody): CreateJobValidationResult {
  const studentId = body.studentId?.trim()
  const printerId = body.printerId?.trim()
  const fileName = body.fileName?.trim()
  const jobReason = body.jobReason?.trim()
  const estimatedTimeMinutes = toPositiveInteger(body.estimatedTimeMinutes)
  const estimatedWeightGrams = toPositiveNumber(body.estimatedWeightGrams)
  const { maxPrintHours } = getPrintPolicySettings()

  if (!studentId) {
    return { error: 'Student id is required.' }
  }

  if (!printerId) {
    return { error: 'Printer id is required.' }
  }

  if (!fileName) {
    return { error: 'File name is required.' }
  }

  if (estimatedTimeMinutes === null) {
    return { error: 'Estimated time must be greater than zero.' }
  }

  if (estimatedTimeMinutes > maxPrintHours * 60) {
    return { error: `Estimated time cannot exceed ${maxPrintHours} hours.` }
  }

  if (estimatedWeightGrams === null) {
    return { error: 'Estimated weight must be a number greater than zero.' }
  }

  if (!jobReason) {
    return { error: 'Job reason is required.' }
  }

  return {
    error: null,
    value: {
      studentId,
      printerId,
      fileName,
      estimatedTimeMinutes,
      estimatedWeightGrams,
      jobReason,
    },
  }
}

type StudentWeeklyUsageResult =
  | { ok: true; gramsUsed: number }
  | { ok: false }

async function getStudentWeeklyUsageGrams(studentId: string): Promise<StudentWeeklyUsageResult> {
  const { data, error } = await supabase
    .from('jobs')
    .select('estimated_weight_grams, status, created_at')
    .eq('student_id', studentId)
    .gte('created_at', getCurrentWeekStartIso())

  if (error) {
    console.error(`[Jobs] Failed to load weekly usage for student ${studentId}.`, error)
    return { ok: false }
  }

  const gramsUsed = (data ?? []).reduce((total, row) => {
    const typedRow = row as Pick<JobRow, 'estimated_weight_grams' | 'status'>

    if (typedRow.status === 'expired') {
      return total
    }

    const weight = toPositiveNumber(typedRow.estimated_weight_grams)
    return total + (weight ?? 0)
  }, 0)

  return { ok: true, gramsUsed }
}

function getCurrentWeekStartIso(now = new Date()) {
  const localStart = new Date(now)
  localStart.setHours(0, 0, 0, 0)
  localStart.setDate(localStart.getDate() - localStart.getDay())

  return localStart.toISOString()
}

async function createJobRecord(input: ValidatedCreateJobInput) {
  const insertPayload = {
    student_id: input.studentId,
    printer_id: input.printerId,
    file_name: input.fileName,
    file_size: null,
    estimated_time: input.estimatedTimeMinutes,
    estimated_weight_grams: Number(input.estimatedWeightGrams.toFixed(2)),
    job_reason: input.jobReason,
    status: 'queued',
    started_at: null,
    ended_at: null,
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(insertPayload)
    .select(
      'id, student_id, printer_id, file_name, file_size, estimated_time, estimated_weight_grams, job_reason, started_at, ended_at, created_at, status',
    )
    .single()

  if (error || !data) {
    console.error('[Jobs] Failed to create job record.', error)
    return { ok: false as const }
  }

  return {
    ok: true as const,
    job: mapJobRow(data as JobRow),
  }
}

async function deleteJobRecord(jobId: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId)

  if (error) {
    console.error(`[Jobs] Failed to delete job ${jobId}.`, error)
    return { ok: false as const }
  }

  return { ok: true as const }
}

function mapJobRow(row: JobRow) {
  return {
    id: String(row.id),
    studentId: row.student_id === null ? null : String(row.student_id),
    printerId: row.printer_id === null ? null : String(row.printer_id),
    fileName: row.file_name,
    fileSize: row.file_size,
    estimatedTime: row.estimated_time,
    estimatedWeightGrams: row.estimated_weight_grams,
    jobReason: row.job_reason,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    status: row.status,
  }
}

function toPositiveNumber(value: number | string | null | undefined) {
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

export default router
