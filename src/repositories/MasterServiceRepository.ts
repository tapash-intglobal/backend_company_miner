import MasterService from '../models/MasterService';

export interface CreateMasterServiceData {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateMasterServiceData {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListMasterServicesParams {
  isActive?: boolean;
}

export class MasterServiceRepository {
  async findAll(params?: ListMasterServicesParams): Promise<MasterService[]> {
    const where: Record<string, unknown> = {};
    if (params?.isActive !== undefined) where.isActive = params.isActive;
    return MasterService.findAll({
      where,
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  async findById(id: number): Promise<MasterService | null> {
    return MasterService.findByPk(id);
  }

  async create(data: CreateMasterServiceData): Promise<MasterService> {
    return MasterService.create({
      name: data.name,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    });
  }

  async update(id: number, data: UpdateMasterServiceData): Promise<MasterService | null> {
    const row = await MasterService.findByPk(id);
    if (!row) return null;
    await row.update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    });
    return row;
  }

  async delete(id: number): Promise<boolean> {
    const deleted = await MasterService.destroy({ where: { id } });
    return deleted > 0;
  }
}

const masterServiceRepository = new MasterServiceRepository();
export default masterServiceRepository;
