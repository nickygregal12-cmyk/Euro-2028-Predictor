# Selected challenger materialisation — Development

**14 August 2026. Complete.**

This records the Development-first materialisation of the already-selected
nine-league challenger policy. No model selection was reopened, no provider was
called and no model was promoted.

## Authority

Version: `selected-20260814-v1`

The single policy-expansion authority was `ai/train_selected_challengers.py`,
which reads `ai/challenger_policy.py`. The workflow contained no duplicate
league/family/half-life map.

## First run and the equal-blend packaging defect

Initial Development materialisation run **31759881455** successfully stored the
seven Poisson challengers but failed while packaging the EPL/ECH equal-blend
validation report. The failure occurred after the blend probabilities and
calibration metrics had already been computed:

`ValueError: operands could not be broadcast together with shapes (12,) (6,)`

Root cause was in `ensemble.evaluate_out_of_time`: when the selected meta-model
was itself `equal_blend`, the diagnostic candidate loop iterated
`("equal_blend", meta)` and therefore appended the same equal-blend fold score
twice. This was diagnostic bookkeeping, not a change in the selected blend
probabilities or model policy.

A focused regression `ai/test_ensemble_equal_blend.py` reproduces the case. The
fix deduplicates the candidate list before the two comparison loops. Focused
patch run **31760148325** passed before the change was committed.

## Retry

Development retry:

- GitHub Actions run: **31760224572**
- job: **94644794757**
- target: Development `iouzoutneyjpugbbtdem`
- version: `selected-20260814-v1`
- provider collection calls: **0**
- retry mode: `--skip-existing`
- seven existing Poisson challengers: skipped
- EPL/ECH equal blends: trained successfully
- artefact/database provenance verification: passed for all nine
- current-model set before: **0**
- current-model set after: **0**
- automatic promotions: **0**

The materialisation workflow was then made `workflow_dispatch`-only so ordinary
branch pushes cannot repeat the hosted training.

## Materialised challengers

All nine rows are `status=challenger`, `features_version=f9`, and request the
same seven feature groups:

`core, form, performance, congestion, halftime, shots_volume, corners`

The stored `ModelBundle` for every row carries coverage-guard provenance. On the
final current-history fits every requested group was supported, so effective
groups equal requested groups and `dropped_groups=[]`. This does not contradict
the historical SCH 1718 falsification: the guard resolves independently on each
training window and final fit.

| league | model id | family | half-life | components / meta | calibration | eval train n | final train n | trained through | artifact SHA-256 |
| --- | --- | --- | ---: | --- | --- | ---: | ---: | --- | --- |
| ECH | `0f8299ba-ea87-4425-9d55-cd3256f1861f` | ensemble | 1800 | poisson+elo / equal_blend | identity | 5001 | 5574 | 2026-05-02 | `9608b3250cbd123c18ce14f4e144e4d86c156aa88820bc8250cd3b9ebfebbe9d` |
| EL1 | `18fae1fa-66ff-44f4-b83f-eb3af46e1ff6` | poisson | 1800 | — | temperature | 3994 | 4458 | 2026-05-02 | `4dd027201221054136376374dabaa84b6c9ca684b9767660e46a508da10b0458` |
| EL2 | `74ceb181-ecc4-47a8-bba7-a66392178cec` | poisson | 900 | — | identity | 3996 | 4459 | 2026-05-02 | `e6f41c6c82bdd84504e54fd1d586a833d442bd9bbcd0b5527734fceb4aa34f79` |
| ENL | `a546737b-2a1e-4d39-bb59-74251f6fb315` | poisson | 900 | — | identity | 4991 | 5549 | 2026-04-25 | `8d05b0a5f66187b8e03b049a34ec66567da97f4c13943c6077619723658381e3` |
| EPL | `75b3cb4d-8b99-4025-9bd8-6869f568679e` | ensemble | 1800 | poisson+elo / equal_blend | identity | 3420 | 3800 | 2026-05-24 | `fa56453759d09750954338643702ee82105063779cc22b7bdcd2454755fc7cd2` |
| SCH | `8003c7b7-e433-4a72-b9ab-f9156e6aed5b` | poisson | 900 | — | identity | 2977 | 3335 | 2026-05-01 | `22465a3a0191a50b14b72b1d65b5a43876beb5a39ef313951089fad75cbd53f3` |
| SL1 | `0694222e-9fd1-4262-be34-6d30279bd7e8` | poisson | 1800 | — | identity | 3227 | 3609 | 2026-05-01 | `875ced61312aca901351cf523469567f69bdb4e5ee3eaa2f8932fe598ec996a3` |
| SL2 | `e4ce7a59-691d-480f-95f2-e9a0cad9b18b` | poisson | 900 | — | identity | 3069 | 3384 | 2026-05-02 | `48fc1264d2a25d28840231a37165d3c3cd841021198c72de6d8dc5b65a75f0e` |
| SPL | `e81d61cd-a031-4255-b47f-6696cd2a169e` | poisson | 1800 | — | identity | 1994 | 2238 | 2026-05-15 | `e435ee0b359e7c9a80ade6fd5587b8bc89e3c5ddef1a4ceba01241b3d7b4f6ce` |

## Verdict

Development materialisation passes the gate:

- exactly nine selected challengers;
- exact approved family/window policy;
- ensemble component/meta identity correct;
- complete evaluation/final-fit provenance;
- immutable artefact hashes present;
- final-fit coverage provenance present;
- zero provider calls;
- every row remains `challenger`;
- zero automatic lifecycle changes.

Promotion remains downstream of merge, Production materialisation and the
synthetic historical betting-evidence contract.
