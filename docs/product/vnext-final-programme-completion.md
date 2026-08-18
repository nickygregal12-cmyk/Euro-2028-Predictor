# vNext final programme completion

**Status:** final programme completion contract. This tightens the orchestration-level finish condition without changing the scope or creative authority of Stages 8–15.

The vNext programme is **not complete** merely because the implementation PRs for Stages 8–15 have merged or because either product is described as ready for cutover.

## Required final state

The programme may be declared complete only when all of the following are true:

1. every Stage 8–15 minimum completion predicate is satisfied;
2. the Football Hub vNext experience has received explicit Production authority for the exact cutover action and target, has been cut over through the authorised deployment path, and is live in Production;
3. the Euro 2028 vNext experience has received explicit Production authority for the exact cutover action and target, has been cut over through the authorised deployment path, and is live in Production;
4. both products have passed post-deploy smoke checks covering their intended routes, authentication/session behaviour, refresh/deep links and critical user journeys;
5. rollback remains available through each product's defined confidence gate, and superseded legacy frontend routes/code have an intentional retained, redirected or retired state;
6. required final exact-head CI/review evidence is green and there is no unresolved Blocker or Important finding;
7. the current route migration matrix has no silently orphaned user-facing route;
8. Production state is re-read and reported truthfully after deployment rather than inferred from repository state or a successful build;
9. no vNext presentation workaround substitutes for unfinished scoring, lock, reveal, settlement, privacy, progression or provider truth.

## Production authority

This contract does **not** weaken the Production safety gate.

An agent may autonomously prepare either product to a verified **READY FOR CUTOVER** state, but being ready is not programme completion. The actual Football Hub and Euro 2028 Production mutations each require explicit authority for that exact action and target.

A machine flag, merged PR, green preview, successful rehearsal or previous Production permission is not a substitute for current exact-target authority.

If Production authority has not been granted, the programme must remain incomplete at the precise cutover gate rather than reporting success early.

## Relationship to the stage contracts

`docs/product/vnext-stage-contracts.md` continues to own each stage's stable mission, boundary and minimum stage predicate. This file owns the stronger **whole-programme finish condition**.

Stage 14 is the Football Hub cutover stage. Stage 15 may perform the Euro 2028 adoption and its production cutover work, but regardless of how that work is sliced, the final programme audit must prove that **both Football Hub and Euro 2028 are actually live in Production and post-deploy verified**.
