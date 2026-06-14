import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

const RETRYABLE_NETWORK_PATTERNS = [
  'fetch failed',
  'network',
  'timeout',
  'timed out',
  'econnreset',
  'etimedout',
  'econnrefused',
  'socket hang up',
  'rate limit',
  'temporarily unavailable',
];

export function isRetryableJobError(err: unknown): boolean {
  if (
    err instanceof ValidationError ||
    err instanceof NotFoundError ||
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof ConflictError
  ) {
    return false;
  }

  if (err instanceof AppError) {
    if (err.statusCode === 429) return true;
    if (err.statusCode >= 400 && err.statusCode < 500) return false;
    return err.statusCode >= 500;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return RETRYABLE_NETWORK_PATTERNS.some((pattern) => msg.includes(pattern));
  }

  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
