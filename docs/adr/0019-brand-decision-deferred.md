# ADR 0019 — Brand decision deferred with a trigger

- **Status:** Accepted
- **Date:** 30 July 2026
- **Supersedes:** the brand half of ADR 0017. **The club identity half of ADR 0017 is unchanged and remains in force.**

## Context

ADR 0017 recorded **Scoreline** as a provisional working name, pending four clearance checks: UK IPO classes 9 and 41, domain, App Store listing name, Play Store listing name.

Partial checking on 30 July 2026 found the name too crowded to proceed:

- **SCORELINE LTD** (company 15377220) — an active UK company incorporated December 2023, registered under SIC 85510 *sports and recreation education* and 85600 *educational support services*.
- **Scoreline.ai** — a UK technology and media company headquartered in Brighton, founded 2019, approximately 28 employees across three continents, around $1.8M annual revenue, describing itself as the parent brand behind a portfolio.
- **Scoreline Sports Pvt. Ltd.** — a Kerala sports education business and the commercial rights owner of the Kerala Football Association.

None blocks registration outright, since a company name confers no trade mark right. Together they evidence use in trade sufficient to make an application risky and an objection plausible, and Scoreline.ai is funded enough to raise one. Against the asset-cleanliness argument in ADR 0017 — an unlicensed or contested intellectual property position is exactly what acquisition diligence surfaces — that risk is not worth taking.

Scoreline was the third candidate rejected in a day, after Matchday and Touchline. The pattern is now evidenced rather than suspected: **ordinary football vocabulary is exhausted**, and every obvious term has a commercial occupant.

## Decision

**The brand decision is deferred with a trigger. It is not open indefinitely.**

The repository, application and hosted names remain **Euro 2028 Predictor** through the 2026/27 rehearsal season.

**Reopen on completion of Phase 0 discovery. Decide before any external user sees the product** — that is, before the closed cohort opens. Public launch in August 2027 is the outer bound and must not become the moment of decision.

### Why deferral is correct, not merely convenient

**Nothing downstream depends on it.** The competition-context engine, competition-season schema, ingestion pipeline and every game rule are brand-agnostic. Deferral blocks only the rename and store listings, and listings are not required until Phase 3.

**The rehearsal is headless.** No users and no public exposure through 2026/27, so the name is seen only by the owner.

**And the stronger reason: the name should follow the positioning, not precede it.** Phase 0 discovery has not happened. Choosing a brand before speaking to organisers and players, and before playing the incumbents properly, means choosing from reasoning rather than evidence — the failure the programme plan exists to prevent.

### Method, when reopened

- **Check a batch in one sitting**, not candidates one at a time. Three sequential rejections in a day is a slow loop with a poor hit rate.
- **Add Companies House** to the four checks. It confers no trade mark right but evidences use in trade, which supports unregistered rights and passing-off claims. It is what disqualified Scoreline, and it was not in the original list.
- **Weight candidates toward coined or oblique words**, on the evidence above.
- Structure remains as ADR 0017 specifies: distinctive brand plus descriptive subtitle, league-agnostic, no competition trade mark, brand names the hub rather than one of its games.

## Consequences

- **Brand selection and the repository/application rename leave the engineering critical path.** They do not block Stage A closing, Stage C, ingestion or other brand-agnostic engineering work.
- The repository keeps a name that misdescribes it for roughly a year. This is accepted: internally visible only, and the alternative is an interim rename followed by a real one.
- **A candidate domain may be registered speculatively at any time.** A few pounds buys an option with no commitment.
- Phase 0 gains a dependent: brand selection now waits on it, which is an additional reason not to let discovery slip.
- The rename procedure — Supabase redirect allowlist before the Netlify rename, verification before removing the old entries — remains as specified and unexecuted.

## Rejected alternatives

- **Proceeding with Scoreline despite the findings.** Rejected on the evidence above. Defensible for a hobby project; not for one whose stated objective includes a sale.
- **Continuing to generate and check candidates now.** Rejected: it consumes attention during the two days before the rehearsal season starts, to settle a decision with no downstream dependency, and it would produce a name chosen before discovery informs the positioning.
- **Renaming to an interim such as "predictor-games".** Rejected: two renames cost more than one deferral, and each carries the Supabase authentication redirect risk.
- **Leaving the brand decision open with no trigger.** Rejected as the likely failure mode. An open decision with no reopening condition drifts until it is urgent, and is then made badly. The trigger is Phase 0 completion, and the deadline is the closed cohort.
