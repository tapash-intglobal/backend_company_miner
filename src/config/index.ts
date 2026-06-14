import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'company_miner_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    poolMin: Number.parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  rateLimit: {
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: Number.parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS ||
        (process.env.NODE_ENV === 'production' ? '5000' : '20000'),
      10
    ),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'openai').toLowerCase(),
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
  },
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
    apiBase: (process.env.ZOHO_API_BASE || 'https://www.zohoapis.com').replace(/\/$/, ''),
    accountsUrl: (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/$/, ''),
    integrationApiKey: process.env.ZOHO_INTEGRATION_API_KEY || '',
    workerEnabled: process.env.ZOHO_WORKER_ENABLED !== 'false',
    workerPollIntervalMs: Number.parseInt(process.env.ZOHO_WORKER_POLL_INTERVAL_MS || '5000', 10),
    jobIdempotencyWindowMs: Number.parseInt(
      process.env.ZOHO_JOB_IDEMPOTENCY_WINDOW_MS || '1800000',
      10
    ),
    workerConcurrency: Number.parseInt(process.env.ZOHO_WORKER_CONCURRENCY || '1', 10),
    jobStaleProcessingMs: Number.parseInt(process.env.ZOHO_JOB_STALE_PROCESSING_MS || '900000', 10),
    jobMaxAttempts: Number.parseInt(process.env.ZOHO_JOB_MAX_ATTEMPTS || '3', 10),
    jobRetryDelayMs: (process.env.ZOHO_JOB_RETRY_DELAYS_MS || '5000,15000,45000')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0),
  },
};

export default config;
