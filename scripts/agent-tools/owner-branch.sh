#!/usr/bin/env bash
# Create and switch to a task branch, and only a task branch.
#
# The third enforcing edge. Review made the point that push and pull request had
# wrappers while branch creation and commit did not, so the policy's task-branch
# rule could be sidestepped by running git directly — an authority that is
# optional to consult is not an authority.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf 'Usage: owner-branch.sh <namespace>/<name>\n' >&2
  exit 2
fi

branch="$1"
repository_root="$(git rev-parse --show-toplevel)"

# The name is checked by the policy, not here: one definition of "a task
# branch", used by every edge.
if ! node "${repository_root}/scripts/check-pre-live-owner-authority.mjs" branch.create --branch "$branch" >/dev/null; then
  printf 'Refusing: branch.create is not permitted for %s by the current authority policy.\n' "$branch" >&2
  # 3 = authority refusal, distinct from a validation (1) or usage (2) failure:
  # a policy denial is not a defect and must not be retried as one.
  exit 3
fi

git switch --create "$branch"
