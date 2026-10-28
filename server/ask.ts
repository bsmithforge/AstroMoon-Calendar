/**
 * Ask the Almanac endpoint (handler source).
 *
 *   POST /api/ask  { "question": "...", "timezone": "America/Edmonton", "hemisphere": "northern" }
 *
 * Returns the grounded answer from server/ai/ask.ts as JSON. Without
 * AI_BASE_URL, AI_MODEL, and AI_API_KEY it answers 503 not_configured, and
 * the rest of the app is unaffected. When the provider's free quota is used
 * up it answers 503 resting, with Retry-After when the provider gives one.
 *
 * Deployment matches the feed: scripts/build-api.mjs bundles this file into
 * server/dist/ask.js, which api/ask.js re-exports. See server/calendar.ts.
 */

import { Hemisphere } from '../src/types';
import { isValidTimeZone } from '../src/utils/subscription';
import { askAlmanac } from './ai/ask';
import { ChatModel, createChatModel, ProviderError, readProviderConfigs } from './ai/provider';

export const ASK_MAX_QUESTION_LENGTH = 400;
const MAX_BODY_BYTES = 4096;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function invalid(message: string): Response {
  return json(400, { error: 'invalid_request', message });
}

export interface AskHandlerDeps {
  /** Returns null when no provider is configured. */
  getModel: () => ChatModel | null;
  now?: () => Date;
}

export function createAskHandler({ getModel, now }: AskHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return json(415, { error: 'unsupported_media_type', message: 'Send a JSON body.' });
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
      return json(413, { error: 'too_large', message: 'Request body is too large.' });
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return json(413, { error: 'too_large', message: 'Request body is too large.' });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return invalid('Body must be valid JSON.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Body must be a JSON object.');

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) return invalid('Ask a question.');
    if (question.length > ASK_MAX_QUESTION_LENGTH) {
      return invalid(`Questions are limited to ${ASK_MAX_QUESTION_LENGTH} characters.`);
    }
    const timezone = body.timezone ?? 'UTC';
    if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) return invalid('timezone must be an IANA time zone.');
    const hemisphere = body.hemisphere ?? 'northern';
    if (hemisphere !== 'northern' && hemisphere !== 'southern') {
      return invalid('hemisphere must be "northern" or "southern".');
    }

    const model = getModel();
    if (!model) {
      return json(503, { error: 'not_configured', message: 'Ask the Almanac is not configured on this deployment.' });
    }

    try {
      const result = await askAlmanac(
        { question, timezone, hemisphere: hemisphere as Hemisphere },
        { model, now: now?.() }
      );
      return json(200, result);
    } catch (err) {
      if (err instanceof ProviderError) {
        console.error(`Ask provider error (${err.kind}): ${err.message}`);
        if (err.kind === 'quota') {
          return json(
            503,
            { error: 'resting', message: 'The almanac is resting: the free AI quota is used up for now.', retryAfter: err.retryAfterSeconds ?? null },
            err.retryAfterSeconds !== undefined ? { 'Retry-After': String(err.retryAfterSeconds) } : {}
          );
        }
        return json(503, {
          error: err.kind === 'timeout' ? 'timeout' : 'unavailable',
          message: err.kind === 'timeout' ? 'The almanac took too long to answer. Try again.' : 'The almanac is unavailable right now. Try again later.',
        });
      }
      console.error('Ask failed:', err);
      return json(500, { error: 'internal', message: 'Something went wrong while answering.' });
    }
  };
}

function modelFromEnv(): ChatModel | null {
  const configs = readProviderConfigs(process.env);
  return configs.length > 0 ? createChatModel(configs) : null;
}

export const POST = createAskHandler({ getModel: modelFromEnv });

export function GET(): Response {
  return json(405, { error: 'method_not_allowed', message: 'Use POST.' }, { Allow: 'POST' });
}
