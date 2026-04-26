import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import eventRoutes from './routes/events'
import filamentRoutes from './routes/filament'
import jobRoutes from './routes/jobs'
import printerRoutes from './routes/printers'
import settingsRoutes from './routes/settings'
import { PrinterRadar } from './radar'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
export const radar = new PrinterRadar()

app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/events', eventRoutes)
app.use('/filament', filamentRoutes)
app.use('/jobs', jobRoutes)
app.use('/printers', printerRoutes)
app.use('/settings', settingsRoutes)

app.get('/status', (req, res) => {
  res.json({ status: 'PLA server running' })
})

app.listen(PORT, async () => {
  console.log(`PLA server running on port ${PORT}`)
  await radar.start()
})
