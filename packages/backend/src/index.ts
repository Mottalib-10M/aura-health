import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config/index.js';
import { pool, closeDatabasePool } from './config/database.js';
import { logger, requestContext } from './utils/logger.js';
import { authenticate, type AuthenticatedUser } from './middleware/auth.js';
import { graphqlRateLimiter, closeRateLimiterRedis } from './middleware/rateLimiter.js';
import { phiRedaction } from './middleware/phiRedaction.js';
import { typeDefs } from './graphql/types/index.js';
import { queryResolvers } from './graphql/queries/index.js';
import { mutationResolvers } from './graphql/mutations/index.js';

// ---------------------------------------------------------------------------
// GraphQL context
// ---------------------------------------------------------------------------
export interface AuraContext {
  user?: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function bootstrap(): Promise<void> {
  // 1. Build executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: [queryResolvers, mutationResolvers] as never,
  });

  // 2. Create Apollo Server 4
  const apollo = new ApolloServer<AuraContext>({
    schema,
    introspection: config.server.isDev,
    formatError: (formattedError) => {
      // Strip internal details in production
      if (config.server.isProd) {
        logger.error({ err: formattedError }, 'GraphQL error');
        return {
          message: formattedError.message,
          locations: formattedError.locations,
          path: formattedError.path,
        };
      }
      return formattedError;
    },
    plugins: [
      {
        async requestDidStart() {
          const startTime = performance.now();
          return {
            async willSendResponse(requestContext) {
              const durationMs = Math.round(performance.now() - startTime);
              logger.debug(
                {
                  operationName: requestContext.operationName ?? 'anonymous',
                  durationMs,
                },
                'GraphQL request completed',
              );
            },
          };
        },
      },
    ],
  });

  await apollo.start();

  // 3. Create Express app
  const app = express();

  // ── Security headers ───────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: config.server.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.server.isDev
        ? '*'
        : [
            'https://app.aurahealth.uz',
            'https://admin.aurahealth.uz',
            /\.aurahealth\.uz$/,
          ],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ── Request parsing ────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));

  // ── PHI redaction (before logging) ─────────────────────────────────
  app.use(phiRedaction);

  // ── Structured request logging ─────────────────────────────────────
  app.use(
    morgan(
      (tokens, req, res) => {
        return JSON.stringify({
          method: tokens.method(req, res),
          url: tokens.url(req, res),
          status: tokens.status(req, res),
          contentLength: tokens.res(req, res, 'content-length'),
          responseTime: `${tokens['response-time'](req, res)}ms`,
        });
      },
      {
        stream: {
          write: (message: string) => {
            try {
              const data = JSON.parse(message.trim());
              logger.info(data, 'HTTP request');
            } catch {
              logger.info(message.trim());
            }
          },
        },
      },
    ),
  );

  // ── Trace ID propagation ───────────────────────────────────────────
  app.use((req, _res, next) => {
    const traceId =
      (req.headers['x-trace-id'] as string) ??
      (req.headers['x-request-id'] as string) ??
      uuidv4();

    requestContext.run({ traceId }, () => next());
  });

  // ── Authentication (populate req.user) ─────────────────────────────
  app.use(authenticate);

  // ── Health check ───────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    let postgresStatus = 'down';
    let redisStatus = 'down';

    // Check PostgreSQL
    try {
      const dbResult = await pool.query('SELECT 1');
      postgresStatus = dbResult.rows.length > 0 ? 'up' : 'down';
    } catch {
      postgresStatus = 'down';
    }

    // Check Redis
    try {
      const Redis = (await import('ioredis')).default;
      const redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await redisClient.connect();
      const pong = await redisClient.ping();
      redisStatus = pong === 'PONG' ? 'up' : 'down';
      await redisClient.quit();
    } catch {
      redisStatus = 'down';
    }

    const overallStatus = postgresStatus === 'up' && redisStatus === 'up' ? 'healthy' : 'unhealthy';
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: process.uptime(),
      dependencies: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
    });
  });

  // ── GraphQL endpoint ───────────────────────────────────────────────
  app.use(
    '/graphql',
    graphqlRateLimiter,
    expressMiddleware(apollo, {
      context: async ({ req }): Promise<AuraContext> => {
        return {
          user: req.user,
        };
      },
    }),
  );

  // ── 404 handler ────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Global error handler ───────────────────────────────────────────
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err }, 'Unhandled Express error');
      res.status(500).json({
        error: config.server.isProd ? 'Internal server error' : err.message,
      });
    },
  );

  // 4. Start listening
  const server = app.listen(config.server.port, () => {
    logger.info(
      {
        port: config.server.port,
        env: config.server.nodeEnv,
        graphql: `http://localhost:${config.server.port}/graphql`,
        health: `http://localhost:${config.server.port}/health`,
      },
      'Aura Health backend started',
    );
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');
      await apollo.stop();
      logger.info('Apollo Server stopped');
      await closeDatabasePool();
      await closeRateLimiterRedis();
      logger.info('All connections closed — exiting');
      process.exit(0);
    });

    // Force exit after 15 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 15_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled rejection / exception safety nets
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start Aura Health backend');
  process.exit(1);
});
