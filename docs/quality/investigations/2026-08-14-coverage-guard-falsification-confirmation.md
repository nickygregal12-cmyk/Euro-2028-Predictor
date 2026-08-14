# Coverage guard historical falsification — explicit-arm confirmation

**14 August 2026. Closed.**

This is the one targeted rerun required after the coverage guard became the normal
`fit_family` behaviour. The historical study now names its semantics explicitly:

- **CONTROL:** `coverage_guard=False` — full configured feature set;
- **GUARDED:** `coverage_guard=True` — support-filtered adopted behaviour.

No other model experiment was rerun.

## Execution

- GitHub Actions run: **31759647868**
- checkout: PR #781 merge ref `e27fb5345f2cd543933f5f843bb39b039ae5b73e`
- Development project: `iouzoutneyjpugbbtdem`
- `AI_READ_ONLY=1`
- package write-scope proof: passed
- provider scripts/calls: **none**
- study: `experiments.py --study coverage-guard`, all nine leagues only
- artifact: `coverage-falsification-31759647868`
- artifact id: **9204139712**
- artifact SHA-256: `5db7e268db3bf11a933582aa08cf38a1cd6531e0fa5a16ce471a2ce6502be91a`

## Result

| League | Fired folds | Paired delta | Result |
| --- | --- | ---: | --- |
| EPL | none | +0.000000000000 | exact no-op |
| ECH | none | +0.000000000000 | exact no-op |
| EL1 | none | +0.000000000000 | exact no-op |
| EL2 | none | +0.000000000000 | exact no-op |
| ENL | none | +0.000000000000 | exact no-op |
| SPL | none | +0.000000000000 | exact no-op |
| SCH | 1718 | -0.028300634297 | catastrophic sparse-coverage fold removed |
| SL1 | 1718 | +0.000000000000 | numerical identity |
| SL2 | 1718 | +0.000000000000 | numerical identity |

The decisive SCH fold reproduced the original result exactly to the shown precision:

- dropped groups: `shots_volume`, `corners`;
- training support for each: `0.0085`;
- test support for each: `0.9250`;
- control log loss: **1.303120337899**;
- guarded log loss: **1.048414629228**.

SL1 and SL2 also dropped `shots_volume` + `corners` in 1718, but the model output
was numerically unchanged:

- SL1: `0.993483596389 → 0.993483596389`;
- SL2: `1.028320967177 → 1.028320967177`.

## Verdict

The adopted general coverage guard is confirmed. It removes the SCH coverage-regime
failure while remaining an exact/no-material-change operation everywhere else.
There is no league-specific branch and no reason to reopen this research question.

The model-selection policy previously confirmed on Development remains valid; this
rerun changes no selected family or half-life and therefore does not justify another
broad model study.
