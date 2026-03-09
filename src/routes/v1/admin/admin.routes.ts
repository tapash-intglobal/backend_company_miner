import { Router } from 'express';
import { authenticate } from '../../../middleware/auth';
import { authorize } from '../../../middleware/rbac';
import companyMinerRoutes from './company-miner.routes';
import masterServicesRoutes from './master-services.routes';

const router = Router();

router.use(authenticate);

// Company Miner: any authenticated user (mounted before authorize so no admin role required)
router.use('/company-miner', companyMinerRoutes);

// Master Services: admin only
router.use(authorize('admin'));
router.use('/master-services', masterServicesRoutes);

export default router;
