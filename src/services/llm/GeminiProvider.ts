import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config';
import logger from '../../utils/logger';
import type { LlmProvider } from './types';

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return trimmed;
}

function extractGeminiErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const status = extractGeminiErrorStatus(err);
  if (status === 429) return true;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted');
}

function mapGeminiError(err: unknown): Error {
  if (isQuotaOrRateLimitError(err)) {
    return new Error('Gemini rate limit exceeded (429)');
  }
  const status = extractGeminiErrorStatus(err);
  if (status === 503) {
    return new Error('Gemini service unavailable (503)');
  }
  return new Error('AI extraction failed');
}

export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const;
  readonly model: string;
  private readonly client: GoogleGenerativeAI | null;

  constructor() {
    this.model = config.ai.gemini.model;
    const apiKey = config.ai.gemini.apiKey.trim();
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  async completeJson(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini is not configured');
    }

    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? config.ai.gemini.maxOutputTokensDefault;
    const timeoutMs = config.ai.gemini.requestTimeoutMs;

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      const generatePromise = model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      });

      const result = await Promise.race([
        generatePromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs);
        }),
      ]);

      const response = result.response;
      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      const usage = response.usageMetadata;
      if (usage) {
        logger.debug('Gemini completion usage', {
          model: this.model,
          finishReason,
          promptTokenCount: usage.promptTokenCount,
          candidatesTokenCount: usage.candidatesTokenCount,
          totalTokenCount: usage.totalTokenCount,
        });
      }

      if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
        throw new Error('AI content blocked by Gemini safety filters');
      }

      const raw = response.text()?.trim();
      if (!raw) {
        throw new Error('AI returned no content');
      }

      if (finishReason === 'MAX_TOKENS') {
        logger.warn('Gemini response truncated (MAX_TOKENS)', {
          model: this.model,
          maxOutputTokens: maxTokens,
          rawLength: raw.length,
        });
        throw new Error('AI response truncated');
      }

      return stripJsonFence(raw);
    } catch (err) {
      if (err instanceof Error && err.message === 'Gemini request timed out') {
        logger.warn('Company Miner: Gemini request timed out', { model: this.model, timeoutMs });
        throw err;
      }
      if (err instanceof Error && err.message.startsWith('AI ')) {
        logger.warn('Company Miner: Gemini completion issue', { model: this.model, message: err.message });
        throw err;
      }
      logger.warn('Company Miner: Gemini completion failed', { model: this.model, error: err });
      throw mapGeminiError(err);
    }
  }
}
