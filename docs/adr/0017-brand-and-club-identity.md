# ADR 0017 — Brand and club identity

- **Status:** **Brand half superseded by [ADR 0019](0019-brand-decision-deferred.md)** (30 July 2026) — Scoreline was withdrawn on clearance evidence and the brand decision is deferred with a trigger. **The club identity half below is unchanged and remains in force.** The brand content in this record is retained as written, for traceability; read 0019 for the current position.
- **Partially superseded by [ADR 0021](0021-sharing-surface-priority.md)** (1 August 2026): the consequence below claiming the weekly shareable results card is *"the artefact most likely to be seen outside the product"* no longer holds. Observed Phase 0 evidence (O3) found league tables were already being shared unprompted, so standings sharing is primary and the weekly card secondary. **The `ClubIdentity` requirement attached to that consequence still stands** and now applies to the standings share view first.
- **Club identity half implemented as a switchable capability** (19 August 2026): Stage 14 built the option this ADR's own consequence names — *"adding licensed crests later is a single component change"* — as `src/domain/clubIdentity/officialBadge.ts` plus `src/app/clubBadgePolicy.ts`. **It ships DISABLED and the decision below is unchanged.** No provider adapter decodes a badge field, `VITE_UI_OFFICIAL_BADGES` fails closed, and `netlify.toml`'s `img-src 'self' data:` would block a remote badge regardless. Turning it on is three deliberate changes — a recorded rights decision, a provider adapter that carries the field, and a CSP that admits the host — not one flag.
- **Date:** 29 July 2026

## Context

The repository, product and domain are named for Euro 2028. Under ADR 0011 the Euros become one competition among several, so a tournament-specific brand no longer describes the product. Renaming is trivial now and progressively expensive once invite links, search presence and store listings exist.

Separately, the product must represent football clubs visually and cannot use their crests. Club badges are simultaneously registered trade marks and original artistic works. Data providers serve crest imagery readily but disclaim the rights: Sportmonks' terms state that logos are copyrighted by their owners, that the developer must arrange proof of intellectual property themselves, and — notably — recommend creating a variation of the logo where permission cannot be obtained. API-Football's terms take the same position.

## Decision

### Brand

**Working name: Scoreline.** Provisional until all four clearance checks pass — UK IPO classes 9 and 41, domain availability, App Store listing name, Play Store listing name. A name clearing three of four is not usable.

**Structure: distinctive brand plus descriptive subtitle** — "Scoreline — Football Predictor". The brand carries and is defensible; the subtitle does the discovery work in store search. Purely descriptive names are unavailable in this category in any case, and would be weak trade marks.

**The brand must not incorporate a competition trade mark.** Using someone else's mark as a product name is a materially weaker position than describing a fixture factually. The name must also be league-agnostic, since it has to carry the Premier League, the Scottish Premiership and Euro 2028 equally.

**The brand is the hub, and games sit beneath it** — Scoreline Predictor, Scoreline Last Man Standing, Scoreline Cup. A hub named for one of its games makes the others feel like additions.

**Renaming the repository preserves issues, pull requests and history**, and GitHub redirects the previous URL. Netlify's repository link and any hardcoded URLs in documentation and CI configuration require updating in the same change.

### Club identity

**Launch badge-free.** A canonical `ClubIdentity` component is the only path by which a club is visually represented anywhere in the codebase, exactly as the flag component already works for the tournament product. It renders from per-club tokens: colour, a generic kit pattern, and a monogram.

Three viable presentations, all legally clean: colour monograms, generic kit patterns — stripes, hoops, halves, a sash, all centuries-old football conventions owned by nobody — or the two combined.

**The design must not leave a crest-shaped hole.** A layout built around a missing forty-pixel circle looks deprived; an editorial, typographic layout looks considered. Build the second.

**Accessibility: colour is never used alone.** Colour plus monogram plus name, always. This is also the practical resolution for collisions — Liverpool and Manchester United are both red, and Chelsea, Everton and Leicester are all blue.

**What may be used, and is:** club names stated factually, per the honest descriptive use provision at section 11(2) of the Trade Marks Act 1994; fixture lists, which the CJEU held in *Football Dataco v Yahoo!* (C-604/10, 2012) do not attract copyright under the Database Directive, and which the 2004 *Fixtures Marketing* line held do not attract sui generis database right — obligations there are contractual, governed by the provider's terms; colours; generic kit patterns; and player names stated factually.

**Publish an unambiguous non-affiliation statement** in the footer and terms. It does not cure infringement, but it speaks directly to passing off.

## Consequences

- Because `ClubIdentity` is the sole rendering path, **adding licensed crests later is a single component change** rather than a redesign. The option is preserved rather than foreclosed.
- The weekly shareable results card must be built on `ClubIdentity`, since it is the artefact most likely to be seen outside the product.
- Monograms are more legible than crests at thirty-six pixels, which suits the phone-first requirement better than badges would.
- **Club licensing is realistically unavailable at this scale.** Club and league programmes are built for broadcasters, betting operators and merchandisers, not free applications with a few thousand users. The practical choice is badge-free or unlicensed, not badge-free or licensed. Ask each provider during evaluation; a provider that genuinely licenses imagery would change this and would justify a higher price.
- The brand decision blocks Stage A, and Stage A blocks everything else.

## Rejected alternatives

- **Matchday.** Rejected on three grounds. The Football Association publishes "Matchday by England Football" on both stores; a second party claims Matchday™ for a football game; and the name now carries an explicit **England Football** association, which is precisely wrong for a product whose differentiator includes treating the Scottish game as first-class.
- **Touchline.** Rejected: an existing tournament prediction application already uses it, and "Touchline Bet" — a betting tips app with roughly a hundred thousand downloads — drags the name into the gambling association ADR 0015 exists to avoid.
- **Purely descriptive names** such as "Predict The Score". Rejected: weak as trade marks because they merely describe the activity, and "predictions" as a term is heavily colonised by betting-tips products, which fights the free-to-play positioning.
- **Names implying management** such as Gaffer. Rejected: manager vocabulary sets the expectation of squad selection, which is a different game.
- **Numerals in the brand**, such as Pick90. Rejected: numbers read as years or version numbers, and in a football context "90" carries an unavoidable and specifically English association.
- **Using real crests despite the position above.** Rejected. The trade mark argument is reasonable — descriptive use to identify which club is playing. The **copyright** argument is not: a crest is an original artistic work, UK fair dealing is narrow, and there is no descriptive-use defence in copyright. Two factors make this worse here than for competitors: an acquisition is an explicit objective and an unlicensed intellectual property dependency is exactly what diligence surfaces; and the timing runs one way, since adding crests later is a component change while removing them after users have seen them is a visible downgrade.
- **A new repository rather than a rename.** Rejected: it would discard the test suite, migration chain, audit record, ADR series and git history, and would invert the economics of the plan by turning Euro 2028 from a configuration back into a rebuild.
