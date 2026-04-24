import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { CircuitBreakerPort } from '@flow/shared';
import { NOOP_CIRCUIT_BREAKER } from '@flow/shared';

export interface AgentExecutionContext {
  workspaceId: string;
  agentId: string;
  taskId?: string;
  runId?: string;
}

export interface LLMOptions {
  taskTier?: 'fast' | 'quality';
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  actualCostCents: number;
}

export class NoAvailableProviderError extends Error {
  constructor() {
    super('AI services are temporarily unavailable. Please try again in a moment.');
    this.name = 'NoAvailableProviderError';
  }
}

import type { LanguageModelV1 } from 'ai';

type LanguageModel = LanguageModelV1;

interface ProviderConfig {
  name: string;
  createModel: () => LanguageModel;
  circuitName: string;
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

function estimateCostCents(inputTokens: number, outputTokens: number, model: string): number {
  if (model.includes('claude')) {
    return Math.ceil((inputTokens * 0.003 + outputTokens * 0.015) / 1000 * 100);
  }
  if (model.includes('gemini')) {
    return Math.ceil((inputTokens * 0.000075 + outputTokens * 0.0003) / 1000 * 100);
  }
  return Math.ceil((inputTokens * 0.00005 + outputTokens * 0.0001) / 1000 * 100);
}

export interface CostLogger {
  insertEstimate(entry: {
    workspaceId: string;
    agentId: string;
    runId?: string;
    provider: string;
    model: string;
    inputTokens: number;
    estimatedCostCents: number;
  }): Promise<string>;
  insertActual(entry: {
    workspaceId: string;
    agentId: string;
    runId?: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostCents: number;
    actualCostCents: number;
  }): Promise<void>;
}

export interface LlmRouter {
  complete(messages: Message[], context: AgentExecutionContext, options?: LLMOptions): Promise<LlmResponse>;
  isHealthy(provider: string): boolean;
}

export function createLLMRouter(
  circuitBreaker: CircuitBreakerPort = NOOP_CIRCUIT_BREAKER,
  costLogger?: CostLogger,
): LlmRouter {
  const groqApiKey = process.env.GROQ_API_KEY ?? '';
  const groqClient = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: groqApiKey,
  });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const anthropicClient = createAnthropic({
    apiKey: anthropicApiKey,
  });

  const geminiApiKey = process.env.GEMINI_API_KEY ?? '';
  const geminiClient = createGoogleGenerativeAI({
    apiKey: geminiApiKey,
  });

  const fastProviders: ProviderConfig[] = [
    { name: 'groq', createModel: () => groqClient('llama-3.3-70b-versatile'), circuitName: 'groq' },
    { name: 'gemini-fast', createModel: () => geminiClient('gemini-2.0-flash'), circuitName: 'gemini' },
    { name: 'anthropic-fast', createModel: () => anthropicClient('claude-haiku-4-20250414'), circuitName: 'anthropic' },
  ];

  const qualityProviders: ProviderConfig[] = [
    { name: 'anthropic', createModel: () => anthropicClient('claude-sonnet-4-20250514'), circuitName: 'anthropic' },
    { name: 'gemini', createModel: () => geminiClient('gemini-2.5-pro'), circuitName: 'gemini' },
    { name: 'groq-quality', createModel: () => groqClient('llama-3.3-70b-versatile'), circuitName: 'groq' },
  ];

  function selectProvider(tier: 'fast' | 'quality'): ProviderConfig | null {
    const providers = tier === 'fast' ? fastProviders : qualityProviders;
    for (const provider of providers) {
      if (circuitBreaker.canExecute(provider.circuitName)) {
        return provider;
      }
    }
    return null;
  }

  return {
    async complete(messages, context, options = {}): Promise<LlmResponse> {
      const tier = options.taskTier ?? 'fast';
      const provider = selectProvider(tier);

      if (!provider) {
        throw new NoAvailableProviderError();
      }

      const modelId = provider.name;
      const estimatedCostCents = estimateCostCents(
        (options.maxTokens ?? 1024) * 2,
        options.maxTokens ?? 1024,
        modelId,
      );

      if (costLogger) {
        const estimateEntry: {
          workspaceId: string;
          agentId: string;
          runId?: string;
          provider: string;
          model: string;
          inputTokens: number;
          estimatedCostCents: number;
        } = {
          workspaceId: context.workspaceId,
          agentId: context.agentId,
          provider: provider.name,
          model: modelId,
          inputTokens: (options.maxTokens ?? 1024) * 2,
          estimatedCostCents,
        };
        if (context.runId !== undefined) estimateEntry.runId = context.runId;
        await costLogger.insertEstimate(estimateEntry);
      }

      try {
        const model = provider.createModel();
        const result = await generateText({
          model,
          messages,
          maxTokens: options.maxTokens ?? 1024,
          temperature: options.temperature ?? 0.3,
        });

        const resolvedModelId = result.response.modelId ?? provider.name;
        const inputTokens = result.usage?.promptTokens ?? 0;
        const outputTokens = result.usage?.completionTokens ?? 0;
        const actualCostCents = estimateCostCents(inputTokens, outputTokens, resolvedModelId);

        circuitBreaker.recordSuccess(provider.circuitName);

        if (costLogger) {
          const actualEntry: {
            workspaceId: string;
            agentId: string;
            runId?: string;
            provider: string;
            model: string;
            inputTokens: number;
            outputTokens: number;
            estimatedCostCents: number;
            actualCostCents: number;
          } = {
            workspaceId: context.workspaceId,
            agentId: context.agentId,
            provider: provider.name,
            model: resolvedModelId,
            inputTokens,
            outputTokens,
            estimatedCostCents,
            actualCostCents,
          };
          if (context.runId !== undefined) actualEntry.runId = context.runId;
          await costLogger.insertActual(actualEntry);
        }

        return {
          text: result.text,
          provider: provider.name,
          model: resolvedModelId,
          inputTokens,
          outputTokens,
          estimatedCostCents,
          actualCostCents,
        };
      } catch (err) {
        circuitBreaker.recordFailure(provider.circuitName);
        throw err;
      }
    },

    isHealthy(provider: string): boolean {
      return circuitBreaker.canExecute(provider);
    },
  };
}
