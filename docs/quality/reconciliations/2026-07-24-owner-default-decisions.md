# Owner default decisions — 24 July 2026

## Decision

The owner approved the recommended defaults for the three outstanding owner-controlled operations areas.

## Production recovery

Approved defaults:

- trusted execution machine: the owner's current Windows computer;
- encryption: 7-Zip AES-256 with a strong unique password;
- off-machine custody: the owner's OneDrive;
- recovery reviewer: the owner;
- plaintext staging: outside both the Git repository and OneDrive-synchronised directories;
- passwords remain local and must not be placed in GitHub, repository files or chat.

GitHub issue #32 is the execution and acceptance record. Approval of these defaults does not constitute a backup, off-site custody or restore proof. Production migrations remain blocked until issue #32 is completed and accepted.

## Legacy public development site

The owner approved the recommended outcome: retire/protect `euro28-predictor-dev.netlify.app`.

Target state:

- remove public access;
- disable the hourly heartbeat and unnecessary legacy functions through a separate legacy workstream;
- do not repoint the site to either current Euro Supabase project;
- leave inactive staging Supabase project `gcfdwobpnanjchcnvdco` untouched pending separate review.

Automation did not change the site. Team-login protection returned HTTP 422 and the password fallback was blocked by the platform secret-handling layer. Issue #27 remains open for the Netlify dashboard action and after-state evidence.

## Turnstile non-production model

The owner approved Cloudflare's always-pass test credentials for non-production:

- deploy-preview, branch-deploy and Netlify dev site key: `1x00000000000000000000AA`;
- development Supabase Turnstile secret: `1x0000000000000000000000000000000AA`.

Production retains its existing real site key and real secret. The site key and secret must be changed together; test credentials must never reach production.

The connected tools cannot update the development Supabase Auth CAPTCHA provider/secret. No Turnstile or Auth configuration changed. Issue #28 remains open for dashboard configuration and authenticated preview verification.

## GitHub branch protection

Technical enforcement of pull requests and required checks on `main` remains unverified because the connected GitHub tools cannot read rulesets/branch protection and the execution environment has no authenticated GitHub CLI. Issue #33 records the recommended rules and required evidence.

## Safety statement

This decision record changed no Netlify access control, function, schedule or environment variable; no Cloudflare widget; no Supabase Auth setting, schema, migration history or data; and no production deployment contract.