import { Output, streamText, type LanguageModel } from 'ai';
import type Typesearch from 'typesearch-js';
import { cleanStory, instructions, MAX_STORIES, prompt, searchOptions, selectArticles, storySchema } from './briefing.ts';
import { gatewayCost } from './model.ts';
import { TOPICS, topicQuery } from './options.ts';
import { explain } from './typesearch.ts';
import type { BriefingEvent, BriefingRequest, GeoResult } from './types.ts';

export interface RunDeps {
  ts: Pick<Typesearch, 'search'>;
  model: LanguageModel;
  modelId: string;
  signal?: AbortSignal;
}

/** The topic's query in the news language, or the custom topic as written. */
export function queryFor(req: BriefingRequest): { query: string; label: string } {
  const custom = req.custom?.trim();
  if (custom) return { query: custom, label: custom };
  const topic = TOPICS.find((t) => t.id === req.topic) ?? TOPICS[0];
  return { query: topicQuery(topic, req.language), label: topic.label };
}

/**
 * One briefing: typesearch finds the articles, the model writes stories citing them. Every step is
 * sent as it happens; errors are events too, never an exception.
 */
export async function runBriefing(req: BriefingRequest, send: (e: BriefingEvent) => void, deps: RunDeps): Promise<void> {
  const started = Date.now();
  const { query, label } = queryFor(req);
  const cost = { typesearch_usd: 0, model_usd: 0 as number | null, model: deps.modelId, input_tokens: 0, output_tokens: 0 };
  const finish = () => {
    send({ type: 'cost', cost });
    send({ type: 'done', ms: Date.now() - started });
  };

  let response;
  try {
    response = await deps.ts.search(query, searchOptions(req), { signal: deps.signal });
  } catch (e) {
    if (deps.signal?.aborted) return;
    send({ type: 'error', source: 'typesearch', ...explain(e) });
    return;
  }

  const articles = selectArticles(response.results as GeoResult[]);
  cost.typesearch_usd = response.usage.cost_usd ?? 0;
  send({
    type: 'search',
    query,
    mode: response.mode,
    total: response.total,
    articles,
    cost_usd: response.usage.cost_usd,
    duration_ms: response.usage.duration_ms,
    cached: response.cached_at !== null,
    warnings: response.warnings,
  });

  if (articles.length === 0) {
    send({ type: 'empty' });
    finish();
    return;
  }

  let modelError: unknown = null;
  let stories = 0;
  try {
    const result = streamText({
      model: deps.model,
      instructions: instructions(req),
      prompt: prompt(req, label, articles),
      output: Output.array({ element: storySchema }),
      reasoning: 'low',
      maxRetries: 1,
      abortSignal: deps.signal,
      timeout: { totalMs: 90_000 },
      onError: ({ error }) => {
        modelError = error;
      },
    });
    for await (const element of result.elementStream) {
      if (stories >= MAX_STORIES) break;
      const story = cleanStory(element, articles);
      if (!story) continue;
      stories += 1;
      send({ type: 'story', story });
    }
    if (!modelError) {
      const [usage, steps] = await Promise.all([result.totalUsage, result.steps]);
      cost.input_tokens = usage.inputTokens ?? 0;
      cost.output_tokens = usage.outputTokens ?? 0;
      const prices = steps.map((s) => gatewayCost(s.providerMetadata));
      cost.model_usd = prices.every((p) => p === null) ? null : prices.reduce<number>((a, p) => a + (p ?? 0), 0);
    }
  } catch (e) {
    modelError ??= e;
  }
  if (deps.signal?.aborted) return;

  if (modelError) {
    cost.model_usd = null;
    send({ type: 'error', source: 'model', ...modelMessage(modelError, deps.modelId) });
  } else if (stories === 0) {
    send({ type: 'error', source: 'model', message: 'The model did not write any story citing the sources.', hint: 'Try again, or another MODEL.' });
  }
  finish();
}

function modelMessage(e: unknown, modelId: string): { message: string; hint?: string } {
  const message = e instanceof Error ? e.message : String(e);
  if (/api key|unauthori[sz]ed|authentication|oidc/i.test(message)) {
    return { message: `The model (${modelId}) rejected the credentials.`, hint: 'Check AI_GATEWAY_API_KEY, or OPENAI_API_KEY / ANTHROPIC_API_KEY.' };
  }
  if (/not found|does not exist|unknown model/i.test(message)) {
    return { message: `Model ${modelId} is not available.`, hint: 'Set MODEL to a provider/model id your account can use.' };
  }
  return { message: `The model failed: ${message}` };
}
