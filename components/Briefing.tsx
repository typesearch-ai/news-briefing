'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormData } from '@/lib/form';
import { ago, compact, hostOf, seconds, usd } from '@/lib/format';
import { pieces } from '@/lib/citations';
import { readNdjson } from '@/lib/ndjson';
import { countryName, DEFAULT_TOPIC, flag, languageName, mainLanguage, placeName, TOPICS, WINDOWS } from '@/lib/options';
import type { Article, BriefingEvent, BriefingRequest, Cost, Mode, Story } from '@/lib/types';
import { Alert, ArrowUpRight, Check, Pulse } from './ui';

type SearchEvent = Extract<BriefingEvent, { type: 'search' }>;
type ErrorEvent = Extract<BriefingEvent, { type: 'error' }>;
type Status = 'idle' | 'searching' | 'writing' | 'done' | 'empty' | 'error';

interface Run {
  status: Status;
  request: BriefingRequest | null;
  search: SearchEvent | null;
  stories: Story[];
  cost: Cost | null;
  error: ErrorEvent | null;
  ms: number | null;
}

const IDLE: Run = { status: 'idle', request: null, search: null, stories: [], cost: null, error: null, ms: null };

const MODES: { id: Exclude<Mode, 'ultra'>; label: string; text: string }[] = [
  { id: 'fast', label: 'Fast', text: 'Headlines and standfirsts. Enough for a briefing.' },
  { id: 'normal', label: 'Normal', text: 'Also reads the best articles and quotes them.' },
  { id: 'deep', label: 'Deep', text: 'Other wordings, more articles, sites beyond the index.' },
];

const QUICK = [
  { country: 'AR', topic: 'economy' },
  { country: 'BR', topic: 'technology' },
  { country: 'US', topic: 'science' },
  { country: 'ES', topic: 'politics' },
];

export function Briefing({ form, model, mock }: { form: FormData; model: string; mock: boolean }) {
  const countries = form.countries;
  const firstCountry = countries.find((c) => c.code === 'US')?.code ?? countries[0]?.code ?? null;
  const [country, setCountry] = useState<string | null>(firstCountry);
  const [language, setLanguage] = useState(() => pickLanguage(firstCountry, form.languages));
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [custom, setCustom] = useState('');
  const [days, setDays] = useState<number>(1);
  const [mode, setMode] = useState<Exclude<Mode, 'ultra'>>('fast');
  const [run, setRun] = useState<Run>(IDLE);
  const [active, setActive] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = run.status === 'searching' || run.status === 'writing';

  const start = useCallback(async (req: BriefingRequest) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setActive(null);
    setRun({ ...IDLE, status: 'searching', request: req });
    const update = (fn: (r: Run) => Run) => {
      if (!ac.signal.aborted) setRun(fn);
    };
    try {
      const res = await fetch('/api/briefing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ac.signal });
      if (!res.ok || !res.body) throw new Error(`The server answered ${res.status}.`);
      await readNdjson<BriefingEvent>(res.body, (e) => {
        update((r) => {
          switch (e.type) {
            case 'search':
              return { ...r, search: e, status: e.articles.length ? 'writing' : r.status };
            case 'story':
              return { ...r, stories: [...r.stories, e.story] };
            case 'empty':
              return { ...r, status: 'empty' };
            case 'cost':
              return { ...r, cost: e.cost };
            case 'error':
              return { ...r, status: 'error', error: e };
            case 'done':
              return { ...r, ms: e.ms, status: r.status === 'error' || r.status === 'empty' ? r.status : 'done' };
          }
        });
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      update((r) => ({ ...r, status: 'error', error: { type: 'error', source: 'config', message: err instanceof Error ? err.message : String(err), hint: 'Check that the server is running.' } }));
    }
  }, []);

  const request = (over: Partial<BriefingRequest> = {}): BriefingRequest => ({
    country,
    language,
    topic,
    custom: custom.trim() || null,
    days,
    mode,
    ...over,
  });

  const submit = () => {
    if (!busy) void start(request());
  };

  useEffect(() => () => controller.current?.abort(), []);

  const chooseCountry = (code: string | null) => {
    setCountry(code);
    setLanguage(pickLanguage(code, form.languages));
  };

  const quick = QUICK.filter((q) => countries.some((c) => c.code === q.country)).slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[372px_minmax(0,1fr)] lg:items-start">
      {/* The form */}
      <form
        className="card p-5 lg:sticky lg:top-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className="grid grid-cols-[1.35fr_1fr] gap-3">
          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <select id="country" className="field" value={country ?? ''} onChange={(e) => chooseCountry(e.target.value || null)}>
              <option value="">🌐 Any country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {flag(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">
              Language
            </label>
            <select id="language" className="field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {form.languages.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="label">Topic</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={!custom.trim() && topic === t.id}
                onClick={() => {
                  setTopic(t.id);
                  setCustom('');
                }}
                className="chip justify-center"
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="field mt-2"
            value={custom}
            maxLength={120}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`Or your own topic, in ${languageName(language)}…`}
            aria-label="Your own topic"
          />
        </fieldset>

        <fieldset className="mt-5">
          <legend className="label">Published in the last</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-[6px] bg-sand p-0.5">
            {WINDOWS.map((w) => (
              <button key={w.days} type="button" role="radio" aria-checked={days === w.days} onClick={() => setDays(w.days)} className="chip h-8 justify-center bg-transparent">
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="label">Search mode</legend>
          <div role="radiogroup" className="grid gap-1.5">
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.id)}
                  className={`flex items-start justify-between gap-3 rounded-[6px] px-3 py-2.5 text-left transition-shadow ${
                    on ? 'bg-white shadow-[0_0_0_1.5px_var(--color-ink)]' : 'bg-white shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-line-strong)]'
                  }`}
                >
                  <span>
                    <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                      {m.label}
                      {m.id === 'fast' ? <span className="rounded-[3px] bg-good-soft px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider text-good">Recommended</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{m.text}</span>
                  </span>
                  {form.prices ? (
                    <span className="shrink-0 pt-0.5 font-mono text-[11.5px] text-ink-2" title="typesearch list price per search, from the API">
                      {usd(form.prices[m.id])}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
          {busy ? (
            <>
              <Pulse /> Writing…
            </>
          ) : (
            'Write the briefing'
          )}
        </button>
        <p className="mt-2.5 text-center text-[11.5px] leading-snug text-faint">
          Prices are typesearch&rsquo;s, per search. The model ({model}) is billed by its provider.
        </p>
      </form>

      {/* The briefing */}
      <section aria-live="polite" className="min-w-0">
        {run.status === 'idle' ? (
          <Idle
            quick={quick}
            onQuick={(q) => {
              chooseCountry(q.country);
              setTopic(q.topic);
              setCustom('');
              void start(request({ country: q.country, language: pickLanguage(q.country, form.languages), topic: q.topic, custom: null }));
            }}
          />
        ) : (
          <Result run={run} active={active} setActive={setActive} onRetry={(over) => void start({ ...(run.request as BriefingRequest), ...over })} />
        )}
        {mock ? (
          <p className="mt-3 text-[11.5px] text-faint">
            <span className="mr-1.5 rounded-[3px] bg-sand px-1 py-px font-mono text-[9.5px] uppercase tracking-wider text-muted">Sample</span>
            Demo mode: fictional outlets and stories, no API calls. Pick Sports for the empty state, or write «error» as the topic.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function pickLanguage(country: string | null, languages: string[]): string {
  const main = mainLanguage(country);
  return languages.includes(main) ? main : languages.includes('en') ? 'en' : (languages[0] ?? 'en');
}

function Idle({ quick, onQuick }: { quick: { country: string; topic: string }[]; onQuick: (q: { country: string; topic: string }) => void }) {
  return (
    <div className="card dots relative overflow-hidden p-6 sm:p-8">
      <div className="relative max-w-[520px]">
        <p className="eyebrow">Your briefing</p>
        <h2 className="display mt-3 text-[30px] text-ink sm:text-[34px]">
          Pick a place and a topic. <em>We&rsquo;ll bring the sources.</em>
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          typesearch finds the articles published in that country and language; a model writes the stories and cites every sentence. You see
          what each briefing cost.
        </p>
        {quick.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button key={q.country + q.topic} type="button" onClick={() => onQuick(q)} className="chip h-9 bg-white px-3 shadow-[0_0_0_1px_var(--color-line)]">
                {flag(q.country)} {TOPICS.find((t) => t.id === q.topic)?.label} · {countryName(q.country)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="relative mt-8 grid gap-3" aria-hidden>
        {[0.92, 0.78, 0.64].map((w, i) => (
          <div key={i} className="rounded-[6px] border border-line bg-white/90 p-4">
            <div className="h-3.5 rounded-[3px] bg-sand-2" style={{ width: `${w * 70}%` }} />
            <div className="mt-3 h-2.5 rounded-[3px] bg-sand" style={{ width: `${w * 100}%` }} />
            <div className="mt-2 h-2.5 rounded-[3px] bg-sand" style={{ width: `${w * 84}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Result({ run, active, setActive, onRetry }: { run: Run; active: number | null; setActive: (n: number | null) => void; onRetry: (over: Partial<BriefingRequest>) => void }) {
  const req = run.request as BriefingRequest;
  const topicLabel = req.custom ?? TOPICS.find((t) => t.id === req.topic)?.label ?? req.topic;
  const articles = run.search?.articles ?? [];
  const outlets = new Set(articles.map((a) => a.source ?? hostOf(a.url))).size;
  const busy = run.status === 'searching' || run.status === 'writing';

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <p className="eyebrow">
          {req.country ? `${flag(req.country)} ${countryName(req.country)}` : '🌐 Any country'} · {languageName(req.language)} · last{' '}
          {WINDOWS.find((w) => w.days === req.days)?.label}
        </p>
        <h2 className="display mt-2 text-[30px] text-ink sm:text-[36px]">{topicLabel}</h2>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          <StatusLine run={run} outlets={outlets} />
        </div>
      </div>

      {run.status === 'empty' ? <Empty req={req} onRetry={onRetry} /> : null}

      {run.stories.length || busy ? (
        <ol className="divide-y divide-line">
          {run.stories.map((s, i) => (
            <StoryItem key={i} i={i} story={s} articles={articles} active={active} setActive={setActive} />
          ))}
          {busy
            ? Array.from({ length: Math.max(1, 3 - run.stories.length) }, (_, i) => (
                <li key={`sk-${i}`} className="px-5 py-5 sm:px-6">
                  <div className="shimmer h-5 w-3/5 rounded-[3px]" />
                  <div className="shimmer mt-3 h-3 w-full rounded-[3px]" />
                  <div className="shimmer mt-2 h-3 w-4/5 rounded-[3px]" />
                </li>
              ))
            : null}
        </ol>
      ) : null}

      {run.status === 'error' && run.error ? <ErrorBox error={run.error} /> : null}

      {articles.length ? <Sources articles={articles} total={run.search?.total ?? articles.length} active={active} setActive={setActive} /> : null}

      {run.cost && run.status !== 'error' ? <CostBar cost={run.cost} mode={run.search?.mode ?? req.mode} cached={run.search?.cached ?? false} /> : null}
    </div>
  );
}

function StatusLine({ run, outlets }: { run: Run; outlets: number }) {
  const s = run.search;
  if (run.status === 'searching') {
    return (
      <span className="flex items-center gap-2">
        <Pulse /> Searching the latest articles…
      </span>
    );
  }
  const when = s ? (s.cached ? 'cached' : seconds(s.duration_ms)) : '';
  const found = !s ? null : s.articles.length ? (
    <span className="flex items-center gap-1.5">
      <Check size={13} className="text-good" />
      {s.articles.length} articles from {outlets} {outlets === 1 ? 'outlet' : 'outlets'} · {when}
    </span>
  ) : (
    <span>No articles found · {when}</span>
  );
  if (run.status === 'writing') {
    return (
      <>
        {found}
        <span className="flex items-center gap-2">
          <Pulse /> Writing the briefing…
        </span>
      </>
    );
  }
  return (
    <>
      {found}
      {run.status === 'done' && run.ms !== null ? <span className="text-faint">Done in {seconds(run.ms)}</span> : null}
    </>
  );
}

function StoryItem({ i, story, articles, active, setActive }: { i: number; story: Story; articles: Article[]; active: number | null; setActive: (n: number | null) => void }) {
  const max = articles.length;
  return (
    <li className="animate-rise px-5 py-5 sm:px-6">
      <div className="flex gap-4">
        <span className="pt-1 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
        <div className="min-w-0">
          <h3 className="display text-[21px] leading-[1.2] text-ink sm:text-[23px]">{story.headline}</h3>
          <p className="mt-2 text-[15px] leading-[1.65] text-ink-2">
            {pieces(story.summary, max).map((p, j) =>
              p.type === 'text' ? (
                <span key={j}>{p.text}</span>
              ) : (
                <span key={j} className="whitespace-nowrap">
                  {p.word}
                  {p.cites.map((n) => {
                    const a = articles[n - 1];
                    return (
                      <a
                        key={n}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="cite"
                        data-active={active === n}
                        title={`${a.source ?? hostOf(a.url)}: ${a.title}`}
                        onMouseEnter={() => setActive(n)}
                        onMouseLeave={() => setActive(null)}
                        onFocus={() => setActive(n)}
                        onBlur={() => setActive(null)}
                      >
                        {n}
                      </a>
                    );
                  })}
                </span>
              ),
            )}
          </p>
          <p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-faint">
            {story.citations.map((n) => {
              const a = articles[n - 1];
              return (
                <a key={n} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                  {a.source ?? hostOf(a.url)}
                  {a.outlets > 1 ? <span className="text-faint">+{a.outlets - 1}</span> : null}
                  <ArrowUpRight size={11} />
                </a>
              );
            })}
          </p>
        </div>
      </div>
    </li>
  );
}

function Sources({ articles, total, active, setActive }: { articles: Article[]; total: number; active: number | null; setActive: (n: number | null) => void }) {
  return (
    <details className="group border-t border-line bg-canvas" open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 sm:px-6">
        <span className="eyebrow">
          Sources · {articles.length}
          {total > articles.length ? ` of ${compact(total)} relevant` : ''}
        </span>
        <span className="text-[12px] text-faint group-open:hidden">Show</span>
        <span className="hidden text-[12px] text-faint group-open:inline">Hide</span>
      </summary>
      <ol className="grid gap-px px-3 pb-3 sm:px-4">
        {articles.map((a) => (
          <li key={a.n}>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              onMouseEnter={() => setActive(a.n)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-start gap-3 rounded-[5px] px-2 py-2 transition-colors ${active === a.n ? 'bg-accent-soft' : 'hover:bg-white'}`}
            >
              <span className="cite mt-0.5 shrink-0" data-active={active === a.n}>
                {a.n}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13.5px] leading-snug text-ink">{a.title}</span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-faint">
                  <span>{a.source ?? hostOf(a.url)}</span>
                  <span>{ago(a.published_at)}</span>
                  {a.outlets > 1 ? <span>also in {a.outlets - 1} more</span> : null}
                  {a.found_in !== 'index' ? <span className="text-muted">found beyond the index</span> : null}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

function CostBar({ cost, mode, cached }: { cost: Cost; mode: Mode; cached: boolean }) {
  const total = cost.typesearch_usd + (cost.model_usd ?? 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 sm:px-6">
      <span className="text-[12.5px] text-muted">
        This briefing cost <strong className="font-semibold text-ink">{cost.model_usd === null ? `${usd(cost.typesearch_usd)} + model` : usd(total)}</strong>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 text-accent-deep">
          typesearch {usd(cost.typesearch_usd)} · {mode}
          {cached ? ' · cached, free' : ''}
        </span>
        <span className="rounded-[4px] bg-sand px-1.5 py-0.5 text-ink-2">
          {cost.input_tokens + cost.output_tokens === 0
            ? 'no model call'
            : `${cost.model} ${cost.model_usd === null ? '' : `${usd(cost.model_usd)} · `}${compact(cost.input_tokens + cost.output_tokens)} tokens`}
        </span>
      </span>
    </div>
  );
}

function Empty({ req, onRetry }: { req: BriefingRequest; onRetry: (over: Partial<BriefingRequest>) => void }) {
  const place = req.country ? placeName(req.country) : 'any country';
  return (
    <div className="px-5 py-8 sm:px-6">
      <p className="display text-[24px] text-ink">Nothing yet for this one.</p>
      <p className="mt-2 max-w-[520px] text-[14px] leading-relaxed text-muted">
        No article about this topic in {place}, in {languageName(req.language)}, in the last {WINDOWS.find((w) => w.days === req.days)?.label}. The
        index may not cover it yet. Try:
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {req.days < 7 ? (
          <button type="button" className="btn btn-outline h-9 text-[13px]" onClick={() => onRetry({ days: 7 })}>
            The last 7 days
          </button>
        ) : null}
        {req.mode !== 'deep' ? (
          <button type="button" className="btn btn-outline h-9 text-[13px]" onClick={() => onRetry({ mode: 'deep' })}>
            Deep mode
          </button>
        ) : null}
        {req.country ? (
          <button type="button" className="btn btn-outline h-9 text-[13px]" onClick={() => onRetry({ country: null })}>
            Any country
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: ErrorEvent }) {
  const where = { typesearch: 'typesearch', model: 'The model', input: 'The request', config: 'Setup' }[error.source];
  return (
    <div className="m-5 flex gap-3 rounded-[6px] border border-[#f3c9c4] bg-bad-soft px-4 py-3 sm:m-6">
      <Alert size={18} className="mt-0.5 shrink-0 text-bad" />
      <div className="min-w-0 text-[13.5px] leading-relaxed">
        <p className="font-medium text-ink">
          {where}: {error.message}
        </p>
        {error.hint ? <p className="mt-0.5 text-ink-2">{error.hint}</p> : null}
        {error.code ? (
          <p className="mt-1 font-mono text-[11px] text-muted">
            {error.status ? `${error.status} · ` : ''}
            {error.code}
          </p>
        ) : null}
      </div>
    </div>
  );
}
