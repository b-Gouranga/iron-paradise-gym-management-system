import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
app.use(cors({ origin: env.frontendUrl }))
app.use(express.json())
app.use('/api', apiRouter)
app.use(errorHandler)
app.listen(env.port, () => console.log(`Iron Paradise API running on port ${env.port}`))
