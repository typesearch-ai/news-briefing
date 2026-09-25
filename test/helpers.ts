import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import Typesearch from 'typesearch-js';
import { assertSchema } from './contract.ts';

type Handler = (path: string, body: any) => { status?: number; body: unknown };

/** A real SDK client whose fetch validates every request against the OpenAPI and answers with `handler`. */
export function fakeTypesearch(handler: Handler) {
  const requests: { path: string; body: any }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname === '/v1/search') assertSchema('SearchRequest', body);
    requests.push({ path: url.pathname, body });
    const r = handler(url.pathname, body);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return { ts: new Typesearch({ apiKey: 'ts_test_key', baseURL: 'https://api.typesearch.test', fetch, maxRetries: 0 }), requests };
}

const usage = {
  inputTokens: { total: 1000, noCache: 1000, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 200, text: 200, reasoning: undefined },
};

/** A model that streams `text` (the structured output) and reports a gateway cost if given. */
export function streamingModel(text: string, cost?: string) {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 't' },
          ...(text.match(/[\s\S]{1,17}/g) ?? []).map((delta) => ({ type: 'text-delta' as const, id: 't', delta })),
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage, ...(cost ? { providerMetadata: { gateway: { cost } } } : {}) },
        ],
      }),
    }),
  });
  return model;
}

export function failingModel(message: string) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error(message);
    },
  });
}

/** Collects the events a run sends. */
export function collector<T extends { type: string }>() {
  const events: T[] = [];
  return { events, send: (e: T) => void events.push(e), types: () => events.map((e) => e.type) };
}
