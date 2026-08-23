# Persistent private cloud Conductor

## Status

Optional **developer infrastructure only**. The goal is one private web front door for Predictor development without paying for a permanently large VM or routing every model through paid APIs.

The cost-first order is:

1. **£0 host:** Oracle Cloud Always Free Ampere A1 when capacity is available;
2. **effectively £0 host:** an existing spare computer kept on at home, reached through Tailscale;
3. **£0 on-demand:** the personal GitHub Codespaces monthly allowance when an always-on box is unnecessary;
4. **paid fallback only:** a small ordinary Ubuntu VM if the free choices prove unreliable.

Nothing here is part of the Predictor application, Netlify deployment, Supabase runtime, AI Lab runtime or production dependency graph.

## Cost policy

The tracked model team is deliberately subscription/free-first:

| Agent | Default provider/model | Incremental cost intent | Role |
| --- | --- | --- | --- |
| `predictor-conductor` | OpenAI GPT-5.6 Sol via direct OpenCode OpenAI login | use existing ChatGPT allowance first | read-only coordinator |
| `predictor-builder` | OpenAI GPT-5.6 Sol via direct OpenCode OpenAI login | use existing ChatGPT allowance first | sole write-capable worker |
| `predictor-critic` | Ox Alpha via OpenRouter | currently free | independent read-only critic |

Do **not** route GPT through OpenRouter by default. OpenCode supports signing into OpenAI with a ChatGPT account; use that path so ordinary Conductor/Builder work uses the user's existing ChatGPT plan allowance. If that allowance is exhausted, stop rather than silently switching to paid API usage.

Ox Alpha remains behind a separately scoped `OPENROUTER_API_KEY`; the model is currently free, but availability/pricing is external and may change.

Claude is optional rather than a mandatory per-task charge. If the operator already has Claude Pro/Max, use the **official Claude Code client** for selected escalations/reviews. Do not reuse Claude subscription credentials through OpenCode or third-party plugins. Anthropic's supported subscription path is Claude Code itself. If no Claude subscription exists, leave that lane disabled rather than creating API spend.

## Free host choice A — Oracle Cloud Always Free

Oracle currently offers Always Free Ampere A1 compute equivalent to **2 OCPUs and 12 GB RAM** plus Always Free block storage in the account's home region. That is enough to trial the Conductor because model inference is remote; the host mainly runs Git, Node/TypeScript, OpenCode and repository tools.

Important limitations:

- the free A1 shape is ARM64;
- capacity can be unavailable in a region;
- the repository installer supports both x86-64 and ARM64 Node binaries;
- very heavy Playwright/build workloads will be slower than a paid 8/16 GB development VM.

Use Ubuntu 24.04 LTS and allocate the free A1 allowance to one VM where possible.

## Free host choice B — spare home computer

If an old desktop, mini PC or laptop is available, this is the most dependable £0-hosting option. Install Ubuntu 24.04 LTS, keep it plugged in, disable sleep while serving the workspace, and use the same installer below.

Tailscale means no router port-forwarding is required. From the user's perspective it behaves like a private cloud box even though the hardware is at home.

Electricity is the only incremental infrastructure cost.

## Free host choice C — Codespaces on demand

Personal GitHub accounts include a monthly Codespaces quota. Use this when persistent 24/7 availability is not necessary. Codespaces automatically stops when idle, so it is not the always-on architecture, but it is a good zero-cost fallback and the repository already bootstraps OpenCode there.

Do not keep Codespaces running simply to imitate an always-on server; that wastes the included core-hours.

## Paid fallback

If Oracle capacity is unavailable and there is no spare machine, use the smallest Ubuntu VM that comfortably runs the current workload, then resize only if tests/builds prove it necessary. Do not start with a 16 GB server merely because one was used as an earlier reference design.

The remote models do not become smarter when the VM is larger. More CPU/RAM only speeds local repository operations.

## Security shape

```text
phone / tablet / laptop
        |
   Tailscale app
        |
 encrypted private tailnet
        |
  Tailscale Serve HTTPS
        |
  127.0.0.1:4096
        |
 OpenCode Web + HTTP Basic auth
        |
 Predictor repository
```

OpenCode binds **only to `127.0.0.1:4096`**. Never expose 4096 publicly and never use Tailscale Funnel for this workspace.

Tailscale Personal is sufficient for an individual non-commercial workspace and is currently free. There are two access layers:

1. membership in the private Tailscale tailnet;
2. OpenCode `OPENCODE_SERVER_PASSWORD` HTTP Basic authentication.

## 1. Prepare an Ubuntu 24.04 host

Create the Oracle A1 VM, prepare the spare computer, or provision the paid fallback. Create a non-root development user:

```bash
adduser predictor
usermod -aG sudo predictor
su - predictor
sudo -v
```

The OpenCode service runs as this account, never root.

## 2. Clone and install

```bash
git clone https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git
cd Euro-2028-Predictor
bash scripts/agent-tools/cloud-conductor-install.sh
```

The installer:

- verifies Ubuntu 24.04;
- handles x86-64 or ARM64;
- installs/checksum-verifies the exact repository Node version;
- installs Tailscale from its signed Ubuntu repository;
- runs the repository-pinned developer bootstrap;
- asks for the OpenRouter key used by free Ox Alpha;
- generates a separate OpenCode web password;
- installs an always-on user `systemd` service;
- binds OpenCode to localhost only.

It makes no model request during installation.

## 3. Authenticate the free/subscription model paths

### Ox Alpha

Create a separately scoped OpenRouter key for the workspace and provide it to the installer. Do not put money on the key merely because it exists; Ox Alpha is the intended OpenRouter model for the default critic lane.

### ChatGPT / OpenAI

From the OpenCode UI/TUI, connect **OpenAI** and choose the ChatGPT Plus/Pro authentication option. Complete the browser login with the same ChatGPT account you already use.

This is intentionally separate from `OPENROUTER_API_KEY`. The tracked GPT agents use provider `openai`, not `openrouter/openai`.

If the ChatGPT/Codex allowance is exhausted, wait for reset or explicitly decide whether extra credits are worthwhile. Never make API spending an automatic fallback.

### Claude — optional escalation

If you already pay for Claude Pro/Max, install/authenticate the official Claude Code client on the same host and use the Claude account subscription route. Keep Anthropic API keys unset if the goal is to stay within the subscription rather than pay API rates.

Claude is not required for every task. A good cost policy is:

- GPT subscription: ordinary coordination/build work;
- Ox Alpha free: independent challenge/review;
- Claude Code subscription: use only on tasks where a genuinely different implementation/review pass is valuable.

If you do not have a Claude subscription, skip Claude initially.

## 4. Join Tailscale

```bash
sudo tailscale up
```

Approve the host in the same Tailscale tailnet used on your phone/tablet/computer, then privately publish OpenCode:

```bash
sudo tailscale serve --bg 4096
sudo tailscale serve status
```

Do not use `tailscale funnel`.

## 5. Save the web password

```bash
grep '^OPENCODE_SERVER_PASSWORD=' ~/.config/predictor-cloud/opencode.env | cut -d= -f2-
```

Username:

```text
predictor
```

Save the password in a password manager.

## 6. Optional GitHub write access

```bash
gh auth login
```

Use the browser/device flow. `git push` and `gh pr create` remain explicit approval boundaries in the tracked Builder configuration.

## 7. Verify

```bash
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

Healthy state includes the exact Node version, OpenCode, tracked agents, OpenRouter key, localhost-only service, Tailscale/Serve and optional GitHub CLI auth.

## Normal use

Open the private `https://...ts.net` URL from any Tailscale-connected device and select `predictor-conductor`.

A normal task should look like one user prompt. The Conductor decides whether an independent Ox pass adds value. It should not create a committee for trivial changes and should not spend money to manufacture model diversity.

```text
one user prompt
    |
GPT Conductor (existing ChatGPT allowance)
    |
    +-- trivial/proven -> handle directly
    |
    +-- implementation -> GPT Builder -> optional free Ox diff review
    |
    +-- high-risk/ambiguous -> free Ox preflight -> GPT Builder -> fresh Ox review
    |
    +-- selected hard case -> optional official Claude Code subscription pass
    |
reconcile against source/tests
    |
branch / PR / CI
```

## Updating

```bash
git switch main
git pull --ff-only
bash scripts/agent-tools/cloud-conductor-install.sh
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

## Recovery

```bash
systemctl --user status predictor-conductor.service
journalctl --user -u predictor-conductor.service -n 100 --no-pager
systemctl --user restart predictor-conductor.service
tailscale status
sudo tailscale serve status
```

## Cost guardrails

- Prefer free host before paid VM.
- Do not expose a public web service just to avoid Tailscale; Tailscale Personal is free for this personal use case.
- Keep Ox on its free model unless pricing changes.
- Use the direct ChatGPT login rather than OpenRouter GPT billing.
- Never configure automatic paid fallback when subscription allowance is exhausted.
- Claude is an optional official-client escalation, not a mandatory API bill.
- Re-evaluate model/provider pricing before increasing any API budget.

## What this does not do

- It does not make model consensus repository authority.
- It does not expose OpenCode publicly.
- It does not grant Supabase/Netlify/Production access.
- It does not let multiple write agents race on one checkout.
- It does not make every task a multi-model debate.
- It does not require a paid server or paid model API to get started.
