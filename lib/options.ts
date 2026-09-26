/*
 * What the form offers: topics (with the query to send in each language), countries, languages, time
 * windows and the default language of each country. The API filters by any ISO code: a country or a
 * language with little news gives the empty state, which suggests a wider search.
 */

export type LanguageCode = string; // ISO 639-1
export type CountryCode = string; // ISO 3166-1 alpha-2

/** Languages we have topic translations for. Other languages use the English query. */
export const TRANSLATED = ['en', 'es', 'pt', 'fr', 'de', 'it'] as const;
type Translated = (typeof TRANSLATED)[number];

export interface Topic {
  id: string;
  label: string;
  /** The query sent to typesearch, in the language of the news. */
  query: Record<Translated, string>;
}

export const TOPICS: Topic[] = [
  {
    id: 'politics',
    label: 'Politics',
    query: { en: 'politics and government', es: 'política y gobierno', pt: 'política e governo', fr: 'politique et gouvernement', de: 'Politik und Regierung', it: 'politica e governo' },
  },
  {
    id: 'economy',
    label: 'Economy',
    query: { en: 'economy', es: 'economía', pt: 'economia', fr: 'économie', de: 'Wirtschaft', it: 'economia' },
  },
  {
    id: 'business',
    label: 'Business',
    query: { en: 'companies and business', es: 'empresas y negocios', pt: 'empresas e negócios', fr: 'entreprises', de: 'Unternehmen', it: 'aziende e imprese' },
  },
  {
    id: 'technology',
    label: 'Technology',
    query: { en: 'technology', es: 'tecnología', pt: 'tecnologia', fr: 'technologie', de: 'Technologie', it: 'tecnologia' },
  },
  {
    id: 'science',
    label: 'Science',
    query: { en: 'science and research', es: 'ciencia e investigación', pt: 'ciência e pesquisa', fr: 'science et recherche', de: 'Wissenschaft und Forschung', it: 'scienza e ricerca' },
  },
  {
    id: 'health',
    label: 'Health',
    query: { en: 'health', es: 'salud', pt: 'saúde', fr: 'santé', de: 'Gesundheit', it: 'salute' },
  },
  {
    id: 'climate',
    label: 'Climate',
    query: { en: 'climate and environment', es: 'clima y medio ambiente', pt: 'clima e meio ambiente', fr: 'climat et environnement', de: 'Klima und Umwelt', it: 'clima e ambiente' },
  },
  {
    id: 'sports',
    label: 'Sports',
    query: { en: 'sports', es: 'deportes', pt: 'esportes', fr: 'sport', de: 'Sport', it: 'sport' },
  },
  {
    id: 'culture',
    label: 'Culture',
    query: { en: 'culture and the arts', es: 'cultura y espectáculos', pt: 'cultura e artes', fr: 'culture', de: 'Kultur', it: 'cultura e spettacoli' },
  },
];

export const DEFAULT_TOPIC = 'economy';

/** The query for a topic in a language: its translation, or the English one. */
export function topicQuery(topic: Topic, language: LanguageCode): string {
  return (TRANSLATED as readonly string[]).includes(language) ? topic.query[language as Translated] : topic.query.en;
}

/** How far back to look, in days (the API's `days`). */
export const WINDOWS = [
  { days: 1, label: '24 hours' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
] as const;
export type WindowDays = (typeof WINDOWS)[number]['days'];

/** The language most of a country's news is in, for the form's default. */
const MAIN_LANGUAGE: Record<string, LanguageCode> = {
  AR: 'es', BO: 'es', CL: 'es', CO: 'es', CR: 'es', CU: 'es', DO: 'es', EC: 'es', ES: 'es', GT: 'es', HN: 'es',
  MX: 'es', NI: 'es', PA: 'es', PE: 'es', PR: 'es', PY: 'es', SV: 'es', UY: 'es', VE: 'es',
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
  US: 'en', GB: 'en', IE: 'en', CA: 'en', AU: 'en', NZ: 'en', IN: 'en', ZA: 'en', NG: 'en', KE: 'en', SG: 'en', PH: 'en',
  FR: 'fr', BE: 'fr', SN: 'fr', CI: 'fr', MA: 'fr',
  DE: 'de', AT: 'de', CH: 'de',
  IT: 'it',
  NL: 'nl', PL: 'pl', SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', CZ: 'cs', GR: 'el', TR: 'tr', RO: 'ro', HU: 'hu', UA: 'uk',
  RU: 'ru', JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh', IL: 'he', SA: 'ar', AE: 'ar', EG: 'ar', ID: 'id', VN: 'vi', TH: 'th',
};

/** The countries the form offers: those with a default language above. */
export const COUNTRIES: CountryCode[] = Object.keys(MAIN_LANGUAGE);

/** The languages the form offers: the ones with topic translations first, then the rest. */
export const LANGUAGES: LanguageCode[] = [...new Set<LanguageCode>([...TRANSLATED, ...Object.values(MAIN_LANGUAGE)])];

export function mainLanguage(country: CountryCode | null): LanguageCode {
  return (country && MAIN_LANGUAGE[country]) || 'en';
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
const languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' });

export const countryName = (code: CountryCode): string => regionNames.of(code) ?? code;

/** Countries whose English name takes «the»: «in the United States». */
const WITH_THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'DO', 'BS', 'GM', 'CF', 'KY', 'VA', 'MV', 'SC']);

/** The country as it goes in a sentence: «the United States», «Argentina». */
export const placeName = (code: CountryCode): string => (WITH_THE.has(code) ? `the ${countryName(code)}` : countryName(code));
export const languageName = (code: LanguageCode): string => languageNames.of(code) ?? code;

/** The flag of a country, from its two letters (regional indicator symbols). */
export function flag(code: CountryCode): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
