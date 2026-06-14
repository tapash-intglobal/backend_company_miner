import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import adminRoutes from './admin/admin.routes';
import healthRoutes from './health.routes';
import integrationsRoutes from './integrations/integrations.routes';

const router = Router();

// Public health check for API + DB
router.use('/health', healthRoutes);

// Auth and admin feature routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/integrations', integrationsRoutes);

export default router;
