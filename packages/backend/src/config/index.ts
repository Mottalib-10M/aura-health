import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ---------------------------------------------------------------------------
// Schema – validates every env var at boot so we fail fast on misconfiguration
// ---------------------------------------------------------------------------
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // PostgreSQL
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1).default('aura_health'),
  DB_USER: z.string().min(1).default('aura'),
  DB_PASSWORD: z.string().default(''),

  // Redis
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Kafka
  KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // AI / LiteLLM
  LITELLM_URL: z.string().url().default('http://localhost:4001'),
  LITELLM_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@aurahealth.uz'),

  // Hyperledger Fabric
  HLF_PEER_ENDPOINT: z.string().optional(),
  HLF_MSP_ID: z.string().default('Org1MSP'),
  HLF_CHANNEL: z.string().default('aurachannel'),
  HLF_CHAINCODE: z.string().default('audit'),
  HLF_CERT_PATH: z.string().optional(),
  HLF_KEY_PATH: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// ---------------------------------------------------------------------------
// Exported config object — strongly typed, frozen
// ---------------------------------------------------------------------------
export const config = Object.freeze({
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  kafka: {
    brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },

  ai: {
    litellmUrl: env.LITELLM_URL,
    litellmApiKey: env.LITELLM_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    googleApiKey: env.GOOGLE_API_KEY,
  },

  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  },

  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  },

  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  },

  blockchain: {
    peerEndpoint: env.HLF_PEER_ENDPOINT,
    mspId: env.HLF_MSP_ID,
    channel: env.HLF_CHANNEL,
    chaincode: env.HLF_CHAINCODE,
    certPath: env.HLF_CERT_PATH,
    keyPath: env.HLF_KEY_PATH,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
});

export type Config = typeof config;
