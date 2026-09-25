import { z } from 'zod';
import { chooseModel, languageModel, modelProblem } from '@/lib/model';
import { ndjsonResponse } from '@/lib/ndjson';
import { TOPICS, WINDOWS } from '@/lib/options';
import { runBriefing } from '@/lib/run';
import { hasApiKey, typesearch } from '@/lib/typesearch';
import type { BriefingEvent } from '@/lib/types';

// A deep search plus the model can take a while.
export const maxDuration = 120;

const body = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  language: z.string().regex(/^[a-z]{2}$/),
  topic: z.enum(TOPICS.map((t) => t.id) as [string, ...string[]]),
  custom: z.string().trim().max(120).nullable(),
  days: z
    .number()
    .int()
    .refine((d) => WINDOWS.some((w) => w.days === d), 'Not an offered window.'),
  mode: z.enum(['fast', 'normal', 'deep']),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  const choice = chooseModel();
  return ndjsonResponse<BriefingEvent>(async (send, signal) => {
    if (!parsed.success) {
      send({ type: 'error', source: 'input', message: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') });
      return;
    }
    if (!hasApiKey()) {
      send({ type: 'error', source: 'config', message: 'TYPESEARCH_API_KEY is not set.', hint: 'Create a key at app.typesearch.ai and add it to the environment.' });
      return;
    }
    const problem = modelProblem(choice);
    if (problem) {
      send({ type: 'error', source: 'config', message: problem });
      return;
    }
    await runBriefing(parsed.data, send, { ts: await typesearch(), model: await languageModel(choice), modelId: choice.id, signal });
  }, request.signal);
}
