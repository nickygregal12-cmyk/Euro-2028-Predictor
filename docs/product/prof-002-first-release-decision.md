# PROF-002 — first-release decision

**Status:** decided 20 August 2026  
**Scope:** Football Hub first release  
**Supersedes for current release status:** the open-gap conclusion in `docs/product/vnext-player-profiles.md` §8.5. That section remains useful historical/design evidence for why a separate named list would need another backend contract.

## Decision

**Pinned Rival Watch is sufficient for the first Football Hub release.**

The merged experience already covers the actual first-release job: a player can deliberately keep a small set of relevant rivals close, and that choice persists on the server. `useWatchedRivals` reads the existing per-season `pinned_rivals` preference, writes through `set_pinned_rival`, re-reads the server after a change, and surfaces a refusal instead of maintaining an optimistic second truth.

The boundary is deliberately narrow:

- season-scoped;
- only players the caller may already reach through the shared-private-league profile boundary;
- a private note-to-self rather than a reciprocal social relationship;
- no notification to the pinned player;
- no follower count;
- no global people search or directory;
- no feed, popularity signal or follower notifications;
- no new permission or prediction visibility.

## Why no separate “people you follow” list now

The older §8.5 audit correctly established that `get_my_preferences` does not carry the display name and season-scoped player reference required to render a safe named list. Closing that technical gap would require a new enumeration read.

After the vNext completion work, that read no longer closes a necessary first-release journey: Rival Watch already provides the deliberate-rival experience in the places where rivalry matters. Building another read solely to reproduce those same saved rivals as a directory adds backend surface, another people context and another navigation expectation without adding a necessary gameplay capability.

Therefore the missing list is **not an engineering release blocker**.

## Reopening rule

A distinct named list/following model may return only as a future enhancement if a concrete journey is demonstrated that Rival Watch cannot serve. Reopening it requires a fresh product decision and must not silently grow into a generic social graph.

No database, hosted configuration or player data changes are made by this decision.
