import { AUTOMATION_STEPS, CATEGORY_META, SIGNAL_GUIDE, SIGNAL_ORDER, WILL_NOT_AUTOMATE } from "@/lib/signals";

export function AutomationPanel() {
  return (
    <div>
      <h2 className="h-section">Collect the signal. A person still writes.</h2>
      <p className="prose-s mt-4">
        Sourcing is already mostly automated. The missing system is a clock. Collect eight public signals. A person
        confirms identity and tone. The talent team writes the note.
      </p>
      <ol className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
        {AUTOMATION_STEPS.map((step, i) => (
          <li key={step.title}>
            <p className="eyebrow muted tnum">0{i + 1}</p>
            <p className="mt-2 text-[15px]">{step.title}.</p>
            <p className="prose-s mt-2 muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <h3 className="eyebrow mt-12 font-semibold">What stays human</h3>
      <ul className="mt-3">
        {WILL_NOT_AUTOMATE.map((item) => (
          <li key={item} className="prose-s hair-t py-3">{item}</li>
        ))}
      </ul>
      <h2 className="h-section mt-16">Signal by signal.</h2>
      <p className="prose-s mt-4 muted">What it is. Why it predicts a reply. How you would verify it. How a collector would run it. Where a person stays in the loop.</p>
      <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {SIGNAL_ORDER.map((type) => {
          const g = SIGNAL_GUIDE[type];
          return (
            <div key={type}>
              <p className="brandline">{g.label}</p>
              <p className="mt-1 text-[12px] muted">{CATEGORY_META[g.category].label}. {g.window}</p>
              <dl className="spec mt-3">
                <dt>What</dt><dd>{g.what}</dd>
                <dt>Why a reply</dt><dd>{g.why}</dd>
                <dt>Verify</dt><dd>{g.verify}</dd>
                <dt>Collect</dt><dd>{g.collect}</dd>
                <dt>Human</dt><dd>{g.human}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
