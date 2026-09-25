import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runBriefing } from '../lib/run.ts';
import { emptySearch, SAMPLE_STORIES, sampleSearch } from '../lib/sample.ts';
import type { BriefingEvent, BriefingRequest } from '../lib/types.ts';
import { collector, failingModel, fakeTypesearch, streamingModel } from './helpers.ts';

const req: BriefingRequest = { country: 'US', language: 'en', topic: 'technology', custom: null, days: 1, mode: 'fast' };
const output = JSON.stringify({ elements: SAMPLE_STORIES });

test('a briefing: the search, each story as it is written, the cost and the end', async () => {
  const { ts, requests } = fakeTypesearch((_, body) => ({ body: sampleSearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  await runBriefing(req, c.send, { ts, model: streamingModel(output, '0.00042'), modelId: 'openai/gpt-6-luna' });

  assert.deepEqual(c.types(), ['search', ...SAMPLE_STORIES.map(() => 'story'), 'cost', 'done']);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.query, 'technology');
  assert.deepEqual(requests[0].body.countries, ['US']);

  const search = c.events[0] as Extract<BriefingEvent, { type: 'search' }>;
  assert.equal(search.articles.length, 8, 'the weather article (score 0.12) is left out');
  const stories = c.events.filter((e) => e.type === 'story').map((e) => (e as Extract<BriefingEvent, { type: 'story' }>).story);
  assert.ok(stories.every((s) => s.citations.length > 0 && s.citations.every((n) => n >= 1 && n <= search.articles.length)));

  const { cost } = c.events.at(-2) as Extract<BriefingEvent, { type: 'cost' }>;
  assert.equal(cost.typesearch_usd, 0.0014);
  assert.equal(cost.model_usd, 0.00042);
  assert.equal(cost.input_tokens, 1000);
  assert.equal(cost.output_tokens, 200);
});

test('a custom topic is sent as written', async () => {
  const { ts, requests } = fakeTypesearch((_, body) => ({ body: sampleSearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  await runBriefing({ ...req, custom: '  la inflación hoy ' }, c.send, { ts, model: streamingModel(output), modelId: 'm' });
  assert.equal(requests[0].body.query, 'la inflación hoy');
  assert.equal(requests[0].body.temporal, 'off');
});

test('stories that cite nothing real never reach the page', async () => {
  const { ts } = fakeTypesearch((_, body) => ({ body: sampleSearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  const text = JSON.stringify({ elements: [{ headline: 'Made up', summary: 'Nothing to cite [99].' }, { headline: 'Real', summary: 'A fact [2].' }] });
  await runBriefing(req, c.send, { ts, model: streamingModel(text), modelId: 'm' });
  const stories = c.events.filter((e) => e.type === 'story');
  assert.equal(stories.length, 1);
  assert.equal((stories[0] as Extract<BriefingEvent, { type: 'story' }>).story.headline, 'Real');
});

test('nothing found: an empty event and no model call', async () => {
  const { ts } = fakeTypesearch((_, body) => ({ body: emptySearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  let called = false;
  const model = streamingModel(output);
  const original = model.doStream.bind(model);
  model.doStream = async (o) => {
    called = true;
    return original(o);
  };
  await runBriefing(req, c.send, { ts, model, modelId: 'm' });
  assert.deepEqual(c.types(), ['search', 'empty', 'cost', 'done']);
  assert.equal(called, false);
  const { cost } = c.events[2] as Extract<BriefingEvent, { type: 'cost' }>;
  assert.equal(cost.model_usd, 0);
});

test('a typesearch error is an event with a hint, and nothing else runs', async () => {
  const { ts } = fakeTypesearch(() => ({
    status: 402,
    body: { type: 'about:blank', title: 'Insufficient credits', status: 402, detail: 'No credit left.', code: 'insufficient_credits', request_id: 'req_x' },
  }));
  const c = collector<BriefingEvent>();
  await runBriefing(req, c.send, { ts, model: streamingModel(output), modelId: 'm' });
  assert.deepEqual(c.types(), ['error']);
  const e = c.events[0] as Extract<BriefingEvent, { type: 'error' }>;
  assert.equal(e.source, 'typesearch');
  assert.equal(e.status, 402);
  assert.equal(e.code, 'insufficient_credits');
  assert.match(e.hint ?? '', /credit/);
});

test('a model error is an event too, after the search, with the typesearch cost', async () => {
  const { ts } = fakeTypesearch((_, body) => ({ body: sampleSearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  await runBriefing(req, c.send, { ts, model: failingModel('Invalid API key provided'), modelId: 'openai/gpt-6-luna' });
  assert.deepEqual(c.types(), ['search', 'error', 'cost', 'done']);
  const e = c.events[1] as Extract<BriefingEvent, { type: 'error' }>;
  assert.equal(e.source, 'model');
  assert.match(e.message, /credentials/);
  const { cost } = c.events[2] as Extract<BriefingEvent, { type: 'cost' }>;
  assert.equal(cost.typesearch_usd, 0.0014);
  assert.equal(cost.model_usd, null);
});

test('without a gateway price the model cost is unknown, not zero', async () => {
  const { ts } = fakeTypesearch((_, body) => ({ body: sampleSearch(body.query, body.mode) }));
  const c = collector<BriefingEvent>();
  await runBriefing(req, c.send, { ts, model: streamingModel(output), modelId: 'openai/gpt-6-luna' });
  const { cost } = c.events.find((e) => e.type === 'cost') as Extract<BriefingEvent, { type: 'cost' }>;
  assert.equal(cost.model_usd, null);
});
