import type { NextFunction, Request, Response } from 'express'

/**
 * Security headers middleware.
 *
 * Sets essential defensive HTTP response headers:
 * - X-Content-Type-Options: nosniff (prevent MIME-sniffing)
 * - X-Frame-Options: DENY (clickjacking protection)
 * - X-XSS-Protection: 0 (disable deprecated buggy browser XSS auditor)
 * - Referrer-Policy: strict-origin-when-cross-origin (prevent leaking referrer info)
 * - Content-Security-Policy: frame-ancestors 'none'; default-src 'self' (API-safe policy)
 * - Strict-Transport-Security: ONLY in production over HTTPS to prevent local HTTP dev issues
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Clickjacking defense
  res.setHeader('X-Frame-Options', 'DENY')

  // Disable legacy buggy XSS filters that can introduce vulnerabilities
  res.setHeader('X-XSS-Protection', '0')

  // Control referrer information sent in requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // API-safe Content Security Policy that forbids framing and restricts origins
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; default-src 'self'")

  // Strict-Transport-Security: Strictly ONLY in production when connection is HTTPS
  // Never enable on local HTTP development to prevent breaking developer workflows
  const isProduction = process.env.NODE_ENV === 'production'
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https'

  if (isProduction && isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}
