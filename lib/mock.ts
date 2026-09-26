/*
 * DEMO_MOCK=1: the typesearch API and the model answer with the fictional sample data in
 * lib/sample.ts, with realistic delays. For screenshots, trying the UI and tests; no key, no cost.
 * A topic about sports returns nothing (the empty state) and the custom topic «error» returns a 402.
 */
import { simulateReadableStream, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { emptySearch, SAMPLE_STORIES, SAMPLE_USAGE, sampleSearch } from './sample.ts';

const DELAY = { ultra: 600, fast: 900, normal: 1800, deep: 3200 } as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'req_sample' } });

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

export const mockFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const signal = init?.signal;
  if (url.pathname === '/v1/usage') return json(SAMPLE_USAGE);
  if (url.pathname === '/v1/search') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query: string; mode?: keyof typeof DELAY };
    const mode = body.mode ?? 'normal';
    await wait(DELAY[mode], signal);
    if (body.query.trim().toLowerCase() === 'error') {
      return json(
        {
          type: 'https://typesearch.ai/docs/errors#insufficient_credits',
          title: 'Insufficient credits',
          status: 402,
          detail: 'Your organization has no credit left.',
          code: 'insufficient_credits',
          request_id: 'req_sample_error',
        },
        402,
      );
    }
    if (/^(sports?|deportes|esportes)$/i.test(body.query.trim())) return json(emptySearch(body.query, mode));
    return json(sampleSearch(body.query, mode));
  }
  return json({ type: 'about:blank', title: 'Not found', status: 404, detail: 'Not in the sample API.', code: 'not_found', request_id: 'req_sample' }, 404);
};

/** Writes SAMPLE_STORIES as the structured output, a few characters at a time. */
export function mockModel(): LanguageModel {
  const text = JSON.stringify({ elements: SAMPLE_STORIES });
  const pieces = text.match(/[\s\S]{1,24}/g) ?? [];
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'briefing-writer',
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: 500,
        chunkDelayInMs: 18,
        chunks: [
          { type: 'text-start', id: 't' },
          ...pieces.map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end', id: 't' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: {
              inputTokens: { total: 1480, noCache: 1480, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 420, text: 420, reasoning: undefined },
            },
            providerMetadata: { gateway: { cost: '0.000358' } },
          },
        ],
      }),
    }),
  });
}
