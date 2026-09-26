/*
 * Sample data for DEMO_MOCK=1 and the tests. Everything here is fictional: the outlets use the
 * reserved .example domain and the companies are made-up names. It is shaped exactly like the API's
 * responses (test/contract.test.ts validates it against the OpenAPI document).
 */
import type { SearchResponse, Usage } from 'typesearch-js';
import type { GeoResult } from './types.ts';

const minutesAgo = (now: number, m: number) => new Date(now - m * 60_000).toISOString().replace(/\.\d{3}Z$/, '.000Z');

type SampleArticle = {
  path: string;
  title: string;
  source: [string, string];
  minutes: number;
  snippet: string;
  score: number;
  highlight?: string;
  also?: [string, string][];
};

const WIRE: [string, string] = ['Example Wire', 'examplewire.example'];
const POST: [string, string] = ['The Example Post', 'examplepost.example'];
const TECH: [string, string] = ['Tech Example Daily', 'techexample.example'];
const HERALD: [string, string] = ['Example Herald', 'exampleherald.example'];

const ARTICLES: SampleArticle[] = [
  {
    path: 'tech/contoso-nine-minute-battery',
    title: 'Contoso unveils a battery that charges an electric car in nine minutes',
    source: WIRE,
    minutes: 95,
    snippet: 'The company says the cell, built with a silicon anode, will reach its first cars in 2028 after safety certification.',
    score: 0.97,
    highlight: 'Contoso expects the first cars with the new cell on sale in 2028, once regulators certify it.',
    also: [POST, TECH],
  },
  {
    path: 'business/fabrikam-outage-inquiry',
    title: "Regulator opens an inquiry into the Fabrikam cloud outage that took down payment apps",
    source: POST,
    minutes: 210,
    snippet: 'The outage lasted four hours on Wednesday and affected banks and retailers across the country, the agency said.',
    score: 0.94,
    highlight: 'The agency said it will publish its first findings within 60 days.',
    also: [WIRE],
  },
  {
    path: 'startups/northwind-robotics-series-c',
    title: 'Northwind Robotics raises $120 million to build warehouse robots',
    source: TECH,
    minutes: 340,
    snippet: 'The round was led by existing investors; the startup plans to double its engineering team in Springfield.',
    score: 0.95,
    also: [WIRE],
  },
  {
    path: 'finance/woodgrove-passkeys',
    title: 'Woodgrove Bank will let customers pay with passkeys instead of card numbers',
    source: WIRE,
    minutes: 150,
    snippet: 'The bank said the feature reaches all customers by December, and that card numbers will stay available.',
    score: 0.9,
  },
  {
    path: 'ai/proseware-open-model',
    title: 'Proseware releases an open model small enough to run on a laptop',
    source: TECH,
    minutes: 60,
    snippet: 'The model is free for commercial use and was trained on licensed text, the company said.',
    score: 0.92,
  },
  {
    path: 'markets/litware-supply-delays',
    title: 'Chip supplier Litware warns of delays for smartphone makers',
    source: POST,
    minutes: 420,
    snippet: "Litware said a fire at a supplier's plant would push some deliveries back by up to six weeks.",
    score: 0.88,
  },
  {
    path: 'local/springfield-self-driving-buses',
    title: 'Springfield starts testing self-driving buses on two routes',
    source: HERALD,
    minutes: 520,
    snippet: 'The buses carry a safety driver during the six-month trial, the city said.',
    score: 0.81,
  },
  {
    path: 'gadgets/adventure-works-vr-price',
    title: 'Adventure Works cuts the price of its VR headset by a third',
    source: HERALD,
    minutes: 700,
    snippet: 'The company said sales were below plan and a new model is due next year.',
    score: 0.77,
  },
  {
    path: 'weather/weekend',
    title: 'Weekend weather: sunny, with light winds',
    source: HERALD,
    minutes: 45,
    snippet: 'Temperatures stay mild through Sunday.',
    score: 0.12,
  },
];

function result(a: SampleArticle, now: number, mode: string): GeoResult {
  const read = mode !== 'fast' && mode !== 'ultra';
  return {
    url: `https://${a.source[1]}/${a.path}`,
    title: a.title,
    source: a.source[0],
    country: 'US',
    language: 'en',
    published_at: minutesAgo(now, a.minutes),
    section: a.path.split('/')[0],
    snippet: a.snippet,
    score: a.score,
    headline_relevance: Math.max(0.05, a.score - 0.04),
    read: read && a.score > 0.5 ? { probability: a.score, centrality: 3 } : null,
    highlights: read && a.highlight ? [a.highlight] : [],
    tone: null,
    answers: null,
    duplicates: (a.also ?? []).map(([name, domain]) => ({ url: `https://${domain}/${a.path}`, title: a.title, source: name })),
    date_match: null,
    referenced_date: null,
    found_in: 'index',
  };
}

export const PRICING: Usage['pricing'] = {
  currency: 'USD',
  per_1000_requests: { ultra: 1, fast: 1.4, normal: 2.2, deep: 5.6, similar: 2.2, similar_deep: 4.6, site_search: 2.4 },
  per_1000_pages: { contents: 0.2, contents_with_query: 0.4 },
};

export function sampleSearch(query: string, mode: SearchResponse['mode'], now = Date.now()): SearchResponse {
  const results = ARTICLES.map((a) => result(a, now, mode));
  const relevant = results.filter((r) => r.score >= 0.5);
  return {
    id: 'req_sample_briefing',
    object: 'search',
    mode,
    queries: [query],
    found: true,
    total: relevant.length,
    results,
    groups: null,
    near_misses: [],
    rejected: [],
    diffusion: null,
    tone: null,
    essential: null,
    reference: null,
    temporal: null,
    site: null,
    index: null,
    usage: {
      tokens: 2310,
      calls: 2,
      cost_usd: PRICING.per_1000_requests[mode] / 1000,
      headlines: 160,
      from_memory: 40,
      pages_direct: mode === 'fast' || mode === 'ultra' ? 0 : 4,
      pages_browser: 0,
      duration_ms: mode === 'deep' ? 8400 : mode === 'normal' ? 3100 : 1300,
    },
    budget: null,
    discovery: { status: 'skipped', sites: 0, ms: 0 },
    incomplete: false,
    cached_at: null,
    warnings: [],
  };
}

export function emptySearch(query: string, mode: SearchResponse['mode'], now = Date.now()): SearchResponse {
  return { ...sampleSearch(query, mode, now), id: 'req_sample_empty', found: false, total: 0, results: [], discovery: { status: 'used', sites: 3, ms: 2400 } };
}

export const SAMPLE_USAGE: Usage = {
  object: 'usage',
  key: { id: 'key_sample', name: 'Sample key' },
  limits: { tokens_per_day: 2_000_000, requests_per_minute: 600, requests_per_second: 10 },
  today: { requests: 12, tokens: 30_000, cost_usd: 0.02, remaining_tokens: 1_970_000 },
  last_30_days: { requests: 240, tokens: 610_000, cost_usd: 0.41 },
  credit: { balance_usd: 4.59, plan: 'payg', spent_this_month_usd: 0.41, monthly_limit_usd: null },
  pricing: PRICING,
};

/** What the sample model writes for the sample articles, numbered as selectArticles() numbers them. */
export const SAMPLE_STORIES = [
  {
    headline: 'Contoso says its new battery charges an electric car in nine minutes',
    summary:
      'Contoso unveiled a battery cell with a silicon anode that it says can charge an electric car in nine minutes [1]. The first cars using it are expected in 2028, once the cell passes safety certification [1].',
  },
  {
    headline: 'Regulator investigates the Fabrikam cloud outage',
    summary:
      "A regulator opened an inquiry into Wednesday's four-hour outage of Fabrikam's cloud [3]. The failure took down payment apps of banks and retailers across the country [3].",
  },
  {
    headline: 'Northwind Robotics raises $120 million for warehouse robots',
    summary:
      'Northwind Robotics raised $120 million in a round led by its existing investors [2]. The startup plans to double its engineering team in Springfield [2].',
  },
  {
    headline: 'Woodgrove Bank customers will pay with passkeys',
    summary:
      'Woodgrove Bank will let customers pay with passkeys instead of card numbers, which will remain available [5]. The feature reaches every customer by December [5].',
  },
  {
    headline: 'Proseware releases an open model that runs on a laptop',
    summary: 'Proseware released a model small enough to run on a laptop and free for commercial use [4]. The company said it was trained on licensed text [4].',
  },
  {
    headline: 'Litware warns of chip delays after a fire at a supplier',
    summary: "Litware warned smartphone makers that some deliveries could slip by up to six weeks after a fire at a supplier's plant [6].",
  },
];
