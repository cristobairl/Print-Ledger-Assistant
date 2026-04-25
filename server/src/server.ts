import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import jobRoutes from './routes/jobs'
import printerRoutes from './routes/printers'
import { PrinterRadar } from './radar'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/auth', authRoutes)
app.use('/jobs', jobRoutes)
app.use('/printers', printerRoutes)

// Health check
app.get('/status', (req, res) => {
  res.json({ status: 'PLA server running' })
})

// Start watchdog
const radar = new PrinterRadar()
radar.start()

// Start server
app.listen(PORT, () => {
  console.log(`PLA server running on port ${PORT}`)
})