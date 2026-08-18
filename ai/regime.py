"""Has this club become a different club?

The question matters because every feature in this package assumes the recent
past is evidence about the near future. Usually it is. Sometimes it is not: a
promoted squad, a new manager with a different shape, a January in which four
starters left. When that happens the model is not wrong about the data — the
data has stopped describing the team.

Two failure modes, and the second is the dangerous one.

Missing a real change makes forecasts stale. Detecting a change that has not
happened is worse: it throws away a club's history on the evidence of a bad
afternoon, and a detector that fires on one 4-0 defeat will fire roughly once
per club per season on noise alone. So the bar here is deliberately hard to
clear — a sustained shift across a window of matches, measured against the
club's own previous variability with a two-sample statistic, or a discrete
event (a division change, a manager change recorded as an observation) that is
a fact rather than an inference.

Leakage: every input is either already-played matches strictly before the
cutoff, or an `ai.observations` row read through `known_at <= as_of`. A
manager appointed on Tuesday and recorded on Wednesday is invisible to a
backtest pretending to forecast on Monday, which is the entire purpose of that
column.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

import numpy as np
import pandas as pd

# The detector's own parameters, stated rather than buried. Each is a defence
# against firing on noise.
RECENT_WINDOW = 6        # matches that might describe the new regime
BASELINE_WINDOW = 12     # matches before them that describe the old one
MIN_RECENT = 5           # below this, "sustained" is not a word that applies
MIN_BASELINE = 8
T_THRESHOLD = 2.5        # Welch t, two-sided; ~1% under the null per test


@dataclass
class RegimeSignal:
    kind: str
    detail: str
    strength: float          # 0..1, how strongly this signal fired
    observed_at: date | None = None


@dataclass
class RegimeVerdict:
    team: str
    changed: bool
    signals: list[RegimeSignal] = field(default_factory=list)
    since: date | None = None
    evidence: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "team": self.team,
            "regime_change": self.changed,
            "since": self.since,
            "signals": [{"kind": s.kind, "detail": s.detail,
                         "strength": round(s.strength, 3),
                         "observed_at": s.observed_at} for s in self.signals],
            "evidence": self.evidence,
        }


def _welch_t(a: np.ndarray, b: np.ndarray) -> float:
    """Two-sample t with unequal variances. Zero when either side is degenerate."""
    if len(a) < 2 or len(b) < 2:
        return 0.0
    va, vb = a.var(ddof=1), b.var(ddof=1)
    denom = np.sqrt(va / len(a) + vb / len(b))
    if not np.isfinite(denom) or denom <= 1e-9:
        return 0.0
    return float((a.mean() - b.mean()) / denom)


def detect_for_team(matches: pd.DataFrame, team: str, as_of: date,
                    division_move: int = 0,
                    manager_changes: list[dict] | None = None) -> RegimeVerdict:
    """`matches` is this club's own played matches, strictly before `as_of`.

    Expected columns: match_date, gf, ga, and optionally sot_f / sot_a. Goal
    margin is always available; shot margin is checked when it is, because a
    change in territory shows up in shots before it shows up in results and
    the whole point is to notice sooner than the table does.
    """
    played = matches[matches["match_date"] < as_of].sort_values("match_date")
    signals: list[RegimeSignal] = []
    evidence: dict = {"matches_considered": int(len(played))}
    since: date | None = None

    # 1. A division change is a fact, not an inference. It is also the one
    #    "regime change" that is certain: the opposition is different.
    if division_move:
        signals.append(RegimeSignal(
            "division_change",
            "promoted" if division_move > 0 else "relegated",
            1.0))

    # 2. A manager change, only if an observation says so and said so in time.
    for change in (manager_changes or []):
        when = change.get("applies_from")
        if isinstance(when, (datetime, pd.Timestamp)):
            when = when.date()
        signals.append(RegimeSignal(
            "manager_change",
            str(change.get("value", {}).get("manager", "new manager")),
            0.8, when))
        if when and (since is None or when > since):
            since = when

    # 3. A sustained statistical shift. Requires both windows to be full: a
    #    club with nine matches of history has no baseline to have changed
    #    from, and pretending otherwise is how a detector fires every August.
    recent = played.tail(RECENT_WINDOW)
    baseline = played.iloc[max(0, len(played) - RECENT_WINDOW - BASELINE_WINDOW):
                           len(played) - RECENT_WINDOW]
    evidence["recent_matches"] = int(len(recent))
    evidence["baseline_matches"] = int(len(baseline))

    if len(recent) >= MIN_RECENT and len(baseline) >= MIN_BASELINE:
        for label, f_col, a_col in (("goal_margin", "gf", "ga"),
                                    ("shot_margin", "sot_f", "sot_a")):
            if f_col not in played.columns or a_col not in played.columns:
                continue
            r = (recent[f_col] - recent[a_col]).dropna().to_numpy(dtype=float)
            b = (baseline[f_col] - baseline[a_col]).dropna().to_numpy(dtype=float)
            t = _welch_t(r, b)
            evidence[f"t_{label}"] = round(t, 3)
            if abs(t) >= T_THRESHOLD:
                signals.append(RegimeSignal(
                    f"sustained_{label}_shift",
                    f"{label.replace('_', ' ')} moved from {b.mean():+.2f} to "
                    f"{r.mean():+.2f} over {len(r)} matches (Welch t {t:+.2f})",
                    float(min(1.0, abs(t) / (2 * T_THRESHOLD)))))
                first_recent = recent["match_date"].iloc[0]
                if since is None:
                    since = first_recent

    # A statistical signal on its own must be sustained AND large; a discrete
    # event stands alone because it is not an inference from noisy data.
    discrete = any(s.kind in ("division_change", "manager_change") for s in signals)
    statistical = [s for s in signals if s.kind.startswith("sustained_")]
    changed = bool(discrete or statistical)

    return RegimeVerdict(team=team, changed=changed, signals=signals,
                         since=since, evidence=evidence)


def team_match_frame(history: pd.DataFrame, team: str) -> pd.DataFrame:
    """One club's matches from either side, in the shape the detector wants."""
    home = history[history["home_canonical"] == team]
    away = history[history["away_canonical"] == team]
    frames = []
    if len(home):
        frames.append(pd.DataFrame({
            "match_date": home["match_date"],
            "gf": home["home_goals"], "ga": home["away_goals"],
            "sot_f": home.get("home_shots_ot"), "sot_a": home.get("away_shots_ot"),
        }))
    if len(away):
        frames.append(pd.DataFrame({
            "match_date": away["match_date"],
            "gf": away["away_goals"], "ga": away["home_goals"],
            "sot_f": away.get("away_shots_ot"), "sot_a": away.get("home_shots_ot"),
        }))
    if not frames:
        return pd.DataFrame(columns=["match_date", "gf", "ga", "sot_f", "sot_a"])
    return pd.concat(frames).sort_values("match_date").reset_index(drop=True)


def regime_weights(match_dates, change_date: date | None,
                   pre_change_weight: float = 0.5):
    """Down-weight evidence from before a detected change.

    Returned as multipliers to be combined with the time decay, never as a
    filter: matches before a regime change are still evidence — a club that
    changed manager did not stop having been a bad defensive side — and
    deleting them would be the same overreaction this module exists to avoid.

    Off by default everywhere. `experiments.py --study regime-weighting` is
    what decides whether it earns a place, on paired folds, like every other
    change in this package.
    """
    dates = pd.to_datetime(pd.Series(list(match_dates)))
    if change_date is None:
        return np.ones(len(dates), dtype=float)
    cut = pd.Timestamp(change_date)
    return np.where(dates < cut, float(pre_change_weight), 1.0)


def manager_change_observations(as_of: datetime, subject_keys=None) -> list[dict]:
    """Manager changes this system knew about at `as_of`, and no others.

    Goes through `ai.observations_as_of`, which contract 185 built for exactly
    this: the guarantee lives in the function's `known_at <= p_as_of` clause
    rather than in this caller remembering to filter. Returns an empty list on
    a lab with no observations, which is the current state and not an error.
    """
    from db import query_df

    frame = query_df(
        "select subject_key, applies_from, known_at, value, source "
        "  from ai.observations_as_of(%s, 'manager', 'team')",
        (as_of,),
    )
    if frame.empty:
        return []
    rows = frame.to_dict("records")
    if subject_keys is not None:
        wanted = set(subject_keys)
        rows = [r for r in rows if r["subject_key"] in wanted]
    return rows
