# Strix — controlled dynamic security assessment

Agentic penetration testing, run deliberately. It complements the static
security tooling rather than replacing any of it.

**This capability is inert.** `STRIX_LLM_API_KEY` is not configured for this
repository, so the workflow stops before it installs anything. No assessment
has been run, and nothing is scheduled.

## Where it sits

The existing stack reasons about the code and the supply chain:

| Tool | Asks |
| --- | --- |
| CodeQL | is there a vulnerable pattern in the source? |
| Betterleaks | is a secret committed? |
| Dependency Review | is a new dependency known-vulnerable? |
| Harden-Runner, zizmor, actionlint | is the CI estate itself sound? |
| Squawk | is this migration unsafe to apply? |

None of them asks the one remaining question: **can a running deployment
actually be attacked?** That needs traffic against a live target, which is
what Strix does and why it is governed differently from everything above.

## Rules of engagement

**Production is never a target.** The workflow offers only `local-preview` and
`staging`. The choice list constrains the UI, so the job re-checks the resolved
host in shell — a `workflow_dispatch` API call can pass any string — and
refuses the production domains and any `*.supabase.co` host outright. Deploy
previews are refused too: they carry real Supabase configuration.

**It cannot run by accident.** `workflow_dispatch` is the only trigger. There
is no `push`, no `pull_request` and no `schedule`, and
`tests/scripts/strixSecurityWorkflow.test.ts` fails if one is added. An
operator must also type `ASSESS` to confirm authorisation.

**It fails closed.** With no `STRIX_LLM_API_KEY` the job stops with a message.
It does not degrade to "scanned nothing, found nothing" — a green tick on an
assessment that never happened is worse than a red one, because somebody will
read it as clean.

**It cannot spend provider quota.** The `local-preview` target builds with a
loopback Supabase URL and a disposable anon key, so the application under test
has no route to a real project and no paid football or odds provider is
configured. There is nothing for an agent to reach even if it tries.

**It cannot write to Production.** It never receives a Production credential,
and the target it is pointed at has none either.

**No real user credentials, ever.** Credential stuffing, password spraying and
testing with a real player's account are all out of scope. If authenticated
testing is wanted, seed a disposable account on the disposable target.

**Findings are artefacts, not commits.** Output is uploaded as a 14-day
artefact and scrubbed of anything credential-shaped first — a pentest log
quotes request and response bodies, which is precisely where a token ends up.
Nothing is written back to the repository.

**Non-gating, on purpose.** The job is `continue-on-error`, following the
pattern #809 set for new security tooling: arrive report-only, prove signal
quality and runtime, and become blocking only on evidence. Making a noisy tool
mandatory is how a team learns to ignore red CI.

## When to run it

- before a significant pre-production release;
- when an auth, session, invite or admin-capability boundary changes;
- as a periodic assessment against a dedicated staging environment;
- when investigating a specific suspected weakness.

Not on every commit, and not as a substitute for the static tooling.

## Standing it up

1. Provision an LLM credential for a provider Strix supports and add it as the
   repository secret `STRIX_LLM_API_KEY`. It is not a football or odds
   provider key and must not be one.
2. For `staging`, stand up an environment that carries **no real players** and
   no Production Supabase project.
3. Run **Actions → Strix dynamic security assessment → Run workflow**, choose
   the target, type `ASSESS`.
4. Triage the artefact. Confirm each finding by hand before acting: an agentic
   pentester produces plausible reports, and a plausible report is not a
   vulnerability until somebody reproduces it.

## Deliberately not done

- No scheduled run. It becomes periodic only once runtime and cost have been
  observed over several real assessments.
- No merge gate.
- No Production assessment path. That needs a separate owner decision, a
  maintenance window and a rollback plan, and it would not be this workflow.
