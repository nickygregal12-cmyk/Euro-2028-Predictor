#!/usr/bin/env bash
set -euo pipefail

action="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$action" in create|update) ;; *)
  printf 'Usage: owner-pr.sh create|update [gh pr title/body/metadata options]\n' >&2
  exit 2
esac

branch="$(git branch --show-current)"
case "$branch" in
  ''|main|master)
    printf 'Refusing PR operation from protected or detached branch: %s\n' "${branch:-DETACHED}" >&2
    exit 1
    ;;
  */*) ;;
  *)
    printf 'Refusing non-task branch without a namespace: %s\n' "$branch" >&2
    exit 1
    ;;
esac

for argument in "$@"; do
  case "$argument" in
    --head|--head=*|-H|-H*|--base|--base=*|-B|-B*|--repo|--repo=*|-R|-R*|--web|--recover|--recover=*|--body-file|--body-file=*|-F|-F*|--template|--template=*)
      printf 'Refusing caller-controlled PR target or recovery option: %s\n' "$argument" >&2
      exit 2
      ;;
  esac
done

if [ "$action" = create ]; then
  gh pr create --base main --head "$branch" "$@"
else
  gh pr edit "$branch" "$@"
fi
if [ -n "${FAKE_LOG:-}" ]; then printf 'CALLS=%s\n' "$FAKE_LOG" >&2; fi
