# Reusable master audit prompt

## Purpose

This file preserves the complete approved evidence-based audit prompt used for the Euro 2028 Predictor, followed by the approved feature/business-rule and repeat-audit control addenda.

Material changes to this prompt affect audit comparability and must be reviewed as a quality-control change. Do not replace it with a generic checklist.

---

# Full Website and Repository Audit

Act as a senior software architect, frontend engineer, backend engineer, security reviewer, QA lead, DevOps engineer, accessibility specialist, and product designer.

Your task is to carry out a **complete, evidence-based audit of this website and its entire repository**.

This is an audit only. **Do not edit, delete, move, rename, commit, push, deploy, migrate, install, or reformat anything unless I explicitly approve it after reviewing your findings.**

Do not assume that existing code, tests, documentation, comments, or architectural decisions are correct. Verify everything against the actual files and, where possible, the running website.

## Main objective

Determine:

1. What the website currently does.
2. How the repository is structured.
3. What is working correctly.
4. What is incomplete, broken, duplicated, obsolete, insecure, misleading, fragile, or unnecessarily complex.
5. What is missing for the website to be considered production-ready.
6. What should be fixed first.
7. Whether the implementation matches the intended user experience and business rules.
8. Whether another developer or AI agent could safely maintain and extend the project.

## Audit rules

* Inspect the entire repository, not only the obvious page or component files.
* Read the project documentation, configuration files, package scripts, environment-variable usage, migrations, tests, schemas, deployment files, and source code.
* Trace important features through the full system:

  * user interface
  * state management
  * API or service layer
  * database
  * validation
  * permissions
  * error handling
  * loading states
  * tests
* Do not report speculative issues as confirmed facts.
* Clearly distinguish:

  * confirmed defect
  * likely defect
  * design concern
  * maintainability concern
  * missing evidence
  * recommendation
* Every significant finding must include file paths, relevant functions/components, routes, database objects, configuration entries, or other concrete evidence.
* Do not mark something as safe or working merely because a test exists. Inspect whether the test is meaningful and whether it tests current behaviour.
* Do not trust comments or documentation without checking whether the implementation still matches them.
* Identify generated files, archived code, experiments, backups, temporary files, duplicate versions, and files that appear unused.
* Do not recommend a large rewrite unless you can demonstrate why incremental repair would be worse.
* Prefer practical improvements over unnecessary abstraction or fashionable technology.
* Do not create artificial issues simply to make the report appear thorough.

## Phase 1 — Repository orientation

First, build an accurate picture of the project.

Report:

* framework, language, package manager, runtime, and build system
* frontend architecture
* backend or serverless architecture
* database and authentication providers
* hosting and deployment setup
* state-management approach
* styling system
* testing tools
* linting, formatting, type-checking, and validation tools
* main application entry points
* route structure
* major feature areas
* important external services
* environment-specific behaviour
* how local, staging, preview, and production environments differ
* whether the repository is a monorepo or single application
* whether there are multiple competing implementations of the same feature

Produce a concise repository map showing the purpose of each important directory.

## Phase 2 — Run the existing checks

Where safe and possible, run the existing non-destructive commands, including:

* dependency installation only if dependencies are not already available and installation is permitted
* build
* type-checking
* linting
* unit tests
* integration tests
* end-to-end tests
* repository audits
* formatting checks
* security or dependency checks already included in the project

Before running commands, inspect the scripts so you understand what they do.

Do not run commands that:

* alter production data
* apply database migrations
* reset databases
* seed external environments
* deploy the site
* push commits
* modify cloud resources
* send real emails or notifications
* trigger payments
* perform destructive cleanup

For every check, report:

* command
* result
* warnings
* failures
* whether the check appears trustworthy
* important areas it does not cover

A passing command is not proof that the project is correct.

## Phase 3 — Architecture and code quality

Audit:

* separation of concerns
* component and module boundaries
* file size and responsibility
* duplicate logic
* duplicated components or page variants
* inconsistent patterns
* circular dependencies
* deeply coupled modules
* hidden global state
* unnecessary prop drilling
* misuse of context or stores
* fragile state synchronisation
* race conditions
* stale data risks
* hardcoded values
* scattered business rules
* magic strings and numbers
* inconsistent naming
* abandoned experiments
* dead code
* unused exports
* unused dependencies
* outdated compatibility layers
* large files that should be separated
* excessive abstraction
* missing abstraction where duplication creates risk
* inconsistent error handling
* swallowed errors
* debug logs
* temporary flags
* TODO, FIXME, HACK, placeholder, and mock code
* commented-out code
* code paths that can no longer execute
* functionality implemented differently across pages

Identify where the architecture will become difficult to maintain as features grow.

For each major issue, explain the consequence rather than only describing the code smell.

## Phase 4 — Functional and business-rule audit

Identify the website’s important user journeys and trace each one from beginning to end.

For each journey, check:

* entry point
* navigation
* required data
* permissions
* validation
* loading state
* empty state
* success state
* failure state
* retry behaviour
* refresh behaviour
* direct URL access
* browser back/forward behaviour
* mobile behaviour
* persistence
* concurrent updates
* duplicate submission protection
* expired or stale sessions
* unusual but valid data
* malformed or missing data

Create a feature matrix using these statuses:

* Complete
* Mostly complete
* Partially implemented
* Placeholder
* Broken
* Unreachable
* Duplicated
* Not verifiable

Check whether the user interface and the underlying business logic agree.

Look specifically for:

* screens that display success before the server confirms it
* UI elements with no working action
* actions available to users who should not have them
* features that exist in code but cannot be reached
* routes that can be reached but should not be public
* old logic that conflicts with newer logic
* calculations performed differently in different locations
* inconsistent date, time, currency, score, status, or timezone handling
* incorrect assumptions about ordering, uniqueness, null values, or optional fields
* incomplete lifecycle states
* transient displays of incorrect information

## Phase 5 — User interface and user experience

Audit the running website where available, alongside the implementation.

Review:

* desktop layout
* tablet layout
* mobile layout
* small mobile screens
* wide screens
* portrait and landscape behaviour
* consistency between pages
* navigation clarity
* information hierarchy
* content density
* typography
* spacing
* alignment
* responsive breakpoints
* overflow
* clipping
* horizontal scrolling
* fixed and sticky elements
* modals and sheets
* focus management
* forms
* feedback after actions
* destructive-action warnings
* loading indicators
* empty states
* error messages
* disabled states
* touch-target sizes
* discoverability
* confusing terminology
* inconsistent labels
* visual states that appear clickable but are not
* pages that feel unfinished
* placeholder content
* internal or developer terminology exposed to users

Do not reduce the review to personal visual preference. Explain the practical user impact.

Where possible, test important layouts at representative viewport widths.

## Phase 6 — Accessibility

Audit against WCAG 2.2 AA principles.

Check:

* semantic HTML
* heading order
* landmarks
* keyboard navigation
* visible focus
* skip links
* labels and accessible names
* form errors
* screen-reader announcements
* modal focus trapping and restoration
* colour contrast
* reliance on colour alone
* alt text
* icons without labels
* table semantics
* reduced-motion preferences
* zoom and text scaling
* target sizes
* dynamic content
* live regions
* route-change announcements
* logical reading order
* hidden content accidentally exposed to assistive technology

Clearly separate automated findings from issues requiring manual verification.

## Phase 7 — Security and privacy

Perform a defensive security review without attempting harmful exploitation.

Audit:

* exposed secrets
* committed environment files
* API keys
* service-role credentials
* client-side privilege checks
* server-side authorisation
* authentication flows
* session handling
* password-reset flows
* account enumeration
* role escalation
* insecure direct-object references
* database row-level security
* storage permissions
* administrative routes
* administrative API calls
* validation and sanitisation
* injection risks
* cross-site scripting
* cross-site request forgery
* open redirects
* unsafe HTML rendering
* insecure file uploads
* rate limiting
* abuse controls
* brute-force protection
* personally identifiable information
* excessive logging
* error messages that leak internal information
* CORS
* security headers
* Content Security Policy
* HTTPS assumptions
* dependency vulnerabilities
* webhook validation
* replay protection
* serverless-function permissions
* environment isolation
* test or simulation data entering production
* destructive operations without sufficient safeguards

For database-backed applications, verify that permissions are enforced at the database or trusted server layer, not only hidden in the interface.

Do not expose actual secret values in the report. Refer only to the location and type of secret.

## Phase 8 — Data and database integrity

Inspect schemas, migrations, generated types, queries, functions, triggers, policies, and seed data.

Audit:

* source of truth for each major entity
* schema consistency
* migration ordering
* migration idempotency
* migrations missing from version control
* drift between code and database assumptions
* foreign keys
* unique constraints
* nullability
* indexes
* cascading deletes
* orphaned data risks
* duplicated records
* race conditions
* transactions
* atomic updates
* timestamp handling
* timezone handling
* status fields
* enum consistency
* derived data
* caching
* stale generated types
* unsafe client-side writes
* overly broad queries
* missing pagination
* N+1 patterns
* inefficient subscriptions
* irreversible changes
* backup and recovery assumptions
* production-data safety
* test-data isolation
* reset and simulation safeguards

Do not apply migrations or alter data during the audit.

## Phase 9 — Performance

Audit:

* production bundle size
* route-level code splitting
* lazy loading
* unnecessary re-renders
* expensive calculations
* repeated requests
* waterfalls
* duplicate data fetching
* oversized images
* missing image optimisation
* font loading
* layout shifts
* long tasks
* large DOM trees
* excessive client-side JavaScript
* slow database queries
* missing indexes
* unnecessary real-time subscriptions
* cache strategy
* service-worker behaviour
* memory leaks
* event-listener cleanup
* polling
* rendering of large lists
* mobile network performance
* Core Web Vitals risks

Distinguish measured problems from risks inferred through code inspection.

## Phase 10 — Reliability and edge cases

Review how the system handles:

* offline or interrupted connections
* slow requests
* partial failures
* stale tabs
* simultaneous browser sessions
* duplicate clicks
* refresh during submission
* expired authentication
* missing records
* deleted records
* unusually long names and text
* zero values
* negative values
* ties
* empty collections
* large datasets
* unexpected ordering
* time transitions
* daylight-saving changes
* midnight boundaries
* scheduled state changes
* corrected or reversed data
* rollback
* retry
* idempotency
* maintenance periods
* external-service outages

Identify any situation where the website can show a convincing but incorrect state.

## Phase 11 — Testing quality

Audit the tests themselves.

Report:

* what is tested
* what is not tested
* whether tests reflect current behaviour
* brittle tests
* duplicated tests
* shallow tests
* tests that only assert implementation details
* snapshots that hide regressions
* tests that can pass while the user journey is broken
* skipped tests
* quarantined tests
* flaky tests
* mock-heavy tests that fail to test integration
* missing database-policy tests
* missing permission tests
* missing error-state tests
* missing responsive or visual tests
* missing end-to-end journeys
* whether test data resembles real data
* whether production behaviour differs from the test environment

Recommend a practical testing pyramid appropriate to this specific project.

## Phase 12 — SEO, sharing and public-web quality

Where applicable, review:

* page titles
* meta descriptions
* canonical URLs
* robots directives
* sitemap
* Open Graph data
* social previews
* favicons
* manifest
* structured data
* semantic page structure
* crawlability
* duplicate content
* missing public-page content
* handling of private routes
* error pages
* redirects
* broken internal links
* shareable deep links

Do not apply SEO expectations to private application screens where they are not relevant.

## Phase 13 — Deployment and operations

Audit:

* deployment configuration
* preview deployments
* production configuration
* environment-variable separation
* branch rules
* CI checks
* release process
* rollback process
* database deployment process
* migration gates
* monitoring
* error reporting
* logging
* alerting
* analytics
* uptime checks
* incident-response documentation
* dependency update process
* backups
* disaster recovery
* domain and redirect configuration
* security headers
* caching headers
* source-map exposure
* runtime versions
* lockfiles
* reproducible builds
* production-only failures
* staging parity
* accidental production access from local or preview environments

Identify any action that a developer or AI agent could accidentally perform against production.

## Phase 14 — Documentation and maintainability

Audit all project documentation.

Check:

* setup instructions
* required tools
* environment variables
* local development
* database setup
* deployment
* testing
* architecture
* business rules
* permissions
* troubleshooting
* current project status
* unfinished work
* known risks
* ownership
* recovery procedures
* AI-agent instructions
* conflicting documents
* stale documents
* duplicated plans
* references to files or commands that no longer exist

Determine whether a new developer could safely run, understand, modify, test, and deploy the project using only the repository.

## Phase 15 — Repository hygiene

Look for:

* secrets
* `.env` files
* build output
* dependency directories
* operating-system files
* editor files
* archives
* duplicate repositories
* old exports
* screenshots
* database dumps
* large binary files
* temporary scripts
* experimental code
* unused assets
* abandoned branches referenced in documentation
* inconsistent lockfiles
* backup copies with names such as `old`, `new`, `final`, `copy`, `v2`, or numbered duplicates
* files that should be ignored
* important files incorrectly ignored

Explain what should be kept, removed, archived, or documented.

## Required final report structure

Produce one structured audit report with the following sections.

### 1. Executive summary

Summarise:

* overall condition of the project
* whether it is safe to continue building on
* whether it appears production-ready
* strongest areas
* weakest areas
* most serious risk
* recommended immediate next step

### 2. Scorecard

Score each category out of 10:

* Product completeness
* Functional correctness
* Architecture
* Code quality
* Frontend maintainability
* Backend maintainability
* UI consistency
* Mobile experience
* Accessibility
* Security
* Data integrity
* Performance
* Reliability
* Testing
* Deployment and operations
* Documentation
* Repository hygiene
* Future maintainability

For every score, provide a brief evidence-based justification and describe what is required to reach 10/10.

Do not award 10/10 unless there is strong evidence that the area is exceptionally complete.

### 3. Critical findings

List issues that could cause:

* data loss
* security breach
* permission bypass
* production outage
* incorrect core results
* irreversible corruption
* serious privacy exposure

### 4. High-priority findings

List major functional, architectural, deployment, UX, testing, or maintainability problems.

### 5. Medium-priority findings

List meaningful issues that should be addressed but do not immediately threaten the application.

### 6. Low-priority findings

List polish, cleanup, minor consistency, and optional-improvement items.

### 7. Positive findings

Identify the parts that are well designed and should be preserved.

### 8. Feature-completeness matrix

For each major feature, include:

| Feature | Status | Frontend | Backend/Data | Tests | Main concern |
| ------- | ------ | -------- | ------------ | ----- | ------------ |

### 9. Route and page audit

For each user-accessible route or screen, include:

| Route/Page | Purpose | Status | Mobile | Accessibility | Functional risks |
| ---------- | ------- | ------ | ------ | ------------- | ---------------- |

Include hidden, administrative, legacy, redirect, and unreachable routes where identified.

### 10. Dead, duplicate and obsolete code

List files or implementations that appear:

* unused
* duplicated
* superseded
* unreachable
* generated
* temporary
* unsafe to delete without further checking

Do not recommend deletion without explaining how usage was checked.

### 11. Missing production requirements

List everything still required before launch, separating:

* mandatory
* strongly recommended
* optional

### 12. Prioritised remediation roadmap

Organise the work into:

* Stage 0 — stop-the-line risks
* Stage 1 — correctness and data safety
* Stage 2 — security and permissions
* Stage 3 — architecture and maintainability
* Stage 4 — user journeys and UX
* Stage 5 — testing and release confidence
* Stage 6 — performance and polish
* Stage 7 — production readiness

For each task include:

| ID | Task | Reason | Severity | Files/Systems | Dependencies | Effort | Validation |
| -- | ---- | ------ | -------- | ------------- | ------------ | ------ | ---------- |

Use effort estimates such as:

* XS — isolated small change
* S — small contained change
* M — multiple files or moderate logic
* L — substantial cross-system work
* XL — architectural or migration-heavy work

Do not estimate calendar time.

### 13. Recommended first implementation batch

Choose the safest and highest-value group of tasks to complete first.

The first batch should:

* be small enough to review properly
* avoid mixing unrelated changes
* include clear validation steps
* avoid unnecessary rewrites
* not depend on unresolved architectural decisions

### 14. Unknowns and limitations

State clearly:

* files or systems you could not access
* commands you could not run
* environments you could not inspect
* assumptions that remain unverified
* findings that require database, production, or manual browser access
* areas where evidence was insufficient

## Finding format

Use this format for every important finding:

**ID:** SECURITY-001
**Title:** Brief and specific title
**Severity:** Critical / High / Medium / Low
**Confidence:** Confirmed / High confidence / Possible / Requires verification
**Category:** Security / Data / Architecture / UX / Testing / Other
**Evidence:** Exact files, functions, routes, queries, policies, or command output
**Problem:** What is wrong
**Impact:** What could happen
**Recommended fix:** Practical corrective action
**Validation:** How to prove the issue has been resolved
**Dependencies:** Anything that must be understood or completed first

## Final requirements

* Be direct and critical, but fair.
* Base conclusions on evidence from this repository.
* Do not provide a generic website-audit checklist as the final output.
* Do not hide uncertainty.
* Do not exaggerate severity.
* Do not make any changes.
* Do not finish after finding the first major issue.
* Complete the entire audit before producing the final prioritised report.
* Reference exact file paths wherever possible.
* Keep confirmed findings separate from recommendations.
* Highlight any production-sensitive action that must require human approval.
* End with a clear verdict:

  * Safe to continue development
  * Safe only after critical repairs
  * Not safe to build on without restructuring
  * Insufficient evidence to determine

Begin by inspecting the repository structure, project instructions, package scripts, configuration, documentation, and version-control state. Then provide a short orientation summary before continuing with the full audit.

---

# Feature and business-rule verification addendum

Do not assume that features, scoring systems or game modes from previous projects are part of this repository.

Determine the current application scope only from:

1. the current GitHub `main` branch;
2. current authoritative repository documentation;
3. current database migrations and schema;
4. the deployed website;
5. current tests; and
6. clearly marked active TODO or roadmap documents.

Do not import rules or functionality from:

- previous World Cup predictor projects;
- older repository versions;
- previous chat discussions;
- abandoned prototypes;
- planned future features; or
- similarly named game modes.

## Current feature inventory

Build an evidence-based inventory of everything currently present in the repository.

For each potential feature, classify it as:

- Implemented
- Partially implemented
- UI prototype only
- Database structure only
- Documented but not implemented
- Planned
- Legacy or obsolete
- Not present
- Unclear

Include exact file paths and routes supporting the classification.

Potential feature names found in documentation must not be treated as implemented until corresponding working code and data support are verified.

## Scoring audit

Discover the current scoring system from the repository rather than using assumed values.

Identify:

- every file containing scoring values;
- every function that calculates points;
- database functions or triggers that award points;
- constants or configuration containing point values;
- tests containing scoring expectations;
- documentation describing scoring;
- administrator tools that initiate scoring or recalculation; and
- any duplicated scoring implementation.

Produce:

| Scoring rule | Current value | Evidence | Implemented where | Tested | Conflicts |
| ------------ | ------------: | -------- | ----------------- | ------ | --------- |

Where sources disagree, do not choose one silently. Report:

- the conflicting values;
- exact evidence for each;
- which source appears current;
- whether the live application follows either version; and
- what requires owner confirmation.

Do not modify or standardise scoring during the audit.

## Additional and future game modes

Do not assume that KO Predictor, Last Man Standing, Fan Duels or any other bonus game exists.

Search for evidence of each possible game mode across:

- routes;
- components;
- services;
- database migrations;
- tables;
- types;
- tests;
- navigation;
- feature flags;
- documentation; and
- deployed pages.

Classify each separately.

A feature mentioned only in a roadmap or TODO file must be reported as planned, not implemented.

If KO Predictor is not present in the current repository, state:

- that it is outside the current implemented application scope;
- whether any unused scaffolding exists;
- whether existing architecture could support it later; and
- whether any current code incorrectly assumes it already exists.

Do not audit hypothetical KO Predictor scoring or behaviour unless the repository contains an active implementation.

## Business rules

Extract current business rules from the application itself.

For every major rule, record:

| Rule | Source | Enforcement layer | Test coverage | Confidence |
| ---- | ------ | ----------------- | ------------- | ---------- |

Determine whether each rule is enforced through:

- interface only;
- client-side logic;
- server or edge function;
- database constraint;
- Row Level Security;
- database function; or
- multiple layers.

Flag important rules that are enforced only in the browser.

Do not label earlier project discussions as authoritative unless they are represented in the current repository or explicitly confirmed by the owner.

## Scope limitation

This audit concerns the current Euro 2028 Predictor repository and deployed website only.

Previous predictor applications may be used solely to identify possible copied legacy code. Their scoring rules, architecture and intended features must not be treated as requirements for this project.

---

# Repeat-audit and quality-baseline controls

For every audit after the first baseline:

1. read `docs/quality/README.md`, `current-status.md`, `feature-baseline.md`, `risk-register.md` and `deferred-decisions.md` before inspecting implementation;
2. audit the exact current branch, commit SHA and deployed version rather than assuming the previous audit still applies;
3. compare every feature and safeguard against `feature-baseline.md` to detect silent removal, loss of reachability, weakened enforcement or scope drift;
4. review every previously open and resolved Critical/High finding and retain the original ID when the same root cause returns;
5. preserve uncertainty when systems are inaccessible; do not infer that an unverified production control remains safe;
6. inspect development/preview/production isolation, Supabase migrations/RLS/functions/auth settings and Netlify configuration wherever access permits;
7. remain non-destructive and require explicit human approval for production-sensitive actions;
8. create a new dated report instead of overwriting historical evidence;
9. propose updates to `risk-register.md`, `feature-baseline.md`, `deferred-decisions.md` and `current-status.md` from reviewed evidence; and
10. record the next audit baseline, unresolved unknowns and the safest next remediation batch.
