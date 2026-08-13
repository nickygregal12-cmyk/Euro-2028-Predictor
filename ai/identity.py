"""Whether a fixture's clubs are who the pipeline thinks they are.

Production's first fifty-one forecasts are the argument for this module. The
`provider-poll` Edge Function canonicalised club names through its own
twelve-entry alias table — a fourth vocabulary, complete for the Premier League
and empty below it — so `Leicester City` never became `Leicester`. Leicester's
whole 2025/26 Championship season sat in `ai.raw_matches` under the canonical
name and the fixture asked for a club by a name the history had never heard of.
The feature builder answered honestly: `away_matches_known = 0`,
`away_is_newcomer = 1`, Elo 1180. The model then answered honestly too:

    Notts County 99.659% / draw 0.327% / Leicester 0.014%,  6.00 - 0.05

Nothing in that chain is a modelling error, and the previous version of
`predict.py` printed `WARNING - clubs with no history` and wrote the row
anyway. A warning beside an extreme forecast is not a control: it is a note
somebody reads after the accumulator has already been built.

So this module distinguishes the two cases that look identical in the feature
row and are completely different facts:

  LEGITIMATE — a genuinely new club, a promoted club whose history is in a
  lower division, a first-ever provider appearance, or a league whose history
  this lab has not imported. The right answer is a low data-confidence forecast
  and a `PASS_LOW_DATA` at the gate. These are normal.

  DEFECTIVE — the club HAS history, reachable under a name this fixture's own
  provider spelling resolves to, and the fixture is using the wrong key. There
  is no forecast to make here, only a broken join, and the correct output is a
  refusal with a reason code.

The distinction is deterministic and needs no model, no LLM and no threshold:
it asks the alias authority what the name resolves to and asks the history
whether the answer is in it.
"""
from __future__ import annotations

from dataclasses import dataclass

from aliases import canonical_from_odds_api, normalise

# The two refusals. Named separately because they have different fixes: the
# first is a name nothing can resolve, the second is a name that resolves to a
# club the history holds under a DIFFERENT key, which is a custody defect
# rather than a missing alias.
INVALID_TEAM_IDENTITY = "INVALID_TEAM_IDENTITY"
HISTORY_ALIAS_MISMATCH = "HISTORY_ALIAS_MISMATCH"

# The legitimate states. Reported, never refused.
NO_HISTORY_LEGITIMATE = "NO_HISTORY_NEW_CLUB"


@dataclass(frozen=True)
class ClubVerdict:
    name: str
    matches_known: float | None
    known_in_history: bool
    resolves_to: str | None
    resolution: str
    alias_history_available: bool
    reason: str | None

    @property
    def blocks(self) -> bool:
        return self.reason is not None


@dataclass(frozen=True)
class FixtureVerdict:
    home: ClubVerdict
    away: ClubVerdict

    @property
    def blocks(self) -> bool:
        return self.home.blocks or self.away.blocks

    @property
    def reason_codes(self) -> list[str]:
        return sorted({v.reason for v in (self.home, self.away) if v.reason})

    def to_dict(self) -> dict:
        return {
            "blocked": self.blocks,
            "reason_codes": self.reason_codes,
            "clubs": {
                side: {
                    "name": v.name,
                    "matches_known": v.matches_known,
                    "known_in_history": v.known_in_history,
                    "resolves_to": v.resolves_to,
                    "resolution": v.resolution,
                    "alias_history_available": v.alias_history_available,
                    "reason": v.reason,
                }
                for side, v in (("home", self.home), ("away", self.away))
            },
        }


def _history_index(known_clubs) -> dict[str, str]:
    """Normalised history key -> the canonical name the history actually uses."""
    index: dict[str, str] = {}
    for name in known_clubs:
        index.setdefault(normalise(name), name)
    return index


def assess_club(name: str, known_clubs: set[str],
                history_index: dict[str, str] | None = None,
                matches_known: float | None = None) -> ClubVerdict:
    """One club, judged against the history this run actually loaded."""
    index = history_index if history_index is not None else _history_index(known_clubs)
    in_history = name in known_clubs
    resolved, how = canonical_from_odds_api(name)

    # The alias authority's answer, and whether the history holds it. Also
    # checked by shape, because a club may be in the history under a spelling
    # that normalises to the same key without being character-identical.
    alias_target = resolved if resolved and resolved != name else None
    shape_target = index.get(normalise(name))
    if shape_target == name:
        shape_target = None
    reachable = None
    if alias_target and alias_target in known_clubs:
        reachable = alias_target
    elif shape_target:
        reachable = shape_target

    reason: str | None = None
    if not in_history:
        if reachable is not None:
            # The club is right there, under another key. This is the defect.
            reason = HISTORY_ALIAS_MISMATCH
        elif how == "unmatched" and resolved is None:
            # Nothing in the alias authority or the history recognises this
            # name at all. It may be a genuinely new club — but the pipeline
            # cannot tell that from a corrupted string, and a forecast built on
            # a name nothing recognises is not a forecast.
            reason = INVALID_TEAM_IDENTITY

    return ClubVerdict(
        name=name,
        matches_known=(None if matches_known is None else float(matches_known)),
        known_in_history=in_history,
        resolves_to=reachable or resolved,
        resolution=how,
        alias_history_available=reachable is not None,
        reason=reason,
    )


def assess_fixture(home: str, away: str, known_clubs: set[str],
                   features: dict | None = None,
                   history_index: dict[str, str] | None = None) -> FixtureVerdict:
    """Both clubs of one fixture, before anything is scored.

    `features` is optional and is used only to carry `matches_known` into the
    evidence. The VERDICT never depends on it: a feature row is produced by the
    same broken join it would be asked to detect.
    """
    features = features or {}
    index = history_index if history_index is not None else _history_index(known_clubs)
    return FixtureVerdict(
        home=assess_club(home, known_clubs, index, features.get("home_matches_known")),
        away=assess_club(away, known_clubs, index, features.get("away_matches_known")),
    )


def partition(fixtures, known_clubs: set[str]) -> tuple[list, list]:
    """Split an iterable of (index, home, away, features) into scoreable and refused.

    Returns `(scoreable, refused)`, where each refused entry carries its
    verdict. The caller writes no prediction for a refused fixture — not a
    neutral one, not a low-confidence one, none — because the downstream value
    engine and accumulator are structurally incapable of using a fixture that
    has no prediction row, and that is a stronger guarantee than any threshold.
    """
    index = _history_index(known_clubs)
    scoreable, refused = [], []
    for item in fixtures:
        i, home, away, feats = item
        verdict = assess_fixture(home, away, known_clubs, feats, index)
        (refused if verdict.blocks else scoreable).append((i, home, away, feats, verdict))
    return scoreable, refused
