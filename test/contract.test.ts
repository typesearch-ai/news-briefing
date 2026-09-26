import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptySearch, PRICING, SAMPLE_USAGE, sampleSearch } from '../lib/sample.ts';
import { assertSchema, openapi } from './contract.ts';

test('the sample data has exactly the shape of the API responses', () => {
  for (const mode of ['ultra', 'fast', 'normal', 'deep'] as const) {
    assertSchema('SearchResponse', sampleSearch('technology', mode));
    assertSchema('SearchResponse', emptySearch('sports', mode));
  }
  assertSchema('Usage', SAMPLE_USAGE);
});

test('the sample prices are the API list prices (x-pricing in the OpenAPI)', () => {
  assert.deepEqual(PRICING, openapi['x-pricing']);
});

test('sample outlets are fictional: only .example domains', () => {
  const r = sampleSearch('t', 'deep');
  const urls = [...r.results.map((x) => x.url), ...r.results.flatMap((x) => x.duplicates.map((d) => d.url))];
  assert.ok(urls.every((u) => new URL(u).hostname.endsWith('.example')), urls.join('\n'));
});
