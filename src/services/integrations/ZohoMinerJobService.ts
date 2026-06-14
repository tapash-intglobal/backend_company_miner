import { Op } from 'sequelize';
import config from '../../config';
import ZohoMinerJob from '../../models/ZohoMinerJob';
import MasterService from '../../models/MasterService';
import companyMinerService from '../tools/CompanyMinerService';
import zohoCrmService from './ZohoCrmService';
import zohoOAuthService from './ZohoOAuthService';
import { generateCompanyMinerPdf } from '../../utils/companyMinerPdf';
import logger from '../../utils/logger';
import {
  ZohoMinerJobStatus,
  type ZohoProcessLeadPayload,
} from '../../types/zoho';
import { ValidationError } from '../../utils/errors';
import { isRetryableJobError, sleep } from '../../utils/retryableError';

export interface EnqueueJobResult {
  job: ZohoMinerJob;
  isDuplicate: boolean;
}

export interface JobStatusDto {
  job_id: string;
  lead_id: string;
  status: ZohoMinerJobStatus;
  website: string | null;
  resolved_website: string | null;
  pdf_filename: string | null;
  zoho_attachment_id: string | null;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

function toJobStatusDto(job: ZohoMinerJob): JobStatusDto {
  return {
    job_id: job.id,
    lead_id: job.leadId,
    status: job.status,
    website: job.website,
    resolved_website: job.resolvedWebsite,
    pdf_filename: job.pdfFilename,
    zoho_attachment_id: job.zohoAttachmentId,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    started_at: job.startedAt,
    completed_at: job.completedAt,
  };
}

function optionalTrim(value?: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class ZohoMinerJobService {
  private workerTimer: ReturnType<typeof setInterval> | null = null;
  private processingCount = 0;

  toStatusDto(job: ZohoMinerJob): JobStatusDto {
    return toJobStatusDto(job);
  }

  async enqueueJob(payload: ZohoProcessLeadPayload): Promise<EnqueueJobResult> {
    const leadId = payload.lead_id.trim();
    const websiteInput = optionalTrim(payload.website);

    if (websiteInput) {
      companyMinerService.normalizeUrl(websiteInput);
    }

    const windowStart = new Date(Date.now() - config.zoho.jobIdempotencyWindowMs);
    const existing = await ZohoMinerJob.findOne({
      where: {
        leadId,
        status: {
          [Op.in]: [ZohoMinerJobStatus.QUEUED, ZohoMinerJobStatus.PROCESSING],
        },
        createdAt: {
          [Op.gte]: windowStart,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    if (existing) {
      return { job: existing, isDuplicate: true };
    }

    const job = await ZohoMinerJob.create({
      leadId,
      website: websiteInput,
      company: optionalTrim(payload.company),
      email: optionalTrim(payload.email),
      firstName: optionalTrim(payload.first_name),
      lastName: optionalTrim(payload.last_name),
      status: ZohoMinerJobStatus.QUEUED,
    });

    return { job, isDuplicate: false };
  }

  async getJobById(jobId: string): Promise<ZohoMinerJob | null> {
    return ZohoMinerJob.findByPk(jobId);
  }

  async resolveWebsite(job: ZohoMinerJob): Promise<string> {
    const fromPayload = optionalTrim(job.website ?? undefined);
    if (fromPayload) {
      return companyMinerService.normalizeUrl(fromPayload);
    }

    if (!zohoOAuthService.isConfigured()) {
      throw new ValidationError(
        'Website is required when Zoho OAuth is not configured for GET fallback'
      );
    }

    const lead = await zohoCrmService.getLead(job.leadId);
    const fromZoho = optionalTrim(lead.Website ?? undefined);
    if (!fromZoho) {
      throw new ValidationError('Website is not available on the Zoho lead record');
    }

    if (!job.company && lead.Company) {
      await job.update({ company: optionalTrim(lead.Company ?? undefined) });
    }
    if (!job.email && lead.Email) {
      await job.update({ email: optionalTrim(lead.Email ?? undefined) });
    }
    if (!job.firstName && lead.First_Name) {
      await job.update({ firstName: optionalTrim(lead.First_Name ?? undefined) });
    }
    if (!job.lastName && lead.Last_Name) {
      await job.update({ lastName: optionalTrim(lead.Last_Name ?? undefined) });
    }

    return companyMinerService.normalizeUrl(fromZoho);
  }

  async recoverStaleProcessingJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - config.zoho.jobStaleProcessingMs);
    const [affectedCount] = await ZohoMinerJob.update(
      {
        status: ZohoMinerJobStatus.QUEUED,
        startedAt: null,
        errorMessage: null,
      },
      {
        where: {
          status: ZohoMinerJobStatus.PROCESSING,
          startedAt: {
            [Op.lt]: cutoff,
          },
        },
      }
    );

    if (affectedCount > 0) {
      logger.warn('Re-queued stale Zoho miner jobs', { count: affectedCount, cutoff });
    }

    return affectedCount;
  }

  private async executeJobPipeline(job: ZohoMinerJob): Promise<void> {
    const resolvedWebsite = await this.resolveWebsite(job);
    await job.update({ resolvedWebsite });

    const result = await companyMinerService.mineCompany(resolvedWebsite);

    const masterServices = await MasterService.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
      attributes: ['id', 'name'],
    });
    const suggested = await companyMinerService.suggestServicesWeCanProvide(
      result,
      masterServices.map((m) => ({ id: m.id, name: m.name }))
    );

    const pdf = await generateCompanyMinerPdf({
      url: resolvedWebsite,
      result,
      suggestedServices: suggested,
    });

    if (!zohoOAuthService.isConfigured()) {
      throw new ValidationError('Zoho OAuth is not configured for attachment upload');
    }

    const attachment = await zohoCrmService.uploadLeadAttachment(
      job.leadId,
      pdf.buffer,
      pdf.filename
    );

    await job.update({
      status: ZohoMinerJobStatus.COMPLETED,
      pdfFilename: pdf.filename,
      zohoAttachmentId: attachment.id ? String(attachment.id) : null,
      completedAt: new Date(),
      errorMessage: null,
    });

    logger.info('Zoho miner job completed', {
      jobId: job.id,
      leadId: job.leadId,
      pdfFilename: pdf.filename,
    });
  }

  async processJob(jobId: string): Promise<void> {
    const job = await ZohoMinerJob.findByPk(jobId);
    if (!job || job.status !== ZohoMinerJobStatus.QUEUED) {
      return;
    }

    await job.update({
      status: ZohoMinerJobStatus.PROCESSING,
      startedAt: new Date(),
      errorMessage: null,
    });

    const maxAttempts = Math.max(1, config.zoho.jobMaxAttempts);
    const retryDelays =
      config.zoho.jobRetryDelayMs.length > 0
        ? config.zoho.jobRetryDelayMs
        : [5000, 15000, 45000];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.executeJobPipeline(job);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const canRetry = isRetryableJobError(err) && attempt < maxAttempts;

        if (canRetry) {
          const delayMs = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)] ?? 5000;
          logger.warn('Zoho miner job attempt failed, retrying', {
            jobId: job.id,
            leadId: job.leadId,
            attempt,
            maxAttempts,
            delayMs,
            message,
          });
          await sleep(delayMs);
          await job.reload();
          const statusAfterWait = job.getDataValue('status');
          if (statusAfterWait !== ZohoMinerJobStatus.PROCESSING) {
            logger.info('Zoho miner job no longer processing after retry wait', {
              jobId: job.id,
              status: statusAfterWait,
            });
            return;
          }
          continue;
        }

        await job.update({
          status: ZohoMinerJobStatus.FAILED,
          errorMessage: message.slice(0, 2000),
          completedAt: new Date(),
        });
        logger.error('Zoho miner job failed', {
          jobId: job.id,
          leadId: job.leadId,
          attempt,
          maxAttempts,
          message,
        });
        return;
      }
    }
  }

  private async pollAndProcess(): Promise<void> {
    await this.recoverStaleProcessingJobs();

    const maxConcurrent = Math.max(1, config.zoho.workerConcurrency);
    if (this.processingCount >= maxConcurrent) {
      return;
    }

    const slots = maxConcurrent - this.processingCount;
    const jobs = await ZohoMinerJob.findAll({
      where: { status: ZohoMinerJobStatus.QUEUED },
      order: [['createdAt', 'ASC']],
      limit: slots,
    });

    for (const job of jobs) {
      this.processingCount += 1;
      void this.processJob(job.id).finally(() => {
        this.processingCount -= 1;
      });
    }
  }

  startWorker(): void {
    if (!config.zoho.workerEnabled) {
      logger.info('Zoho miner worker disabled (ZOHO_WORKER_ENABLED=false)');
      return;
    }

    if (this.workerTimer) {
      return;
    }

    logger.info('Zoho miner worker started', {
      pollIntervalMs: config.zoho.workerPollIntervalMs,
      concurrency: config.zoho.workerConcurrency,
      staleProcessingMs: config.zoho.jobStaleProcessingMs,
      maxAttempts: config.zoho.jobMaxAttempts,
    });

    void this.recoverStaleProcessingJobs().then(() => this.pollAndProcess());
    this.workerTimer = setInterval(() => {
      void this.pollAndProcess();
    }, config.zoho.workerPollIntervalMs);
  }

  stopWorker(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      logger.info('Zoho miner worker stopped');
    }
  }
}

const zohoMinerJobService = new ZohoMinerJobService();
export default zohoMinerJobService;
