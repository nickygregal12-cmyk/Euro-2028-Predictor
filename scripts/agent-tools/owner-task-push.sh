#!/usr/bin/env bash
# Push the current task branch, and nothing else.
#
# The safety is that there is nothing to say. It takes no arguments, so force,
# refspec and target selection are not rejected — they are unavailable. The
# refspec is assembled here from the branch the repository is actually on.
#
# Derived from the unmerged #1041, with two changes. Its version ended with a
# branch on FAKE_LOG that existed only so a test could observe it; production
# code does not take instructions from a test-only variable, and the test now
# derives what it needs itself. Its argument handling is also gone, since the
# command accepts none.
set -euo pipefail

if [ "$#" -ne 0 ]; then
  printf 'owner-task-push takes no arguments: force and target selection are unavailable, not refused.\n' >&2
  exit 2
fi

repository_root="$(git rev-parse --show-toplevel)"
if ! node "${repository_root}/scripts/check-pre-live-owner-authority.mjs" branch.push >/dev/null; then
  printf 'Refusing: branch.push is not permitted by the current authority policy.\n' >&2
  exit 1
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
if [ -n "$remote" ] && [ "$remote" != origin ]; then
  printf 'Refusing non-origin upstream for %s.\n' "$branch" >&2
  exit 1
fi

# origin <branch>, not a caller-supplied refspec: this can only ever write the
# branch it is standing on, to its own name.
git push --set-upstream origin "$branch"
