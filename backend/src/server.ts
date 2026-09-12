import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { securityHeaders } from './middleware/securityHeaders.js'

const app = express()
app.use(securityHeaders)
app.use(cors({ origin: env.frontendUrl }))
app.use(
  express.json({
    limit: '100kb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf
    },
  }),
)
app.use('/api', apiRouter)
app.use(errorHandler)
app.listen(env.port, () => console.log(`Iron Paradise API running on port ${env.port}`))
