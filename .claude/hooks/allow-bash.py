#!/usr/bin/env python3
"""PreToolUse hook: enforce a per-agent Bash allowlist. Default deny.

Ported from the `permission.bash` blocks in .opencode/agents/*.md. Claude Code
subagent frontmatter has no `permissions` field and settings.json permissions
are project-wide, so a per-agent allowlist has nowhere else to live.

Usage, from an agent's `hooks:` frontmatter:

    command: python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/allow-bash.py <agent-name>

Patterns live in agent-bash-allow.json beside this file.

Semantics, mirroring OpenCode:

  * Default is deny. A command runs only if every one of its segments matches
    an `allow` pattern. An unlisted command is refused outright for a
    write-capable role and referred to the operator for a read-only one; see
    `unmatched()` and the `$unmatched` register for why the split is by
    capability rather than global.
  * `never` is applied after `allow` and wins, reproducing OpenCode's
    last-match-wins ordering. The builder needs `git switch <existing>` and
    `git branch --list` while being refused branch *creation*; that is not
    expressible as a pure prefix allowlist.

Two deliberate hardenings beyond OpenCode, because a prefix glob like
`git log*` would otherwise match `git log > /tmp/x` and `git log; rm -rf .`:

  * Command substitution ($(...), backticks, <(...)) is refused outright --
    it hides an arbitrary command inside an allowed one.
  * Redirection to a file is refused. 2>&1, >&2 and >/dev/null still pass.

Contract: read PreToolUse JSON on stdin, emit a deny decision on stdout,
exit 0. Silence (exit 0, no output) leaves the call to normal permissions.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "agent-bash-allow.json")

# Segment separators. Deliberately excludes bare & -- splitting on it would
# tear `2>&1` in half and strand `1` as an unmatchable segment. Backgrounding
# is handled separately below.
SPLIT = re.compile(r"\s*(?:&&|\|\||;|\||\n)\s*")

# Backgrounding, which would detach a command from this gate. Excludes & that
# belongs to a redirection (2>&1, >&2, &>file).
BACKGROUND = re.compile(r"(?<![>&])&(?![&>])")

# Command substitution in any form -- an allowed wrapper around anything.
SUBSTITUTION = re.compile(r"\$\(|`|<\(|>\(")

# Parameter expansion, which is NOT command substitution, and the distinction is
# the whole of the defect this closes.
#
# Everything above and below matches RAW TEXT. Bash expands `${VAR}` AFTER this
# gate has judged that text, so an expansion contributing nothing at all still
# rewrites the command that finally runs. That splits any literal rule in half:
#
#     git switch ${EMPTY}-c gate-bypass
#         -- the argument starts with `$`, so it matches the broad
#            `git switch [^-]*` allow and never reaches `git switch -*`.
#            Bash then runs `git switch -c gate-bypass`, creating a branch the
#            profile explicitly refuses.
#
#     git fetch --upload${EMPTY}-pack='sh -c "..."' origin
#         -- GIT_REMOTE_EXEC below looks for the literal `--upload-pack`.
#            Bash then runs it, and that is arbitrary command execution for the
#            write-capable builder role.
#
# The same trick generalises to every raw-text rule on this path:
# GIT_PRE_SUBCOMMAND_FLAG, TRAVERSAL, $neverPathPattern and the whole `never`
# list are each defeated by an empty expansion placed inside the literal.
#
# So any `$` is refused outright. That is broader than the two demonstrated
# payloads on purpose: this matcher does not parse shell quoting, so it cannot
# tell an expansion that will fire from one that will not, and a rule that has
# to guess is the rule that gets bypassed next. It costs nothing measurable --
# NO allow or never pattern in agent-bash-allow.json contains a `$`, checked
# mechanically by `agentBashAllowlistParity`, so nothing legitimate is expressed
# with one. A command that genuinely needs an expansion belongs in a wrapper
# under scripts/agent-tools/ where its arguments are the wrapper's business.
#
# Found by an independent Codex review, 27 Aug 2026, and reproduced against this
# file before the fix: both payloads above returned ALLOW.
EXPANSION = re.compile(r"\$")

# Redirection is handled as an allowlist too: strip the forms that cannot write
# a file, then refuse any < or > still standing. An earlier version pattern-
# matched the dangerous forms instead and missed `1>file`, `3>file`, `>&file`
# and `<<<` (external review, 27 Aug 2026).
SAFE_REDIRECT = re.compile(
    r"[0-9]?>>?&[0-9]"                                  # 2>&1, 1>&2
    r"|&>>?\s*/dev/(?:null|stdout|stderr)\b"            # &>/dev/null
    r"|[0-9]?>>?\s*/dev/(?:null|stdout|stderr)\b"       # >/dev/null, 2>/dev/null
)
ANY_REDIRECT = re.compile(r"[<>]")

# Control characters. A bare \r reads as a line break to a human but is an
# ordinary word character to bash, so it can hide a second command in plain
# sight. \n is a segment separator and is handled by SPLIT.
CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")

# Parent-directory traversal, which walks straight out of an allowlisted
# directory: `bash scripts/agent-tools/../../../../../bin/sh -c ...` matched
# `bash scripts/agent-tools/*` and executed /bin/sh.
TRAVERSAL = re.compile(r"(?:^|[\s/='\"])\.\.(?:/|\s|$)")

# git's first argument being a flag means it is configuring git itself rather
# than running an allowlisted subcommand: `git -c alias.x='!sh' x`, `git -C
# /elsewhere`, `git --git-dir=`, `git --exec-path=`. No allowlisted form starts
# this way, so the whole shape is refused.
GIT_PRE_SUBCOMMAND_FLAG = re.compile(r"^git\s+-")

# git options that hand a command line to git to execute. `git fetch` is
# allowlisted for every role that has git at all, and these turn it into
# arbitrary execution.
GIT_REMOTE_EXEC = re.compile(
    r"--(?:upload-pack|receive-pack|exec-path|exec)\b|\bext::"
)


def glob_to_regex(pattern):
    """OpenCode-style glob -> anchored regex.

    * matches any run of characters, [..] passes through as a character class,
    everything else is literal.
    """
    out = []
    i = 0
    while i < len(pattern):
        char = pattern[i]
        if char == "*":
            out.append(".*")
        elif char == "[":
            close = pattern.find("]", i + 1)
            if close == -1:
                out.append(re.escape(char))
            else:
                out.append(pattern[i:close + 1])
                i = close
        else:
            out.append(re.escape(char))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def unmatched(reason, agent, rules):
    """An unlisted command. Deny for write-capable roles, ask for read-only.

    OpenCode ends each bash block with `"*": ask`, so an unlisted command
    prompts the operator. Reproducing that for every role would be wrong here:
    an autonomous or headless agent has nobody to prompt, so "ask" degrades to
    an unattended refusal at best and a rubber stamp at worst.

    The split is by capability, which is the property that actually matters. A
    role that cannot mutate anything can safely prompt -- worst case an
    operator approves a read the allowlist had not anticipated, such as
    `git stash list`. A role that can mutate does not get that latitude.
    """
    read_only = set(rules.get("$unmatched", {}).get("ask", []))
    if agent in read_only:
        json.dump({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": (
                    f"{reason}. {agent} is read-only, so this is referred to you "
                    f"rather than refused outright. Approve only if the command "
                    f"cannot mutate anything."
                ),
            }
        }, sys.stdout)
        sys.exit(0)
    deny(reason, agent)


def deny(reason, agent):
    json.dump({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"Blocked for {agent}: {reason}. This agent's Bash allowlist is "
                f".claude/hooks/agent-bash-allow.json, ported from its OpenCode "
                f"permission block. Do not work around the refusal -- report "
                f"what you could not verify, or hand the step to the agent that "
                f"owns it."
            ),
        }
    }, sys.stdout)
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        sys.exit(0)  # No agent named; not ours to adjudicate.
    agent = sys.argv[1]

    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)  # Malformed input is not ours to adjudicate.

    if payload.get("tool_name") != "Bash":
        sys.exit(0)

    command = payload.get("tool_input", {}).get("command", "").strip()
    if not command:
        sys.exit(0)

    try:
        with open(CONFIG, encoding="utf-8") as handle:
            rules = json.load(handle)
    except (OSError, json.JSONDecodeError):
        deny("the allowlist file is missing or unreadable, so nothing can be "
             "proven safe", agent)

    profile = rules.get(agent)
    if not isinstance(profile, dict):
        deny(f"no allowlist profile is defined for {agent}", agent)

    allow = [glob_to_regex(p) for p in profile.get("allow", [])]
    # The role's own denials, plus a floor that applies to every role. The floor
    # exists so a read-only role's empty `never` list cannot let a mutation fall
    # through to the ASK path in unmatched().
    never = [glob_to_regex(p) for p in profile.get("never", [])] + [
        glob_to_regex(p)
        for p in rules.get("$neverForAnyAgent", {}).get("never", [])
    ]
    filters = [glob_to_regex(p)
               for p in rules.get("$filters", {}).get("allow", [])]

    if SUBSTITUTION.search(command):
        deny("command substitution can hide an arbitrary command inside an "
             "allowed one", agent)

    # After SUBSTITUTION, so `$(...)` keeps the more specific message it earns.
    if EXPANSION.search(command):
        deny("shell expansion rewrites the command after this gate has judged "
             "it, so no literal rule below can be trusted; put a command that "
             "needs one behind a wrapper in scripts/agent-tools/", agent)

    if BACKGROUND.search(command):
        deny("backgrounding detaches the command from this gate", agent)

    if CONTROL.search(command):
        deny("control characters can hide a second command from a reader", agent)

    # Collapse whitespace runs before matching. `git switch  -c x` (two spaces)
    # otherwise slips past the `git switch -*` refusal, which assumes one
    # (external review, 27 Aug 2026).
    segments = [
        re.sub(r"\s+", " ", s.strip()) for s in SPLIT.split(command) if s.strip()
    ]

    try:
        secret_path = re.compile(rules["$neverPathPattern"]["pattern"])
    except (KeyError, TypeError, re.error):
        deny("the secret-path rule is missing or invalid, so nothing can be "
             "proven safe", agent)

    for index, segment in enumerate(segments):
        if secret_path.search(segment):
            deny(f"{segment!r} names a secret-bearing path", agent)
        if ANY_REDIRECT.search(SAFE_REDIRECT.sub("", segment)):
            deny(f"redirection or here-document in {segment!r}", agent)

        if TRAVERSAL.search(segment):
            deny(f"parent-directory traversal in {segment!r} walks out of the "
                 f"allowlisted path", agent)

        if GIT_PRE_SUBCOMMAND_FLAG.search(segment):
            deny(f"{segment!r} configures git itself before naming a "
                 f"subcommand, which can run an arbitrary command", agent)

        if GIT_REMOTE_EXEC.search(segment):
            deny(f"{segment!r} hands a command line to git to execute", agent)

        # Deny wins over allow, mirroring OpenCode's last-match-wins ordering.
        for pattern in never:
            if pattern.match(segment):
                deny(f"{segment!r} is explicitly refused for this role; route "
                     f"it through the enforcing wrapper in scripts/agent-tools/",
                     agent)

        if any(pattern.match(segment) for pattern in allow):
            continue

        # A read-only filter is fine downstream of an allowed command, but
        # never as the command that starts the chain.
        if index > 0 and any(pattern.match(segment) for pattern in filters):
            continue

        unmatched(f"{segment!r} is not on this agent's allowlist", agent, rules)

    sys.exit(0)


if __name__ == "__main__":
    main()
