import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import companyMinerService from '../../services/tools/CompanyMinerService';
import MasterService from '../../models/MasterService';

const BLOCKED_PROTOCOLS = ['file:', 'javascript:', 'data:', 'vbscript:', 'ftp:'];

export const mineCompanySchema = z.object({
  body: z.object({
    url: z
      .string()
      .min(1, 'URL is required')
      .max(2048, 'URL must be at most 2048 characters')
      .refine(
        (val) => !BLOCKED_PROTOCOLS.some((p) => val.trim().toLowerCase().startsWith(p)),
        { message: 'URL protocol is not allowed' }
      )
      .refine(
        (val) => {
          const t = val.trim();
          const u = t.toLowerCase().startsWith('http') ? t : `https://${t}`;
          try {
            const p = new URL(u);
            return p.protocol === 'http:' || p.protocol === 'https:';
          } catch {
            return false;
          }
        },
        { message: 'URL is malformed or invalid' }
      ),
    instruction: z
      .string()
      .max(150, 'Instruction must be at most 150 characters')
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  }),
});

export class CompanyMinerController {
  async mineCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url, instruction } = req.body as { url: string; instruction?: string };
      const result = await companyMinerService.mineCompany(url, instruction);

      const masterServices = await MasterService.findAll({
        where: { isActive: true },
        order: [['sortOrder', 'ASC']],
        attributes: ['id', 'name'],
      });
      const suggested = await companyMinerService.suggestServicesWeCanProvide(
        result,
        masterServices.map((m) => ({ id: m.id, name: m.name }))
      );

      // Generate PDF (best-effort; API still returns JSON even if PDF generation fails)
      let pdfBase64: string | undefined;
      let pdfFilename: string | undefined;
      try {
        const { generateCompanyMinerPdf } = await import('../../utils/companyMinerPdf');
        const pdf = await generateCompanyMinerPdf({
          url,
          instruction,
          result,
          suggestedServices: suggested,
        });
        pdfBase64 = pdf.buffer.toString('base64');
        pdfFilename = pdf.filename;
      } catch (pdfErr) {
        // Log but do not fail the main response
        // eslint-disable-next-line no-console
        console.warn('Company Miner: PDF generation failed', pdfErr);
      }

      sendSuccess(
        res,
        'Company mined successfully',
        {
          ...result,
          suggestedServicesWeCanProvide: suggested,
          pdfBase64,
          pdfFilename,
        },
        200
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message === 'URL is required' ||
        message === 'URL must use http or https' ||
        message === 'URL is malformed' ||
        message === 'URL protocol is not allowed' ||
        message.includes('at most')
      ) {
        sendError(res, message, 400);
        return;
      }
      if (
        message === 'Could not fetch website content or content was too short to analyze' ||
        message.includes('fetch')
      ) {
        sendError(res, message, 422);
        return;
      }
      if (
        message === 'AI extraction is not configured' ||
        message === 'AI extraction failed' ||
        message === 'AI returned no content' ||
        message === 'AI extraction returned invalid structure' ||
        message === 'AI extraction returned invalid response'
      ) {
        sendError(res, message, 502);
        return;
      }
      next(err);
    }
  }
}

const companyMinerController = new CompanyMinerController();
export default companyMinerController;
