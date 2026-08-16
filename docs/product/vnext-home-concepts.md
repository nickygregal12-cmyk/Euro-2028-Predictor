# vNext Home concepts — A, B and C

**Status:** design exploration for review. **No concept is selected.**
**Scope:** presentation and information architecture only
**Does not govern:** scoring, locks, reveal, settlement, membership, progression, provider truth, routing, or the legacy production UI

Three Home concepts, built on the one workshop Home model
(`src/vnext/fixtures/home/homeModel.ts`) and the one fictional matchday. Same
user, same teams, same matches, same rivals, same leagues, same prediction
state. The only thing that differs between them is the composition — which is
what makes comparing them worth anything.

They live in Storybook under **vNext/Home Concepts**, each reviewable at 375,
430, 768, 1440 and 1920, with a **Compare A · B · C** group that puts all three
on one board at one width.

Nothing here is wired into the product. There is no approved Home screen.

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

## Not decided here

Which concept wins, or which parts of which. That is the owner's call, and
Stage 4's job.
