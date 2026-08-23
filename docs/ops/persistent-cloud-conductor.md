# Persistent private cloud Conductor

## Status

Optional **developer infrastructure only**. This is the recommended single-front-door cloud workspace for the Predictor: one private Linux VM runs the repository and OpenCode web continuously; Tailscale makes the web UI reachable only from the operator's private tailnet; project-defined OpenCode agents coordinate GPT, Claude and Ox Alpha behind one conversation.

It is not part of the Predictor application, Netlify deployment, Supabase runtime, AI Lab runtime or production dependency graph.

## Recommended host

Use a normal x86-64 Ubuntu 24.04 LTS VM. The current reference size is:

- Hetzner Cloud, Germany (Nuremberg/NBG1 is suitable);
- CX43: 8 shared vCPU, 16 GB RAM, 160 GB NVMe;
- primary IPv4 enabled for straightforward initial administration;
- Ubuntu 24.04 LTS;
- backups optional but recommended once the workspace contains valuable unpushed work.

The server is intentionally ordinary. Nothing in the repository depends on Hetzner: the same installer can run on another Ubuntu 24.04 x86-64/arm64 VM if hosting needs change.

A smaller CX33 (4 vCPU/8 GB) can run the stack, but 16 GB gives materially better headroom for TypeScript builds, Playwright, Graphify and a coding agent at the same time. A larger server does not make the remote models smarter; it only improves local repository/tool/test performance.

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

OpenCode binds **only to `127.0.0.1:4096`**. Do not open port 4096 in a provider firewall and do not use Tailscale Funnel. `tailscale serve` is the private tailnet path.

There are two access layers:

1. device/user membership in the Tailscale tailnet;
2. OpenCode's `OPENCODE_SERVER_PASSWORD` HTTP Basic authentication.

The OpenRouter credential lives in `~/.config/predictor-cloud/opencode.env`, mode `0600`, on the VM. It never belongs in Git.

## Model team

The tracked project agents are deliberately small:

| Agent | Model | Access | Role |
| --- | --- | --- | --- |
| `predictor-conductor` | OpenAI GPT-5.6 Sol via OpenRouter | read/orchestrate | single user-facing coordinator; chooses which passes are justified |
| `predictor-builder` | Anthropic Claude Sonnet 5 via OpenRouter | write/test | sole implementation worker |
| `predictor-critic` | Ox Alpha via OpenRouter | read-only | independent adversarial preflight/diff review |

The Conductor does **not** automatically call every model. Routine work should remain cheap and fast. Non-trivial implementation normally becomes Conductor → Builder → Critic → reconciliation. High-risk or ambiguous work may add a Critic preflight before the Builder.

Repository `AGENTS.md`, `NOW.md`, task routing, canonical authorities and executable tests remain above every model.

## OpenRouter key for this server

Prefer a **separate API key** named for this workspace instead of reusing the Codespaces key. A separate key makes revocation and spend attribution simple.

Recommended starting controls:

- key name: `predictor-cloud-conductor`;
- set a modest credit/spend limit while proving the workflow;
- keep OpenRouter Auto Top-Up disabled if you want prepaid credits to be a hard ceiling;
- increase the limit only after observing real task cost.

Ox Alpha is currently free, but GPT/Claude calls are paid. Model pricing and availability are external and may change.

## 1. Create the VM

In the hosting control panel:

1. Create a project such as `Predictor Dev`.
2. Create an Ubuntu 24.04 LTS server in Germany.
3. Choose CX43 (or the equivalent 8 vCPU / 16 GB class on another provider).
4. Add your SSH public key if available. Prefer SSH keys over password-only administration.
5. Keep the application port `4096` closed publicly. The VM only needs outbound internet plus an administration path for initial setup.

If using a provider firewall, allow SSH only as needed for administration. After Tailscale is working, Tailscale SSH or ordinary SSH over the tailnet can become the normal management path.

## 2. Create the non-root development user

Log into the new server once as its initial administrator/root user, then:

```bash
adduser predictor
usermod -aG sudo predictor
```

If the root account already has the SSH key you want to use, copy it safely:

```bash
rsync --archive --chown=predictor:predictor /root/.ssh /home/predictor/
```

Then switch to the development user:

```bash
su - predictor
sudo -v
```

The persistent OpenCode service deliberately runs as this non-root account.

## 3. Clone the repository and install the workspace

The repository is public, so the initial clone needs no GitHub credential:

```bash
git clone https://github.com/nickygregal12-cmyk/Euro-2028-Predictor.git
cd Euro-2028-Predictor
bash scripts/agent-tools/cloud-conductor-install.sh
```

The installer:

- verifies Ubuntu 24.04;
- installs host prerequisites;
- installs the exact Node version declared by `package.json` and verifies the official Node checksum;
- installs Tailscale from its signed Ubuntu repository;
- runs the repository's normal pinned developer-tool bootstrap;
- asks for `OPENROUTER_API_KEY` without echoing it;
- generates a separate OpenCode web password;
- creates and starts a persistent user-level `systemd` service;
- enables user lingering so OpenCode survives SSH logout/reboot.

It never exposes OpenCode publicly and never performs a model request just by installing.

## 4. Join the private tailnet

On the VM:

```bash
sudo tailscale up
```

Tailscale prints an authentication URL. Open it in your browser and approve this VM in the same Tailscale account/tailnet you will use on your phone, tablet or computer.

Install/sign into the Tailscale app on each device from which you want to reach the Conductor.

Then expose the localhost OpenCode service **privately** to the tailnet:

```bash
sudo tailscale serve --bg 4096
sudo tailscale serve status
```

The first Serve setup can ask you to enable Tailscale HTTPS. Follow its consent link. Serve should display a private `https://...ts.net` URL.

Do not use `tailscale funnel`; Funnel is public internet exposure and is not the architecture here.

## 5. Save the OpenCode web password

The installer generates a password and stores it only on the VM. Read that one value:

```bash
grep '^OPENCODE_SERVER_PASSWORD=' ~/.config/predictor-cloud/opencode.env | cut -d= -f2-
```

Save it in your password manager. The username is:

```text
predictor
```

Do not copy the OpenRouter key out of the same file unnecessarily.

## 6. Open the single front door

With Tailscale connected on your phone/tablet/laptop, open the private HTTPS URL printed by:

```bash
sudo tailscale serve status
```

Authenticate using username `predictor` and the generated password.

Start a session with the **`predictor-conductor`** agent. That is the normal front door. You should not need to jump between Claude, Ox and GPT manually for routine work.

Example request:

```text
The AI Lab is still too confusing and I do not trust the relationship between
match predictions and betting recommendations. Investigate the real current
implementation and improve whatever is genuinely wrong. Do not redesign for
its own sake. Work through the repository authorities and tests, use independent
review where it adds confidence, and prepare a PR if a code change is justified.
```

The Conductor decides whether the task needs only itself, Claude implementation, Ox review, or a preflight + implementation + review sequence.

## 7. Give the workspace GitHub write access

OpenRouter/model access and GitHub access are intentionally separate.

To let the Builder push branches and create pull requests, authenticate GitHub CLI once as the `predictor` user:

```bash
gh auth login
```

Use GitHub.com and the browser/device login flow. Grant only the repository access needed for this development workflow.

Push and PR creation remain explicit approval boundaries in the tracked Builder configuration. The model cannot silently turn hosted access into Product/Production permission.

## 8. Verify the workspace

Run:

```bash
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

Expected healthy signals include:

- exact repository Node version;
- OpenCode installed;
- all three tracked agents present;
- OpenRouter credential configured;
- Conductor systemd service active;
- localhost OpenCode endpoint requiring HTTP authentication;
- VM joined to Tailscale;
- private Tailscale Serve route configured;
- GitHub CLI authenticated if PR creation is desired.

## Normal use

Most days there is only one application to open: the private OpenCode web URL.

Use the Conductor for the task. Do not manually preload the whole repo or tell all three models to solve everything. The repository's task router and authority chain are still the context-control layer.

Useful operating pattern:

```text
one user prompt
    |
Predictor Conductor (GPT)
    |
    +-- trivial/proven task -> no delegation
    |
    +-- investigation -> optional Ox challenge
    |
    +-- implementation -> Claude Builder -> Ox diff review
    |
    +-- high-risk -> Ox preflight -> Claude Builder -> fresh Ox diff review
    |
reconcile against source/tests
    |
branch / PR / CI
```

## Updating the cloud workspace

The VM is persistent, but the repository remains the authority. Before a new task, the Conductor/Builder should work from fresh `main` and a clean tree.

When `config/agent-tools.json`, the exact Node version, or cloud scripts change materially:

```bash
git switch main
git pull --ff-only
bash scripts/agent-tools/cloud-conductor-install.sh
bash scripts/agent-tools/cloud-conductor-doctor.sh
```

The installer is designed to be re-run. It preserves the existing OpenRouter key and OpenCode web password unless replacements are supplied explicitly.

## Recovery

Service status/logs:

```bash
systemctl --user status predictor-conductor.service
journalctl --user -u predictor-conductor.service -n 100 --no-pager
```

Restart OpenCode:

```bash
systemctl --user restart predictor-conductor.service
```

Tailscale status:

```bash
tailscale status
sudo tailscale serve status
```

Re-run the repository doctor before changing configuration blindly.

## What this does not do

- It does not make a model or AI consensus repository authority.
- It does not expose OpenCode on the public internet.
- It does not put provider keys in GitHub or application environment files.
- It does not grant Supabase/Netlify/Production access.
- It does not let multiple write agents race on one checkout.
- It does not make every task a three-model debate.
- It does not replace CI, PR review or the repository's deterministic routing/skill system.
