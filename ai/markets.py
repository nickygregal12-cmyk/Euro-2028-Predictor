"""Every goal-based market, derived from one joint scoreline distribution.

The important structural fact, and the reason this is one module rather than
eight models: over/under, both-teams-to-score, correct score, double chance,
draw-no-bet, team totals, win-to-nil and Asian handicap are all just different
sums over the SAME grid of P(home goals = h, away goals = a). You do not need
a model per market. You need one good grid.

The corollary is less comfortable. Because they share a source, they share
their errors. If the grid is 3% over-confident, six markets are wrong together
and in the same direction, and a dashboard showing "value found in six markets"
is showing one piece of evidence six times. `ai.markets.derived_from_scoreline`
records which markets have this property so the evidence can be discounted.

Cards and corners are genuinely separate — different data, different model,
independent errors. They live in card_corner_models.py.
"""
from __future__ import annotations

import numpy as np

MAX_GOALS_DEFAULT = 10


def _grid(g: np.ndarray) -> np.ndarray:
    g = np.asarray(g, dtype=float)
    if g.ndim == 2:
        g = g[None, :, :]
    return g / g.sum(axis=(1, 2), keepdims=True)


def _totals(n: int) -> np.ndarray:
    """Matrix of h + a for each cell."""
    idx = np.arange(n)
    return idx[:, None] + idx[None, :]


# ---------------------------------------------------------------------------
# Result family
# ---------------------------------------------------------------------------

def match_result(grid) -> np.ndarray:
    """(n, 3) home / draw / away."""
    g = _grid(grid)
    n = g.shape[1]
    idx = np.arange(n)
    home = idx[:, None] > idx[None, :]
    draw = idx[:, None] == idx[None, :]
    away = idx[:, None] < idx[None, :]
    return np.stack([(g * home).sum(axis=(1, 2)),
                     (g * draw).sum(axis=(1, 2)),
                     (g * away).sum(axis=(1, 2))], axis=1)


def double_chance(grid) -> dict[str, np.ndarray]:
    p = match_result(grid)
    return {"1X": p[:, 0] + p[:, 1], "12": p[:, 0] + p[:, 2], "X2": p[:, 1] + p[:, 2]}


def draw_no_bet(grid) -> dict[str, np.ndarray]:
    """A draw returns the stake, so the probabilities renormalise over H and A."""
    p = match_result(grid)
    live = p[:, 0] + p[:, 2]
    return {"Home": p[:, 0] / live, "Away": p[:, 2] / live}


# ---------------------------------------------------------------------------
# Goals family
# ---------------------------------------------------------------------------

def over_under(grid, line: float = 2.5) -> dict[str, np.ndarray]:
    """Half lines only here. A whole line (2.0) can push; use asian_total."""
    g = _grid(grid)
    tot = _totals(g.shape[1])
    over = (g * (tot > line)).sum(axis=(1, 2))
    return {"Over": over, "Under": 1.0 - over}


def asian_total(grid, line: float) -> dict[str, np.ndarray]:
    """Whole and quarter goal lines, returning stake-weighted win probabilities
    and the push probability, because a 2.0 line refunds on exactly 2 goals and
    pretending otherwise silently overstates the edge."""
    g = _grid(grid)
    tot = _totals(g.shape[1])
    if abs(line * 2 - round(line * 2)) > 1e-9:      # quarter line: split two bets
        lo, hi = line - 0.25, line + 0.25
        a, b = asian_total(grid, lo), asian_total(grid, hi)
        return {k: 0.5 * (a[k] + b[k]) for k in ("Over", "Under", "Push")}
    push = (g * (tot == line)).sum(axis=(1, 2)) if float(line).is_integer() else 0.0
    over = (g * (tot > line)).sum(axis=(1, 2))
    under = (g * (tot < line)).sum(axis=(1, 2))
    return {"Over": over, "Under": under, "Push": np.asarray(push)}


def both_teams_to_score(grid) -> dict[str, np.ndarray]:
    g = _grid(grid)
    yes = g[:, 1:, 1:].sum(axis=(1, 2))
    return {"Yes": yes, "No": 1.0 - yes}


def correct_score(grid, top_n: int = 20) -> list[dict[str, float]]:
    g = _grid(grid)
    n = g.shape[1]
    out = []
    for m in g:
        flat = m.flatten()
        order = np.argsort(flat)[::-1][:top_n]
        out.append({f"{i // n}-{i % n}": float(flat[i]) for i in order})
    return out


def team_totals(grid, line: float = 1.5) -> dict[str, np.ndarray]:
    g = _grid(grid)
    n = g.shape[1]
    idx = np.arange(n)
    home_over = (g * (idx[:, None] > line)).sum(axis=(1, 2))
    away_over = (g * (idx[None, :] > line)).sum(axis=(1, 2))
    return {"HomeOver": home_over, "HomeUnder": 1 - home_over,
            "AwayOver": away_over, "AwayUnder": 1 - away_over}


def win_to_nil(grid) -> dict[str, np.ndarray]:
    g = _grid(grid)
    n = g.shape[1]
    idx = np.arange(n)
    home = (g * ((idx[:, None] > idx[None, :]) & (idx[None, :] == 0))).sum(axis=(1, 2))
    away = (g * ((idx[None, :] > idx[:, None]) & (idx[:, None] == 0))).sum(axis=(1, 2))
    return {"HomeWinToNil": home, "AwayWinToNil": away}


def clean_sheet(grid) -> dict[str, np.ndarray]:
    g = _grid(grid)
    return {"HomeCS": g[:, :, 0].sum(axis=1), "AwayCS": g[:, 0, :].sum(axis=1)}


def asian_handicap(grid, line: float) -> dict[str, np.ndarray]:
    """`line` applies to the HOME team: -1.0 means home must win by two.

    Whole lines push, quarter lines split the stake across the two neighbouring
    half-lines. Both are handled, because the Asian handicap market has the
    lowest margins in football and is therefore the one most worth pricing
    correctly.
    """
    if abs(line * 2 - round(line * 2)) > 1e-9:
        lo, hi = line - 0.25, line + 0.25
        a, b = asian_handicap(grid, lo), asian_handicap(grid, hi)
        return {k: 0.5 * (a[k] + b[k]) for k in ("Home", "Away", "Push")}
    g = _grid(grid)
    n = g.shape[1]
    idx = np.arange(n)
    margin = (idx[:, None] - idx[None, :]) + line
    home = (g * (margin > 0)).sum(axis=(1, 2))
    away = (g * (margin < 0)).sum(axis=(1, 2))
    push = (g * (np.abs(margin) < 1e-9)).sum(axis=(1, 2))
    return {"Home": home, "Away": away, "Push": push}


# ---------------------------------------------------------------------------
# One call to price everything
# ---------------------------------------------------------------------------

OU_LINES = (0.5, 1.5, 2.5, 3.5, 4.5)
AH_LINES = (-2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25,
            0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)
TT_LINES = (0.5, 1.5, 2.5)


def price_all(grid, cs_top_n: int = 12) -> list[dict]:
    """Every scoreline-derived market for each row of the grid.

    Returned as one document per fixture so it can be stored whole in
    ai.predictions.market_probabilities — keeping them together is a reminder
    that they came from one grid and are not independent.
    """
    g = _grid(grid)
    n_rows = g.shape[0]
    res = match_result(g)
    dc, dnb = double_chance(g), draw_no_bet(g)
    btts, wtn, cs_ = both_teams_to_score(g), win_to_nil(g), clean_sheet(g)
    scores = correct_score(g, cs_top_n)

    ou = {L: over_under(g, L) for L in OU_LINES}
    at = {L: asian_total(g, L) for L in (1.0, 2.0, 3.0, 2.25, 2.75)}
    ah = {L: asian_handicap(g, L) for L in AH_LINES}
    tt = {L: team_totals(g, L) for L in TT_LINES}

    out = []
    for i in range(n_rows):
        out.append({
            "1X2": {"H": float(res[i, 0]), "D": float(res[i, 1]), "A": float(res[i, 2])},
            "DC": {k: float(v[i]) for k, v in dc.items()},
            "DNB": {k: float(v[i]) for k, v in dnb.items()},
            "BTTS": {k: float(v[i]) for k, v in btts.items()},
            "WTN": {k: float(v[i]) for k, v in wtn.items()},
            "CleanSheet": {k: float(v[i]) for k, v in cs_.items()},
            "OU": {str(L): {k: float(v[i]) for k, v in d.items()} for L, d in ou.items()},
            "AsianTotal": {str(L): {k: float(np.atleast_1d(v)[i if np.ndim(v) else 0])
                                    for k, v in d.items()} for L, d in at.items()},
            "AH": {str(L): {k: float(v[i]) for k, v in d.items()} for L, d in ah.items()},
            "TT": {str(L): {k: float(v[i]) for k, v in d.items()} for L, d in tt.items()},
            "CS": {k: round(v, 5) for k, v in scores[i].items()},
        })
    return out
