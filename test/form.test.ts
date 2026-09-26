import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchOptions } from '../lib/briefing.ts';
import { formData, loadFormData } from '../lib/form.ts';
import { mainLanguage } from '../lib/options.ts';
import { PRICING } from '../lib/sample.ts';
import { assertSchema } from './contract.ts';

test('the form offers fixed countries, by name, and languages, the translated ones first', () => {
  const f = formData(PRICING);
  assert.ok(f.countries.length > 20);
  assert.ok(f.countries.every((c) => /^[A-Z]{2}$/.test(c.code) && c.name !== c.code), 'every code has an English name');
  const names = f.countries.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')));
  assert.deepEqual(f.languages.slice(0, 6), ['en', 'es', 'pt', 'fr', 'de', 'it']);
  assert.equal(new Set(f.languages).size, f.languages.length);
  for (const c of f.countries) assert.ok(f.languages.includes(mainLanguage(c.code)), `${c.code}: its main language is offered`);
});

test('every country the form offers, with its main language, is a valid search for the API', () => {
  for (const { code } of formData(null).countries) {
    const o = searchOptions({ country: code, language: mainLanguage(code), topic: 'economy', custom: null, days: 1, mode: 'fast' });
    assertSchema('SearchRequest', { query: 'economía', ...o });
  }
});

test('prices come from the API, and are left out when it cannot be reached', async () => {
  assert.deepEqual(formData(PRICING).prices, {
    ultra: PRICING.per_1000_requests.ultra / 1000,
    fast: PRICING.per_1000_requests.fast / 1000,
    normal: PRICING.per_1000_requests.normal / 1000,
    deep: PRICING.per_1000_requests.deep / 1000,
  });
  assert.equal(formData(null).prices, null);

  process.env.DEMO_MOCK = '1';
  const f = await loadFormData();
  assert.equal(f.prices?.fast, PRICING.per_1000_requests.fast / 1000);
});
