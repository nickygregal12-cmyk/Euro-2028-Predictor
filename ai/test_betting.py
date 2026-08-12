"""Offline verification of the betting layer.

Simulates a market whose accuracy you control, so that "does the backtester
correctly say there is no edge when there is no edge" can actually be checked —
which is the failure mode that matters. A backtester that finds profit in a
fair market will find profit in your data too, and you will believe it.

Run:  python test_betting.py
"""
from __future__ import annotations

import numpy as np

import backtest
import betting

RNG = np.random.default_rng(28061966)
OUTCOMES = np.array(["H", "D", "A"])


def simulate_market(n: int, model_noise: float, market_noise: float,
                    margin: float = 0.05, close_noise: float | None = None,
                    best_price_uplift: float = 0.0):
    """Returns (model_probs, offered_odds, closing_odds, average_odds, results).

    `model_noise` vs `market_noise` is the whole experiment: equal means no
    edge, model lower means the model genuinely knows more than the price.
    """
    # True probabilities, Dirichlet-ish and football-shaped
    true = RNG.dirichlet([4.6, 2.7, 3.2], size=n)

    def perturb(p, sd):
        logit = np.log(np.clip(p, 1e-9, None)) + RNG.normal(0, sd, p.shape)
        e = np.exp(logit - logit.max(axis=1, keepdims=True))
        return e / e.sum(axis=1, keepdims=True)

    model = perturb(true, model_noise)
    market_fair = perturb(true, market_noise)
    close_fair = perturb(true, close_noise if close_noise is not None else market_noise * 0.7)

    # Apply the bookmaker margin to get quoted prices.
    avg_odds = 1.0 / (market_fair * (1.0 + margin))
    best_odds = avg_odds * (1.0 + best_price_uplift)      # line shopping
    close_odds = 1.0 / (close_fair * (1.0 + margin * 0.6))  # margin tightens at close

    u = RNG.random((n, 1))
    cum = true.cumsum(axis=1)
    results = OUTCOMES[(u > cum).sum(axis=1)]
    return model, best_odds, close_odds, avg_odds, results


def check_devig_recovers_truth() -> None:
    """De-vigging a book built FROM known probabilities must return them."""
    true = np.array([[0.46, 0.27, 0.27], [0.72, 0.18, 0.10]])
    odds = 1.0 / (true * 1.045)
    for method in ("multiplicative", "power", "shin"):
        rec = betting.fair_probabilities(odds, method)
        err = np.abs(rec - true).max()
        assert err < 0.02, f"{method} recovered probabilities off by {err:.4f}"
    # Multiplicative is exact here only because the margin was applied
    # proportionally. Shin should still be close, which is the point.
    print("  [pass] all de-vig methods recover a proportionally-margined book")


def check_shin_vs_multiplicative_on_longshots() -> None:
    """Shin must assign the favourite MORE probability than multiplicative.

    This is the favourite-longshot correction. If it ever inverts, the method
    is wrong and every longshot 'value bet' it produces is an artefact."""
    odds = np.array([[1.25, 6.0, 12.0]])
    m = betting.fair_probabilities(odds, "multiplicative")[0]
    s = betting.fair_probabilities(odds, "shin")[0]
    assert s[0] > m[0] and s[2] < m[2], "Shin did not correct favourite-longshot bias"
    print(f"  [pass] Shin lifts the favourite {m[0]:.3f} -> {s[0]:.3f} and "
          f"cuts the longshot {m[2]:.3f} -> {s[2]:.3f}")


def check_no_edge_market() -> None:
    """NEGATIVE CONTROL: a perfectly efficient market.

    market_noise = 0 means the price IS the truth plus a margin. This is the
    right model of an efficient market and it is a stronger test than making
    both estimates equally noisy — two independent noisy estimates of the same
    truth can genuinely be averaged for profit, which is a real effect but not
    the one being tested here.

    A correct backtester must lose almost exactly the margin, no matter how
    selective the rule is, and must report negative CLV. If this ever shows
    profit, nothing else in this module can be believed."""
    model, best, close, avg, res = simulate_market(
        8000, model_noise=0.30, market_noise=0.0, margin=0.05, close_noise=0.0)
    r = backtest.run(model, best, res, closing_odds=close, average_odds=avg,
                     staking="flat")
    print(f"  efficient market: {r.n_bets} bets, ROI {r.flat_unit_roi:+.2%} "
          f"CI [{r.roi_ci[0]:+.2%}, {r.roi_ci[1]:+.2%}], CLV {r.mean_clv:+.4f}")
    print(f"  (theoretical ROI against a proportionally-margined book: "
          f"{1/1.05 - 1:+.2%})")
    assert r.flat_unit_roi < 0.0, f"found {r.flat_unit_roi:+.2%} flat ROI in an efficient market"
    assert r.mean_clv < 0.005, f"manufactured CLV of {r.mean_clv:+.4f} against truth"
    print("  [pass] no profit and no CLV manufactured from an efficient market")


def check_real_edge_is_found() -> None:
    """POSITIVE CONTROL: the model is better informed than the price.

    The closing line is set halfway back toward the truth, which is what a real
    market does as money arrives — so CLV should be positive but smaller than
    the raw edge."""
    model, best, close, avg, res = simulate_market(
        8000, model_noise=0.08, market_noise=0.30, margin=0.05, close_noise=0.20)
    r = backtest.run(model, best, res, closing_odds=close, average_odds=avg,
                     staking="flat")
    print(f"  soft market:      {r.n_bets} bets, ROI {r.flat_unit_roi:+.2%} "
          f"CI [{r.roi_ci[0]:+.2%}, {r.roi_ci[1]:+.2%}], CLV {r.mean_clv:+.4f} "
          f"CI [{r.clv_ci[0]:+.4f}, {r.clv_ci[1]:+.4f}]")
    assert r.mean_clv > 0, "failed to detect a genuine informational edge"
    assert r.clv_ci[0] > 0, "edge present but not significant — sample too small"
    assert r.flat_unit_roi > 0, "genuine edge did not translate into positive ROI"
    print("  [pass] a genuine edge shows up in both CLV and ROI")


def check_selectivity_does_not_create_edge() -> None:
    """Against an efficient market, tightening the threshold must not help.

    The instinct when a strategy loses is to demand a bigger edge. Against a
    market that is actually right, a bigger threshold just selects matches where
    the model is more wrong, and the ROI stays pinned at minus the margin."""
    model, best, close, avg, res = simulate_market(
        8000, model_noise=0.30, market_noise=0.0, margin=0.05, close_noise=0.0)
    print(f"  {'min edge':>10}{'bets':>8}{'ROI':>10}")
    rois = []
    for thr in (0.02, 0.05, 0.10, 0.20):
        rule = betting.SelectionRule(min_edge=thr)
        r = backtest.run(model, best, res, closing_odds=close, rule=rule, staking="flat")
        rois.append(r.flat_unit_roi)
        print(f"  {thr:>10.0%}{r.n_bets:>8}{r.flat_unit_roi:>+10.2%}")
    assert max(rois) < 0.0, "selectivity manufactured profit from an efficient market"
    print("  [pass] a bigger threshold does not conjure an edge that is not there")


def check_line_shopping_is_separated() -> None:
    """A model with NO informational edge, but taking prices 3% above average.

    The total edge looks real. The decomposition must attribute essentially
    all of it to line shopping rather than to the model."""
    model, best, close, avg, res = simulate_market(
        6000, model_noise=0.10, market_noise=0.0, margin=0.05,
        best_price_uplift=0.03)
    d = betting.decompose_edge(model, best, avg)
    total = d["total_edge"].mean()
    model_part = d["model_edge_vs_average"].mean()
    shop_part = d["line_shopping_edge"].mean()
    print(f"  total {total:+.4f}  =  model vs average {model_part:+.4f}"
          f"  +  line shopping {shop_part:+.4f}")
    assert abs(shop_part - 0.03) < 0.001, "line-shopping component mis-measured"
    assert model_part < 0, ("the model has no information here, so its component "
                            "must be negative by the margin")
    print("  [pass] the 3% is correctly attributed to shopping, not to the model")


def check_two_roi_definitions_differ() -> None:
    """Under Kelly staking the flat-unit return and the stake-weighted return
    are different numbers, and reporting either one as "ROI" is ambiguous.

    A code review caught this: the backtester was computing profit from the
    real variable stakes but reporting the flat-stake mean as the ROI."""
    model, best, close, avg, res = simulate_market(
        4000, model_noise=0.12, market_noise=0.30, margin=0.05)
    flat = backtest.run(model, best, res, closing_odds=close, staking="flat")
    kelly = backtest.run(model, best, res, closing_odds=close, staking="kelly")
    print(f"  flat staking:  flat-unit {flat.flat_unit_roi:+.2%}  "
          f"stake-weighted {flat.stake_weighted_roi:+.2%}")
    print(f"  kelly staking: flat-unit {kelly.flat_unit_roi:+.2%}  "
          f"stake-weighted {kelly.stake_weighted_roi:+.2%}")
    assert abs(flat.flat_unit_roi - flat.stake_weighted_roi) < 1e-9, \
        "with equal stakes the two definitions must coincide"
    assert abs(kelly.flat_unit_roi - kelly.stake_weighted_roi) > 1e-6, \
        "with variable stakes they must differ"
    print("  [pass] the two ROI definitions coincide under flat stakes and "
          "diverge under Kelly, as they should")


def check_power_arithmetic() -> None:
    """The headline claim of this module, verified by simulation rather than
    quoted from a textbook."""
    odds, roi = 3.0, 0.03
    p_win = (1 + roi) / odds
    detections = 0
    trials = 3000
    for _ in range(trials):
        wins = RNG.random(4000) < p_win
        ret = np.where(wins, odds - 1.0, -1.0)
        t = ret.mean() / (ret.std(ddof=1) / np.sqrt(len(ret)))
        detections += t > 1.645
    power = detections / trials
    needed = backtest.bets_for_power(roi, float(np.sqrt(p_win * (odds - 1 - roi) ** 2
                                                        + (1 - p_win) * (1 + roi) ** 2)))
    print(f"  a true +3% ROI at odds 3.0 is detected in {power:.0%} of 4,000-bet "
          f"samples; 80% power needs ~{needed:,} bets")
    assert power < 0.5, "power calculation disagrees with simulation"
    print("  [pass] profit is not a measurable signal at hobby volume")


def test_per_league_report_uses_flat_roi_key() -> None:
    """Regression: report() used to read a key run() never wrote."""
    n = 12
    probs = np.tile([0.65, 0.20, 0.15], (n, 1))
    odds = np.tile([2.0, 3.5, 5.0], (n, 1))
    results = np.array(["H", "A"] * (n // 2))
    leagues = np.array(["EPL"] * 6 + ["SL2"] * 6)
    r = backtest.run(probs, odds, results, leagues=leagues, staking="flat")
    text = backtest.report(r)
    assert "EPL" in text and "SL2" in text and "flat ROI" in text


def main() -> None:
    print("1. de-vigging")
    check_devig_recovers_truth()
    check_shin_vs_multiplicative_on_longshots()
    print("\n2. negative control")
    check_no_edge_market()
    print("\n3. positive control")
    check_real_edge_is_found()
    print("\n3b. selectivity is not a strategy")
    check_selectivity_does_not_create_edge()
    print("\n4. line shopping vs model skill")
    check_line_shopping_is_separated()
    print("\n4b. two ROI definitions")
    check_two_roi_definitions_differ()
    print("\n5. statistical power")
    check_power_arithmetic()
    print("\nALL BETTING CHECKS PASSED")


if __name__ == "__main__":
    main()
