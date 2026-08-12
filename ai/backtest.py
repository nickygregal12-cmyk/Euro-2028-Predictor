"""Simulating a betting record, and being honest about what it proves.

The central fact this module is built around, which you should read before
looking at any profit figure it produces:

    A genuine 3% ROI edge, flat-staked at average odds of 3.0, is detected by a
    one-sided 95% t-test only about 36% of the time after FOUR THOUSAND bets.
    Reaching 80% power needs roughly twelve thousand.

At ten selections a week that is over twenty years. Profit is therefore not a
measurable signal at the volume you will ever operate at, and any dashboard
that leads with "+£340 this season" is reporting noise with a pound sign on it.

Closing-line value is different. A true +1% CLV is detected about 89% of the
time after a hundred bets, because every bet contributes a measurement rather
than a coin flip. That is why `summarise` puts CLV first and profit last.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

import betting


@dataclass
class BacktestResult:
    n_bets: int
    n_candidates: int
    staked: float
    profit: float
    # Two different numbers that are both routinely called "ROI".
    # flat_unit_roi is the mean return per unit staked treating every bet as
    # the same size. It is the series the significance test runs on, because
    # it is (near enough) i.i.d.
    # stake_weighted_roi is profit / total staked for the simulated book, which
    # is what the strategy actually returned once Kelly varied the stakes.
    # They differ whenever the winners and losers were not the same size, which
    # is always.
    flat_unit_roi: float
    stake_weighted_roi: float
    roi_ci: tuple[float, float]
    roi_p_value: float
    hit_rate: float
    mean_odds: float
    mean_edge: float
    mean_clv: float | None
    clv_ci: tuple[float, float] | None
    clv_p_value: float | None
    beat_close_rate: float | None
    max_drawdown: float
    final_bankroll: float
    bets_for_80pct_power: int | None
    by_league: dict = field(default_factory=dict)
    equity_curve: list = field(default_factory=list)


def _bootstrap_ci(x: np.ndarray, n_boot: int = 5000, alpha: float = 0.05,
                  seed: int = 12345) -> tuple[float, float]:
    """Percentile bootstrap. Betting returns are wildly non-normal — a handful
    of 8.0 winners dominate the mean — so a normal-theory interval understates
    the spread badly at small n."""
    if len(x) < 2:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(x), size=(n_boot, len(x)))
    means = x[idx].mean(axis=1)
    return (float(np.quantile(means, alpha / 2)), float(np.quantile(means, 1 - alpha / 2)))


def _one_sided_p(x: np.ndarray) -> float:
    """P(observing this mean or better | true mean is zero), normal approximation."""
    if len(x) < 2 or x.std(ddof=1) == 0:
        return float("nan")
    from scipy.stats import norm
    t = x.mean() / (x.std(ddof=1) / np.sqrt(len(x)))
    return float(1.0 - norm.cdf(t))


def bets_for_power(observed_roi: float, return_sd: float,
                   power: float = 0.80, alpha: float = 0.05) -> int | None:
    """How many bets would be needed to detect this edge, if it is real.

    Printed next to every ROI figure so the number is read in context. It is
    almost always a shock, and it should be.
    """
    if observed_roi <= 0 or return_sd <= 0:
        return None
    from scipy.stats import norm
    z_a, z_b = norm.ppf(1 - alpha), norm.ppf(power)
    return int(np.ceil(((z_a + z_b) * return_sd / observed_roi) ** 2))


def bets_for_clv_power(observed_clv: float, clv_sd: float,
                       power: float = 0.80, alpha: float = 0.05) -> int | None:
    """Same calculation as bets_for_power, for CLV.

    Exposed separately because the widely-quoted "CLV converges in about a
    hundred bets" is not a law; it depends entirely on the standard deviation
    of your own CLV series, which depends on your odds range, your selection
    rule and which benchmark you compare against. Measure your own SD from
    ai.bet_results and put it in here rather than trusting anyone's round
    number, including mine.
    """
    return bets_for_power(observed_clv, clv_sd, power, alpha)


def run(
    model_probs: np.ndarray,          # (n, 3) H/D/A
    odds: np.ndarray,                 # (n, 3) best available decimal price
    results: np.ndarray,              # (n,) 'H'/'D'/'A'
    *,
    closing_odds: np.ndarray | None = None,   # (n, 3)
    average_odds: np.ndarray | None = None,   # (n, 3) market average
    leagues: np.ndarray | None = None,
    rule: betting.SelectionRule | None = None,
    staking: str = "kelly",           # 'flat' | 'kelly'
    starting_bankroll: float = 1000.0,
    flat_stake: float = 10.0,
    commission: float = 0.0,          # 0.02 for a 2% exchange commission on wins
    devig_method: str = "shin",
) -> BacktestResult:
    """Walk the selections in order and simulate the bankroll.

    `odds` must be the price you could actually have taken at the time you
    predicted — not the best price in hindsight, and not the closing price.
    Backtesting against closing odds is the most common way a value strategy
    proves itself and then loses money: the closing price is not available to
    you when you bet, and it is the price that already contains the information
    you think you have found.
    """
    rule = rule or betting.SelectionRule()
    p = np.asarray(model_probs, dtype=float)
    o = np.asarray(odds, dtype=float)
    res = np.asarray(results)
    n_matches = len(res)

    mask = rule.select(p, o)
    # One bet per match: the best qualifying edge, not all three outcomes.
    ev_all = np.where(mask, betting.expected_value(p, o), -np.inf)
    best_leg = ev_all.argmax(axis=1)
    has_bet = np.isfinite(ev_all.max(axis=1)) & (ev_all.max(axis=1) > -np.inf)

    rows = np.arange(n_matches)[has_bet]
    legs = best_leg[has_bet]
    if len(rows) == 0:
        return BacktestResult(0, n_matches, 0.0, 0.0, 0.0, 0.0, (float("nan"),) * 2,
                              float("nan"), 0.0, 0.0, 0.0, None, None, None, None,
                              0.0, starting_bankroll, None)

    bet_odds = o[rows, legs]
    bet_prob = p[rows, legs]
    bet_edge = betting.expected_value(bet_prob, bet_odds)
    won = res[rows] == np.array(betting.OUTCOMES)[legs]

    # ---- staking, sequentially so the bankroll compounds -------------------
    bankroll = starting_bankroll
    stakes, equity = [], []
    peak, max_dd = starting_bankroll, 0.0
    for i in range(len(rows)):
        if staking == "flat":
            stake = flat_stake
        else:
            f = betting.fractional_kelly(bet_prob[i], bet_odds[i],
                                         rule.kelly_fraction, rule.max_stake_fraction)
            stake = float(f) * bankroll
        stake = min(stake, bankroll)
        gross = (bet_odds[i] - 1.0) * stake
        if won[i]:
            bankroll += gross * (1.0 - commission)
        else:
            bankroll -= stake
        stakes.append(stake)
        equity.append(bankroll)
        peak = max(peak, bankroll)
        max_dd = max(max_dd, (peak - bankroll) / peak if peak > 0 else 0.0)

    stakes = np.array(stakes)
    # Per-unit returns, which is what the statistics are computed on.
    unit_return = np.where(won, (bet_odds - 1.0) * (1.0 - commission), -1.0)

    staked = float(stakes.sum())
    profit = float((unit_return * stakes).sum())
    flat_unit_roi = float(unit_return.mean())
    stake_weighted_roi = float(profit / staked) if staked > 0 else float("nan")

    # ---- closing-line value ------------------------------------------------
    mean_clv = clv_ci = clv_p = beat_rate = None
    if closing_odds is not None:
        close = np.asarray(closing_odds, dtype=float)[rows]
        valid = np.isfinite(close).all(axis=1)
        if valid.sum() >= 2:
            fair_close = betting.fair_probabilities(close[valid], devig_method)
            leg_fair = fair_close[np.arange(valid.sum()), legs[valid]]
            clv = betting.closing_line_value(bet_odds[valid], leg_fair)
            mean_clv = float(clv.mean())
            clv_ci = _bootstrap_ci(clv)
            clv_p = _one_sided_p(clv)
            beat_rate = float((bet_odds[valid] > close[valid][
                np.arange(valid.sum()), legs[valid]]).mean())

    # ---- per-league breakdown ---------------------------------------------
    by_league: dict = {}
    if leagues is not None:
        lg = np.asarray(leagues)[rows]
        for key in np.unique(lg):
            m = lg == key
            if m.sum() < 5:
                continue
            by_league[str(key)] = {
                "n": int(m.sum()),
                "flat_unit_roi": round(float(unit_return[m].mean()), 4),
                "hit_rate": round(float(won[m].mean()), 4),
                "mean_odds": round(float(bet_odds[m].mean()), 3),
            }

    return BacktestResult(
        n_bets=len(rows),
        n_candidates=n_matches,
        staked=staked,
        profit=profit,
        flat_unit_roi=flat_unit_roi,
        stake_weighted_roi=stake_weighted_roi,
        roi_ci=_bootstrap_ci(unit_return),
        roi_p_value=_one_sided_p(unit_return),
        hit_rate=float(won.mean()),
        mean_odds=float(bet_odds.mean()),
        mean_edge=float(bet_edge.mean()),
        mean_clv=mean_clv,
        clv_ci=clv_ci,
        clv_p_value=clv_p,
        beat_close_rate=beat_rate,
        max_drawdown=float(max_dd),
        final_bankroll=float(bankroll),
        bets_for_80pct_power=bets_for_power(flat_unit_roi,
                                            float(unit_return.std(ddof=1))),
        by_league=by_league,
        equity_curve=[round(float(e), 2) for e in equity],
    )


def report(r: BacktestResult) -> str:
    lines = [
        "",
        "CLOSING-LINE VALUE  (the metric that means something at this sample size)",
    ]
    if r.mean_clv is None:
        lines.append("  no closing odds supplied — cannot assess")
    else:
        lo, hi = r.clv_ci
        verdict = ("evidence of a real edge" if lo > 0
                   else "not distinguishable from zero")
        lines += [
            f"  mean CLV        {r.mean_clv:+.4f}   95% CI [{lo:+.4f}, {hi:+.4f}]  p={r.clv_p_value:.3f}",
            f"  beat the close  {r.beat_close_rate:.1%} of bets",
            f"  verdict         {verdict}",
        ]

    lo, hi = r.roi_ci
    lines += [
        "",
        "PROFIT  (read the interval, not the point estimate)",
        f"  bets            {r.n_bets} from {r.n_candidates} matches "
        f"({r.n_bets / max(r.n_candidates,1):.1%} selected)",
        f"  hit rate        {r.hit_rate:.1%}   mean odds {r.mean_odds:.2f}   "
        f"mean claimed edge {r.mean_edge:+.1%}",
        f"  flat-unit ROI   {r.flat_unit_roi:+.2%}   95% CI [{lo:+.2%}, {hi:+.2%}]  "
        f"p={r.roi_p_value:.3f}",
        f"  stake-weighted  {r.stake_weighted_roi:+.2%}   (what the Kelly-staked book "
        f"actually returned)",
        f"  staked {r.staked:,.0f}  profit {r.profit:+,.0f}  "
        f"final bankroll {r.final_bankroll:,.0f}  max drawdown {r.max_drawdown:.1%}",
    ]
    if r.bets_for_80pct_power:
        weeks = r.bets_for_80pct_power / 10
        lines.append(
            f"  to show this flat-unit ROI is real at 80% power you would need "
            f"{r.bets_for_80pct_power:,} bets (~{weeks/52:.0f} years at 10 a week)"
        )
    else:
        lines.append("  flat-unit ROI is negative or degenerate; power calculation "
                     "not meaningful")

    if r.by_league:
        lines += ["", "BY LEAGUE"]
        for k, v in sorted(r.by_league.items()):
            lines.append(f"  {k:6} n={v['n']:>5}  flat ROI {v['flat_unit_roi']:+.2%}  "
                         f"hit {v['hit_rate']:.1%}  avg odds {v['mean_odds']:.2f}")
    return "\n".join(lines)
