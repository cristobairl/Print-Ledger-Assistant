import { Router, Request, Response } from 'express'
import { supabase } from '../db'

const router = Router()

function parseCardSwipe(raw: string) {
  const track1 = raw.match(/%B(\d+)\^([^^]+)\^/)
  if (!track1) return null

  const card_id = track1[1]
  const [lastName, firstName] = track1[2].split('/')

  return {
    card_id,
    first_name: firstName?.trim(),
    last_name: lastName?.trim()
  }
}

// POST /auth/swipe
router.post('/swipe', async (req: Request, res: Response) => {
  const { raw } = req.body

  const parsed = parseCardSwipe(raw)
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid card data' })
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('card_id', parsed.card_id)
    .single()

  if (error || !student) {
    return res.status(401).json({ error: 'Student not found' })
  }

  return res.json({
    authorized: true,
    student_id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    is_admin: student.is_admin
  })
})

export default router