import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import authService from '../../services/auth/AuthService';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['admin', 'user']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export class AuthController {
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body as Parameters<typeof authService.register>[0]);
      sendSuccess(res, 'User registered successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body as { email: string; password: string });
      sendSuccess(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new Error('User not authenticated'));
      }
      sendSuccess(res, 'Profile retrieved successfully', {
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
      });
    } catch (err) {
      next(err);
    }
  }
}

const authController = new AuthController();
export default authController;
