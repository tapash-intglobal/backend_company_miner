import { Router } from 'express';
import companyMinerController, {
  mineCompanySchema,
  generateServiceEmailSchema,
} from '../../../controllers/admin/CompanyMinerController';
import { validate } from '../../../middleware/validation';

const router = Router();

router.post(
  '/',
  validate(mineCompanySchema),
  companyMinerController.mineCompany.bind(companyMinerController)
);

router.post(
  '/generate-service-email',
  validate(generateServiceEmailSchema),
  companyMinerController.generateServiceEmail.bind(companyMinerController)
);

export default router;
