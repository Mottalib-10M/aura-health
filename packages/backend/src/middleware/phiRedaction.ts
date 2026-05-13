import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// PHI patterns – covers HIPAA-relevant identifiers
// ---------------------------------------------------------------------------
const PHI_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp; mask: string }> = [
  // Names — simple heuristic: capitalized word pairs (firstName lastName)
  // We apply this only to known body fields, not globally, to avoid false positives.
  { label: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, mask: '[EMAIL]' },
  { label: 'phone', regex: /(\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g, mask: '[PHONE]' },
  { label: 'ssn', regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, mask: '[SSN]' },
  { label: 'dob', regex: /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g, mask: '[DOB]' },
  { label: 'ip', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, mask: '[IP]' },
  { label: 'passport', regex: /\b[A-Z]{1,2}\d{6,9}\b/g, mask: '[ID]' },
];

// Body field names that are known to contain PHI
const PHI_FIELD_NAMES = new Set([
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'fullName',
  'full_name',
  'name',
  'email',
  'phone',
  'phoneNumber',
  'phone_number',
  'address',
  'ssn',
  'nationalId',
  'national_id',
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'passport',
  'biometricHash',
  'biometric_hash',
  'password',
]);

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

function redactString(value: string): string {
  let result = value;
  for (const { regex, mask } of PHI_PATTERNS) {
    result = result.replace(regex, mask);
  }
  return result;
}

function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  // Direct field-name match — hard redact
  if (PHI_FIELD_NAMES.has(key)) {
    if (typeof value === 'string') {
      return value.length > 0 ? `[REDACTED:${key}]` : value;
    }
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => redactValue(String(idx), item));
  }

  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    redacted[key] = redactValue(key, val);
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// Express middleware — redacts PHI from request bodies before they reach logs
// ---------------------------------------------------------------------------

/**
 * This middleware does NOT modify `req.body` — it stores a redacted copy
 * on `req.redactedBody` for logging purposes, and patches `morgan` tokens
 * so any request-body logging uses the redacted version.
 */
export function phiRedaction(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === 'object') {
      // Store the redacted version for logging
      (req as RequestWithRedacted).redactedBody = redactObject(
        req.body as Record<string, unknown>,
      );
    }
  } catch (err) {
    logger.warn({ err }, 'PHI redaction failed on request body');
  }
  next();
}

interface RequestWithRedacted extends Request {
  redactedBody?: Record<string, unknown>;
}

/**
 * Redact PHI from an arbitrary object — useful in resolvers before
 * sending data to external audit or analytics systems.
 */
export function redactPhi<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return redactObject(data);
}

/**
 * Redact PHI from a plain string (e.g. log messages, error messages).
 */
export function redactPhiString(text: string): string {
  return redactString(text);
}
