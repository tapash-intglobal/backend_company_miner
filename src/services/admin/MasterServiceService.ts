import MasterService from '../../models/MasterService';
import masterServiceRepository, {
  CreateMasterServiceData,
  UpdateMasterServiceData,
  ListMasterServicesParams,
} from '../../repositories/MasterServiceRepository';

export class MasterServiceService {
  async list(params?: ListMasterServicesParams): Promise<MasterService[]> {
    return masterServiceRepository.findAll(params);
  }

  async getById(id: number): Promise<MasterService | null> {
    return masterServiceRepository.findById(id);
  }

  async create(data: CreateMasterServiceData): Promise<MasterService> {
    return masterServiceRepository.create(data);
  }

  async update(id: number, data: UpdateMasterServiceData): Promise<MasterService | null> {
    return masterServiceRepository.update(id, data);
  }

  async delete(id: number): Promise<boolean> {
    return masterServiceRepository.delete(id);
  }
}

const masterServiceService = new MasterServiceService();
export default masterServiceService;
