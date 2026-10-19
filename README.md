# Ping When

Live: https://ping-when.vercel.app

Sourcing is automated. Timing is not.

Ping When decides when to reach out. A person still writes. The queue starts empty. Import a CSV or JSON of real candidates and the score, the cliff, and the queue are computed from that file only. Approve, snooze, or dismiss. Export the approved rows as CSV. Nothing is sent.

## Start empty, score your file

There is no pre-loaded roster and no seed queue. The first screen is empty until you import a file (or deliberately load the labelled example — see below).

**Four columns are enough:**

```csv
name,role,employer,start_date
Mira Sol,Research scientist,Northline,2025-11-09
Theo Park,Research engineer,Harbor Glass,2026-01-12
```

- `name` is the only required column. `role` and `employer` can be blank.
- `start_date` is `YYYY-MM` or `YYYY-MM-DD`. A month with no day uses the first of that month. It is what scores a candidate: from it the 12 / 24 / 36-month tenure cliffs are inferred (labelled an inference, not a view of a grant).
- **Signals are optional.** A candidate with no signals still scores from `start_date`. To add dated signals, use `type`, `date`, `source_url`, and `note` columns — `type` values include `release` (aliases `paper` / `model`), `talk`, `oss`, `funding`, `layoff`, `building`, and `reorg`. A signal needs a valid `date`; an undated signal is dropped and reported, and only that signal is dropped.
- **Headers are fuzzy.** `Candidate Name`, `Title`, `Company`, `Start Date`, `Signal Date`, `Link`, `Details` and similar variants map to the canonical columns. Comma, tab (TSV / paste), and semicolon delimiters all import, with quoting respected.
- **Name-only (or name + employer) lists import too.** They are listed as *unscored — needs start-date* rather than rejected. Add a `start_date` and re-import to score them. A missing or invalid `start_date` is never guessed.
- JSON with the same fields works the same way. Download `ping-when-template.csv` for the canonical eight columns.

Everything runs in the client. No API keys, no database, no network calls with your file.

## The example is an example

The 30 fictional archetypes ship as `ping-when-example.csv`, labelled as an example. Names, employers, papers, and start dates in it are invented; nothing in it is a claim about a real person. Load it on purpose, from the import panel, only to see the mechanics — and clear it before a real list. It is never loaded by default.

Because scoring uses the real current date (see below), the example's queue is not a fixed story: scores, windows, and who is "this week" move as today moves. That is the point — it behaves exactly like a real imported file would.

## The clock is today

Scoring uses the actual current date on the client. "This week" is the Monday–Sunday week containing today, and cliff windows, decay, and months-in-role are all computed from today. There is no fixed or pinned week. (The checks in `scripts/` inject an explicit date so the arithmetic can be verified deterministically; the app itself never defaults to that date.)

## Scoring

Each scored profile has a role start and a dated signal timeline. Only the strongest cliff mark enters the score.

Three weights, always visible:

```
score = (wC·Cliff + wP·Proof + wS·Shift) / (wC + wP + wS)
```

- **Cliff** — a bell curve peaking 21 days before the 12 / 24 / 36-month anniversary (σ = 22 days). Year weights are 1.00 / 0.84 / 0.72. Far-away marks contribute nothing.
- **Proof** — papers, model releases, talks, open source.
- **Shift** — funding, layoffs, reorgs, and a public "building something new" post.

Proof and shift decay with a **28-day half-life**: `0.5 ^ (daysAgo / 28)`. If a bucket has several signals, the score uses the strongest, plus 0.45× the next, plus 0.20× the third, capped at 100.

This is a weighted **average**. Raising cliff proximity does not add points on top; it spends attention the other weights no longer get, so a pure launch can fall under the line when the weights favour cliffs.

| Band | Rule |
| --- | --- |
| REACH OUT THIS WEEK | Rounded score ≥ 60, and the driving signal's window covers the current week |
| WARM UP | Rounded score ≥ 38, or a score that clears 60 whose window is not this week |
| WAIT | Under 38 |

Default weights are **30 cliff / 40 proof / 30 shift**. Drag the weights (or use the presets) and the queue re-sorts; each card shows the driving signal, why it is this week, a first-touch angle, and the week the window opens and closes.

## Decisions stay local

Approve, Snooze, and Dismiss record a decision on this machine only. Nothing is sent, drafted, or followed up. **Export approved** downloads the approved rows as CSV (`ping-when-approved.csv`).

A layoff signal is news about the employer, not proof this person was affected — open the source link before you approve. The line at 60 predicts a likelier reply, not a hire.

## Signal table

Windows are measured from the public event. Cliffs are measured from the anniversary inferred from a public start date.

| Signal | Weight | What it is | Why it predicts a reply | How you'd verify it | What I'd automate | Human in the loop |
| --- | --- | --- | --- | --- | --- | --- |
| Tenure cliff (12 / 24 / 36) | Cliff | The role anniversary. Year one is the classic cliff: unvested equity becomes theirs and the cost of leaving drops. Later marks are real and weaker. Only the strongest mark scores. | People rarely answer in month four, when leaving forfeits the year. Around the cliff they are already asking if they want another year. Strength peaks three weeks before, while there is still time to run a process. | You do not see the grant. You see a start date: LinkedIn, a "joined" post, a talk bio, a lab people page. Infer +12/24/36 and label it an inference. | Store the public start date. A nightly job emits "cliff in N days." No comp tools, no HRIS. | The cliff picks the week. It never appears in the sentence. Fuzzy dates, academia, and senior hires who may not have a standard cliff are held out by a person. Window: 6 weeks before through 3 weeks after. |
| Paper or model release | Proof | A paper, preprint, tech report, or checkpoint they authored or led. | The inbox is already in "talk about the work" mode. The note is a response, not a cold open, and the weeks after a release are when people ask what the next problem is. | arXiv, OpenReview, Semantic Scholar, a lab blog, a Hugging Face model card. Match on more than a surname. | arXiv API, OpenReview, Semantic Scholar, Hugging Face, lab RSS. Author match proposes a link. | A human confirms identity before it can move the week queue. The angle has to cite one real result. If nobody read it, it is not a this-week note. Window: release day through 5 weeks. |
| Conference talk | Proof | A public listing for a talk, poster, or panel. | They are about to be public, in a peer setting, on the subject of the work. A note about the content feels like the field. A note about "a quick chat before your talk" feels like a funnel. | The program page. Match the person, not just the name. Workshop listings collide. | Diff program pages for the venues this team actually hires from. | Human confirms the match. Mention the subject. Suggest after the session, not a hold on the calendar before it. Window: listing through 1 week after the session. |
| Open-source release | Proof | A release or model card on a project they maintain. Stars do not count. | People who just shipped answer technical email. That reply window is about a month, then it goes cold. | GitHub or GitLab releases, Hugging Face, a package registry. Confirm maintainer, not a drive-by. | GitHub releases on an allow-list of repos, plus Hugging Face webhooks. A human maintains the repo-to-person map. | The angle needs a real technical remark. If the team cannot make one, they are not a this-week candidate. Window: release day through 4 weeks. |
| Employer funding | Shift | A public round, grant, or budget announcement at the current employer. | Weaker, and two-directional. Some people get harder to move (refresher coming). Others reassess before the new mandate lands. It predicts a decision, not a yes. | Company blog, press wire, public grant award. Not round gossip. | Employer RSS plus a news search on the employer. A human confirms it is real before it scores. | Do not open with the round. Mention it only if it changed the work. Window: announcement through 3 weeks. |
| Employer layoff | Shift | A public reduction or lab closure. Not proof this person was affected. | The psychological contract breaks in public. Highest short-horizon shift signal, easiest to misuse. | The company's statement, reputable press, or a US WARN notice. A coworker's post is a lead, not confirmation. | Press and WARN feeds matched to the employer. Every hit is auto-tagged tone review. Never auto-draft. | A person decides whether this week is kind. The note does not mention the layoff unless the candidate does. Window: news day through 4 weeks. |
| Building something new | Shift | A first-person public post that they are starting something or leaving to build. | Explicit intent. Highest precision of the social signals, shortest half-life. Often means they will not take a job. That can still be a reason to write — as a relationship, not a requisition. | Their site, a public post, a personal newsletter. Not private chats. | Personal RSS and a licensed social listen. A classifier for "I'm building." High false-positive rate. | A human confirms the post before status can change. If they are founding, do not disguise a job pitch as curiosity. Window: post day through 3 weeks. |
| Role or company reorg | Shift | Title, manager, or charter changed, or the group was merged or moved. | The job they joined is not the job they have. People talk while the new charter is negotiable, and go quiet once they recommit or leave. Noisier than a cliff. | A public "new role" post, an org note, or a team-page change they stated. A LinkedIn title diff is only a hint. | Snapshots of public profiles and team pages. Default the diff to a suggestion. | Acknowledge a new scope only if they have said it publicly. Do not reveal title-tracking. Window: change day through 6 weeks. |

## What I would automate next

Not another sourcer.

1. Overnight collectors for the eight signals, public sources only.
2. A review tray for identity matches. Unconfirmed matches cannot cross the week line.
3. The same three weights, chosen by a talent lead, scored every morning against the real date. Revisit them quarterly from reply and "wrong window" tags. Do not let a model silently retune them.
4. Monday queue: score ≥ 60 and the driving window covers the week, with the why and an angle.
5. A person writes. A person sends.

Would not automate: the send, mentioning a vest date or a layoff, treating an inferred cliff as a known grant, or letting one social post flip status without a confirm.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys, no database, no network calls.

Checks (scoring arithmetic, import parsing, and independent hand-computed cases; each injects its own explicit date):

```bash
npm test
```
