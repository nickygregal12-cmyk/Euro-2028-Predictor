#!/usr/bin/env bash
# Run one AI Lab command once per league, over all nine by default.
#
#   ./run_leagues.sh predict.py --days-ahead 10
#
# Two properties, both of which the inline loops it replaces got wrong.
#
# The leagues are independent, so one failure must not cost the other eight.
# GitHub Actions runs a step under `bash -e`, so `for L in ...; do python
# evaluate.py --league "$L"; done` abandoned every later league the moment one
# died — and in the evening job it also skipped settlement entirely.
#
# A failure must still be visible. The inline loops guarded predict and
# find_value with `|| echo "no current model for $L"` and `|| true`, but
# neither script exits non-zero when there is no current model: both print
# their own message, record the skip in `ai.job_runs` and return 0. Those
# guards could therefore only ever fire on a REAL error — a dead database, an
# artefact whose SHA no longer matches, a feature build that raised — and they
# turned each one into a reassuring line of output and a green run. This runs
# every league, names the ones that failed, and exits non-zero if any did.
set -uo pipefail

LEAGUES=(EPL ECH EL1 EL2 ENL SPL SCH SL1 SL2)
PYTHON="${PYTHON:-python}"

if [ "$#" -lt 1 ]; then
  echo "usage: run_leagues.sh <script.py> [args...]" >&2
  exit 2
fi

script="$1"
shift

failed=()
for league in "${LEAGUES[@]}"; do
  echo "--- ${script} ${league} ---"
  if ! "${PYTHON}" "${script}" --league "${league}" "$@"; then
    failed+=("${league}")
  fi
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "${script} failed for: ${failed[*]}" >&2
  exit 1
fi
echo "${script} completed for all ${#LEAGUES[@]} leagues"
