import { Router, Request, Response } from 'express'
import { supabase } from '../db'

const router = Router()

function parseCardSwipe(raw: string) {
  const track1 = raw.match(/%B(\d+)\^([^^]+)\^/)
  if (!track1) return null

  const card_id = track1[1]
  const [lastName, firstName] = track1[2].split('/')
  const firstGivenName = firstName?.trim().split(/\s+/)[0]

  return {
    card_id,
    first_name: firstGivenName,
    last_name: lastName?.trim()
  }
}

// POST /auth/swipe
router.post('/swipe', async (req: Request, res: Response) => {
  const { raw, adminMode } = req.body

  const parsed = parseCardSwipe(raw)
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid card data' })
  }

  const { data: existingStudent, error: lookupError } = await supabase
    .from('students')
    .select('*')
    .eq('card_id', parsed.card_id)
    .maybeSingle()

  if (lookupError) {
    return res.status(500).json({ error: 'Failed to look up student' })
  }

  let student = existingStudent
  let created = false

  if (!student) {
    const { data: insertedStudent, error: insertError } = await supabase
      .from('students')
      .insert({
        card_id: parsed.card_id,
        first_name: parsed.first_name ?? 'Unknown',
        last_name: parsed.last_name ?? 'Student',
        is_admin: false,
      })
      .select('*')
      .single()

    if (insertError || !insertedStudent) {
      return res.status(500).json({ error: 'Failed to register student on first swipe' })
    }

    student = insertedStudent
    created = true
  }

  const needsNameRefresh =
    student &&
    ((parsed.first_name && student.first_name !== parsed.first_name) ||
      (parsed.last_name && student.last_name !== parsed.last_name))

  if (student && needsNameRefresh) {
    const { data: refreshedStudent, error: refreshError } = await supabase
      .from('students')
      .update({
        first_name: parsed.first_name ?? student.first_name,
        last_name: parsed.last_name ?? student.last_name,
      })
      .eq('id', student.id)
      .select('*')
      .single()

    if (refreshError || !refreshedStudent) {
      return res.status(500).json({ error: 'Failed to refresh student name from swipe' })
    }

    student = refreshedStudent
  }

  return res.json({
    authorized: true,
    student_id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    is_admin: Boolean(student.is_admin) || Boolean(adminMode),
    created,
  })
})

export default router
