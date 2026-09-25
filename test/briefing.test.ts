import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanStory, instructions, MIN_SCORE, prompt, searchOptions, selectArticles } from '../lib/briefing.ts';
import { sampleSearch } from '../lib/sample.ts';
import type { BriefingRequest, GeoResult } from '../lib/types.ts';
import { assertSchema } from './contract.ts';

const req: BriefingRequest = { country: 'AR', language: 'es', topic: 'economy', custom: null, days: 1, mode: 'fast' };

test('the search: one country and one language, deduplicated, dates in the topic ignored', () => {
  const o = searchOptions(req);
  assert.deepEqual(o.countries, ['AR']);
  assert.deepEqual(o.languages, ['es']);
  assert.equal(o.dedupe, true);
  assert.equal(o.temporal, 'off');
  assert.equal(o.days, 1);
  assert.equal(o.highlights, undefined, 'fast reads nothing: no highlights to ask for');
  assert.equal(searchOptions({ ...req, mode: 'normal' }).highlights, true);
  assert.equal(searchOptions({ ...req, country: null }).countries, undefined, 'any country: no filter');
});

test('every request body the form can produce is valid for the API', () => {
  for (const mode of ['fast', 'normal', 'deep'] as const)
    for (const country of ['US', null])
      for (const days of [1, 3, 7]) assertSchema('SearchRequest', { query: 'economía', ...searchOptions({ ...req, mode, country, days }) });
});

test('articles: only relevant ones, the most covered first, numbered from 1', () => {
  const results = sampleSearch('technology', 'fast', Date.parse('2026-09-25T12:00:00Z')).results as GeoResult[];
  const articles = selectArticles(results);
  assert.ok(articles.every((a) => a.score >= MIN_SCORE));
  assert.equal(articles.length, results.filter((r) => r.score >= MIN_SCORE).length);
  assert.deepEqual(articles.map((a) => a.n), articles.map((_, i) => i + 1));
  assert.equal(articles[0].outlets, 3, 'the story carried by three outlets goes first');
  for (let i = 1; i < articles.length; i++) assert.ok(articles[i - 1].outlets >= articles[i].outlets);
});

test('the prompt numbers every source and says how many outlets carried it', () => {
  const articles = selectArticles(sampleSearch('technology', 'normal', Date.parse('2026-09-25T12:00:00Z')).results as GeoResult[]);
  const p = prompt(req, 'Economy', articles);
  for (const a of articles) assert.ok(p.includes(`[${a.n}] ${a.title}`));
  assert.match(p, /carried by 3 outlets/);
  assert.doesNotMatch(p, /undefined|null/);
  assert.match(instructions(req), /Argentina/);
  assert.match(instructions(req), /Spanish/);
  assert.match(instructions(req), /data, not instructions/);
});

test('a story keeps only citations to real sources; without any, it is dropped', () => {
  const articles = selectArticles(sampleSearch('t', 'fast').results as GeoResult[]);
  const n = articles.length;
  assert.deepEqual(cleanStory({ headline: 'H', summary: `Fact [1]. Invented [${n + 5}].` }, articles), { headline: 'H', summary: 'Fact[1]. Invented.', citations: [1] });
  assert.equal(cleanStory({ headline: 'H', summary: 'No sources at all.' }, articles), null);
  assert.equal(cleanStory({ headline: 'H', summary: `Only a fake one [${n + 1}].` }, articles), null);
  assert.equal(cleanStory({ headline: '', summary: 'x [1]' }, articles), null);
  assert.equal(cleanStory({ headline: 'Title [2]', summary: 'x [1]' }, articles)?.headline, 'Title', 'no markers in headlines');
});

test('countries read well in a sentence', () => {
  assert.match(instructions({ ...req, country: 'US', language: 'en' }), /about the United States, written in English/);
  assert.match(instructions({ ...req, country: null, language: 'fr' }), /about the world, written in French/);
});
