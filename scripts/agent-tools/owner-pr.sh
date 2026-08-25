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
operation="pr.create"
[ "$action" = update ] && operation="pr.update"
if ! node "${repository_root}/scripts/check-pre-live-owner-authority.mjs" "$operation" >/dev/null; then
  printf 'Refusing: %s is not permitted by the current authority policy.\n' "$operation" >&2
  exit 1
fi

branch="$(git branch --show-current)"
case "$branch" in
  ''|main|master)
    printf 'Refusing pull-request operation from protected or detached branch: %s\n' "${branch:-DETACHED}" >&2
    exit 1
    ;;
  */*) ;;
  *)
    printf 'Refusing non-task branch without a namespace: %s\n' "$branch" >&2
    exit 1
    ;;
esac

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

if [ "$action" = create ]; then
  gh pr create --base main --head "$branch" "$@"
else
  gh pr edit "$branch" "$@"
fi
