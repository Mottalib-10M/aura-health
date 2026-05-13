import type { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Redis client (lazy singleton)
// ---------------------------------------------------------------------------
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis rate-limiter client error');
    });

    // Connect lazily — don't block server boot
    redisClient.connect().catch((err) => {
      logger.warn({ err }, 'Redis rate-limiter failed to connect; falling back to permissive mode');
    });
  }
  return redisClient;
}

// ---------------------------------------------------------------------------
// Sliding window rate limiter (Redis MULTI/EXEC)
// ---------------------------------------------------------------------------
export interface RateLimitConfig {
  /** Unique namespace for this limiter (e.g. "graphql", "auth") */
  prefix: string;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Optional: custom key extractor (defaults to IP address) */
  keyExtractor?: (req: Request) => string;
  /** If true, skip rate limiting when Redis is unavailable */
  failOpen?: boolean;
}

/**
 * Create an Express middleware that enforces per-key rate limits using a
 * Redis sorted-set sliding window.
 *
 * Algorithm:
 * 1. ZREMRANGEBYSCORE to prune entries outside the current window
 * 2. ZCARD to count remaining entries
 * 3. If under limit, ZADD the current timestamp
 * 4. PEXPIRE to auto-clean the key
 *
 * Wrapped in a MULTI/EXEC for atomicity.
 */
export function createRateLimiter(options: RateLimitConfig) {
  const {
    prefix,
    windowMs,
    maxRequests,
    keyExtractor = defaultKeyExtractor,
    failOpen = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedis();

    // If Redis isn't connected and we fail-open, let the request through
    if (redis.status !== 'ready') {
      if (failOpen) {
        return next();
      }
      res.status(503).json({ error: 'Rate limiter unavailable' });
      return;
    }

    const rawKey = keyExtractor(req);
    const key = `rl:${prefix}:${rawKey}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const pipeline = redis.multi();
      // Remove expired entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      // Count current entries
      pipeline.zcard(key);
      // Add current request
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
      // Set key expiry so it auto-cleans
      pipeline.pexpire(key, windowMs);

      const results = await pipeline.exec();

      if (!results) {
        if (failOpen) return next();
        res.status(503).json({ error: 'Rate limiter error' });
        return;
      }

      // results[1] = [err, count] from ZCARD
      const countResult = results[1];
      const currentCount = (countResult?.[1] as number) ?? 0;

      // Set rate-limit headers (draft-ietf-httpapi-ratelimit-headers)
      const remaining = Math.max(0, maxRequests - currentCount - 1);
      const resetAt = Math.ceil((now + windowMs) / 1000);

      res.setHeader('RateLimit-Limit', maxRequests);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetAt);

      if (currentCount >= maxRequests) {
        const retryAfterSec = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        logger.warn({ key: rawKey, count: currentCount, limit: maxRequests }, 'Rate limit exceeded');
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: retryAfterSec,
        });
        return;
      }

      next();
    } catch (err) {
      logger.error({ err }, 'Rate limiter Redis error');
      if (failOpen) {
        next();
      } else {
        res.status(503).json({ error: 'Rate limiter unavailable' });
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Default key extractor — uses IP, preferring X-Forwarded-For behind proxy
// ---------------------------------------------------------------------------
function defaultKeyExtractor(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for common endpoints
// ---------------------------------------------------------------------------

/** GraphQL endpoint: generous limit */
export const graphqlRateLimiter = createRateLimiter({
  prefix: 'graphql',
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
});

/** Authentication endpoints: tighter limit to prevent brute-force */
export const authRateLimiter = createRateLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
});

/** AI triage: moderate limit to control inference costs */
export const triageRateLimiter = createRateLimiter({
  prefix: 'triage',
  windowMs: 60 * 1000,
  maxRequests: 10,
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
export async function closeRateLimiterRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
