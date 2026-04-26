import { Router } from 'express'
import { radar } from '../server'

const router = Router()

router.get('/status', (req, res) => {
  res.json(radar.getStatus())
})

router.post('/:printerId/authorize', (req, res) => {
  const updated = radar.authorize(req.params.printerId, req.body ?? {})
  if (!updated) {
    return res.status(404).json({ error: 'Printer not found' })
  }

  return res.json({ ok: true, printers: radar.getStatus() })
})

router.post('/:printerId/deauthorize', async (req, res) => {
  const updated = await radar.deauthorize(req.params.printerId)
  if (!updated) {
    return res.status(404).json({ error: 'Printer not found' })
  }

  return res.json({ ok: true, printers: radar.getStatus() })
})

export default router
