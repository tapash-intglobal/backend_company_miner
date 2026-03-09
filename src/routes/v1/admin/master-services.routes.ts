import { Router } from 'express';
import MasterServiceController, {
  listMasterServicesSchema,
  createMasterServiceSchema,
  updateMasterServiceSchema,
  getByIdSchema,
} from '../../../controllers/admin/MasterServiceController';
import { validate } from '../../../middleware/validation';

const router = Router();

router.get('/', validate(listMasterServicesSchema), MasterServiceController.list.bind(MasterServiceController));
router.get('/:id', validate(getByIdSchema), MasterServiceController.getById.bind(MasterServiceController));
router.post('/', validate(createMasterServiceSchema), MasterServiceController.create.bind(MasterServiceController));
router.put('/:id', validate(updateMasterServiceSchema), MasterServiceController.update.bind(MasterServiceController));
router.delete('/:id', validate(getByIdSchema), MasterServiceController.delete.bind(MasterServiceController));

export default router;
