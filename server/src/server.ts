import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import jobRoutes from './routes/jobs'
import printerRoutes from './routes/printers'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/jobs', jobRoutes)
app.use('/printers', printerRoutes)

app.get('/status', (req, res) => {
  res.json({ status: 'PLA server running' })
})

app.listen(PORT, () => {
  console.log(`PLA server running on port ${PORT}`)
})