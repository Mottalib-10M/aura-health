import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Routing matrix — maps decision types to primary/fallback models
// ---------------------------------------------------------------------------

export type RoutingDecision =
  | 'symptom_triage'
  | 'longitudinal_analysis'
  | 'prescription_efficacy'
  | 'radiology_analysis'
  | 'mental_health'
  | 'outbreak_detection'
  | 'supply_forecast'
  | 'general_medical';

interface ModelConfig {
  modelId: string;
  displayName: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  costTier: 'low' | 'medium' | 'high';
}

interface RouteEntry {
  primary: ModelConfig;
  fallbacks: ModelConfig[];
}

const ROUTING_MATRIX: Record<RoutingDecision, RouteEntry> = {
  symptom_triage: {
    primary: {
      modelId: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek-R1',
      maxTokens: 4096,
      temperature: 0.1,
      timeoutMs: 30_000,
      costTier: 'medium',
    },
    fallbacks: [
      {
        modelId: 'anthropic/claude-sonnet-4-5-20250514',
        displayName: 'Claude Sonnet 4.5',
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 45_000,
        costTier: 'high',
      },
      {
        modelId: 'openai/gpt-4.1-nano',
        displayName: 'GPT-4.1-nano',
        maxTokens: 2048,
        temperature: 0.2,
        timeoutMs: 15_000,
        costTier: 'low',
      },
    ],
  },

  longitudinal_analysis: {
    primary: {
      modelId: 'anthropic/claude-sonnet-4-5-20250514',
      displayName: 'Claude Sonnet 4.5',
      maxTokens: 8192,
      temperature: 0.15,
      timeoutMs: 60_000,
      costTier: 'high',
    },
    fallbacks: [
      {
        modelId: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek-R1',
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 45_000,
        costTier: 'medium',
      },
    ],
  },

  prescription_efficacy: {
    primary: {
      modelId: 'openai/gpt-4.1-nano',
      displayName: 'GPT-4.1-nano',
      maxTokens: 2048,
      temperature: 0.1,
      timeoutMs: 15_000,
      costTier: 'low',
    },
    fallbacks: [
      {
        modelId: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek-R1',
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 30_000,
        costTier: 'medium',
      },
    ],
  },

  radiology_analysis: {
    primary: {
      modelId: 'google/medgemma-27b',
      displayName: 'MedGemma-27B',
      maxTokens: 4096,
      temperature: 0.05,
      timeoutMs: 60_000,
      costTier: 'high',
    },
    fallbacks: [
      {
        modelId: 'anthropic/claude-sonnet-4-5-20250514',
        displayName: 'Claude Sonnet 4.5',
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 45_000,
        costTier: 'high',
      },
    ],
  },

  mental_health: {
    primary: {
      modelId: 'anthropic/claude-sonnet-4-5-20250514',
      displayName: 'Claude Sonnet 4.5',
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 45_000,
      costTier: 'high',
    },
    fallbacks: [
      {
        modelId: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek-R1',
        maxTokens: 4096,
        temperature: 0.2,
        timeoutMs: 30_000,
        costTier: 'medium',
      },
    ],
  },

  outbreak_detection: {
    primary: {
      modelId: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek-R1',
      maxTokens: 4096,
      temperature: 0.05,
      timeoutMs: 30_000,
      costTier: 'medium',
    },
    fallbacks: [
      {
        modelId: 'openai/gpt-4.1-nano',
        displayName: 'GPT-4.1-nano',
        maxTokens: 2048,
        temperature: 0.1,
        timeoutMs: 15_000,
        costTier: 'low',
      },
    ],
  },

  supply_forecast: {
    primary: {
      modelId: 'openai/gpt-4.1-nano',
      displayName: 'GPT-4.1-nano',
      maxTokens: 2048,
      temperature: 0.1,
      timeoutMs: 15_000,
      costTier: 'low',
    },
    fallbacks: [
      {
        modelId: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek-R1',
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 30_000,
        costTier: 'medium',
      },
    ],
  },

  general_medical: {
    primary: {
      modelId: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek-R1',
      maxTokens: 4096,
      temperature: 0.2,
      timeoutMs: 30_000,
      costTier: 'medium',
    },
    fallbacks: [
      {
        modelId: 'openai/gpt-4.1-nano',
        displayName: 'GPT-4.1-nano',
        maxTokens: 2048,
        temperature: 0.2,
        timeoutMs: 15_000,
        costTier: 'low',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Latency tracking — simple in-memory EWMA
// ---------------------------------------------------------------------------
const latencyStats = new Map<string, { ewma: number; count: number }>();

function recordLatency(modelId: string, latencyMs: number): void {
  const alpha = 0.3; // EWMA smoothing factor
  const existing = latencyStats.get(modelId);
  if (existing) {
    existing.ewma = alpha * latencyMs + (1 - alpha) * existing.ewma;
    existing.count++;
  } else {
    latencyStats.set(modelId, { ewma: latencyMs, count: 1 });
  }
}

function getAverageLatency(modelId: string): number | undefined {
  return latencyStats.get(modelId)?.ewma;
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/**
 * Select the best model for a given decision type.
 * Returns the model config from the routing matrix.
 */
export function selectModel(decision: RoutingDecision): ModelConfig {
  const route = ROUTING_MATRIX[decision];
  if (!route) {
    throw new Error(`Unknown routing decision: ${decision}`);
  }
  return route.primary;
}

/**
 * Get the full fallback chain for a decision type (primary + fallbacks).
 */
export function getFallbackChain(decision: RoutingDecision): ModelConfig[] {
  const route = ROUTING_MATRIX[decision];
  if (!route) {
    throw new Error(`Unknown routing decision: ${decision}`);
  }
  return [route.primary, ...route.fallbacks];
}

// ---------------------------------------------------------------------------
// Unified model calling via LiteLLM proxy
// ---------------------------------------------------------------------------

export interface ModelCallOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
}

export interface ModelCallResult {
  content: string;
  modelUsed: string;
  latencyMs: number;
  tokensUsed: {
    prompt: number;
    completion: number;
  };
}

/**
 * Call a specific model via the LiteLLM proxy.
 */
async function callSingleModel(
  modelConfig: ModelConfig,
  options: ModelCallOptions,
): Promise<ModelCallResult> {
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), modelConfig.timeoutMs);

  try {
    const response = await fetch(`${config.ai.litellmUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.ai.litellmApiKey && {
          Authorization: `Bearer ${config.ai.litellmApiKey}`,
        }),
      },
      body: JSON.stringify({
        model: modelConfig.modelId,
        messages: options.messages,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        ...(options.responseFormat && { response_format: options.responseFormat }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`LiteLLM API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const latencyMs = Math.round(performance.now() - startTime);
    recordLatency(modelConfig.modelId, latencyMs);

    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      modelUsed: modelConfig.displayName,
      latencyMs,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call a model with automatic fallback through the chain.
 * Tries the primary model first, then each fallback in order.
 */
export async function callModel(
  decision: RoutingDecision,
  options: ModelCallOptions,
): Promise<ModelCallResult> {
  const chain = getFallbackChain(decision);
  let lastError: Error | null = null;

  for (const modelConfig of chain) {
    try {
      logger.debug(
        { model: modelConfig.displayName, decision },
        'Attempting model call',
      );

      const result = await callSingleModel(modelConfig, options);

      logger.info(
        {
          model: result.modelUsed,
          decision,
          latencyMs: result.latencyMs,
          tokens: result.tokensUsed,
        },
        'Model call succeeded',
      );

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { err: lastError, model: modelConfig.displayName, decision },
        'Model call failed, trying fallback',
      );
    }
  }

  // All models in the chain failed
  logger.error(
    { decision, err: lastError },
    'All models in fallback chain failed',
  );
  throw new Error(`All models failed for decision "${decision}": ${lastError?.message}`);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export function getLatencyStats(): Record<string, { ewma: number; count: number }> {
  const stats: Record<string, { ewma: number; count: number }> = {};
  for (const [modelId, data] of latencyStats.entries()) {
    stats[modelId] = { ...data };
  }
  return stats;
}
