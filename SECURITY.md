# Security policy

## Reporting a vulnerability

**Please report privately, not in a public issue.**

Use GitHub's private vulnerability reporting on this repository:
[**Report a vulnerability**](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/security/advisories/new).
It opens a private advisory visible only to you and the maintainer, and it lets
a fix and a disclosure be prepared together.

If that form is unavailable to you, open a public issue containing **only** the
words "security report, requesting a private channel" and no technical detail,
and a private route will be opened for you.

**There is deliberately no email address here.** This project has no neutral
transactional sender yet — that is `SITE-007` in
[`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md),
accepted and blocked on the brand decision in
[ADR 0019](docs/adr/0019-brand-decision-deferred.md). Publishing a personal
address in its place would be a disclosure decision taken by accident. An
address will be added here when there is one to add.

## What to expect

| | |
| --- | --- |
| Acknowledgement | Within **5 working days** |
| Initial assessment | Within **10 working days** of acknowledgement |
| Fix or documented decision | Depends on severity; you will be told which, and why |
| Credit | Offered by default; tell us if you would rather not be named |

This is a **solo-maintained, pre-launch project with no external users yet**.
That is stated plainly rather than implied by a slow reply: there is no on-call
rotation and no 24-hour response. The timescales above are what one person can
honestly hold, and it is better to publish those than to publish an
enterprise-sounding SLA that will not be met.

## Scope

In scope — this repository and the application it builds:

- authentication, session handling and account boundaries;
- row-level security, database privileges and the bounded RPC surface;
- prediction, scoring, lock, settlement and reveal boundaries — particularly
  anything that lets one player see or change another player's entry, or read a
  prediction before its lock;
- private-league membership, invite codes and anything that enumerates players
  or leagues;
- the Content-Security-Policy and the other response headers in `netlify.toml`;
- secrets or credentials committed to the repository or exposed by CI.

Out of scope:

- **the deploy-preview password.** Non-production sites sit behind a shared
  site password recorded in [`docs/ops/netlify-deploy-access.md`](docs/ops/netlify-deploy-access.md)
  as a convenience perimeter, explicitly **not** a confidentiality control.
  Getting past it is not a finding;
- findings against Supabase, Netlify, Cloudflare or GitHub themselves — please
  report those to the vendor;
- missing hardening with no demonstrated impact (for example a header absent on
  a route that serves no content), volumetric denial of service, and reports
  consisting only of automated scanner output;
- social engineering, physical access, and anything requiring a compromised
  device that is already signed in.

## Please do not

- run automated scanners against the hosted environments — the databases are
  rate-limited and shared, and a scan is indistinguishable from the abuse the
  limits exist to stop;
- access, modify or delete data belonging to anyone else. If a proof of concept
  needs an account, create your own and use that;
- run destructive tests, or anything that would corrupt a competition's results.

Testing against a local checkout is always fine and is the preferred route:
`supabase start` gives a disposable local database, and
`npm run reset:development` reseeds it.

## Known and already recorded

Before reporting, it is worth checking
[`docs/quality/risk-register.md`](docs/quality/risk-register.md). Open findings
are tracked there with their evidence and required closure — invite-code
entropy (`SEC-001`), breach-corpus password checking (`AUTH-002`), inline styles
in the CSP (`SEC-002`) and rate-limit coverage (`DATA-007`) are all already
known. A report that adds new impact or a working exploit to one of those is
still valuable; a report that restates the register is not a duplicate to be
embarrassed about, but it will be closed as already tracked.
