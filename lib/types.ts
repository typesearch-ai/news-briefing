import type { Mode, Result, SearchOptions } from 'typesearch-js';

/*
 * `countries` and `languages` (and each result's `country` and `language`) are in the API since the
 * remote MCP release. Older SDK builds don't type them yet: these types add them, and stay
 * compatible once the SDK does.
 */
export type GeoSearchOptions = SearchOptions & { countries?: string[]; languages?: string[] };
export type GeoResult = Result & { country?: string | null; language?: string | null };

export type { Mode };

/** A numbered source the model can cite as [n]. */
export interface Article {
  n: number;
  url: string;
  title: string;
  source: string | null;
  published_at: string | null;
  snippet: string | null;
  highlights: string[];
  score: number;
  /** How many outlets carried the story: this one and its duplicates. */
  outlets: number;
  found_in: Result['found_in'];
  country: string | null;
  language: string | null;
}

/** One item of the briefing. `summary` carries [n] markers, all pointing to real sources. */
export interface Story {
  headline: string;
  summary: string;
  citations: number[];
}

export interface BriefingRequest {
  country: string | null;
  language: string;
  topic: string;
  custom: string | null;
  days: number;
  mode: Mode;
}

export interface Cost {
  typesearch_usd: number;
  /** Null when the provider does not report a price (direct OpenAI or Anthropic keys). */
  model_usd: number | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

/** What /api/briefing streams, one JSON object per line. */
export type BriefingEvent =
  | {
      type: 'search';
      query: string;
      mode: Mode;
      /** How many relevant articles exist (can be more than those shown). */
      total: number;
      articles: Article[];
      cost_usd: number | null;
      duration_ms: number;
      cached: boolean;
      warnings: { code: string; message: string }[];
    }
  | { type: 'story'; story: Story }
  | { type: 'empty' }
  | { type: 'cost'; cost: Cost }
  | { type: 'error'; source: 'typesearch' | 'model' | 'input' | 'config'; status?: number; code?: string; message: string; hint?: string }
  | { type: 'done'; ms: number };
