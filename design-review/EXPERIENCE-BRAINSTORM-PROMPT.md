# Prompt: brainstorm the experience of SEM Mobile

This is **not** an audit prompt. The last round produced audits — contrast
ratios, touch targets, spacing — and the contrast is now measured and passing.
The app is correct and nobody enjoys using it. That is a different problem, and
it needs ideas, not findings.

Paste everything below the line into another agent. Attach
`03-CORRECTED-real-chrome.jpg`.

**Before you send it:** fill in the one section marked `[YOUR ANSWER]`. It is
the most valuable part of the prompt and the only part nobody else can write.

---

I want you to brainstorm the *experience* of a mobile app. Not critique it —
imagine what it could be. I am going to rebuild a screen from scratch and I
want genuinely different directions to choose from, not a list of improvements
to what exists.

## Who this is for, and when they actually open it

**SEM Trainers & Systems** sells medical simulation equipment — manikins,
skill-lab fit-outs, virtual dissection tables — to medical and nursing colleges
across India. Based in Valsad, Gujarat. About a dozen people use the app.

Four real moments:

1. **The owner, 7am, before leaving the house.** Phone in one hand, tea in the
   other. Thirty seconds. He wants to know if anything went wrong overnight and
   what he should worry about today.
2. **The owner, in a car between meetings.** Two minutes. Someone just
   mentioned a college name and he wants to know what they owe and what is open
   with them.
3. **A field engineer in a hospital corridor.** No signal. A customer is
   standing next to him asking whether a particular trainer is in stock and
   what it costs. He needs an answer in fifteen seconds without looking lost.
4. **The same engineer at 7pm**, logging what happened today before he forgets.

These are not "dashboard" moments. Three of the four are someone standing up,
distracted, slightly rushed, often in front of another person.

## What exists now

A dark, dense operational app. Attached screenshot shows sign-in, the owner's
dashboard, and the module directory.

The owner's screen stacks: billed this financial year with a 12-month bar
chart, money owed with an ageing breakdown, deposits and guarantees, pipeline,
live tenders, demos out. Every card carries an explanatory sentence — *"37
paise in every rupee owed is more than 90 days late"*, *"Line-item amounts, so
tax is excluded"*, *"Counted from dispatch"*.

**The honest verdict, from two outside reviews and from the owner:**

- The plain-English copy is the best thing about it. Both reviewers singled it
  out unprompted. Keep that instinct.
- The data choices are right — it shows real exposure, not vanity metrics.
- **It is exhausting.** The developer optimised hard for never misleading
  anyone, and the result is a screen that explains itself to you in red before
  you have learned anything. Twelve caveats on one screen.
- The owner's words: *"I am not liking the experience."*

So: the content is roughly right and the *feeling* is wrong.

## Constraints that are real

- Backend takes **3–6 seconds per call**. Screens render from a local cache
  instantly and refresh behind. Any idea that needs a fast server is out.
- **Must work with no signal.**
- **Total budget ₹7,000/month.** No paid design system, no icon subscription,
  no component library, no custom fonts beyond free ones.
- **There is no product photography.** None exists anywhere in the business.
- **Much of the data is missing.** Of 15 dashboard panels, 8 have real data.
  850 tenders exist with not one recorded outcome.
- It is a PWA, installed from the browser. Android, mid-range phones, used
  outdoors in Gujarat daylight.

## Already tried and rejected by the owner

Do not re-propose these:
- A home screen that is a to-do list of tasks
- A generic KPI dashboard with evenly weighted stat tiles
- Light theme (the brand is orange `#F08A1E`; dark was chosen deliberately)

## [YOUR ANSWER] — what it should feel like

*The owner fills this in before sending. Name one or two apps on your phone
whose feel you would point at and say "like that", and say what it is about
them. Banking, delivery, messaging, anything — it does not need to be business
software. If you cannot name one, describe the feeling in your own words:
calm? fast? serious? friendly? expensive?*

...

## What I want from you

**Give me four genuinely different directions.** Not four variations on dark
cards. Four different answers to "what is this app, fundamentally".

For each one:

1. **A name and a one-line thesis.** What is the organising idea?
2. **What it feels like in one sentence** — the emotional register.
3. **Describe the owner's first screen concretely.** What is at the top, what
   is below it, what is the biggest thing on screen, what did you cut. Be
   specific enough that someone could build it.
4. **What this direction deliberately sacrifices.** Every direction gives
   something up; name it.
5. **Why it might fail for these particular users.** Argue against your own
   idea.

Then:

6. **The caveat problem.** Every number here has a real qualification —
   figures exclude tax, dates are unreliable, some panels have no data. The
   current app writes them all on screen and it is too heavy. Give me three
   different mechanisms for carrying a caveat without the screen shouting it.
   Being wrong silently is not acceptable; this is medical equipment and
   government tenders, and a wrong number costs real money.
7. **One idea that has nothing to do with dashboards.** If the owner's thirty
   seconds at 7am is the real job, what is the most direct way to do that job?
   It might not be a screen full of numbers at all.
8. **The cheapest single change** that would most improve how this feels,
   given the constraints. One thing.

Be concrete and opinionated. I would rather have one direction I disagree with
strongly than four I feel lukewarm about. Do not hedge, do not give me a
balanced survey, and do not tell me to do user research — there are twelve
users and I can ask them directly.
