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

## Authority

The result document plus this confirmation are now the model-selection
authority for the hardening branch. They define challenger configurations only;
they do not authorise promotion. The synthetic aggregate price/actionability
integrity condition recorded in the result document remains a separate
pre-promotion blocker.
