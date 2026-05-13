import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../config/index.js';

// ---------------------------------------------------------------------------
// Trace-ID propagation via AsyncLocalStorage
// ---------------------------------------------------------------------------
interface RequestContext {
  traceId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------
const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const currentLevelValue = LOG_LEVELS[config.logging.level as LogLevel] ?? LOG_LEVELS.info;

// ---------------------------------------------------------------------------
// PHI redaction patterns
// ---------------------------------------------------------------------------
const PHI_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // Email addresses
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  // Phone numbers — international and local formats
  { regex: /(\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g, replacement: '[PHONE_REDACTED]' },
  // Social security / national ID style numbers (9-14 digits, optionally dashed)
  { regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  // Date of birth patterns  YYYY-MM-DD
  { regex: /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g, replacement: '[DOB_REDACTED]' },
  // IP addresses (v4)
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  // Passport-like alphanumeric IDs (e.g., AB1234567)
  { regex: /\b[A-Z]{1,2}\d{6,9}\b/g, replacement: '[ID_REDACTED]' },
];

function redactPhi(input: string): string {
  let result = input;
  for (const { regex, replacement } of PHI_PATTERNS) {
    result = result.replace(regex, replacement);
  }
  return result;
}

function redactObjectPhi(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactPhi(obj);
  if (typeof obj !== 'object') return obj;

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactPhi(obj.message),
      stack: obj.stack ? redactPhi(obj.stack) : undefined,
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObjectPhi);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Hard-redact known PHI field names regardless of content
    const lowerKey = key.toLowerCase();
    if (
      ['password', 'ssn', 'national_id', 'passport', 'biometric_hash', 'private_key'].includes(
        lowerKey,
      )
    ) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactObjectPhi(value);
    }
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// Structured JSON logger
// ---------------------------------------------------------------------------
function formatEntry(
  level: LogLevel,
  data: Record<string, unknown> | undefined,
  message: string,
): string {
  const ctx = requestContext.getStore();
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    ...(ctx?.traceId && { traceId: ctx.traceId }),
    ...(ctx?.userId && { userId: ctx.userId }),
    msg: redactPhi(message),
  };

  if (data) {
    const redacted = redactObjectPhi(data) as Record<string, unknown>;
    // Promote `err` to top-level error fields
    if (redacted.err && typeof redacted.err === 'object') {
      const errObj = redacted.err as Record<string, unknown>;
      entry.error = {
        name: errObj.name,
        message: errObj.message,
        stack: errObj.stack,
      };
      const { err: _removed, ...rest } = redacted;
      Object.assign(entry, rest);
    } else {
      Object.assign(entry, redacted);
    }
  }

  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevelValue;
}

function write(stream: 'stdout' | 'stderr', output: string): void {
  const target = stream === 'stderr' ? process.stderr : process.stdout;
  target.write(output + '\n');
}

export const logger = {
  trace(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('trace')) return;
    if (typeof data === 'string') {
      write('stdout', formatEntry('trace', undefined, data));
    } else {
      write('stdout', formatEntry('trace', data, message ?? ''));
    }
  },

  debug(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('debug')) return;
    if (typeof data === 'string') {
      write('stdout', formatEntry('debug', undefined, data));
    } else {
      write('stdout', formatEntry('debug', data, message ?? ''));
    }
  },

  info(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('info')) return;
    if (typeof data === 'string') {
      write('stdout', formatEntry('info', undefined, data));
    } else {
      write('stdout', formatEntry('info', data, message ?? ''));
    }
  },

  warn(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('warn')) return;
    if (typeof data === 'string') {
      write('stderr', formatEntry('warn', undefined, data));
    } else {
      write('stderr', formatEntry('warn', data, message ?? ''));
    }
  },

  error(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('error')) return;
    if (typeof data === 'string') {
      write('stderr', formatEntry('error', undefined, data));
    } else {
      write('stderr', formatEntry('error', data, message ?? ''));
    }
  },

  fatal(data: Record<string, unknown> | string, message?: string) {
    if (!shouldLog('fatal')) return;
    if (typeof data === 'string') {
      write('stderr', formatEntry('fatal', undefined, data));
    } else {
      write('stderr', formatEntry('fatal', data, message ?? ''));
    }
  },

  /** Create a child logger that always includes the given fields. */
  child(fields: Record<string, unknown>) {
    const self = this;
    const childLogger = Object.create(self);
    for (const level of Object.keys(LOG_LEVELS) as LogLevel[]) {
      childLogger[level] = (data: Record<string, unknown> | string, message?: string) => {
        if (typeof data === 'string') {
          self[level]({ ...fields }, data);
        } else {
          self[level]({ ...fields, ...data }, message);
        }
      };
    }
    return childLogger as typeof logger;
  },
};
