# Final guarded model selection — exact-head confirmation

**14 August 2026.** This closes the confirmation condition recorded in
`2026-08-14-final-guarded-model-selection-results.md`.

## Exact-head rerun

- Development-only GitHub Actions run: **31754567278**
- Branch head under test: **b444c684f75233259155758fdfa3005514d82f9a**
- PR merge ref checked out by Actions: **1c1c45710f3b425d0a5c5d0c051ca19ddb277dc2**
- `AI_READ_ONLY=1`
- `AI_COVERAGE_GUARD=1`
- Development project-ref proof: passed
- package write-scope proof: passed
- final all-nine comparison: passed
- evidence artifact: `final-guarded-model-selection-31754567278`
- artifact id: **9202268655**
- artifact digest: **sha256:38e820e9bccdcc379c5e416a9095ecf273f349bc7b09def900f2c57513db0621**

The wrapper compatibility correction therefore does not change the evidence.
The exact same predeclared selections were reproduced:

| league | confirmed selection | mean log loss | selected-fold coverage drop? |
| --- | --- | ---: | --- |
| EPL | `blend-1800` | 0.971165 | no |
| ECH | `blend-1800` | 1.046627 | no |
| EL1 | `poisson-1800` | 1.032320 | no |
| EL2 | `poisson-900` | 1.059380 | no |
| ENL | `poisson-900` | 1.039707 | no |
| SPL | `poisson-1800` | 0.952596 | no |
| SCH | `poisson-900` | 1.068311 | yes |
| SL1 | `poisson-1800` | 1.025901 | yes |
| SL2 | `poisson-900` | 1.032354 | yes |

The AI Lab test suite on the same branch head also passed after the correction,
including pickle/joblib reconstruction and the Elo narrow-input compatibility
case that originally exposed the wrapper defect.

## Read-only model-semantics confirmation

A later hardening pass removed an accidental coupling between database safety
and model definition: `AI_READ_ONLY=1` no longer disables an adopted feature
coverage guard. Read-only now means the process cannot write; ordinary research
and deployable training resolve the same guarded model unless a falsification
arm explicitly asks for the pre-guard control.

That change was re-run against Development with the guard explicitly fixed on,
so the model-selection evidence could not move as a side effect of the semantic
cleanup:

- GitHub Actions run: **31755499500**
- branch head under test: **7a4c553c4e52e57fa4887ab0e80fa1a681e6788b**
- PR merge ref checked out by Actions: **8a956434cc303abf1e939ac791f5dc54b5d9c01b**
- `AI_READ_ONLY=1`
- `AI_COVERAGE_GUARD=1`
- Development project-ref proof: passed
- package write-scope proof: passed
- final all-nine comparison: passed
- evidence artifact: `final-guarded-model-selection-31755499500`
- artifact id: **9202617556**
- artifact digest: **sha256:f5c5b0721cd86cd63bf390b54c75b1381be60f0c8afbbd57a26410a5a1200dc7**

It reproduced the same nine selections and the same mean log losses shown above.
This confirmation is important because the research result is now independent
of whether the database session is writable.

The dedicated historical `coverage-guard` study is different: its `control`
arm deliberately represents the pre-guard model. That call site must therefore
request `coverage_guard=False` explicitly rather than inherit behaviour from
`AI_READ_ONLY`. Until that explicit control marker and its stale mutation test
are updated, re-running that one falsification study is blocked even though its
already-recorded adoption result and the corrected final-selection reruns remain
valid.

## Authority

The result document plus this confirmation are now the model-selection
authority for the hardening branch. They define challenger configurations only;
they do not authorise promotion. The synthetic aggregate price/actionability
integrity condition recorded in the result document remains a separate
pre-promotion blocker.
