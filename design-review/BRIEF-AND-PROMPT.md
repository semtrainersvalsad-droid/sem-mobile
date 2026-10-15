# SEM Mobile — brief, and a prompt for an outside UI review

Two parts. **Part 1** is the brief: what this app is and why it looks the way
it does. **Part 2** is a prompt to paste into another AI agent, along with the
two screenshots in this folder.

---

# PART 1 — THE BRIEF

## What it is

A phone app for **SEM Trainers & Systems**, an Indian distributor of medical
simulation equipment (manikins, skill-lab fit-outs, virtual dissection tables)
based in Valsad, Gujarat. It is a mobile front end onto an existing ERP that
runs on Google Apps Script with Google Sheets as the database.

Live at `https://semtrainersvalsad-droid.github.io/sem-mobile/` — a PWA
installed from the browser, not an app-store app.

## Who uses it

| | |
|---|---|
| **The owner** (Shyam) | Wants the business at a glance: billing, who owes money, what is at risk. Opens it between meetings. |
| **Field engineers** | In hospital corridors and car parks. Logging complaints, checking stock in front of a customer, recording demos. Often no signal. |

Roughly a dozen users. Android, mid-range phones, daylight.

## The screens

1. **Sign in** — phone number and password
2. **Business** (owner only) — the dashboard: billed this FY with a 12-month
   bar chart, receivables ageing, deposits and guarantees, pipeline, demos out,
   live tenders
3. **Home** — "what needs you today" as a list, then your tasks
4. **Leads** — searchable list, add a lead, log a follow-up, tap to call
5. **Tasks** — open/all filter, add, mark done
6. **Everything** — a directory of nine modules (complaints, stock, demos,
   projects, tenders, EMD deposits, guarantees, OEM letters, certificates,
   marketing assets), each a searchable list with a detail sheet

## Hard constraints the design has to live with

- **The backend takes 3–6 seconds per call.** Apps Script, not negotiable.
  Everything renders from a local cache first and refreshes behind.
- **It must work with no signal.** Creating things queues offline; editing
  shared records refuses and explains why.
- **Budget is ₹7,000/month total**, so: no design system licence, no icon
  subscription, no analytics, no component library. Icons are hand-drawn SVG
  paths in the bundle.
- **No images.** There is no product-photo library in the system.
- **The data is incomplete and often wrong.** Of 15 dashboard panels, 8 render;
  the rest are blank because the underlying columns were never filled in.

## Choices I made deliberately — please challenge them

These are not accidents, but that does not make them right.

1. **Dark theme only.** Chosen on the argument that pure white on near-black is
   the strongest contrast available in daylight. The counter-argument — that
   dark themes wash out in direct sun and that the desktop ERP is light, so
   users switch between two different-looking systems — was not tested.

2. **Explanatory sentences on cards.** Panels say things like *"37 paise in
   every rupee owed is more than 90 days late"* and *"Counted from dispatch —
   no return date on any of them."* The intent was that a number without its
   caveat is misleading. The risk is that it reads as clutter and nobody reads
   any of it.

3. **Blank panels say why they are blank** rather than showing zero. *"Win rate
   — only 0 of 850 bids have a recorded outcome."* A zero and a missing record
   look identical on a chart and mean opposite things.

4. **Three colours maximum on any categorical chart**, validated for
   colour-blindness against the card background. A fourth hue could not be
   added without a pair becoming indistinguishable, which is why things fold
   into "Other".

5. **Orange (#F08A1E) is the company's brand colour** and is reserved for UI
   chrome — the active tab, buttons, links — never for chart categories.

6. **Tenders are read-only on the phone**, by the owner's instruction.

## What I already suspect is wrong

Said plainly so the reviewer is not starting cold, and so they can disagree:

- **It is dense and text-heavy.** Explanatory sentences everywhere. It may read
  as an engineer's app rather than an owner's.
- **Everything is the same shape.** Rounded dark rectangles at similar weights.
  Hierarchy comes almost entirely from font size.
- **No typography personality.** System font throughout.
- **No motion.** No transitions, no loading skeletons, nothing acknowledges a tap.
- **The sign-in screen is a flat orange field** and looks unlike the rest of the app.
- **The "Everything" grid is dark tiles on a dark background** with low separation.
- **Spacing is tight** — cards are close together and padding is small.
- **Five bottom-nav items** with 10px labels.

## Design tokens, as built

```
background   #0B0D10    card      #171B21    raised  #1E232A
line         #242A32    text      #FFFFFF    muted   #99A3B0
faint        #6B7684    accent    #F08A1E    on-accent #1F1405
red  #FF6B61   amber #FFB443   green #45D9A0
chart series  #3987E5  #199E70  #9085E9
card radius 18–22px · figures use tabular numerals
```

---

# PART 2 — THE PROMPT TO PASTE

> Copy everything below the line into the other agent, and attach
> `01-signin-business-everything.jpg` and `02-home-leads-tasks.jpg`.

---

I need a hard, specific critique of a mobile app's UI. Please do not be
encouraging — I am not looking for reassurance, I am looking for the reasons it
feels wrong.

**The app:** a phone app for an Indian medical-equipment distributor (~12
users), used by the company owner to see the business at a glance and by field
engineers standing in hospital corridors, often with no signal. It is a PWA, not
a native app. Attached are two screenshots showing: sign-in, the owner's
dashboard, the module directory, the home screen, leads and tasks.

**Constraints that cannot change:**
- Backend is Google Apps Script; every call takes 3–6 seconds, so screens render
  from a local cache and refresh behind
- Must work offline
- Total budget ₹7,000/month — no paid design system, icon library, or component
  library; icons are hand-drawn SVG
- No product photography exists
- Much of the underlying data is missing, so some panels are deliberately empty

**Choices the developer made deliberately. Tell me if they are wrong:**
1. Dark theme only, argued as best for daylight contrast — though the desktop
   ERP the same people use is light
2. Explanatory sentences on cards ("37 paise in every rupee owed is more than 90
   days late") on the theory that a number without its caveat misleads
3. Empty panels state why they are empty instead of showing zero
4. Maximum three colours on any categorical chart, for colour-blind separation
5. Brand orange reserved for UI chrome only, never for data

**What I want from you:**

1. **First impression in three sentences.** What does this look like it was
   made by, and for whom? Be blunt.

2. **The top five problems, ranked by how much they hurt**, with a concrete fix
   for each. Separate "this is broken" from "this is a matter of taste" and say
   which is which.

3. **Judge the five deliberate choices above individually.** For each: keep,
   modify, or drop, and why. I especially want pushback on the dark theme and on
   the explanatory text — the developer believes in both and may be wrong.

4. **Visual hierarchy.** On the dashboard, what does the eye hit first, and is
   that the right thing? Everything is a rounded dark rectangle; does that read
   as calm, or as undifferentiated?

5. **What would make the single biggest difference** for the least work, given
   the constraints? One change.

6. **Three specific references** — named apps or products — that solve this
   problem well, and what exactly to take from each. Not "look at Stripe"; tell
   me which screen and which detail.

Assume competence in the implementation; the question is design judgement, not
whether it works. Be concrete: point at what you can see in the screenshots
rather than giving general principles.
