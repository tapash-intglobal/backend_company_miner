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
    const maxTokens = options.maxTokens ?? 1024;

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      });

      const raw = result.response.text()?.trim();
      if (!raw) {
        throw new Error('AI returned no content');
      }
      return stripJsonFence(raw);
    } catch (err) {
      logger.warn('Company Miner: Gemini completion failed', { model: this.model, error: err });
      throw new Error('AI extraction failed');
    }
  }
}
