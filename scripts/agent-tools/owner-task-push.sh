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
authority="${repository_root}/scripts/check-pre-live-owner-authority.mjs"

# The one repository this programme may write to, from the tracked identity
# record — not from git configuration or the environment, both of which the
# thing being constrained can set.
expected_repository="$(node "$authority" --repository)"

branch="$(git branch --show-current)"

# Every effective push URL for origin, which is what `git push origin` actually
# writes to. Review found the ref pinned and the repository open: the wrapper
# passed the NAME "origin" and never read remote.origin.pushurl, so one line of
# git config could redirect an authorised push to another host.
assert_origin_is_the_expected_repository() {
  local urls url normalised count=0
  urls="$(git remote get-url --push --all origin 2>/dev/null || true)"
  if [ -z "$urls" ]; then
    printf 'Refusing: origin has no push URL.\n' >&2
    exit 1
  fi
  while IFS= read -r url; do
    [ -n "$url" ] || continue
    count=$((count + 1))
    normalised="${url%.git}"
    normalised="${normalised#git@github.com:}"
    normalised="${normalised#ssh://git@github.com/}"
    normalised="${normalised#https://github.com/}"
    normalised="${normalised#http://github.com/}"
    if [ "$normalised" != "$expected_repository" ]; then
      printf 'Refusing: origin pushes to %s, not the expected repository.\n' "$url" >&2
      exit 1
    fi
  done <<EOF
$urls
EOF
  if [ "$count" -ne 1 ]; then
    printf 'Refusing: origin has %s push URLs; exactly one is expected.\n' "$count" >&2
    exit 1
  fi
  # Rewrite rules need no separate refusal: `git remote get-url --push --all`
  # reports the URL AFTER expanding both `insteadOf` and `pushInsteadOf`, so a
  # rule retargeting github.com at another host shows up in the loop above as
  # that other host. Measured both ways rather than assumed.
  #
  # The blanket refusal that used to live here was removed because it broke the
  # legitimate case while adding nothing: an SSH-to-HTTPS rewrite is how proxied
  # and CI checkouts are normally configured, and refusing it stopped this
  # wrapper from pushing at all in exactly such an environment. A gate that
  # refuses correct work is still a broken gate.
}

if ! node "$authority" branch.push --branch "$branch" >/dev/null; then
  printf 'Refusing: branch.push is not permitted for %s by the current authority policy.\n' "${branch:-DETACHED}" >&2
  exit 1
fi

remote="$(git config --get "branch.${branch}.remote" 2>/dev/null || true)"
if [ -n "$remote" ] && [ "$remote" != origin ]; then
  printf 'Refusing non-origin upstream for %s.\n' "$branch" >&2
  exit 1
fi

assert_origin_is_the_expected_repository

git push --set-upstream origin "$branch"
