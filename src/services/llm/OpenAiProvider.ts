import OpenAI from 'openai';
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

export class OpenAiProvider implements LlmProvider {
  readonly id = 'openai' as const;
  readonly model: string;
  private readonly client: OpenAI | null;

  constructor() {
    this.model = config.ai.openai.model;
    const apiKey = config.ai.openai.apiKey.trim();
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
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
      throw new Error('OpenAI is not configured');
    }

    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? 1024;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error('AI returned no content');
      }
      return stripJsonFence(raw);
    } catch (err) {
      logger.warn('Company Miner: OpenAI completion failed', { error: err });
      throw new Error('AI extraction failed');
    }
  }
}
