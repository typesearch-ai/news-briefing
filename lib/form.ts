import type { Mode, Pricing } from 'typesearch-js';
import { COUNTRIES, countryName, LANGUAGES } from './options.ts';
import { typesearch } from './typesearch.ts';

/*
 * What the form needs: the countries and languages it offers (fixed, in lib/options.ts) and the list
 * price of each mode, from the API (GET /v1/usage). Prices are never written in this code: they come
 * from the API.
 */

export interface FormData {
  countries: { code: string; name: string }[];
  languages: string[];
  /** USD per request, by mode. Null if the API could not be reached. */
  prices: Record<Mode, number> | null;
}

export function formData(pricing: Pricing | null): FormData {
  const countries = COUNTRIES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const r = pricing?.per_1000_requests;
  return {
    countries,
    languages: [...LANGUAGES],
    prices: r ? { ultra: r.ultra / 1000, fast: r.fast / 1000, normal: r.normal / 1000, deep: r.deep / 1000 } : null,
  };
}

/** The form data; if the API cannot be reached, the prices are left out, never invented. */
export async function loadFormData(): Promise<FormData> {
  const ts = await typesearch();
  const usage = await ts.usage({ timeout: 8000, maxRetries: 1 }).catch(() => null);
  return formData(usage?.pricing ?? null);
}
