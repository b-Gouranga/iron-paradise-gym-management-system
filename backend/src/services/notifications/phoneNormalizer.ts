export interface NormalizedPhoneResult {
  valid: boolean
  formatted: string // E.164 format, e.g. "+919807060501" or "+14155552671"
  digitsOnly: string // E.164 digits without "+" for Meta Graph API "to" parameter, e.g. "919807060501"
  error?: string
}

/**
 * Non-destructive phone normalization utility for WhatsApp dispatch.
 *
 * Rules:
 * 1. Does NOT modify or rewrite the stored database record.
 * 2. If the number starts with "+":
 *    - Validates that remaining digits are between 10 and 15 digits (ITU-T E.164).
 *    - Preserves valid international country codes (+1, +44, +971, etc.).
 * 3. If the number does NOT start with "+":
 *    - Strips whitespace, dashes, and parens.
 *    - If exactly 10 digits: defaults to Indian country code '91' (+91XXXXXXXXXX).
 *    - If 11 digits and starts with '0' (standard Indian trunk prefix): replaces '0' with '91'.
 *    - If 12 digits and starts with '91': treats as Indian number (+91XXXXXXXXXX).
 * 4. Rejects malformed numbers (<10 digits, or non-international numbers >12 digits)
 *    without blind guesswork or corrupted transformations.
 */
export function normalizeWhatsAppPhone(rawPhone: string | null | undefined): NormalizedPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      valid: false,
      formatted: '',
      digitsOnly: '',
      error: 'Phone number is missing or empty.',
    }
  }

  const trimmed = rawPhone.trim()
  if (!trimmed) {
    return {
      valid: false,
      formatted: '',
      digitsOnly: '',
      error: 'Phone number is empty.',
    }
  }

  // Case A: International format with leading '+'
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    // E.164 specifies between 10 and 15 digits
    if (digits.length < 10 || digits.length > 15) {
      return {
        valid: false,
        formatted: trimmed,
        digitsOnly: '',
        error: `Invalid international phone number "${trimmed}". Must contain between 10 and 15 digits.`,
      }
    }
    return {
      valid: true,
      formatted: `+${digits}`,
      digitsOnly: digits,
    }
  }

  // Case B: No leading '+'. Extract digits
  const digits = trimmed.replace(/\D/g, '')

  // 10-digit Indian national number (mobile numbers start with 6, 7, 8, or 9)
  if (digits.length === 10) {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        valid: false,
        formatted: trimmed,
        digitsOnly: '',
        error: `Invalid Indian phone number "${trimmed}". 10-digit mobile numbers must begin with 6, 7, 8, or 9.`,
      }
    }
    return {
      valid: true,
      formatted: `+91${digits}`,
      digitsOnly: `91${digits}`,
    }
  }

  // 11-digit Indian number starting with 0 trunk code
  if (digits.length === 11 && digits.startsWith('0')) {
    const nationalNumber = digits.slice(1)
    if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
      return {
        valid: false,
        formatted: trimmed,
        digitsOnly: '',
        error: `Invalid Indian phone number "${trimmed}". Mobile number must begin with 6, 7, 8, or 9.`,
      }
    }
    return {
      valid: true,
      formatted: `+91${nationalNumber}`,
      digitsOnly: `91${nationalNumber}`,
    }
  }

  // 12-digit Indian number starting with 91 but missing '+'
  if (digits.length === 12 && digits.startsWith('91')) {
    const nationalNumber = digits.slice(2)
    if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
      return {
        valid: false,
        formatted: trimmed,
        digitsOnly: '',
        error: `Invalid Indian phone number "${trimmed}". Mobile number must begin with 6, 7, 8, or 9.`,
      }
    }
    return {
      valid: true,
      formatted: `+${digits}`,
      digitsOnly: digits,
    }
  }

  // Any other length without explicit '+' is malformed or ambiguous. Do not blindly transform!
  return {
    valid: false,
    formatted: trimmed,
    digitsOnly: '',
    error: `Malformed phone number "${trimmed}". Must be a 10-digit Indian mobile number or an international number starting with "+".`,
  }
}
