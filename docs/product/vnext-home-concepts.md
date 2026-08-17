# vNext Home concepts — A, B and C

**Status:** historical. **Decided — A, Matchday Arena, was selected.**
**Scope:** presentation and information architecture only
**Does not govern:** scoring, locks, reveal, settlement, membership, progression, provider truth, routing, or the legacy production UI

> **This is a record of an exploration that has concluded.** The three concept
> implementations no longer exist in the repository — git history holds them.
> What survives is the decision, recorded at the bottom of this page, and the
> one Home it produced in [`src/vnext/home/`](../../src/vnext/home/). Read
> [`vnext-workshop.md`](vnext-workshop.md) for what Home is now; read this only
> for why it is that and not something else.

Three Home concepts, built on the one workshop Home model
(`src/vnext/fixtures/home/homeModel.ts`) and the one fictional matchday. Same
user, same teams, same matches, same rivals, same leagues, same prediction
state. The only thing that differs between them is the composition — which is
what makes comparing them worth anything.

They lived in Storybook under **vNext/Home Concepts**, each reviewable at 375,
430, 768, 1440 and 1920, with a **Compare A · B · C** group that put all three
on one board at one width. That group has been replaced by **vNext/Home**,
which reviews the one selected Home across its three states.

---

## A — Matchday Arena

Football is the event, and the page is the broadcast. A masthead, a score bar
across every fixture, then a **stage**: one match gets a whole zone and
everything else is a supporting row. Mobile stacks masthead → scores → the one
outstanding deadline → stage → grounds → terrace. Desktop puts the grounds
beside the stage and moves navigation into the masthead band, so navigation
costs no horizontal space; at 1920 the terrace takes a column of its own.
Social lives in "the terrace" — league position as one line each, rivals as
gap chips. It is present at every width and never outranks the football. Team
colour is at its loudest here: the stage is painted in both clubs' colours
behind a scrim, and every ground row carries a colour spine. Motion is
moderate: entrances, the live pulse, no continuous ticker travel.

## B — Game Command Centre

My competition is the event. Every zone answers one of four questions — how am
I doing, what changed, what must I decide, who is catching me — and football
arrives as *consequence*: live matches are a ledger of points moving, upcoming
matches are a queue of decisions sorted by deadline rather than kick-off. The
densest of the three. Mobile orders by urgency and pins a standing "2 still to
decide" strip above the bottom bar. Desktop is a real console: a persistent
navigation rail, a five-tile status band, then decide | account | compare, with
the activity wire taking a fourth column at 1920. Social is not a footnote — it
is a whole column, with the leagues split from "you can catch" and "catching
you". Team colour is at its most restrained: a 3px key beside a name, so every
large colour left on the page means a game state. Motion is the lightest.

## C — Cinematic Football

Discovery and football storytelling. One hero — the closest deadline the user
has *not* answered — takes most of the first screen, then horizontal rails of
posters. The borrowing from discovery interfaces stops at the shape: the hero
is a decision, not a trailer, and every poster carries state and numbers.
Mobile gives the hero the screen and browses by scrolling; from tablet up the
hero splits so the live scores sit beside the copy and "what is on now" is
answered inside screen one. Navigation floats over the hero on desktop and
becomes a detached pill on mobile. Rivals get the same poster treatment as
fixtures — this concept's strongest claim — in a "The rivalries" rail beside
the private leagues. Team colour is atmosphere: club colours are the light in
the room, with legibility bought back by a layered scrim. Motion is the
strongest: hero entrance, rail stagger, hover lift.

---

## What is deliberately the same

- one Home model, one matchday, one set of numbers;
- the container-framed workshop, so a 430px frame composes as a phone at any
  monitor size;
- the shared low-level primitives — live indicator, form run, team identity,
  rank movement, motion, typography, formatting;
- the accessibility floor: semantic structure, visible focus, 44px targets,
  state in words as well as colour, and a reduced-motion path that removes
  movement without removing feedback.

## What is deliberately different

Each concept answers the workshop's open questions its own way: what earns the
first screen, how dominant live football should be, where rivalry sits, how
much is visible at once, what desktop does with the extra space, how strongly
club colour should influence a fixture, and what navigation is.

---

## The decision

**Selected: A — Matchday Arena, as the foundation of vNext Home.**

A is the design authority. B and C were not merged into it as equals; each
contributed one specific thing, and the rest of each was left behind.

| | Contributed | Left behind |
| --- | --- | --- |
| **A** Matchday Arena | The whole structure: masthead, score bar, one match on a stage, dense rows for everything else, football before furniture, team colour loud on the featured fixture and restrained elsewhere. | Its "Follow live" action, which named nothing the product has (see below). Its "Live"/"Matchday" navigation pairing. |
| **B** Game Command Centre | **Information.** Rank movement, gap to leader, who you can catch, who can catch you, recent-performance figures — the things A knew about the user and never said. | The metric board. No sparkline, no trend chart, no ledger, no console. |
| **C** Cinematic Football | **Emphasis.** An atmospheric competition wash under the page, display-scale typography where a moment earns it, and one genuinely cinematic treatment reserved for the next decision. | Empty half-screen heroes, poster-per-fixture, and browsing as the primary shape. |

### The new Home principle: state-adaptive emphasis

The strongest thing the exploration produced was not a layout. It was the
observation that Home should not give the same content equal prominence at all
times. So there is **one Home shell with three emphases**:

- **Live** — football is the event. The featured live fixture dominates, with
  the outstanding deadline still banner-ed above it and the competitive
  consequence compact beneath.
- **Decision** — your next decision is the event. The cinematic hero takes the
  dominant zone, and it absorbs the action banner rather than repeating it.
- **Competition** — your competition is the event. The league race, the season
  figures and what has happened take the dominant zone, and the football that
  is coming sits beneath.

These are **emphases, not three Homes**. The masthead, score bar, navigation,
typography, spacing, surfaces, team-colour language and motion do not change —
only which zone is largest, and the order of the two beneath it. Same stadium,
different match state.

### Two smaller decisions this settled

**Navigation says HOME, not MATCHDAY.** A shipped both a "Live" destination and
a "Matchday" destination, which left the user unable to tell whether this was
the product's front door or one competition's tab. It is the front door. Live
football is content on Home — the emphasis system already rearranges the page
around it — so a "Live" tab would navigate to the state Home is already in, and
the competition is named in the masthead as context rather than spending a
navigation slot. Four global destinations: **Home · Fixtures · Leagues ·
Season**.

**Match Centre is the live action, and "Follow live" is gone.** A made "Follow
live" the loud primary on the featured match and "Match centre" the quiet
secondary. There is no follow, subscribe or notify concept in the model, in the
product, or in anything specified — so the loudest control on the most
important card on Home promised a feature that does not exist. Match Centre is
a surface the product is going to build, and it is now the single primary
destination on a live fixture. One real action beats two, one of which is
imaginary.

### AppFrame

Stage 3 found all three concepts wrote their own shell rather than bending to
`AppFrame`. Stage 4's Home did the same, making it four out of four real
compositions that declined it. A layout primitive nothing chooses, kept alive
by a probe whose only purpose is to give it something to measure, is dead
architecture — so `AppFrame`, `Rail` and `AppFrameProbe` were removed. The
browser measurement the probe was carrying now runs against the real Home in
`e2e/vnext-home.spec.ts`, which is a more useful thing to measure.

### Light theme

Deferred, deliberately and unchanged. vNext is dark, the direction works dark,
and doubling the Gold Standard implementation before the core language is
approved would buy nothing.
