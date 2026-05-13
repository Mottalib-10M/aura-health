// ---------------------------------------------------------------------------
// AI Router Domain Types
// ---------------------------------------------------------------------------

/**
 * AI task types supported by the routing engine.
 */
export type AITask = 'triage' | 'longitudinal' | 'vision_ocr' | 'forecasting';

/**
 * Task complexity classification.
 */
export type TaskComplexity = 'low' | 'medium' | 'high' | 'critical';

/**
 * AI model provider identifiers.
 */
export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'local_llama'
  | 'local_mistral'
  | 'azure_openai'
  | 'custom';

/**
 * Model size tiers for cost/performance tradeoff decisions.
 */
export type ModelTier = 'small' | 'medium' | 'large' | 'xl';

// ---- Routing Decision -------------------------------------------------------

/**
 * A routing decision describes the characteristics of an incoming AI request
 * that the router uses to select the optimal model and infrastructure.
 */
export interface RoutingDecision {
  task: AITask;
  complexity: TaskComplexity;
  phi_exposure: boolean;
  latency_requirement_ms: number;
}

// ---- Routing Matrix ---------------------------------------------------------

/**
 * A single entry in the routing matrix mapping a task+complexity combination
 * to a specific model configuration.
 */
export interface RoutingMatrixEntry {
  task: AITask;
  complexity: TaskComplexity;
  model_provider: ModelProvider;
  model_name: string;
  model_tier: ModelTier;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
  fallback_model?: string;
  fallback_provider?: ModelProvider;
  requires_phi_isolation: boolean;
  estimated_cost_per_call_usd: number;
  priority: number; // lower = higher priority
}

/**
 * The complete routing matrix configuration. This is the central artifact
 * that determines which model handles which request type.
 */
export interface RoutingMatrix {
  version: string;
  updated_at: string; // ISO 8601 datetime
  entries: RoutingMatrixEntry[];
  default_entry: RoutingMatrixEntry;
}

// ---- Model Registry ---------------------------------------------------------

/**
 * Health status of a registered model endpoint.
 */
export type ModelHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

/**
 * A registered model endpoint in the AI router's model registry.
 */
export interface RegisteredModel {
  id: string;
  provider: ModelProvider;
  model_name: string;
  tier: ModelTier;
  endpoint_url: string;
  api_version?: string;
  supported_tasks: AITask[];
  max_context_tokens: number;
  max_output_tokens: number;
  supports_streaming: boolean;
  supports_function_calling: boolean;
  health_status: ModelHealthStatus;
  average_latency_ms: number;
  p99_latency_ms: number;
  error_rate: number; // 0-1
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  phi_compliant: boolean; // can handle PHI data
  region_deployed: string;
  last_health_check: string; // ISO 8601 datetime
  is_active: boolean;
}

// ---- Router Request / Response ----------------------------------------------

/**
 * Request to the AI router.
 */
export interface AIRouterRequest {
  request_id: string;
  routing_decision: RoutingDecision;
  payload: Record<string, unknown>;
  user_id: string;
  session_id?: string;
  priority_override?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Response from the AI router.
 */
export interface AIRouterResponse {
  request_id: string;
  model_used: {
    provider: ModelProvider;
    model_name: string;
    tier: ModelTier;
  };
  result: Record<string, unknown>;
  latency_ms: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  cached: boolean;
  fallback_used: boolean;
  phi_isolated: boolean;
  timestamp: string; // ISO 8601 datetime
}

// ---- Router Metrics ---------------------------------------------------------

/**
 * Aggregated router performance metrics for observability dashboards.
 */
export interface RouterMetrics {
  period_start: string; // ISO 8601 datetime
  period_end: string; // ISO 8601 datetime
  total_requests: number;
  requests_by_task: Record<AITask, number>;
  requests_by_complexity: Record<TaskComplexity, number>;
  average_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate: number;
  fallback_rate: number;
  cache_hit_rate: number;
  total_cost_usd: number;
  total_tokens_used: number;
  phi_request_count: number;
}

/**
 * Circuit breaker state for a model endpoint.
 */
export interface CircuitBreakerState {
  model_id: string;
  state: 'closed' | 'open' | 'half-open';
  failure_count: number;
  failure_threshold: number;
  last_failure_at?: string; // ISO 8601 datetime
  recovery_timeout_ms: number;
  next_attempt_at?: string; // ISO 8601 datetime
}
