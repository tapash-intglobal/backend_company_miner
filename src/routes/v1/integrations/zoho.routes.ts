import { Router } from 'express';
import { integrationAuth } from '../../../middleware/integrationAuth';
import { validate } from '../../../middleware/validation';
import zohoIntegrationController, {
  zohoJobIdParamSchema,
  zohoProcessLeadSchema,
} from '../../../controllers/integrations/ZohoIntegrationController';

const router = Router();

router.use(integrationAuth);

router.post(
  '/leads/process',
  validate(zohoProcessLeadSchema),
  zohoIntegrationController.processLead.bind(zohoIntegrationController)
);

router.get(
  '/jobs/:jobId',
  validate(zohoJobIdParamSchema),
  zohoIntegrationController.getJobStatus.bind(zohoIntegrationController)
);

export default router;
