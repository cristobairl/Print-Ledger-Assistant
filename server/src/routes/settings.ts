import { Router } from 'express'
import { getPrintPolicySettings, updatePrintPolicySettings } from '../print-policy'

const router = Router()

router.get('/printing', (req, res) => {
  return res.json(getPrintPolicySettings())
})

router.patch('/printing', (req, res) => {
  const maxPrintHours = toFiniteNumber((req.body ?? {}).maxPrintHours)

  if (maxPrintHours === null) {
    return res.status(400).json({ error: 'maxPrintHours must be a valid number.' })
  }

  return res.json(updatePrintPolicySettings({ maxPrintHours }))
})

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export default router
