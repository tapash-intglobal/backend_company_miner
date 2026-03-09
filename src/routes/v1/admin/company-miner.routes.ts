import { Router } from 'express';
import companyMinerController, { mineCompanySchema } from '../../../controllers/admin/CompanyMinerController';
import { validate } from '../../../middleware/validation';

const router = Router();

router.post(
  '/',
  validate(mineCompanySchema),
  companyMinerController.mineCompany.bind(companyMinerController)
);

export default router;
