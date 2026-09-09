import type { NextFunction, Request, Response } from 'express'

export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction) {
  if (error?.status === 413 || error?.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      message: 'Request payload exceeds the maximum allowed limit of 100KB.',
    })
    return
  }

  console.error(error)
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' })
}
