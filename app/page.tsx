import { Briefing } from '@/components/Briefing';
import { Setup } from '@/components/Setup';
import { Footer, Header } from '@/components/ui';
import { loadFormData } from '@/lib/coverage';
import { chooseModel, mockEnabled, modelProblem } from '@/lib/model';
import { hasApiKey } from '@/lib/typesearch';

// Coverage and prices change slowly: the page is rebuilt at most once an hour.
export const revalidate = 3600;

export default async function Page() {
  const mock = mockEnabled();
  const apiKey = hasApiKey();
  const model = chooseModel();
  const problem = modelProblem(model);
  const ready = apiKey && !problem;
  const form = ready ? await loadFormData() : null;

  return (
    <>
      <Header title="News briefing" />
      <main className="mx-auto max-w-[1180px] px-5 pt-10 sm:pt-14">
        <div className="mb-8 max-w-[760px] sm:mb-10">
          <p className="eyebrow">Open-source demo · typesearch + Vercel AI SDK</p>
          <h1 className="display mt-3 text-[40px] text-ink sm:text-[56px]">
            The day&rsquo;s news, <em>every line sourced.</em>
          </h1>
          <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-muted">
            A briefing for any country, language and topic. typesearch finds the articles; a model writes the stories and links each sentence to
            the article it comes from.
          </p>
        </div>
        {ready && form ? <Briefing form={form} model={model.id} mock={mock} /> : <Setup apiKey={apiKey} modelProblem={problem} />}
      </main>
      <Footer mock={mock} />
    </>
  );
}
