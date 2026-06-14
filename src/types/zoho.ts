export enum ZohoMinerJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ZohoLeadRecord {
  id: string;
  Website?: string | null;
  Company?: string | null;
  Email?: string | null;
  First_Name?: string | null;
  Last_Name?: string | null;
}

export interface ZohoProcessLeadPayload {
  lead_id: string;
  website?: string;
  company?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface ZohoAttachmentUploadResult {
  id?: string;
  fileName?: string;
}
