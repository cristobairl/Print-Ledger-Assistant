import { Router } from 'express'
import { radar } from '../server'

const router = Router()

router.get('/status', (req, res) => {
  res.json(radar.getStatus())
})

export default router
