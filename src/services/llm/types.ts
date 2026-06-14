export type AiProviderId = 'openai' | 'gemini';

export interface LlmCompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LlmProvider {
  readonly id: AiProviderId;
  readonly model: string;
  isConfigured(): boolean;
  completeJson(
    systemPrompt: string,
    userPrompt: string,
    options?: LlmCompletionOptions
  ): Promise<string>;
}

export interface LlmCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}
