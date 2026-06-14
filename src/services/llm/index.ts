import config from '../../config';
import { GeminiProvider } from './GeminiProvider';
import { OpenAiProvider } from './OpenAiProvider';
import type { LlmProvider } from './types';

export function createLlmProvider(): LlmProvider {
  const provider = config.ai.provider.toLowerCase();
  if (provider === 'gemini') {
    return new GeminiProvider();
  }
  return new OpenAiProvider();
}

export type { LlmProvider, LlmCompletionOptions } from './types';
