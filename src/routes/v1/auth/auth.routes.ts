import { Router } from 'express';
import AuthController, {
  registerSchema,
  loginSchema,
} from '../../../controllers/auth/AuthController';
import { validate } from '../../../middleware/validation';
import { authenticate } from '../../../middleware/auth';
import { authRateLimiter } from '../../../middleware/rateLimiter';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  AuthController.register.bind(AuthController)
);
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  AuthController.login.bind(AuthController)
);
router.get('/profile', authenticate, AuthController.getProfile.bind(AuthController));

export default router;
