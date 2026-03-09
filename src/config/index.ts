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
};

export default config;
