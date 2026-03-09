import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import masterServiceService from '../../services/admin/MasterServiceService';

export const listMasterServicesSchema = z.object({
  query: z.object({
    isActive: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});

export const createMasterServiceSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(2000).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateMasterServiceSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const getByIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

export class MasterServiceController {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.query.isActive as boolean | undefined;
      const list = await masterServiceService.list({ isActive });
      sendSuccess(res, 'Master services retrieved successfully', list);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        sendError(res, 'Invalid ID', 400);
        return;
      }
      const item = await masterServiceService.getById(id);
      if (!item) {
        sendError(res, 'Master service not found', 404);
        return;
      }
      sendSuccess(res, 'Master service retrieved successfully', item);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as {
        name: string;
        description?: string | null;
        sortOrder?: number;
        isActive?: boolean;
      };
      const created = await masterServiceService.create(body);
      sendSuccess(res, 'Master service created successfully', created, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        sendError(res, 'Invalid ID', 400);
        return;
      }
      const body = req.body as {
        name?: string;
        description?: string | null;
        sortOrder?: number;
        isActive?: boolean;
      };
      const updated = await masterServiceService.update(id, body);
      if (!updated) {
        sendError(res, 'Master service not found', 404);
        return;
      }
      sendSuccess(res, 'Master service updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        sendError(res, 'Invalid ID', 400);
        return;
      }
      const deleted = await masterServiceService.delete(id);
      if (!deleted) {
        sendError(res, 'Master service not found', 404);
        return;
      }
      sendSuccess(res, 'Master service deleted successfully', undefined);
    } catch (err) {
      next(err);
    }
  }
}

const masterServiceController = new MasterServiceController();
export default masterServiceController;
