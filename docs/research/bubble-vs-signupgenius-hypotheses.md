# Where Bubble Can Beat SignUpGenius

**A market-opportunity analysis with user evidence, Bay Area market sizing, and a testing plan**

*Prepared July 2, 2026. Audience: leadership and design. Parts of this document —
especially the venue-partnership sections — are written so they can be lifted into
pitch materials for individual businesses.*

This document synthesizes three independent functional evaluations of SignUpGenius
([take one](signup-genius-take-one.md), [take two](signup-genius-take-two.md),
[take three](signup-genius-take-three.md)), adds original research into what real
users — especially teachers, school staff, and business operators — say about the
product, proposes eight hypotheses for where Bubble could win, sizes the reachable
market in the nine-county San Francisco Bay Area, and lays out inexpensive ways to
test the most promising ideas before we build anything.

---

## Executive summary

SignUpGenius is very good at one thing: turning "I need twelve parents to bring
cupcakes" into a filled list with almost no effort. That core is genuinely hard to
beat head-on, and we should not try.

But the research surfaced three structural weaknesses that the company cannot easily
fix, because fixing them would mean changing its business model or its core
interaction:

1. **The free product has become hostile to its own users.** Teachers describe the
   ad experience as "pop-up whack-a-mole" and say they are "embarrassed" to send
   SignUpGenius links to parents. The ads *are* the free-tier business model, so
   this will not improve.
2. **First-come-first-served is baked into the product's DNA.** Slots go to whoever
   clicks fastest. In groups with mandatory participation — schools above all — this
   quietly rewards the same fast-fingered families every time and breeds real
   resentment. A fairness-based alternative isn't a feature SignUpGenius can bolt
   on; it's a different philosophy of signing up.
3. **Nobody in this market serves the venue.** SignUpGenius charges the organizer.
   Yet for a whole category of recurring group activities — bowling leagues, trivia
   nights, game nights — the party with the clearest financial motive is the venue
   that sells the shoes, the pitchers, and the appetizers. The bar-trivia industry
   already proves venues will pay real money for guaranteed weeknight traffic.

Our four strongest opportunities, in recommended order of testing:

- **Fairness-first signups for schools** (preference windows and lotteries instead
  of a race) — the most emotionally resonant, cheapest to test.
- **Venue-sponsored groups** (the group plays free; the venue pays because the group
  spends) — the clearest path to revenue that never charges an individual member.
- **Team-finding for solo players**, piggybacked on venue partnerships.
- **Lightweight credential tracking** (chaperone insurance, ServSafe certificates,
  liability paperwork) — a real gap, best tested with restaurants before schools.

Everything below supports those conclusions with evidence, and ends with a concrete,
mostly no-code testing plan.

---

## Part 1: What SignUpGenius is, and where it is strong

All three evaluations, produced independently, paint the same picture.

**The product.** SignUpGenius is a freemium web tool for organizing people into time
slots and tasks: volunteer shifts, potluck items, parent-teacher conference slots,
event registrations. Over time it has layered on payments, fundraising, dues
collection, ticketing, and even auctions. It is owned by Lumaverse Technologies and
is the recognized market leader in its niche — for many parents and teachers,
"send out a SignUpGenius" is a verb.

**The business model.** A free, ad-supported tier drives viral adoption (every
participant sees the product and may become the next organizer). Paid tiers —
roughly **\$9 to \$60 per month** depending on plan and billing — remove ads and unlock
branding, text messaging, multiple administrators, and reporting. Payments collected
through the platform carry a **5% + \$0.50 per-transaction fee**, processed through
Stripe. For comparison, its closest competitor SignUp.com charges roughly
**2.9% + \$0.30.** Raw Stripe pricing is similar. SignUpGenius takes a meaningful
and unjustifiable markup on every dollar that a PTA, charity, or league collects.

**Where it is genuinely strong.** The evaluations agree on the moat: participants
can sign up from a shared link without creating an account, organizers can build a
sheet in minutes, and reminders go out automatically. That "no login, no training,
no IT department" quality is why it spread through schools and churches, and any
challenger has to match it as table stakes.

**Where it is thin.** All three evaluations independently flag the same gaps:

- It fills slots, but it has **no memory of people across events**. There is no
  notion of "this family has already done three shifts this year" or "this person
  always takes the easy jobs." Speculation: it probably does not distinguish between 
- "John Anderson", "John A."
- It can *ask* custom questions ("Do you have insurance?") but it cannot **verify,
  store, expire, or revoke** anything. There is no credential lifecycle, no records, no proof.
- Its interface is widely described as **dated**. The free tier is cluttered
  with ads.
- Reporting is administrative (who signed up, who paid), never longitudinal. 
  Speculation: it is difficult or impossible to determine
  activity by a person or a family for a child, success or failure at 
  filling a venue, changes over time. Unclear, though: it might be behind premier plans
- One evaluation explicitly lists as a market threat: *"low barrier to entry for
  modern, design-centric startups."* That is us.

One caution on the source material: the three evaluations disagree about how deep
SignUpGenius's enterprise features go (single sign-on, compliance certifications,
white-labeling). Where they conflict, we treat the enterprise-depth claims as
unverified. None of our hypotheses depend on them.

---

## Part 2: What real users actually say

We collected verbatim complaints from Capterra, Trustpilot, TrustRadius,
SoftwareAdvice, GetApp, the Apple App Store, and Reddit (including the r/Teachers
community), with particular attention to teachers, school staff, and people running
organizations or businesses. Quotes below are reproduced word-for-word; sources are
linked at the end of the document.

### The ad experience is driving away the education base

This was the loudest and most consistent theme, and it comes straight from the
customer segment SignUpGenius is most identified with. From a May 2024 r/Teachers
thread titled *"Signup Genius alternatives that aren't so cluttered with ads?"*:

> "But in recent years it has become so cluttered with ads that it's actually
> becoming difficult to use." — teacher (original poster)

> "I agree. It is absolutely infested with popups. To the point where the
> sign-up-genius pop-up whack-a-mole is incessant." — teacher

> "Completely agree! I'm kind of embarrassed to use it at this point, but admin
> sends it out automatically…" — teacher

> "I get ads for bras on the signupgenius that I sent out for parent teacher
> conferences." — teacher, r/Teachers

> "The ads. As soon as you sign up for something your have ads to close."
> — office manager, Capterra

The word *embarrassed* is worth pausing on. These are people distributing the
product to hundreds of parents under their own professional name, and the product
is making them look bad. That is exactly the emotional condition under which people
switch tools — and it cannot be fixed without dismantling the free tier's revenue.

### The slot race feels bad, and people know it

The first-come-first-served dynamic shows up in users' own words — including from
both the winners and the losers of the race:

> "We are to perform two chaperone duties per year. It's really important to hit
> that sign up genius link right away to get the ones you want! Some of my
> colleagues prefer choral concerts or plays and others athletic events."
> — teacher, r/Teachers (note: even *staff* race each other for the good duties)

> "I'm first in the sign up genius for paper plates, napkins or the cash donation 😂"
> — parent, Reddit (the cherry-picker's own words: easy, cheap slots get snapped up
> first, leaving the labor-intensive ones for slower families)

> "Sometimes I sign up for something, and by the time I have gotten to the end,
> another person has taken that spot." — Capterra reviewer

> "…we're having to compete with people outside of Hays county for spots,
> hunger-games-style." — community member describing a SignUpGenius-run signup,
> Reddit

Off-platform, the same problem shows up as improvisation: teachers on the ProTeacher
forum describe hand-running lotteries and sending apologetic waitlist notes when
chaperone interest outstrips slots. The tooling doesn't help them, so they work
around it by hand.

*An honest caveat:* we searched specifically for a parent saying, in so many words,
"the same families always win the signup race at our school," and could not find
that exact archetype written down. The ingredients are all verbatim-documented
(racing, cherry-picking, slots gone in minutes, teacher-run lotteries), but the
full sentence is our inference. Our interviews should test whether parents volunteer
it unprompted — that is a specific, falsifiable prediction.

### Organizations hit walls when they try to run real operations on it

From reviewers who identify as running nonprofits, businesses, or programs:

> "If we have several events — say 10 — and we are only allowing people to sign up
> for five events, we have not figured out a way to limit someone from signing up
> for all 10 events since they are separate signups." — Accounting Manager,
> commercial real estate firm, TrustRadius

That quote deserves a highlight: it is a paying organization asking, almost
verbatim, for the **cross-event quota feature** in our fairness hypothesis — and not
getting it.

> "Time consuming to fill in fields with needs & slots… if you have a recurring
> event, if there was a 'duplicate' option it was not clear." — Owner,
> health/wellness & fitness business, Capterra

> "It should be much easier to copy a sign-up from one year to the next."
> — Trustpilot reviewer

> "There isn't anything for complex scheduling needs." — Career Coach, nonprofit,
> Capterra

> "The platform is sub-par in it's ability to collate contact information or mass
> communicate." — Paralegal, law practice, Capterra

> "To set up the time and time slot is not intuitive. I mess up every time I create
> a Sign Up and have to start over. If I wasn't on the Board of an organization
> that uses this program, I wouldn't use it." — organization board member,
> Trustpilot

> "you have to manually input every single slot. There is no 'Create 15 minute
> slots from 4:00pm–6:00pm' options" — teacher, r/Teachers, on building
> parent-teacher conference sheets (a companion comment in the same thread:
> "Creating Signup Geniuses for parent teacher conferences is a massive pain in
> the ass.")

### Privacy and data practices worry the technically literate

School IT staff — the people who often decide what tools a district blesses — had
some of the sharpest words:

> "This just screamed red flag to me, a bunch of users putting in their names and
> the work emails into this site that was 'free' and had ads." — IT administrator,
> r/sysadmin

> "They will spam the email addresses entered from time to time." — IT director
> who uses it for school volunteering, r/sysadmin

> "I've also seen too many people leave things publicly open and if you use one of
> the few customizable options to let the parents input what they want to discuss,
> now everyone and their mother can see the problems." — teacher, r/Teachers, on
> parent-teacher conference sheets exposing what each family wants to talk about

> "We are getting a ton of these that are ending up in Admin Quarantine for Google
> Mail." — K-12 school IT administrator, on SignUpGenius confirmation emails
> failing spam checks so parents never receive them

### When things break, support does not come

> "Recently, our account became corrupted and began linking to a different account.
> As a result, we effectively lost access to years' worth of sign-ups and
> historical data. … After more than a month of follow-ups, we have received
> minimal communication, no clear explanation, and no meaningful resolution."
> — booster club administrator, Trustpilot

> "I've been a loyal, paying customer of SignUpGenius for years… However, when I
> really needed support, their website had a glitch which made it impossible to
> submit a customer service request and no other way to contact them."
> — paying customer, Trustpilot

> "I cancelled my subscription for $4.99. They then proceeded to charge me $49.99 a
> month (twice) till I caught it and cancelled my account." — Trustpilot reviewer

### Pricing and fees grate, especially on nonprofits

> "only the most expensive option has no ads" — Executive Director, performing
> arts organization, Capterra

> "Pricing for Ad free sign ups is more than we care to spend" — President,
> health/wellness & fitness organization, Capterra

On the 5% + $0.50 payment fee specifically, an honest note: Capterra's own
aggregated review summary lists the "5% payment collection fee" among the most
commonly cited drawbacks, and competitors like Zeffy build entire marketing pages
around it ("$820/Year VS $0 for Nonprofits") — but we could not retrieve an
individual reviewer's verbatim rant about the fee. The closest first-person evidence
is a school fundraiser organizer on Reddit matter-of-factly describing passing "~$2
a transaction" on to families buying barbecue. Our reading: the fee is a real
switching *sweetener* competitors use successfully, but it is not, by itself, what
makes people angry enough to leave.

### And people do leave

> "I was a previous user of SignUpGenius and my users really struggled with it."
> — Volunteer Administrator, religious institution, explaining a switch to
> SignUp.com (Capterra)

> "Signup.com did not require users to create an account" — Senior Administrative
> Assistant, government, on why they chose the competitor (Capterra)

> "I'm going Google Doc. Those who don't have it, can easily sign up. Much easier
> than signs-up genius!!" — Trustpilot reviewer

> "Calendly.com. Signup genius is horrendous" — teacher, r/Teachers

> "…used to use signupgenius (which is a dumpster fire)." — event organizer, Reddit

The switching destinations are telling: people are fleeing to tools that are
*simpler* (Google Docs, Calendly), not more powerful. The unmet need is not more
features — it is a product that respects its users.

### What the complaint record does NOT contain

Two absences matter as much as the complaints. First, nobody complains that
SignUpGenius fails at its core job — sheets get filled. Second, the reviewer base is
overwhelmingly education, nonprofit, and church; genuine commercial operators (bar
owners, bowling alley managers, restaurant event managers) barely appear *at all*.
The most plausible interpretation, which we should treat as a hypothesis rather
than a fact: venues are not unhappy SignUpGenius customers — they were never its
customers in the first place. That is white space, not a battleground.

---

## Part 3: The opportunity hypotheses

Eight hypotheses follow, with the four we recommend pursuing marked with a star.
For each we give our honest confidence that the idea survives first contact with
real users — which is a lower bar than "becomes a business," and we've tried to use
plain probability language rather than enthusiasm.

### ★ Hypothesis 1: Fairness-first signups for schools and clubs

**The problem.** Every SignUpGenius sheet is a race. The notification goes out to
everyone simultaneously; in practice the slots go to whoever is free (and quick) at
that exact moment. In groups with mandatory participation quotas and a limited
number of events per year, the slow-to-act become steadily more desperate, and the
fun tasks are cherry-picked early — a dynamic documented in users' own words above,
down to the parent gleefully claiming "paper plates, napkins or the cash donation"
before anyone else can.

**The Bubble alternative.** Replace the race with a **preference window**: everyone
gets, say, 48 hours to rank the slots they'd like; then Bubble allocates — by
lottery, by rotation, or weighted by history, so that the family that hauled
tables in the rain last time gets first pick of the bake-sale table this time.
Around that sits a season-long ledger: each member's participation count, quota
progress, and a visible, defensible answer to "why did she get the fun one?"
Note that a paying business customer on TrustRadius is *already asking* for the
cross-event cap ("only allowing people to sign up for five events…") and the
product cannot do it.

**Why the incumbent can't follow.** First-come-first-served isn't a SignUpGenius
bug; it is the entire interaction model, and their organizer base has learned it.
An allocation model requires the cross-event memory of people that all three
evaluations confirm SignUpGenius lacks.

**Confidence: likely to resonate.** The strongest external validation of any
hypothesis here — teachers already hand-roll lotteries. The real design risk is
that *perceived* fairness and *algorithmic* fairness are different things; the
allocation rules will need to be simple enough to explain at a PTA meeting.

### ★ Hypothesis 2: Venue-sponsored groups — the bowling alley model

**The problem (really, the untapped win-win).** Consider a bowling group that meets
weekly at the same alley. The alley charges the group nothing for organizing there —
it doesn't need to, because sixteen people rent shoes, buy lanes, order pitchers
and nachos every Tuesday. The group needs scheduling, attendance, substitutes, and
reminders; the alley needs *predictable* bodies on its slowest nights. Today,
nobody's software connects those two needs.

**The Bubble alternative.** The group's tools are free, forever — scheduling,
attendance, waitlists, reminders. The **venue** pays Bubble, because the venue is
the party making money: a dashboard where the alley (or bar, or café) publishes
free-to-join recurring slots ("league night, 8 lanes, Tuesdays"), sees reliable
headcounts far enough ahead to staff correctly, and messages its groups. Bubble's
price to the venue can be a flat subscription or per-filled-seat.

**Why we believe venues will pay.** The bar-trivia industry has already run this
experiment for us. Companies like Last Call Trivia and 123 Trivia sell hosted
trivia *as a service* to bars, and their pitch is precisely "we fill your Tuesday";
industry material claims trivia nights lift weekday revenue 30–50%, concentrated on
Tuesday and Wednesday. Venues demonstrably pay for weeknight group traffic. What no
one sells them is the *group-relationship* layer — the recurring, self-organizing
crowd rather than the one-night show.

**Why this matters for our business model.** As a new startup we cannot charge
individual members — engagement would go to zero. This hypothesis is the cleanest
answer to that constraint: the *only* party who ever sees an invoice is the one
with a cash register.

**Confidence: likely worth testing; roughly even odds venues pay before seeing
proof.** Which is exactly why the first test (Part 6) is designed to *manufacture*
the proof: one sponsored night, one till report.

### ★ Hypothesis 3: "Find me a team" — matchmaking for solo players

**The problem.** Plenty of people would love to play trivia, bowl, or throw darts
but have no team. Plenty of teams are one player short. Nothing bridges them.

**The Bubble alternative.** At venues where Hypothesis 2 is live, an "open seats"
board: teams flag that they have room; solo players raise a hand; the venue's
regular night absorbs them.

**Why the sequencing matters.** Pure stranger-matchmaking apps die of the
two-sided cold-start problem: no players without events, no events without players.
Anchoring to a venue partner collapses one side — the event already exists,
recurring, at a known place and time. This should be treated as an *upsell inside
Hypothesis 2*, never a standalone launch.

**Confidence: roughly even.** The social appetite is real, but no-show rates for
meet-a-stranger commitments are notoriously poor, and we won't know ours until we
count actual show-ups at a pilot night.

### ★ Hypothesis 4: Lightweight credential tracking with expiry and revocation

**The problem.** A school running a field trip needs to know each driving chaperone
has a valid license and insurance. A restaurant hosting a popup dinner or
wine-tasting class needs the guest chef's certificate of insurance and the staff's
ServSafe cards, and often a paper trail afterward. SignUpGenius can *ask* these
questions in a custom form field; it cannot verify a document, track an expiration
date, or let the responsible party revoke someone the night before. Today this is
handled by hand, per event, every time.

**The Bubble alternative — deliberately modest.** Version one is an *attestation
workflow*, not a verification service: participants upload documents; the named
organizer reviews and approves; every credential carries an expiry date; a lapsed
credential automatically releases the slot; the responsible party can revoke with
one click, with an audit trail of who approved what and when. Bubble never claims
the license is valid — it claims that *this approver reviewed this file on this
date*. That distinction keeps legal responsibility exactly where it already lives
(with the school or the venue) and keeps us out of the background-check business,
which a company our size cannot safely enter.

**Confidence: roughly even.** The pain is real and recurring, but school-district
procurement is slow. That is why we recommend testing with restaurants and popup
hosts first — same feature, buyers who can say yes in a week — and bringing the
proven workflow to schools second.

### Hypothesis 5: Undercut the payment fee — *supporting move, not a wedge*

SignUpGenius's 5% + $0.50 is roughly double SignUp.com's rate and well above raw
Stripe pricing. Competitors already market against it. We should absolutely offer
near-pass-through payment pricing — but the complaint record suggests fees are what
people grumble about on the way out the door, not why they open it. Fold "and we
don't take 5%" into the messaging for Hypotheses 1 and 2; do not build a company on
it. **Confidence: unlikely to work as a standalone wedge.**

### Hypothesis 6: Simply not being annoying — *table stakes, not a hypothesis*

Effortless slot-swapping (a top complaint), rosters that show *counts* rather than
every neighbor's name and email (a top privacy complaint), an ad-free experience,
confirmation emails that actually arrive. These fix the loudest reviews, and any
modern entrant must have them — but "SignUpGenius, minus the ads" invites the
question "why not just use Google Docs?", which is exactly where frustrated users
already go. Build these as baseline quality inside Hypotheses 1–4; don't test them
as a standalone pitch.

### Hypothesis 7: A trusted marketplace connecting providers and venues — *not yet*

The fullest version of the vision: hotels finding Toastmasters chapters, cafés
finding trivia hosts, children's venues finding vetted face painters, adult venues
finding vetted childcare. We believe in the destination but not the direct route:
it is a two-sided, vetting-heavy marketplace where incumbents already hold the
supply (GigSalad and The Bash for entertainers; the trivia companies for hosts).
The realistic path is *emergent*: once Hypothesis 2 gives us a network of venues
and Hypothesis 4 gives us a credential vault, brokered introductions become a
natural extension rather than a cold-start marketplace. **Confidence: unlikely to
be testable productively in the next two quarters; revisit once H2 and H4 have
traction.**

### Hypothesis 8: Compete for schools head-on — *reframed*

Schools are SignUpGenius's fortress, and for the happy path (a bake-sale sheet) the
incumbent is adequate and entrenched. We do not recommend a frontal "better signup
sheet for schools" pitch. The school strategy *is* Hypotheses 1 and 4: enter where
the incumbent structurally cannot follow (fairness) and where it has no product at
all (credentials) — with the ad-embarrassment documented in Part 2 as the emotional
opening ("send parents something you're proud of").

---

## Part 4: The payment question

Our standing constraint: **the individual participant never pays.** A brand-new
network product that charges members gets zero engagement. Every revenue path below
charges an organization that captures value, in descending order of how clearly
they can see that value:

1. **Venues buying traffic** (Hypothesis 2). The bowling alley pays because Tuesday
   league night sells shoes, lanes, and concessions; the bar pays because trivia
   night sells pitchers and wings. This is the purest win-win-win: members free,
   group free, venue profitable, Bubble paid. It is also the most *pitchable in
   person* — a one-page flyer and a five-minute conversation with an owner.
2. **Organizations buying compliance** (Hypothesis 4). The restaurant hosting
   popups pays for the credential workflow because it saves staff hours and reduces
   risk; schools follow once the workflow is proven.
3. **Organizers buying fairness and pro features** (Hypothesis 1). PTA-budget-sized
   subscriptions, realistic only after the free product has earned love.
4. **Payment pass-through** (Hypothesis 5). Near-cost processing as a loyalty
   feature, not a profit center.

Other win-win shapes worth keeping on the whiteboard, all variants of "the venue
underwrites the group because the group spends": the café that hosts a weekly board
game club (sells coffee and pastries all evening), the brewery that hosts a running
club's finish line (sells the post-run round), the axe-throwing venue that
sponsors a corporate-league bracket, the movie theater that gives a film club a
standing Tuesday screening room. In every case the group's tooling is free, the
venue pays for predictability, and members' only "payment" is the spending they
were happy to do anyway.

---

## Part 5: How big is this in the Bay Area?

Rough counts of addressable organizations in the nine-county Bay Area (San
Francisco, San Mateo, Santa Clara, Alameda, Contra Costa, Marin, Sonoma, Napa,
Solano), compiled July 2026 from official datasets where possible — the California
Department of Education directory, Census County Business Patterns 2023, the 2020
U.S. Religion Census — and from directories where not. Treat these as
order-of-magnitude planning numbers, not census precision; confidence notes are in
the table.

| Segment | Bay Area count | Relevant to | Confidence |
|---|---|---|---|
| K-12 public schools | **~1,780** (≈1,500 conventional) | H1 fairness, H4 credentials | High — counted from the CDE directory file |
| K-12 private schools | **~730** | H1, H4 | High — CDE affidavit data |
| PTA units (+ independent PTOs) | **~600–680 PTAs**; ≈1 parent org per school → **~1,400–1,700 total** | H1 | Medium — PTA district rosters; PTO count is a ratio estimate |
| Bowling centers | **~30–40** | H2 venues, H3 | Medium — Census undercounts small counties; gap-filled from directories |
| Bars & taverns (employer establishments) | **~955** (SF 388, Alameda 165, Santa Clara 130…) | H2, H3 | High for employer establishments; total drinking places likely 2–3× |
| — of which plausibly trivia-hosting | **~100–300** (estimate) | H2, H3 | Low confidence on the range; "low hundreds" direction is solid |
| Full-service restaurants | **~7,800** (all food service ~20,000) | H2, H4 popups | High — Census CBP |
| Churches / congregations | **~3,800** (plausibly 4–5K with independents) | H1-style fairness, volunteer coordination | Medium-high — 2020 Religion Census |
| Registered nonprofits | **~52,000 registered; ~40K are 501(c)(3); perhaps a third operationally active** | H4, general coordination | Medium — IRS-filing data via Cause IQ; many are shells |
| Youth sports | **~110–130 Little League charters, ~40–60 AYSO regions; 500+ leagues all sports** | H1 fairness (snack/carpool duty!), H2 | Medium for LL; all-sports figure is an estimate |
| Niche venues (axe throwing, pool halls, board-game cafés) | **~50–75 combined** | H2, H3 | Low-medium — directory counts in a churny category |
| Toastmasters clubs | **~320–420** | H7 eventually | Medium — district rosters mid-realignment |

**What the numbers say about strategy.** Three readings matter:

- **The school opportunity is big enough and small enough.** Roughly 2,500 schools
  and ~1,500 parent organizations is a market a tiny team can meaningfully dent by
  showing up at PTA meetings in person — and each school is a *recurring* customer
  (every year brings new field trips and new races).
- **The venue opportunity is a walking tour, not an ad campaign.** Thirty-odd
  bowling alleys and low-hundreds of trivia-capable bars means the entire Bay Area
  H2 market can literally be visited in person — which matches our stated
  go-to-market of reaching disaffected groups face to face. Ten venue contracts is
  a real business milestone reachable on foot.
- **Restaurants are the volume play for credentials.** ~8,000 full-service
  restaurants dwarf every other segment with money; even a fraction of a percent
  hosting popups or classes is hundreds of potential H4 customers with fast
  decision cycles.

A loose union across segments gives **roughly 15,000–30,000 plausibly reachable
group-running organizations** in the nine counties. We will never need most of
them; the point is that even the narrowest starting wedges (30 alleys, 2,500
schools) are large enough to prove or kill each hypothesis locally before spending
anything on scale.

---

## Part 6: How we test these ideas

The guiding principle: **measure behavior over stated intent, and spend no
engineering until a human has faked the product by hand.** In roughly ascending
order of cost:

### Interviews and observation (UXR) — start here, weeks 1–2

Five to eight sessions with people who used SignUpGenius in the last 90 days: PTA
room parents, teachers, one or two league organizers. Watch them run a real signup
on their own account (the ads, the slot-editing struggle, and the racing will
demonstrate themselves). Then probe: *"Tell me about the last time a signup felt
unfair."*

This produces two things surveys cannot: the *vocabulary* real users use (which
feeds every later survey, mockup, and pitch), and a test of our specific
prediction — **if Hypothesis 1 is real, at least half of interviewees will
volunteer an unfairness story without being prompted.** If they don't, we've
falsified our strongest hypothesis for the price of eight coffee cards.

Recruiting note: the angry reviewers quoted in Part 2 are unreachable, but their
segments are not — PTA meetings, teacher friends-of-friends, and venue owners are
all in-person accessible, which is precisely our stated outreach model. One
screening question suffices: "Have you used SignUpGenius in the past 90 days?"

### Surveys — after interviews, not before

The task list asked us to evaluate both large-volume and invitation-only surveys.
Our assessment:

**Large-volume panel surveys** (SurveyMonkey Audience, Prolific, Pollfish — paying
a panel provider for hundreds of screened respondents):

- *What they're good for:* prevalence numbers with statistical weight. "62% of Bay
  Area parents who used an online signup in the past year say desirable slots were
  gone before they opened the email" is a sentence that belongs in a pitch deck and
  can only come from volume.
- *The risks:* panel respondents are professional survey-takers, and screening for
  genuine SignUpGenius users burns money fast (incidence in a general panel will be
  low, and every screened-out respondent still costs). Worse, "would you use a
  product that…?" questions produce reliably inflated yeses — stated intent is the
  most notorious false signal in early-stage research. And a badly worded question
  cheerfully manufactures the evidence we were hoping to find.
- *Verdict:* useful **once, narrowly, and late** — a single prevalence question
  battery (past-year signup-tool use, the unfairness experience, the ad
  experience), fielded only after interviews have taught us the wording, and only
  if a pitch deck needs the statistic. Budget guess: $1–3K for 300–500 screened
  respondents. Never use it to test *demand*; only to size *pain*.

**Invitation-only surveys** (sent to named lists: a PTA council's membership, a
school's parent list with the principal's blessing, venue owners we've met):

- *What they're good for:* exactly the right respondents, response rates an order
  of magnitude better, free, and — the underrated payoff — **every respondent is a
  recruitable pilot user.** The final question is "Would you like your school/venue
  in the pilot? Leave your email." The survey is quietly a lead-generation tool.
- *The risks:* small samples, and selection bias in both directions — the people
  who agree to take a survey from us skew friendly, and one PTA council is not the
  Bay Area. Numbers from these surveys inform *us*; they should not be quoted as
  market statistics.
- *Verdict:* the workhorse. Cheap, fast, targeted, and doubles as pilot
  recruitment. Run one per hypothesis audience: a parent/teacher version (H1), a
  venue-owner version handed over in person or emailed after a visit (H2), a
  popup-host version (H4).

**Recommended sequence:** interviews → invitation-only surveys (quantify within
reached communities + recruit pilots) → one paid panel survey *only if* the
resulting pitch needs a defensible prevalence stat. At every stage, prefer a
behavioral signal (they clicked, they signed up for the pilot, they showed up)
over a stated one (they said they liked it).

### Mockups and paper tests — parallel with the surveys

- **The two-flow comparison (H1).** A Canva or Figma side-by-side: the familiar
  race versus a 48-hour preference window with a visible fairness ledger. Present
  at a PTA meeting; ask which they'd adopt *for the next field trip* and what
  arguments it would start. The objections are the data — especially objections
  from the fast-fingered families who currently win.
- **The venue one-pager and dashboard mock (H2).** A single page an owner can read
  in ninety seconds — "Your Tuesday nights, full" — plus a mocked dashboard
  screenshot. This artifact doubles as the actual sales collateral for the concierge
  pilot below, which is why this document is written to be quotable.
- **A 90-second video walkthrough (H2).** For the venue owner who won't sit
  through a meeting: the mock dashboard narrated over screen recording. Costs an
  afternoon; reusable in email follow-ups indefinitely.

### Wizard-of-Oz pilots — no code, real stakes

- **The fairness draw (H1).** Run one real signup for one real class or team:
  collect ranked preferences with a plain Google Form, run the draw by hand,
  email the results with a friendly explanation of why each person got what they
  got. Compare complaint volume and fill rate to the group's last first-come
  race. If the organizer asks to do it again next month, that's the signal.
- **The credential binder (H4).** Find one restaurant hosting a popup and offer to
  run its paperwork: a shared checklist we maintain by hand — chef uploads COI and
  ServSafe cards, we tag expiry dates, the venue sees a simple status page before
  the event. If the venue asks to *keep* the status page afterward, build it.

### The concierge venue night (H2 + H3) — the flagship test

Walk into one bowling alley or bar with the one-pager. The offer: *we will fill
one slow night, free.* We recruit and organize the group manually (which also
pressure-tests every group-side feature by hand); the venue's only obligation is
to tell us the till numbers for that night versus a normal Tuesday.

- **The H2 metric:** incremental spend — shoe rentals, lane fees, bar tab. One
  green Tuesday becomes the case study that opens the next ten doors, and with
  only ~30–40 alleys in the Bay Area, ten doors is a meaningful share of the
  market.
- **The H3 rider:** at that same night, a physical "open seats" table and a QR
  code. Count solo scans, joins, and — the number that actually decides the
  hypothesis — show-ups. We commit to building zero matchmaking product until we
  have observed a real show-up rate.
- **The pricing test:** after the free night succeeds, present three price
  structures (flat monthly, per-filled-seat, revenue share) and watch which one
  the owner *argues about* rather than rejects. An argument about price is a
  purchase intent signal; polite silence is a no.

### What we deliberately are not testing yet

No school-district sales motion (procurement is too slow to learn from), no
marketplace build (Hypothesis 7 waits for the network), no standalone matchmaking
app (Hypothesis 3 stays inside venue nights), and no reliance on "would you pay?"
questions anywhere.

---

## Sources

**Product and pricing:** [SignUpGenius pricing](https://www.signupgenius.com/pricing/enterprise) · [SignUpGenius payment fees](https://www.signupgenius.com/support/collect-money-fees) · [Zelos: SignUp.com vs SignUpGenius fee comparison](https://getzelos.com/signupcom-vs-signupgenius) · [Zeffy comparison marketing](https://www.zeffy.com/compare/zeffy-vs-signupgenius)

**Review sites (quotes):** [Capterra — SignUpGenius reviews](https://www.capterra.com/p/135392/SignUpGenius/reviews/) · [Trustpilot — SignUpGenius](https://www.trustpilot.com/review/signupgenius.com) · [TrustRadius — SignUpGenius](https://www.trustradius.com/products/signupgenius/reviews) · [SoftwareAdvice](https://www.softwareadvice.com/nonprofit/signupgenius-profile/reviews/) · [GetApp](https://www.getapp.com/collaboration-software/a/signupgenius/reviews/) · [Apple App Store — SignUpGenius](https://apps.apple.com/us/app/signupgenius/id1314654833) · [Capterra — SignUp.com reviews (switchers)](https://www.capterra.com/p/135391/SignUp-com/reviews/)

**Community threads (quotes):** [r/Teachers — "alternatives that aren't so cluttered with ads"](https://www.reddit.com/r/Teachers/comments/1cm0i4k/signup_genius_alternatives_that_arent_so/) · [r/Teachers — "what do you wish signup tools could do?"](https://www.reddit.com/r/Teachers/comments/1hpea9v/teachers_what_do_you_wish_signup_tools_could_do/) · [r/Teachers — mandatory duties thread](https://www.reddit.com/r/Teachers/comments/sm847t/mandatory_offclock_duties/) · [r/sysadmin — "has anyone ever used signupgenius"](https://www.reddit.com/r/sysadmin/comments/umohw0/has_anyone_ever_used_signupgenius/) · [r/k12sysadmin — quarantined confirmation email](https://www.reddit.com/r/k12sysadmin/comments/j6snec/anyone_having_issues_with_signup_genius/) · [ProTeacher — "too many chaperones"](https://proteacher.net/discussions/threads/how-do-you-deal-with-too-many-chaperones.391738/)

**Venue economics:** [Last Call Trivia — venue pitch](https://lastcalltrivia.com/bars/) · [123 Trivia Night — FAQ](https://123trivianight.com/faqs/) · [Trivia Anywhere — hosting economics (30–50% weekday-lift claim)](https://www.triviaanywhere.com/blog/how-to-host-bar-trivia)

**Bay Area market sizing:** [CDE School Directory](https://www.cde.ca.gov/schooldirectory/) · [CDE private school affidavit data](https://www.cde.ca.gov/ds/si/ps/documents/privateschooldata2425.xlsx) · [Census County Business Patterns 2023](https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23co.zip) (NAICS 722410 bars, 722511 restaurants, 713950 bowling) · [California State PTA district list](https://capta.org/about/our-team/districts-and-councils/list-of-district-pta-offices/) · [2020 U.S. Religion Census (ARDA county reports)](https://www.thearda.com/us-religion/census/congregational-membership?y=2020&t=0&c=06001) · [Cause IQ nonprofit directories](https://www.causeiq.com/directory/locations/) · [Little League CA districts](https://unpage.org/california/ca-dist.htm) · [Toastmasters D57](https://d57tm.org/clubs) / [D205](https://d205tm.org/sortable-club-list) / [D101](https://d101tm.org/club-list-by-city/)

*Verbatim-quote caveats: quotes were extracted from live pages in July 2026; Reddit
permalinks were partly reconstructed from archives and deleted or edited comments
may differ on the live site. Two complaint archetypes could not be sourced verbatim
despite targeted searching — a parent saying "the same families always win the
school signup race," and a first-person rant about the 5% payment fee — and are
flagged as inferences in the text above rather than presented as quotes.*
