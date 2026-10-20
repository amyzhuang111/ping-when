import type { SignalType, WeightKey } from "@/lib/types";

export interface SignalGuide {
  type: SignalType;
  label: string;
  short: string;
  category: WeightKey;
  what: string;
  why: string;
  verify: string;
  collect: string;
  human: string;
  window: string;
}

export const CATEGORY_META: Record<
  WeightKey,
  { label: string; hint: string; slider: string }
> = {
  cliff: {
    label: "Cliff proximity",
    hint: "12-, 24-, and 36-month marks",
    slider: "Cliff proximity",
  },
  proof: {
    label: "Proof of work",
    hint: "Papers, models, talks, open source",
    slider: "Proof of work",
  },
  shift: {
    label: "Org shift",
    hint: "Funding, layoffs, reorgs, new builds",
    slider: "Org shift",
  },
};

export const SIGNAL_GUIDE: Record<SignalType, SignalGuide> = {
  cliff: {
    type: "cliff",
    label: "Work anniversary",
    short: "12 / 24 / 36-month mark",
    category: "cliff",
    what: "The 12-, 24-, or 36-month anniversary of the current role. The one-year mark is the classic cliff: unvested equity becomes theirs, and the cost of leaving drops. Year two and year three are real and weaker: refreshers and habit dilute them. The score uses whichever mark is strongest right now, not all three added together.",
    why: "People rarely answer a cold note in month four, when leaving forfeits the year. In the weeks around a cliff they are already asking whether they want another year of the same job. A specific note lands while that question is open. Strength peaks three weeks before the date, when there is still time to run a process, and the window stays open for three weeks after.",
    verify: "You almost never see the grant. You see a start date. Public sources: LinkedIn experience dates, a “joined” post, a talk bio (“at Northglass since 2025”), a lab people page. Infer +12, +24, and +36 months and label it an inference. If the date is ambiguous, they stay off the week queue until a person checks it.",
    collect: "Store the public start date and refresh it when the profile changes. A nightly job emits “cliff in N days” for the three marks. No compensation databases, no private HRIS, no guessing at grant size.",
    human: "The cliff chooses the week. It does not appear in the sentence. High-touch means the writer talks about the work and lets them bring up timing. Academic roles, senior hires, and anyone who may not have a standard one-year cliff are held out by a person, not by the formula.",
    window: "Opens 6 weeks before the anniversary and closes 3 weeks after.",
  },
  release: {
    type: "release",
    label: "Paper or model release",
    short: "Paper or model",
    category: "proof",
    what: "A paper, preprint, tech report, or model checkpoint they authored or led, newly public. In this seed set the title says which one it is.",
    why: "The inbox is already in “talk about the work” mode. You have a reason to write that is not a job, and the weeks after a release are when researchers ask what the next problem is. Reply rate moves because the note is a response to something they just did in public.",
    verify: "arXiv, OpenReview, Semantic Scholar, a lab blog, a Hugging Face model card, or a company research index. Match on more than a shared surname. A workshop note and a flagship launch are not the same strength. The seed data encodes that as the strength number.",
    collect: "arXiv API, OpenReview, Semantic Scholar, the Hugging Face hub, and lab RSS. An author-string match proposes a link. A human confirms identity before the signal is allowed to move someone into the week queue.",
    human: "The angle has to cite one concrete result. If nobody on the team read the work, it is not a this-week note, whatever the score says. The tool can name the paper. It cannot pretend someone read it.",
    window: "Opens the day it becomes public and closes 5 weeks later.",
  },
  funding: {
    type: "funding",
    label: "Employer funding",
    short: "Funding news",
    category: "shift",
    what: "A public round, grant, or major budget announcement at the current employer. It is news about the org, not proof the person wants to leave.",
    why: "Weaker than a cliff or a layoff, and two-directional. Some people become harder to reach because a refresher or a bigger mandate is coming. Others reassess in the weeks before that lands, especially when a lab has just become a company. It predicts a decision, not a yes. Keep the weight modest unless you know the org.",
    verify: "The company blog, a press wire, or a public grant award. Not leaked round gossip, and not a rumor from another recruiter.",
    collect: "Employer-blog RSS plus a news search bound to the employer entity. A classifier separates funding from product launches. A human confirms the item is real and material before it scores.",
    human: "Do not open with the round. If the news actually changed their work, it can show up as context later in the note. The suggested angle stays on the work.",
    window: "Opens the day of the announcement and closes 3 weeks later.",
  },
  layoff: {
    type: "layoff",
    label: "Employer layoff",
    short: "Layoff news",
    category: "shift",
    what: "A public reduction, layoff, or lab closure at the current employer. It is not evidence that this person was affected. The seed profiles say that explicitly.",
    why: "The psychological contract breaks in public. People who were not looking start looking, and people who were affected are in an urgent week. It is the strongest short-horizon shift signal, and the easiest one to misuse. That is why every profile carrying it is flagged for tone review.",
    verify: "The company’s own statement, a reputable press account, or a public WARN notice in the US. A coworker’s post is a lead, not confirmation. Do not infer who was cut from a public headcount rumor.",
    collect: "Press and WARN feeds matched to the employer. Auto-tag every hit “tone review.” Never auto-draft. The org-shift weight is the cap on how hard this signal can push a rank.",
    human: "General Intuition wants high-touch with top candidates. A layoff week is when a clumsy note does harm. The queue may surface the person. A human decides whether this week is kind. The note does not mention the layoff unless the candidate does.",
    window: "Opens the day of the news and closes 4 weeks later.",
  },
  talk: {
    type: "talk",
    label: "Conference talk",
    short: "Talk announced",
    category: "proof",
    what: "They are listed for a talk, poster, or panel. The signal dates from the public listing, and the window runs through the week after the session.",
    why: "They are about to be public, in a peer setting, and reachable on the subject of the work. A note about the actual content feels like the field. A note that asks for “a quick chat before your talk” feels like a funnel and gets ignored.",
    verify: "The conference or workshop program page. Match the person, not just the name. Workshop programs collide constantly. The seed venues (Harborlight, Circuit & Form, Glasshouse) are fictional stand-ins for that kind of page.",
    collect: "Program pages for the venues this team actually hires from. Diff the speaker list whenever it updates. A human confirms the match before it counts. Name collisions are the failure mode.",
    human: "Mention the subject. Offer one precise comment. Suggest a conversation after the session, not a hold on their calendar before it.",
    window: "Opens when the listing goes up and closes 1 week after the session.",
  },
  oss: {
    type: "oss",
    label: "Open-source release",
    short: "Open source",
    category: "proof",
    what: "A release, model card, or other public shipping moment on a project they maintain or lead. Stars and drive-by commits do not count.",
    why: "People who just shipped answer technical email. “I read the release” is one of the few cold opens that gets a research reply. The half-life is about a month, then the thread goes cold and you are just another recruiter.",
    verify: "GitHub or GitLab releases, Hugging Face, a package registry, or the lab’s public repo. Confirm they are an author or maintainer, not someone who starred it.",
    collect: "GitHub releases on an allow-list of repos, plus Hugging Face webhooks. Map repo to person from a list a human maintains. Do not fuzzy-match commit authors across the internet.",
    human: "The angle needs a real technical remark: a behavior, a limit, a use. If the team cannot make one, they are not a this-week candidate. The tool names the release. A person supplies the remark.",
    window: "Opens the day of the release and closes 4 weeks later.",
  },
  building: {
    type: "building",
    label: "Building something new",
    short: "Building in public",
    category: "shift",
    what: "A public post or page where they say, in the first person, that they are starting something, leaving to build, or picking up a new problem.",
    why: "Explicit intent. Highest precision of the social signals, shortest half-life. It often means they will not take a job. They are founding, or about to. That can still be a reason to write, as a relationship rather than a requisition. Treat a high score here as “talk to them,” not “they will join.”",
    verify: "Their own site, a public post, or a personal newsletter. Private messages and “someone told me” are out of bounds for this tool. Screenshot-of-a-group-chat is not a source.",
    collect: "Personal-site RSS and a licensed social listen on a watchlist. A small classifier for first-person intent (“I’m building”, “I’m starting”). The false-positive rate is high, so a human confirms the post before it can change someone’s status.",
    human: "If they are founding, do not disguise a job pitch as curiosity. The signal should stay labeled “intent, maybe not a hire,” and the writer decides which conversation it is.",
    window: "Opens the day of the post and closes 3 weeks later.",
  },
  reorg: {
    type: "reorg",
    label: "Role or company reorg",
    short: "Reorg",
    category: "shift",
    what: "Their title, manager, or charter changed, or their group was merged, split, or moved. It is a change in the job, not a performance signal.",
    why: "The job they joined is not the job they have. People will take a conversation while the new charter is still negotiable, and they go quiet once they have recommitted or left. Title edits are noisy, so this stays weaker than a cliff and should not, alone, clear the week line.",
    verify: "A public “new role” post, an org announcement, or a team-page change they or the company stated. A LinkedIn title diff is a hint, not proof. Recruiter taxonomies rewrite titles on their own.",
    collect: "Periodic snapshots of public profiles and team pages. Diff titles and group names. Default the result to a suggestion that a human accepts. The 60-point line and the org-shift weight are what keep a title edit from becoming a queue by itself.",
    human: "Acknowledge a new scope only if they have said it publicly. Do not reveal that you are tracking title edits. If you cannot say where you saw it without sounding like surveillance, do not mention it.",
    window: "Opens the day of the change and closes 6 weeks later.",
  },
};

export const SIGNAL_ORDER: SignalType[] = [
  "cliff",
  "release",
  "talk",
  "oss",
  "funding",
  "layoff",
  "building",
  "reorg",
];

export const AUTOMATION_STEPS: { title: string; body: string }[] = [
  {
    title: "Collect overnight, from public sources only",
    body: "Eight collectors, one per signal, on a nightly cadence. arXiv, OpenReview, Semantic Scholar, Hugging Face, GitHub releases, lab and personal RSS, conference programs, press wires, and public WARN notices. No private HRIS, no scraped inboxes, no “a friend said.”",
  },
  {
    title: "A person confirms identity before rank can move",
    body: "Papers, talks, and social posts collide on names. Unconfirmed matches land in a review tray. They can sit on the timeline as unverified. They cannot push someone across the week line until a human says the match is the right person.",
  },
  {
    title: "Score with the three weights a lead actually chose",
    body: "The sliders are the policy. Production stores them, runs the same weighted average every morning, and does not let a model silently retune them. Once a quarter, reply and “wrong window” outcomes are the reason to move a weight, not a feeling from a single search.",
  },
  {
    title: "Monday queue, then a human writes",
    body: "The week queue is everyone at 60 or above whose driving window covers the week, with the why and a suggested angle. A person on the talent team writes the note and decides whether to send. Ping When never sends, never drafts the full email, and never follows up on its own.",
  },
  {
    title: "Log the outcome against the driving signal",
    body: "Reply, no reply, and “should not have written” get tagged with the signal that put them in the queue. That is how you learn that funding is two-directional, or that a 36-month mark is weaker than the first cliff. The next thing to automate is the learning, not another sourcer.",
  },
];

export const WILL_NOT_AUTOMATE: string[] = [
  "Sending, scheduling, or following up. Timing informs. Humans write.",
  "Mentioning a layoff, a vest date, or a title change the candidate has not said publicly.",
  "Treating an inferred cliff as a known equity grant. Start date in, anniversary out, labeled as an inference.",
  "Letting one social post flip someone into the week queue without a human confirm.",
  "Ranking people who were affected by a layoff above a tone review. The flag is not optional.",
];
