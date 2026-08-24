# Persistent private cloud Conductor

## Status

Optional **developer infrastructure only**. This is the single private front door for AI-assisted Predictor development from a laptop, phone or tablet. It is not part of the Predictor application, Netlify deployment, Supabase runtime, AI Lab runtime or Production dependency graph.

The finished user experience is deliberately simple:

```text
phone / laptop / tablet
        |
   Tailscale app
        |
 private HTTPS .ts.net URL
        |
 OpenCode Web + HTTP Basic auth
        |
 predictor-conductor (default agent)
        |
        +-- GPT Builder when code must change
        +-- direct Ox critic when an independent challenge helps
        +-- Visual QA after player-facing work when evidence is needed
        +-- Release Verifier for release-critical evidence
        +-- optional official Claude Code review for selected hard cases
        |
 repository tests / GitHub PR / CI remain final authority
```

The user should normally remain in **`predictor-conductor`** and describe one outcome in normal language. `opencode.json` makes it the project default, so a new session does not require selecting Build/Plan/Conductor every time.

## Model and cost policy

| Lane | Provider/model | Default cost intent | Capability |
| --- | --- | --- | --- |
| `predictor-conductor` | OpenAI GPT-5.6 Sol via direct OpenCode OpenAI login | existing ChatGPT allowance | read-only coordinator |
| `predictor-builder` | OpenAI GPT-5.6 Sol via direct OpenCode OpenAI login | existing ChatGPT allowance | sole write-capable worker |
| `predictor-critic` | Ox Alpha via OpenRouter | external free/low-cost lane; re-check pricing | independent read-only critic |
| `predictor-visual-qa` | OpenAI GPT-5.6 Sol | existing ChatGPT allowance | read-only browser/journey evidence |
| `predictor-release-verifier` | OpenAI GPT-5.6 Sol | existing ChatGPT allowance | read-only deterministic release evidence |
| Claude review bridge | official Claude Code client | existing Claude subscription/allowance only | optional different-model read-only specialist |

Do **not** route GPT through OpenRouter by default. Authenticate OpenCode directly to OpenAI with the ChatGPT account so ordinary Conductor/Builder/verification work uses the existing subscription allowance. If that allowance is exhausted, stop or wait for reset rather than silently switching to paid API usage.

Ox Alpha remains behind a separately scoped `OPENROUTER_API_KEY`. Pricing/availability is external and can change.

Claude is optional. The repository-supported path uses the **official Claude Code client** and refuses the tracked review bridge when `ANTHROPIC_API_KEY` is set. This prevents a subscription review from silently becoming API billing. Do not route Claude Pro/Max credentials through OpenCode or a third-party provider.

## Security boundary

```text
Tailscale member device
        |
 encrypted private tailnet
        |
 Tailscale Serve HTTPS
        |
 127.0.0.1:4096
        |
 OpenCode Web
```

OpenCode binds **only to `127.0.0.1:4096`**. Never expose port 4096 publicly and never use Tailscale Funnel for this workspace.

Access has two independent layers:

1. membership in the private Tailscale tailnet;
2. OpenCode HTTP Basic authentication using username `predictor` and the generated `OPENCODE_SERVER_PASSWORD`.

No external model may receive `.env` contents, credentials, exported player data or Production secrets merely because it can read repository code.

## Host requirement

Ubuntu **24.04 LTS (noble)** is the supported persistent host. Remote model inference does not need a large VM, but local Node, Graphify, builds and browsers do.

A 2 GiB host is sufficient for basic orchestration/authentication. For regular Playwright, builds and multi-agent verification, use approximately **4 vCPU / 8 GiB RAM**. The doctor reports smaller hosts as usable for orchestration but not ideal for heavy browser/build work.

## Initial install

Create/use a normal non-root account, clone the repository, then run:

```bash
git clone https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git
cd Euro-2028-Predictor
bash scripts/agent-tools/cloud-conductor-install.sh
```

The installer:

- verifies Ubuntu 24.04;
- supports x86-64 and ARM64;
- checksum-verifies the exact repository Node version;
- installs Tailscale from its signed Ubuntu repository;
- runs the pinned developer bootstrap;
- asks for the scoped OpenRouter key used by Ox;
- generates a separate OpenCode web password;
- creates an always-on user `systemd` service;
- binds OpenCode to localhost only;
- makes no model request during installation.

The environment file is:

```text
~/.config/predictor-cloud/opencode.env
```

It must remain mode `0600` and must never be committed or pasted into chat.

## Authenticate OpenAI / ChatGPT

From OpenCode, connect **OpenAI** and choose the ChatGPT subscription login. On a remote server, if the OAuth browser redirects to a localhost port on the laptop, tunnel that port over SSH for the duration of login.

The tracked GPT agents use provider `openai`, not paid OpenRouter GPT.

Verify from the server:

```bash
opencode auth list
opencode models openai
```

Use a sensible reasoning level for routine work rather than maximum effort for every prompt.

## Ox Alpha

The installer stores the scoped OpenRouter key for the service. The Conductor does **not** depend on OpenCode child-session result handoff for Ox because that path can complete while returning empty text to the parent.

Instead the tracked bridge invokes the read-only primary critic directly:

```bash
bash scripts/agent-tools/ox-review.sh \
  "Review this diff for correctness and missing edge states."
```

The user normally does not run this manually. `predictor-conductor` calls it when an independent review is justified.

A live transport smoke is available through the doctor:

```bash
bash scripts/agent-tools/cloud-conductor-doctor.sh --live
```

`--live` makes one tiny Ox request. The default doctor makes **no model request**.

## Optional Claude subscription lane

Install the centrally supported official Claude Code version with:

```bash
bash scripts/agent-tools/cloud-conductor-claude-install.sh
```

Then authenticate:

```bash
claude auth login
claude auth status --text
```

Use the Claude subscription account. Do **not** use Console/API billing for this lane, and keep this empty:

```bash
printenv ANTHROPIC_API_KEY
```

The tracked read-only bridge is:

```bash
bash scripts/agent-tools/claude-review.sh \
  "Independently challenge the architecture of this proposed change."
```

It runs the official client in **plan mode**, so it can inspect and reason but cannot edit source. It refuses to run when `ANTHROPIC_API_KEY` is present. The Conductor should call Claude selectively, not on every task.

## Join Tailscale and publish privately

On the server:

```bash
sudo tailscale up
sudo tailscale serve --bg 4096
sudo tailscale serve status
```

Approve the server in the same Tailscale account used by the phone/laptop. Do not use `tailscale funnel`.

Retrieve the OpenCode password once and save it in a password manager:

```bash
grep '^OPENCODE_SERVER_PASSWORD=' \
  ~/.config/predictor-cloud/opencode.env | cut -d= -f2-
```

Username:

```text
predictor
```

## GitHub access

For Builder branch/PR workflows:

```bash
gh auth login
gh auth setup-git
gh auth status
```

Use the browser/device flow. The tracked Builder still keeps `git push` and `gh pr create` as approval boundaries unless the operator explicitly grants them.

## Verify the finished workspace

Run the local-only doctor first:

```bash
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

Healthy state includes:

- exact Node and OpenCode versions;
- `predictor-conductor` as the default web agent;
- all tracked agents visible;
- direct OpenAI/ChatGPT auth;
- scoped Ox credential without exposing its value;
- optional Claude installation/auth state;
- mode-0600 cloud environment file;
- localhost HTTP Basic auth;
- active `systemd` service;
- Tailscale membership and private Serve route;
- optional GitHub CLI auth;
- a host-capacity warning if the machine is too small for comfortable browser/build verification.

Then prove the Ox bridge once:

```bash
bash scripts/agent-tools/cloud-conductor-doctor.sh --live
```

The target is **0 missing**. Optional warnings are acceptable when they describe deliberately unused capabilities such as Claude or GitHub writes.

## Normal use from a laptop

1. Connect the Tailscale desktop app.
2. Open the private `https://<host>.<tailnet>.ts.net` URL.
3. Sign in with username `predictor` and the saved web password.
4. Open `/home/predictor/Euro-2028-Predictor` if the project list is shown.
5. Start/resume a session. `predictor-conductor` is the default agent.
6. Describe the outcome in normal language.

Bookmark the `.ts.net` page. Sessions and the repository live on the server, so switching laptop or browser does not require cloning the project again.

## Normal use from iPhone/iPad

1. Install Tailscale and sign into the same tailnet.
2. Switch Tailscale on.
3. Open the same private `.ts.net` URL in Safari.
4. Sign in with the same OpenCode credentials.
5. Open the Predictor project/session and use the Conductor exactly as on the laptop.

For a one-tap launcher, in Safari choose **Share → Add to Home Screen** after opening the private OpenCode page. This creates a home-screen shortcut; it does not make the site public and Tailscale still has to be connected.

Do not save API keys in mobile notes or prompts. The only credential normally entered in the browser is the OpenCode Basic-auth password from the password manager.

## How the Conductor should route work

```text
simple/proven question
    -> Conductor only

normal implementation
    -> Builder
    -> focused tests
    -> Ox review when missed-defect cost justifies it

player-facing UI change
    -> Builder
    -> Visual QA when responsive/interaction/accessibility evidence matters
    -> Ox review when useful

security / database / architecture uncertainty
    -> Ox preflight
    -> Builder
    -> fresh Ox diff review
    -> deterministic repository gates

selected hard case needing different model perspective
    -> optional Claude read-only review
    -> reconcile against source/tests

release-critical change
    -> Builder
    -> Visual QA where applicable
    -> Release Verifier
    -> CI / repository authority final
```

Do not call GPT + Ox + Claude on every prompt. Diversity is useful only when it changes confidence enough to justify the extra allowance/context.

## First safe end-to-end prompt

Use this once after setup:

> Perform a read-only health check of this Predictor development workspace. Read AGENTS.md and NOW.md first and follow the repository's deterministic routing/context rules. Confirm current main and relevant open PR state, verify the expected developer tooling, and run one bounded independent Ox check through the tracked direct review bridge. Do not edit files, create branches, commit, push, create a PR or mutate any hosted environment. Report which agent/model performed each part and any setup issue found.

Then verify:

```bash
git status
```

The working tree should remain clean.

## Updating the server checkout

Before starting new work after repository changes:

```bash
cd ~/Euro-2028-Predictor
git switch main
git pull --ff-only
systemctl --user restart predictor-conductor.service
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

If `config/agent-tools.json`, the cloud installer, Node version or bootstrap changed, rerun:

```bash
bash scripts/agent-tools/cloud-conductor-install.sh
```

The installer reuses the existing protected OpenRouter/web credentials rather than requiring them to be pasted again.

## Browser tooling

After resizing to a comfortable browser/build host if necessary:

```bash
npm run test:e2e:install
```

The Visual QA lane uses repository Playwright/browser evidence; it does not make screenshots a substitute for working interaction or authoritative state.

## Recovery

```bash
systemctl --user status predictor-conductor.service --no-pager
journalctl --user -u predictor-conductor.service -n 100 --no-pager
systemctl --user restart predictor-conductor.service
tailscale status
sudo tailscale serve status
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

After a server reboot, the user service is expected to return because linger is enabled, and Tailscale/Serve should persist. Verify with the doctor before assuming remote access is healthy.

## Cost and safety guardrails

- Direct ChatGPT/OpenAI subscription is the ordinary GPT lane.
- Ox is the independent OpenRouter lane; re-check external pricing before assuming it remains free.
- Claude is optional, official-client and subscription-only by policy.
- No automatic paid model/API fallback.
- No Tailscale Funnel and no public OpenCode port.
- One write-capable Builder at a time.
- Visual QA and Release Verifier are read-only.
- Model consensus never becomes repository/product/hosted authority.
- Production, Supabase Production, Netlify Production, paid provider state and real player data remain behind their existing explicit authority boundaries.
