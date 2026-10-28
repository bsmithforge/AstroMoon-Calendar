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
  /**
   * ISO 3166 country codes this provider must not serve (from
   * <prefix>EXCLUDED_COUNTRIES). Gemini's free tier, for one, may not be
   * offered to users in the EEA, UK, or Switzerland.
   */
  excludedCountries?: string[];
}

/** Primary provider first, then the optional fallback. Empty when Ask is not configured. */
export function readProviderConfigs(env: Record<string, string | undefined>): ProviderConfig[] {
  const read = (prefix: string): ProviderConfig | null => {
    const baseUrl = env[`${prefix}BASE_URL`]?.trim();
    const model = env[`${prefix}MODEL`]?.trim();
    const apiKey = env[`${prefix}API_KEY`]?.trim();
    if (!baseUrl || !model || !apiKey) return null;
    const config: ProviderConfig = { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey };
    const excluded = (env[`${prefix}EXCLUDED_COUNTRIES`] ?? '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    if (excluded.length > 0) config.excludedCountries = excluded;
    return config;
  };
  return [read('AI_'), read('AI_FALLBACK_')].filter((config): config is ProviderConfig => config !== null);
}

/**
 * Providers allowed to answer a request from `country` (Vercel's
 * x-vercel-ip-country header). Fails closed: a provider with exclusions is
 * skipped when the country is unknown, as it is under `npm run dev`.
 */
export function providersForCountry(configs: ProviderConfig[], country: string | null): ProviderConfig[] {
  const code = country?.trim().toUpperCase() || null;
  return configs.filter((config) => !config.excludedCountries || (code !== null && !config.excludedCountries.includes(code)));
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined;
}

/**
 * The provider's short error code (Groq: "tool_use_failed"; Gemini wraps its
 * error in an array and uses "status"), for server logs and evals. Only the
 * code is kept: error bodies can echo the model's failed generation.
 */
async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    const error = (Array.isArray(body) ? body[0] : body)?.error;
    const code = error?.status ?? error?.code ?? error?.type;
    return typeof code === 'string' || typeof code === 'number' ? String(code).slice(0, 60) : undefined;
  } catch {
    return undefined;
  }
}

function errorForStatus(status: number, retryAfter: string | null, code?: string): ProviderError {
  const http = code ? `HTTP ${status}, ${code}` : `HTTP ${status}`;
  if (status === 429) return new ProviderError('quota', 'Provider rate limit or quota reached.', parseRetryAfter(retryAfter));
  if (status === 401 || status === 403 || status === 404) {
    return new ProviderError('misconfigured', `Provider rejected the request (${http}). Check the key, base URL, and model.`);
  }
  if (status >= 500) return new ProviderError('unavailable', `Provider error (${http}).`);
  return new ProviderError('bad_response', `Provider rejected the request (${http}).`);
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

    if (!response.ok) {
      throw errorForStatus(response.status, response.headers.get('retry-after'), await readErrorCode(response));
    }

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
