import {
  AUTOMATION_STEPS,
  CATEGORY_META,
  SIGNAL_GUIDE,
  SIGNAL_ORDER,
  WILL_NOT_AUTOMATE,
} from "@/lib/signals";

export function AutomationPanel() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="gi-h text-[32px] text-white">Collect the signal. A person still writes.</h2>
        <p className="gi-prose mt-4">
          Sourcing is already mostly automated. The missing system is a clock. Collect eight public
          signals. A person confirms identity and tone. The talent team writes the note.
        </p>
      </div>

      <div className="gi-grid">
        {AUTOMATION_STEPS.map((step, index) => (
          <div key={step.title} className="gi-split cols-2 gi-block">
            <div>
              <p className="gi-mono text-[13px] text-[#888]">0{index + 1}</p>
              <h3 className="mt-3 text-[20px] leading-[1.25] text-white">{step.title}.</h3>
            </div>
            <p className="text-[16px] leading-[1.7]">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="gi-grid">
        <div className="border-b border-[#4d4d4d] p-5">
          <h3 className="text-[20px] leading-[1.25] text-white">What stays human.</h3>
        </div>
        {WILL_NOT_AUTOMATE.map((item) => (
          <p key={item} className="gi-block p-5 text-[16px] leading-[1.7]">
            {item}
          </p>
        ))}
      </div>

      <div>
        <h2 className="gi-h text-[32px] text-white">Signal by signal.</h2>
        <p className="gi-prose mt-4">
          What it is. Why it predicts a reply. How you would verify it. How a collector would run
          it. Where a person stays in the loop.
        </p>
      </div>

      <div className="gi-grid overflow-x-auto">
        <div className="gi-row gi-mono text-[12px] text-[#888]">
          <div>Signal</div>
          <div>What it is</div>
          <div>Why a reply</div>
          <div>Verify</div>
          <div>Collect / human</div>
        </div>
        {SIGNAL_ORDER.map((type) => {
          const guide = SIGNAL_GUIDE[type];
          const bucket = CATEGORY_META[guide.category];
          return (
            <div key={type} className="gi-block">
              <div className="gi-row">
                <div>
                  <p className="text-[16px] leading-[1.25] text-white">{guide.label}.</p>
                  <p className="gi-mono mt-3 text-[12px] leading-5 text-[#888]">
                    {bucket.label}. {guide.window}
                  </p>
                </div>
                <p className="text-[16px] leading-[1.7]">{guide.what}</p>
                <p className="text-[16px] leading-[1.7]">{guide.why}</p>
                <p className="text-[16px] leading-[1.7]">{guide.verify}</p>
                <div className="text-[16px] leading-[1.7]">
                  <p>{guide.collect}</p>
                  <p className="mt-4 text-[#888]">{guide.human}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
