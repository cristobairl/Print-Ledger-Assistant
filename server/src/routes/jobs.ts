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

export default router
