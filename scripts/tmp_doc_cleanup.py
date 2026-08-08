from pathlib import Path

path = Path('docs/ops/ops-pending-migrations.md')
text = path.read_text()
old = '''Two operational consequences, and the first is already live — contracts 98–110 landed after the declaration moved to 97, so previews are printing the "unavailable" line right now. Development is rolled out to 110, so moving the declaration to 110 — the verified development level, never ahead of it — is the correct next owner action:

1. Every new contract puts the non-production declaration behind again until development is rolled out and Netlify is updated after it. That is the normal cycle, not a fault, and it is why nothing here treats a trailing preview as a failure.
2. The declaration must never be raised *ahead* of the repository contract in any context, and never raised at all for `production`, which stays at 63 with a fatal gate.

`tests/scripts/documentationContractFreshness.test.ts` holds the part that is mechanical: this table and [`netlify-deploy-access.md`](netlify-deploy-access.md) must state the same values, production must stay at 63 in both, and no context may be declared ahead of the repository contract. Nothing running **in CI** can confirm what Netlify actually carries, which is why these guards check the documents against each other rather than against the platform.'''
new = '''The **5 August interpretation** was that contracts 98–110 had made the non-production declaration trail 97 and that the next update would move it to the then-verified Development level 110 while Production remained 63. Those numbers and that action are retained only to explain the evidence of that day; they were superseded by later hosted rollouts and the fresh 8 August Netlify read above.

The durable rules that survive the old numbers are:

1. A new repository contract may leave a non-production declaration trailing until the matching hosted Development rollout is verified. A trailing preview is an intentional pre-rollout state, not permission to guess a higher hosted value.
2. No Netlify declaration may be raised ahead of the **matching hosted database**. Production is separately controlled and a matching database/declaration still does not mean the application artifact has been rebuilt or published.

`tests/scripts/documentationContractFreshness.test.ts` now holds the mechanical part without a magic baseline number: the non-production documentation values must match the Development hosted machine record, the production documentation value must match the Production hosted machine record, the two documentation tables must agree, and no context may be declared ahead of the repository contract. CI still cannot query the Netlify team-console value itself, so a fresh session/platform read remains required to prove the external configuration actually matches those records.'''
if text.count(old) != 1:
    raise SystemExit(f'ops historical instruction block count={text.count(old)}')
path.write_text(text.replace(old, new, 1))

test_path = Path('tests/scripts/documentationContractFreshness.test.ts')
test = test_path.read_text()
old_comment = '''/**
 * The Netlify contract declaration, which is the one hosted number with **no
 * repository-side read path**.
 *
 * `EURO28_DEPLOYED_DB_CONTRACT` is a Netlify team-console environment variable.
 * CI never sees it, and the protected-preview gate reads only the commit
 * *status*, so a green `netlify/euro28predictor/deploy-preview` cannot tell 86
 * from 97 — `validate-deployment-contract.mjs` deliberately waves a *trailing*
 * non-production context through, because a schema-advancing pull request
 * cannot make its preview go green before merge (ADR 0024).
 *
 * So the declaration is owner-reported, and the only thing this repository can
 * enforce is that its two written records of it do not disagree. They are
 * `ops-pending-migrations.md` (a row per environment) and
 * `netlify-deploy-access.md` (a row per deploy context), and on 4 August 2026
 * both had to be edited by hand to move 86 → 97. Updating one and not the other
 * leaves a reader two answers with no way to date them — the same failure the
 * development-contract check above exists for.
 *
 * What this cannot check, stated so the coverage is not overread: whether
 * Netlify actually carries either number. Nothing in this repository can.
 */'''
new_comment = '''/**
 * Netlify's contract declaration is external team-console configuration. CI has
 * no authenticated read path to that console value, so a green deploy-preview
 * status cannot by itself prove which hosted database the build declares.
 *
 * The repository can still make its intended value non-ambiguous: the three
 * non-production documentation rows must match the Development hosted machine
 * record, and the production documentation row must match the Production hosted
 * machine record. A fresh Netlify platform/session read is then the evidence
 * that external configuration actually matches those records.
 *
 * `validate-deployment-contract.mjs` deliberately permits a TRAILING
 * non-production declaration during a schema-advancing PR (ADR 0024), but no
 * context may lead the repository and no document may invent a hosted value.
 */'''
if test.count(old_comment) != 1:
    raise SystemExit(f'Netlify test comment block count={test.count(old_comment)}')
test_path.write_text(test.replace(old_comment, new_comment, 1))
