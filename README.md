# Ping When

Live: https://ping-when.vercel.app

Sourcing is automated. Timing is not.

Ping When decides when to reach out. A person still writes. The queue starts empty. Import a CSV or JSON of real candidates — name, role, employer, `start_date` (`YYYY-MM`), and dated signals (`type`, `date`, `source_url`, `note`) — and the score, the cliff, and the queue are computed from that file only. Approve, snooze, or dismiss. Export the approved rows as CSV. Nothing is sent.

The thirty fictional archetypes are not the roster. They ship as `ping-when-example.csv`, labelled as an example. Load it on purpose. Clear it before a real list. Download `ping-when-template.csv` for the columns.

The clock is fixed on the week of **October 19–25, 2026**, so a walkthrough does not drift.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys, no database, no network calls. Everything runs in the client, and scores are computed only from the CSV/JSON you import. The 30 fictional seed archetypes are a labelled example loaded only on purpose. Nothing is sent.

Optional check that the example scores and the CSV import still hold:

```bash
npm test
```

## What you are looking at

Profiles in the labelled example are fictional seed archetypes: names, employers, papers, and start dates are invented, and nothing in that example is a claim about a real person. Profiles you import are scored only from your CSV/JSON in the client. Nothing is sent.

Each profile has a role type, months in role, and a dated signal timeline. The tenure cliff is inferred from the role start: 12, 24, and 36 months. Only the strongest mark enters the score.

Three weights, always visible:

```
score = (wC·Cliff + wP·Proof + wS·Shift) / (wC + wP + wS)
```

- **Cliff** — a bell curve peaking 21 days before the anniversary (σ = 22 days). Year weights are 1.00 / 0.84 / 0.72 for 12 / 24 / 36 months. Far-away marks contribute nothing.
- **Proof** — papers, model releases, talks, open source.
- **Shift** — funding, layoffs, reorgs, and a public “building something new” post.

Proof and shift decay with a **28-day half-life**: `0.5 ^ (daysAgo / 28)`. If a bucket has several signals, the score uses the strongest, plus 0.45× the next, plus 0.20× the third, capped at 100.

This is a weighted **average**. Raising cliff proximity does not add points on top. It spends attention the other weights no longer get, so a pure launch can fall under the line when the week is defined as a cliff week.

| Band | Rule |
| --- | --- |
| REACH OUT THIS WEEK | Rounded score ≥ 60, and the driving signal’s window covers Oct 19–25 |
| WARM UP | Rounded score ≥ 38, or a score that clears 60 whose window is not this week |
| WAIT | Under 38 |

The driving signal is the strongest signal inside the weight bucket that contributes the most points. The card shows that signal, why it is this week, a first-touch angle, and the week the window opens and closes.

Default weights are **30 cliff / 40 proof / 30 shift**. At those weights the week queue is:

1. **Hana Quill** — embodied RL researcher. Score 66. Driving signal: 12-month cliff (Nov 1), stacked with a lab note and a grant extension.
2. **Sera Okoye** — robotics research engineer. Score 64. Driving signal: Fieldglass announced a reduction. Her 24-month mark is eight days out. The card is flagged for tone review. The angle does not mention the layoff.
3. **Felix Drummond** — open-models research engineer. Score 63. Driving signal: the Loom-2.1 release, with a public “starting a new line” post. Almost no cliff. He is here because proof and shift are both hot.

**Idris Pell** is the case from the interview: world-model researcher, ex-game AI lab, 11 months at Northglass, 12-month cliff on November 9 (21 days out — the peak of the curve). At the balanced weights he is **WARM UP, score 54, rank 8**, cliff-driven, window already open (week of Sep 28 through week of Nov 30). He is six points under the line because a cliff is not the whole mix.

Drag **Cliff proximity** from 30 to 70 (or press **Cliff week**). Idris enters the queue at rank 2, still driven by the 12-month cliff. Amira Kent, a 24-month mark, enters with him. Felix, Mateo Ibarra, and Freya Lind leave: their scores fall because launches now count for less of the average.

## Signal table

Windows are measured from the public event. Cliffs are measured from the anniversary inferred from a public start date.

| Signal | Weight | What it is | Why it predicts a reply | How you’d verify it | What I’d automate | Human in the loop |
| --- | --- | --- | --- | --- | --- | --- |
| Tenure cliff (12 / 24 / 36) | Cliff | The role anniversary. Year one is the classic cliff: unvested equity becomes theirs and the cost of leaving drops. Later marks are real and weaker. Only the strongest mark scores. | People rarely answer in month four, when leaving forfeits the year. Around the cliff they are already asking if they want another year. Strength peaks three weeks before, while there is still time to run a process. | You do not see the grant. You see a start date: LinkedIn, a “joined” post, a talk bio, a lab people page. Infer +12/24/36 and label it an inference. | Store the public start date. A nightly job emits “cliff in N days.” No comp tools, no HRIS. | The cliff picks the week. It never appears in the sentence. Fuzzy dates, academia, and senior hires who may not have a standard cliff are held out by a person. Window: 6 weeks before through 3 weeks after. |
| Paper or model release | Proof | A paper, preprint, tech report, or checkpoint they authored or led. | The inbox is already in “talk about the work” mode. The note is a response, not a cold open, and the weeks after a release are when people ask what the next problem is. | arXiv, OpenReview, Semantic Scholar, a lab blog, a Hugging Face model card. Match on more than a surname. | arXiv API, OpenReview, Semantic Scholar, Hugging Face, lab RSS. Author match proposes a link. | A human confirms identity before it can move the week queue. The angle has to cite one real result. If nobody read it, it is not a this-week note. Window: release day through 5 weeks. |
| Conference talk | Proof | A public listing for a talk, poster, or panel. | They are about to be public, in a peer setting, on the subject of the work. A note about the content feels like the field. A note about “a quick chat before your talk” feels like a funnel. | The program page. Match the person, not just the name. Workshop listings collide. | Diff program pages for the venues this team actually hires from. | Human confirms the match. Mention the subject. Suggest after the session, not a hold on the calendar before it. Window: listing through 1 week after the session. |
| Open-source release | Proof | A release or model card on a project they maintain. Stars do not count. | People who just shipped answer technical email. That reply window is about a month, then it goes cold. | GitHub or GitLab releases, Hugging Face, a package registry. Confirm maintainer, not a drive-by. | GitHub releases on an allow-list of repos, plus Hugging Face webhooks. A human maintains the repo-to-person map. | The angle needs a real technical remark. If the team cannot make one, they are not a this-week candidate. Window: release day through 4 weeks. |
| Employer funding | Shift | A public round, grant, or budget announcement at the current employer. | Weaker, and two-directional. Some people get harder to move (refresher coming). Others reassess before the new mandate lands. It predicts a decision, not a yes. | Company blog, press wire, public grant award. Not round gossip. | Employer RSS plus a news search on the employer. A human confirms it is real before it scores. | Do not open with the round. Mention it only if it changed the work. Window: announcement through 3 weeks. |
| Employer layoff | Shift | A public reduction or lab closure. Not proof this person was affected. | The psychological contract breaks in public. Highest short-horizon shift signal, easiest to misuse. | The company’s statement, reputable press, or a US WARN notice. A coworker’s post is a lead, not confirmation. | Press and WARN feeds matched to the employer. Every hit is auto-tagged tone review. Never auto-draft. | A person decides whether this week is kind. The note does not mention the layoff unless the candidate does. Window: news day through 4 weeks. |
| Building something new | Shift | A first-person public post that they are starting something or leaving to build. | Explicit intent. Highest precision of the social signals, shortest half-life. Often means they will not take a job. That can still be a reason to write — as a relationship, not a requisition. | Their site, a public post, a personal newsletter. Not private chats. | Personal RSS and a licensed social listen. A classifier for “I’m building.” High false-positive rate. | A human confirms the post before status can change. If they are founding, do not disguise a job pitch as curiosity. Window: post day through 3 weeks. |
| Role or company reorg | Shift | Title, manager, or charter changed, or the group was merged or moved. | The job they joined is not the job they have. People talk while the new charter is negotiable, and go quiet once they recommit or leave. Noisier than a cliff. | A public “new role” post, an org note, or a team-page change they stated. A LinkedIn title diff is only a hint. | Snapshots of public profiles and team pages. Default the diff to a suggestion. | Acknowledge a new scope only if they have said it publicly. Do not reveal title-tracking. Window: change day through 6 weeks. |

## What I would automate next

Not another sourcer.

1. Overnight collectors for the eight signals, public sources only.
2. A review tray for identity matches. Unconfirmed matches cannot cross the week line.
3. The same three weights, chosen by a talent lead, scored every morning. Revisit them quarterly from reply and “wrong window” tags. Do not let a model silently retune them.
4. Monday queue: score ≥ 60 and the driving window covers the week, with the why and an angle.
5. A person writes. A person sends.

Would not automate: the send, mentioning a vest date or a layoff, treating an inferred cliff as a known grant, or letting one social post flip status without a confirm.

## Two-minute walkthrough

Say this out loud. The beats match the default screen. About two minutes if you don’t linger. The headline on the white panel is the line to open with.

> Sourcing is automated. Timing is not. You told me sourcing and screening are about ninety percent automated, and what you have not solved is when to reach out. The example was someone hitting their one-year cliff. So I didn’t build another sourcer. I built the clock a talent team can run on its own file.
>
> The screen opens empty. Nothing is sent. The queue starts empty. Bring a CSV or JSON with name, role, employer, start date, and a dated signal with a source link. Missing dates stay on the page as unscored. They are not guessed. The thirty fictional people are an example file. I’ll load it only so you can see the case. Clear takes it off the queue.
>
> The score on the left is a weighted average of three things: how close they are to a 12, 24, or 36-month mark, proof of work, and an org shift. Signals decay. A cliff peaks three weeks before the anniversary, which is when you still have time to run a process.
>
> At the balanced weights, this week is five people. Each row has Approve, Snooze, and Dismiss. There is no Send. Open Signals on a row and you get the dated line: what the signal is, why it predicts a reply, and how you would verify it in public.
>
> Hana Quill is first — embodied RL, score 66, twelve-month cliff in thirteen days, and she just published the footstep note, so you have a reason to write that isn’t the vest. Sera Okoye is second, score 64 — her company posted a reduction, and her two-year mark is eight days out. The row says tone review. The angle says don’t mention the layoff. Felix Drummond is third, score 63, because he just shipped an open-model release, not because of tenure.
>
> The person you described is Idris Pell. The live line under “This week” names him, and he also sits under “Closest to the line.” World-model researcher, ex-game AI lab, eleven months in, cliff on November 9. Rank 8. Score 54. Warm up, not this week. The cliff is already the thing driving him. It just isn’t enough of the mix.
>
> Watch the cliff slider. I’ll take it from 30 to 70. Proof stays 40. Shift stays 30.
>
> Idris enters REACH OUT THIS WEEK at number two, score 67. Still the twelve-month cliff. The window opened the week of September 28 and closes the week of November 30. Amira Kent, a twenty-four-month mark, comes in with him, was 6, now 4. Felix Drummond, Mateo Ibarra, and Freya Lind leave — this is an average, so emphasizing cliffs means a pure launch counts for less. Raising the weight does not dump every anniversary into the week. Leona’s thirty-six-month mark is weaker and further out. She stays warm.
>
> Approve is the human in the loop. It records a decision on this page. It does not message anyone. The third view, Automate next, is how each signal would be collected from public sources, and what stays with a person: identity, tone, and the note.

If you only have time for one move: drag **Cliff proximity** from 30 to 70. **Cliff week** sets the same 70 / 40 / 30.
