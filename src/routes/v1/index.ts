import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import adminRoutes from './admin/admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);

export default router;
