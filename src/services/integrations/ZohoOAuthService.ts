import config from '../../config';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';

interface ZohoTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

export class ZohoOAuthService {
  private accessToken: string | null = null;
  private expiresAtMs = 0;
  private refreshPromise: Promise<string> | null = null;

  isConfigured(): boolean {
    return Boolean(
      config.zoho.clientId && config.zoho.clientSecret && config.zoho.refreshToken
    );
  }

  async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError('Zoho OAuth is not configured', 503);
    }

    const now = Date.now();
    if (this.accessToken && now < this.expiresAtMs - 60_000) {
      return this.accessToken;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const params = new URLSearchParams({
      refresh_token: config.zoho.refreshToken,
      client_id: config.zoho.clientId,
      client_secret: config.zoho.clientSecret,
      grant_type: 'refresh_token',
    });

    const url = `${config.zoho.accountsUrl}/oauth/v2/token?${params.toString()}`;
    const response = await fetch(url, { method: 'POST' });
    const body = (await response.json()) as ZohoTokenResponse;

    if (!response.ok || !body.access_token) {
      const message = body.error || `Zoho token refresh failed (${response.status})`;
      logger.error('Zoho OAuth token refresh failed', { status: response.status, error: body.error });
      throw new AppError(message, 502);
    }

    const expiresInSec = typeof body.expires_in === 'number' ? body.expires_in : 3600;
    this.accessToken = body.access_token;
    this.expiresAtMs = Date.now() + expiresInSec * 1000;
    return this.accessToken;
  }
}

const zohoOAuthService = new ZohoOAuthService();
export default zohoOAuthService;
