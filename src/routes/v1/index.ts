import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import adminRoutes from './admin/admin.routes';
import healthRoutes from './health.routes';

const router = Router();

// Public health check for API + DB
router.use('/health', healthRoutes);

// Auth and admin feature routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

export default router;
