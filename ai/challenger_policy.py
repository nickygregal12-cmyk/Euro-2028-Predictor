"""The model configurations the weekly challenger job is allowed to train.

This is not a tuning surface. The values below are a copy of the predeclared,
Development-only all-nine selection result recorded in
`docs/quality/investigations/2026-08-14-final-guarded-model-selection-results.md`
and confirmed on the wrapper-fix head in the companion confirmation document.

Changing a value here therefore requires new paired walk-forward evidence; it
must never be edited just because another configuration has a lower in-sample
number. `test_challenger_policy.py` pins both the nine-league coverage and the
exact admitted set so "the research said X" and "Monday trains Y" cannot drift
apart silently.

Every command this module builds creates a CHALLENGER only. `train.py` owns that
lifecycle invariant and promotion remains the separate admin/human gate.
"""
from __future__ import annotations

from dataclasses import dataclass

from config import LEAGUES

AUTHORITY = (
    "docs/quality/investigations/"
    "2026-08-14-final-guarded-model-selection-results.md"
)
CONFIRMATION = (
    "docs/quality/investigations/"
    "2026-08-14-final-guarded-model-selection-confirmation.md"
)


@dataclass(frozen=True)
class ChallengerSpec:
    family: str
    half_life_days: int
    base_families: tuple[str, ...] = ()
    meta: str | None = None

    def train_args(self, league: str, version: str) -> list[str]:
        args = [
            "train.py",
            "--league", league,
            "--family", self.family,
            "--half-life-days", str(self.half_life_days),
            "--version", version,
            "--walk-forward",
        ]
        if self.family == "ensemble":
            args += ["--base-families", *self.base_families]
            if self.meta:
                args += ["--meta", self.meta]
        return args


# Fixed by the 14-Aug-2026 predeclared selector. Ordered to match config.LEAGUES
# so logs and artefacts remain stable across runs.
CHALLENGER_POLICY: dict[str, ChallengerSpec] = {
    "EPL": ChallengerSpec("ensemble", 1800, ("poisson", "elo"), "equal_blend"),
    "ECH": ChallengerSpec("ensemble", 1800, ("poisson", "elo"), "equal_blend"),
    "EL1": ChallengerSpec("poisson", 1800),
    "EL2": ChallengerSpec("poisson", 900),
    "ENL": ChallengerSpec("poisson", 900),
    "SPL": ChallengerSpec("poisson", 1800),
    "SCH": ChallengerSpec("poisson", 900),
    "SL1": ChallengerSpec("poisson", 1800),
    "SL2": ChallengerSpec("poisson", 900),
}


def ordered_policy() -> list[tuple[str, ChallengerSpec]]:
    """Return exactly one admitted challenger specification per known league."""
    missing = [league for league in LEAGUES if league not in CHALLENGER_POLICY]
    extra = [league for league in CHALLENGER_POLICY if league not in LEAGUES]
    if missing or extra:
        raise RuntimeError(
            f"challenger policy does not match config.LEAGUES: "
            f"missing={missing}, extra={extra}")
    return [(league, CHALLENGER_POLICY[league]) for league in LEAGUES]
