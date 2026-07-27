# Contract 38 final-target promotion — 27 July 2026

## Scope

This record closes the final heavyweight production promotion before the project enters streamlined Development Mode.

## Recovery gate

- Production backup run `30264080847` completed successfully.
- The read-only dump restored into disposable Supabase.
- The restored copy verified 36 canonical migrations and representative retained counts.
- Only the age-encrypted artifact was uploaded.
- Artifact ZIP digest `f27345d78dfe4b1651b892297176e61d9a7162b1cd041f7b87d964862ad309bc` matched the independently downloaded copy.
- The encrypted artifact was preserved in private off-GitHub custody.

## Database promotion

Production project: `vkfnsqdyhvtwyqkisxhk`

- read-only history confirmed exactly versions 1–36 before change;
- dry-run listed only `20260727075922` and `20260727080159`;
- the owner explicitly approved the production 36→38 migration;
- guarded GitHub Actions run `30267085610` repeated the exact dry-run and applied only those two files;
- independent verification confirmed exactly 38 canonical versions;
- internal capability checking and four administrator wrappers retained the required security mode, fixed search paths and browser-role grants.

No scoring value or tournament rule changed.

## Netlify release

Project: `euro28predictor`

- production `EURO28_DEPLOYED_DB_CONTRACT` changed from 36 to 38 after database verification;
- development, branch-deploy and deploy-preview remained at 38;
- production Supabase isolation remained unchanged;
- deploy `6a67560deb88202a74108c37` published the verified `0b956e8f553f06f5bdb72ce937acc6295a8c2451` source;
- custom-domain smoke passed exact commit, 38/38 contract identity, security headers, all public routes/assets and production-only Supabase endpoint isolation;
- production was locked again after verification so subsequent development merges do not publish automatically.

## Operating-mode decision

Production is now milestone-only. Ordinary UI, documentation and application work use proportionate CI and targeted previews; feature/schema work adds relevant parity and Browser E2E; the full backup/preflight/approval/promotion sequence is reserved for production-risk changes.

The next product phase is Admin Control Room completion followed by the first full tournament lifecycle simulation.
