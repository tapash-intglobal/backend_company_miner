import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response';
import zohoMinerJobService from '../../services/integrations/ZohoMinerJobService';
import companyMinerService from '../../services/tools/CompanyMinerService';
import { NotFoundError } from '../../utils/errors';

const BLOCKED_PROTOCOLS = ['file:', 'javascript:', 'data:', 'vbscript:', 'ftp:'];

const optionalWebsiteSchema = z
  .string()
  .max(2048, 'Website must be at most 2048 characters')
  .optional()
  .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined))
  .refine(
    (val) =>
      val === undefined ||
      !BLOCKED_PROTOCOLS.some((p) => val.trim().toLowerCase().startsWith(p)),
    { message: 'Website protocol is not allowed' }
  );

export const zohoProcessLeadSchema = z.object({
  body: z.object({
    lead_id: z.string().trim().min(1, 'lead_id is required').max(64),
    website: optionalWebsiteSchema,
    company: z
      .string()
      .max(255)
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
    email: z
      .string()
      .max(255)
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
    first_name: z
      .string()
      .max(100)
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
    last_name: z
      .string()
      .max(100)
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  }),
});

export const zohoJobIdParamSchema = z.object({
  params: z.object({
    jobId: z.string().uuid('Invalid job_id format'),
  }),
});

export class ZohoIntegrationController {
  async processLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as z.infer<typeof zohoProcessLeadSchema>['body'];

      if (body.website) {
        try {
          companyMinerService.normalizeUrl(body.website);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Invalid website';
          sendError(res, message, 400);
          return;
        }
      }

      const { job, isDuplicate } = await zohoMinerJobService.enqueueJob(body);
      const data = zohoMinerJobService.toStatusDto(job);

      sendSuccess(
        res,
        isDuplicate
          ? 'Existing Company Miner job is already in progress for this lead'
          : 'Company Miner job accepted',
        data,
        202
      );
    } catch (err) {
      next(err);
    }
  }

  async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params as { jobId: string };
      const job = await zohoMinerJobService.getJobById(jobId);
      if (!job) {
        sendError(res, new NotFoundError('Job not found').message, 404);
        return;
      }

      sendSuccess(res, 'Job status retrieved', zohoMinerJobService.toStatusDto(job), 200);
    } catch (err) {
      next(err);
    }
  }
}

const zohoIntegrationController = new ZohoIntegrationController();
export default zohoIntegrationController;
