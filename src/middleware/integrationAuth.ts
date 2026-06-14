import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { UnauthorizedError } from '../utils/errors';
import { sendError } from '../utils/response';

export function integrationAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = config.zoho.integrationApiKey.trim();
  if (!apiKey) {
    sendError(res, 'Integration API key is not configured', 503);
    return;
  }

  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  let providedKey: string | undefined;
  if (typeof headerKey === 'string' && headerKey.trim()) {
    providedKey = headerKey.trim();
  } else if (authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7).trim();
  }

  if (!providedKey || providedKey !== apiKey) {
    if (providedKey) {
      sendError(res, new UnauthorizedError('Invalid integration API key').message, 401);
      return;
    }
    sendError(res, new UnauthorizedError('Integration API key is required').message, 401);
    return;
  }

  next();
}
