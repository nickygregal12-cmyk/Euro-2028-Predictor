#!/usr/bin/env bash
# Commit to the current task branch, and nowhere else.
#
# Review found `commit.create` granted with a prose constraint that nothing
# checked, and no enforcing edge at all — push and pull request had wrappers,
# commit did not. An operation whose only constraint is a sentence in a config
# file is the thing this stage exists to replace.
#
# Message options only. Nothing here can select a target, amend, or reach a
# path outside the working tree.
set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
authority="${repository_root}/scripts/check-pre-live-owner-authority.mjs"
branch="$(git branch --show-current)"

if ! node "$authority" commit.create --branch "$branch" >/dev/null; then
  printf 'Refusing: commit.create is not permitted for %s by the current authority policy.\n' "${branch:-DETACHED}" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  printf 'Usage: owner-commit.sh --message MSG [--message MSG ...]\n' >&2
  exit 2
fi

# An allowlist, for the same reason the pull-request wrapper uses one: --amend,
# --author, --date and -C all rewrite what the record says happened.
expect_value=0
for argument in "$@"; do
  if [ "$expect_value" -eq 1 ]; then expect_value=0; continue; fi
  case "$argument" in
    --message|-m) expect_value=1 ;;
    *)
      printf 'Refusing option that this wrapper does not explicitly permit: %s\n' "$argument" >&2
      exit 2
      ;;
  esac
done
if [ "$expect_value" -eq 1 ]; then
  printf 'Refusing trailing option with no value.\n' >&2
  exit 2
fi

git commit "$@"
