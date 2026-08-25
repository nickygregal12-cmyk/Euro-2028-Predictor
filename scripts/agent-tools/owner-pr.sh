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
#
# WHY THIS SPEAKS REST RATHER THAN `gh pr create`. The first live canary run
# failed here, three times, on the same thing:
#
#   HTTP 403: This GraphQL query (RepositoryInfo, sent by gh pr create/view
#   (repo info preamble)) is not enabled for this session
#
# `gh pr create` opens with a GraphQL preamble, so on any host whose egress
# serves a pinned set of GitHub operations it fails before this wrapper's own
# checks mean anything — and it fails identically however correct the request
# is. The REST pull-request endpoints are served, take base and head as fields,
# and need no preamble, so the wrapper asks for exactly the call it wants.
#
# The option list narrowed in the same change. --label, --assignee and
# --milestone were named here and used by nothing; each is a separate REST call
# against a different endpoint, and an allowlist entry kept "in case" is the
# thing an allowlist exists to prevent. They are refused now because they are
# not on the list, which is how anything else gets refused.
set -euo pipefail

action="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$action" in
  create|update) ;;
  *)
    printf 'Usage: owner-pr.sh create [--title T] [--body B] [--draft] | update [--title T] [--body B]\n' >&2
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

operation="pr.create"
[ "$action" = update ] && operation="pr.update"
if ! node "$authority" "$operation" --branch "$branch" >/dev/null; then
  printf 'Refusing: %s is not permitted for %s by the current authority policy.\n' "$operation" "${branch:-DETACHED}" >&2
  exit 3
fi

assert_origin_is_the_expected_repository

# Option names that may be passed. Anything else — including any option that
# could redirect the target, read a file, or reach another repository — is
# refused because it is not here.
title=''
body=''
draft=no
have_title=no
have_body=no
expect=''
for argument in "$@"; do
  if [ -n "$expect" ]; then
    case "$expect" in
      title) title="$argument"; have_title=yes ;;
      body) body="$argument"; have_body=yes ;;
    esac
    expect=''
    continue
  fi
  case "$argument" in
    --title) expect=title ;;
    --body) expect=body ;;
    --draft)
      if [ "$action" != create ]; then
        printf 'Refusing --draft on update: it means nothing there.\n' >&2
        exit 2
      fi
      draft=yes
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
if [ -n "$expect" ]; then
  printf 'Refusing trailing option with no value.\n' >&2
  exit 2
fi

# GH_HOST is cleared for the reason GH_REPO was: gh reads it from the
# environment, and it redirects every request to another API host while the
# wrapper still reports that it fixed the repository. The path below names the
# repository explicitly, so GH_REPO cannot reach it either way.
unset GH_REPO GH_HOST

request=(api --method)
if [ "$action" = create ]; then
  if [ "$have_title" = no ] || [ "$have_body" = no ]; then
    printf 'Refusing: create needs both --title and --body.\n' >&2
    exit 2
  fi
  request+=(POST "repos/${expected_repository}/pulls"
    -f "title=${title}" -f "body=${body}" -f 'base=main' -f "head=${branch}")
  if [ "$draft" = yes ]; then
    request+=(-F 'draft=true')
  fi
  gh "${request[@]}" --jq '.html_url'
  exit 0
fi

if [ "$have_title" = no ] && [ "$have_body" = no ]; then
  printf 'Refusing: update needs --title or --body.\n' >&2
  exit 2
fi

# The number is looked up rather than accepted, so `update` can only ever reach
# the open pull request for the branch this repository is standing on.
owner="${expected_repository%%/*}"
number="$(gh api --method GET "repos/${expected_repository}/pulls" \
  -f "head=${owner}:${branch}" -f 'state=open' --jq '.[0].number' 2>/dev/null || true)"
if [ -z "$number" ] || [ "$number" = null ]; then
  printf 'Refusing: no open pull request for %s.\n' "$branch" >&2
  exit 1
fi
case "$number" in
  ''|*[!0-9]*)
    printf 'Refusing: pull request lookup returned %s, which is not a number.\n' "$number" >&2
    exit 1
    ;;
esac

request+=(PATCH "repos/${expected_repository}/pulls/${number}")
if [ "$have_title" = yes ]; then request+=(-f "title=${title}"); fi
if [ "$have_body" = yes ]; then request+=(-f "body=${body}"); fi
gh "${request[@]}" --jq '.html_url'
