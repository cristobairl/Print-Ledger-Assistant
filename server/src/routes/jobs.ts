import { Router } from 'express'
import { supabase } from '../db'

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
  estimatedWeightGrams?: number | string
  jobReason?: string
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
  const studentId = body.studentId?.trim()
  const printerId = body.printerId?.trim()
  const fileName = body.fileName?.trim()
  const jobReason = body.jobReason?.trim()
  const estimatedWeightGrams = toPositiveNumber(body.estimatedWeightGrams)

  if (!studentId) {
    return res.status(400).json({ error: 'Student id is required.' })
  }

  if (!printerId) {
    return res.status(400).json({ error: 'Printer id is required.' })
  }

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required.' })
  }

  if (estimatedWeightGrams === null) {
    return res.status(400).json({ error: 'Estimated weight must be a number greater than zero.' })
  }

  if (!jobReason) {
    return res.status(400).json({ error: 'Job reason is required.' })
  }

  const insertPayload = {
    student_id: studentId,
    printer_id: printerId,
    file_name: fileName,
    file_size: null,
    estimated_time: null,
    estimated_weight_grams: Number(estimatedWeightGrams.toFixed(2)),
    job_reason: jobReason,
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
    return res.status(500).json({ error: 'Failed to create the job record.' })
  }

  return res.status(201).json(mapJobRow(data as JobRow))
})

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

export default router
