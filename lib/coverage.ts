import type { Mode, Pricing } from 'typesearch-js';
import { countryName } from './options.ts';
import { typesearch } from './typesearch.ts';

/*
 * What the form needs from the API: the countries and languages the index covers (GET /v1/sources,
 * aggregate counts only) and the list price of each mode (GET /v1/usage). Prices are never written
 * in this code: they come from the API.
 */

export interface FormData {
  countries: { code: string; name: string }[];
  languages: string[];
  /** USD per request, by mode. Null if the API could not be reached. */
  prices: Record<Mode, number> | null;
}

const FALLBACK_LANGUAGES = ['en', 'es', 'pt', 'fr', 'de', 'it'];

export function fromApi(sources: { by_country: { country: string | null; sources: number }[]; by_language: { language: string }[] } | null, pricing: Pricing | null): FormData {
  const countries = (sources?.by_country ?? [])
    .filter((c): c is { country: string; sources: number } => typeof c.country === 'string' && /^[A-Z]{2}$/.test(c.country) && c.sources > 0)
    .map((c) => ({ code: c.country, name: countryName(c.country) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const languages = [...new Set((sources?.by_language ?? []).map((l) => l.language).filter((l) => /^[a-z]{2}$/.test(l)))];
  const r = pricing?.per_1000_requests;
  return {
    countries,
    languages: languages.length ? languages : FALLBACK_LANGUAGES,
    prices: r ? { ultra: r.ultra / 1000, fast: r.fast / 1000, normal: r.normal / 1000, deep: r.deep / 1000 } : null,
  };
}

/** The form data, from the API; whatever fails is left out, never invented. */
export async function loadFormData(): Promise<FormData> {
  const ts = await typesearch();
  const [sources, usage] = await Promise.allSettled([ts.sources({}, { timeout: 8000, maxRetries: 1 }), ts.usage({ timeout: 8000, maxRetries: 1 })]);
  return fromApi(sources.status === 'fulfilled' ? sources.value : null, usage.status === 'fulfilled' ? usage.value.pricing : null);
}
