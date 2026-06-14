import { Router } from 'express';
import zohoRoutes from './zoho.routes';

const router = Router();

router.use('/zoho', zohoRoutes);

export default router;
