#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 0 ]; then
  printf 'owner-task-push accepts no arguments; force and target selection are intentionally unavailable.\n' >&2
  exit 2
fi

branch="$(git branch --show-current)"
case "$branch" in
  ''|main|master)
    printf 'Refusing to push protected or detached branch: %s\n' "${branch:-DETACHED}" >&2
    exit 1
    ;;
  */*) ;;
  *)
    printf 'Refusing non-task branch without a namespace: %s\n' "$branch" >&2
    exit 1
    ;;
esac

remote="$(git config --get "branch.${branch}.remote" 2>/dev/null || true)"
merge="$(git config --get "branch.${branch}.merge" 2>/dev/null || true)"
if [ -n "$remote" ] && { [ "$remote" != origin ] || [ "$merge" != "refs/heads/${branch}" ]; }; then
  printf 'Refusing mismatched upstream for %s. Expected origin/%s.\n' "$branch" "$branch" >&2
  exit 1
fi

git push --set-upstream origin "$branch"
if [ -n "${FAKE_LOG:-}" ]; then printf 'CALLS=%s\n' "$FAKE_LOG" >&2; fi
