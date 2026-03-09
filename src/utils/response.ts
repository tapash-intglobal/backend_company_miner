import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
  meta?: ApiResponse<T>['meta']
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: unknown
): Response {
  const payload: ApiResponse = {
    success: false,
    message,
    ...(errors !== undefined && errors !== null ? { errors } : {}),
  };
  return res.status(statusCode).json(payload);
}
