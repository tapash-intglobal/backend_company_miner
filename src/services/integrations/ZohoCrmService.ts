import config from '../../config';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';
import type { ZohoAttachmentUploadResult, ZohoLeadRecord } from '../../types/zoho';
import zohoOAuthService from './ZohoOAuthService';

interface ZohoLeadGetResponse {
  data?: ZohoLeadRecord[];
}

interface ZohoAttachmentPostResponse {
  data?: ZohoAttachmentUploadResult[];
}

function buildMultipartBody(
  fieldName: string,
  filename: string,
  contentType: string,
  buffer: Buffer
): { body: Buffer; contentType: string } {
  const boundary = `----CompanyMiner${Date.now()}${Math.random().toString(16).slice(2)}`;
  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([header, buffer, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export class ZohoCrmService {
  async getLead(leadId: string): Promise<ZohoLeadRecord> {
    const token = await zohoOAuthService.getAccessToken();
    const url = `${config.zoho.apiBase}/crm/v8/Leads/${encodeURIComponent(leadId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    const body = (await response.json()) as ZohoLeadGetResponse & { message?: string; code?: string };

    if (!response.ok) {
      const message = body.message || `Zoho GET lead failed (${response.status})`;
      logger.error('Zoho GET lead failed', { leadId, status: response.status, message });
      throw new AppError(message, response.status === 404 ? 404 : 502);
    }

    const lead = body.data?.[0];
    if (!lead) {
      throw new AppError('Lead not found in Zoho CRM', 404);
    }

    return lead;
  }

  async uploadLeadAttachment(
    leadId: string,
    pdfBuffer: Buffer,
    filename: string
  ): Promise<ZohoAttachmentUploadResult> {
    const token = await zohoOAuthService.getAccessToken();
    const url = `${config.zoho.apiBase}/crm/v8/Leads/${encodeURIComponent(leadId)}/Attachments`;
    const multipart = buildMultipartBody('file', filename, 'application/pdf', pdfBuffer);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    const body = (await response.json()) as ZohoAttachmentPostResponse & {
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      const message = body.message || `Zoho attachment upload failed (${response.status})`;
      logger.error('Zoho attachment upload failed', { leadId, status: response.status, message });
      throw new AppError(message, 502);
    }

    const attachment = body.data?.[0] ?? {};
    return attachment;
  }
}

const zohoCrmService = new ZohoCrmService();
export default zohoCrmService;
