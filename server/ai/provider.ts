/**
 * Minimal client for OpenAI-compatible Chat Completions with tool calling.
 *
 * Groq, Google Gemini, Cloudflare Workers AI, and OpenRouter all expose this
 * format, so the provider is configuration (AI_BASE_URL, AI_MODEL,
 * AI_API_KEY, plus optional AI_FALLBACK_*), not code. No SDK dependency.
 */

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools: ChatTool[];
  maxTokens: number;
  timeoutMs: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[];
  /** Model that produced the response, for the answer's trace. */
  model: string;
}

/** One model call. The ask loop depends only on this, so tests can script it. */
export type ChatModel = (request: ChatRequest) => Promise<ChatResponse>;

export type ProviderErrorKind = 'quota' | 'timeout' | 'unavailable' | 'misconfigured' | 'bad_response';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** Primary provider first, then the optional fallback. Empty when Ask is not configured. */
export function readProviderConfigs(env: Record<string, string | undefined>): ProviderConfig[] {
  const read = (prefix: string): ProviderConfig | null => {
    const baseUrl = env[`${prefix}BASE_URL`]?.trim();
    const model = env[`${prefix}MODEL`]?.trim();
    const apiKey = env[`${prefix}API_KEY`]?.trim();
    return baseUrl && model && apiKey ? { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey } : null;
  };
  return [read('AI_'), read('AI_FALLBACK_')].filter((config): config is ProviderConfig => config !== null);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
}

function errorForStatus(status: number, retryAfter: string | null): ProviderError {
  if (status === 429) return new ProviderError('quota', 'Provider rate limit or quota reached.', parseRetryAfter(retryAfter));
  if (status === 401 || status === 403 || status === 404) {
    return new ProviderError('misconfigured', `Provider rejected the request (HTTP ${status}). Check the key, base URL, and model.`);
  }
  if (status >= 500) return new ProviderError('unavailable', `Provider error (HTTP ${status}).`);
  return new ProviderError('bad_response', `Provider rejected the request (HTTP ${status}).`);
}

export function createProviderModel(config: ProviderConfig, fetchImpl: typeof fetch = fetch): ChatModel {
  return async ({ messages, tools, maxTokens, timeoutMs }) => {
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new ProviderError('timeout', `Provider did not respond within ${timeoutMs} ms.`);
      }
      throw new ProviderError('unavailable', 'Could not reach the provider.');
    }

    if (!response.ok) throw errorForStatus(response.status, response.headers.get('retry-after'));

    let body: {
      model?: string;
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    try {
      body = await response.json();
    } catch (err) {
      if ((err as Error)?.name === 'TimeoutError') {
        throw new ProviderError('timeout', `Provider did not respond within ${timeoutMs} ms.`);
      }
      throw new ProviderError('bad_response', 'Provider returned invalid JSON.');
    }
    const message = body.choices?.[0]?.message;
    if (!message) throw new ProviderError('bad_response', 'Provider response had no message.');

    return {
      content: typeof message.content === 'string' ? message.content : null,
      toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
      model: body.model || config.model,
    };
  };
}

/**
 * Tries each provider in order. Any provider failure (quota, outage, timeout,
 * bad key, or a request that provider rejects) hands the same request to the
 * next; the last error is thrown if none answer.
 */
export function createChatModel(configs: ProviderConfig[], fetchImpl: typeof fetch = fetch): ChatModel {
  if (configs.length === 0) throw new Error('No AI provider configured.');
  const models = configs.map((config) => createProviderModel(config, fetchImpl));
  return async (request) => {
    let lastError: unknown;
    for (const model of models) {
      try {
        return await model(request);
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        lastError = err;
      }
    }
    throw lastError;
  };
}
