#!/usr/bin/env bash
# Create or update the pull request for the current task branch.
#
# Base and head are fixed here, never passed in. Everything else is an
# ALLOWLIST of option names.
#
# #1041 used a blocklist, rejecting --head, --base, --repo, --body-file and a
# few others. A blocklist admits every option nobody thought of: `gh pr create`
# alone accepts a couple of dozen, and the set grows with the CLI. Naming what
# may be passed means a new option is inert here until someone adds it
# deliberately.
set -euo pipefail

action="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$action" in
  create|update) ;;
  *)
    printf 'Usage: owner-pr.sh create|update [--title T] [--body B] [--label L] [--draft] [--assignee A] [--milestone M]\n' >&2
    exit 2
    ;;
esac

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
  # A rewrite rule can retarget a URL that looked correct a moment ago.
  if git config --get-regexp '^url\..*\.(push)?insteadof$' >/dev/null 2>&1; then
    printf 'Refusing: a git URL rewrite rule is configured and could retarget this push.\n' >&2
    exit 1
  fi
}

operation="pr.create"
[ "$action" = update ] && operation="pr.update"
if ! node "$authority" "$operation" --branch "$branch" >/dev/null; then
  printf 'Refusing: %s is not permitted for %s by the current authority policy.\n' "$operation" "${branch:-DETACHED}" >&2
  exit 1
fi

assert_origin_is_the_expected_repository

# Option names that may be forwarded. Anything else — including any option that
# could redirect the target, read a file, or reach another repository — is
# refused because it is not here.
expect_value=0
for argument in "$@"; do
  if [ "$expect_value" -eq 1 ]; then expect_value=0; continue; fi
  case "$argument" in
    --title|--body|--label|--assignee|--milestone)
      expect_value=1
      ;;
    --draft)
      ;;
    -*)
      printf 'Refusing option that this wrapper does not explicitly permit: %s\n' "$argument" >&2
      exit 2
      ;;
    *)
      printf 'Refusing positional argument: %s\n' "$argument" >&2
      exit 2
      ;;
  esac
done
if [ "$expect_value" -eq 1 ]; then
  printf 'Refusing trailing option with no value.\n' >&2
  exit 2
fi

# --repo is passed explicitly and GH_REPO is cleared. Excluding --repo from the
# caller's arguments was not enough: gh reads GH_REPO from the environment, so
# an inherited value redirected create and edit to another repository while the
# wrapper reported that it had fixed base and head.
unset GH_REPO GH_HOST
if [ "$action" = create ]; then
  gh pr create --repo "$expected_repository" --base main --head "$branch" "$@"
else
  gh pr edit "$branch" --repo "$expected_repository" "$@"
fi
