# Current-stack improvements

These changes use systems already present in the repository. They should be completed before adding new UI-facing dependencies.

## 1. Standardise generic icons on Lucide

The package is already installed and used by the premium prototype, while production components still include a large hand-maintained generic SVG set.

### Implement

- Keep the existing `IconProps`-style wrapper boundary so component call sites remain stable.
- Back generic icons with `lucide-react` imports.
- Retain custom SVGs only for Predictor-specific concepts that Lucide cannot represent clearly, such as a competition-specific joker or bespoke tournament mark.
- Define supported sizes and stroke widths in one icon module.
- Make decorative icons `aria-hidden` and meaningful standalone icons require an accessible label.
- Use one visual treatment for active navigation; do not introduce a second icon family for filled states.

### First migration slice

- bottom navigation;
- app bar;
- chevrons and close controls;
- lock, information, warning and success states;
- account and settings controls.

### Acceptance criteria

- no generic icon is duplicated in both the custom SVG set and Lucide wrappers;
- production and premium surfaces use the same generic icon language;
- icon-only controls have accessible names;
- the bundle-budget check does not regress materially.

## 2. Correct and generate national flags

The existing `TeamFlag` wrapper and curated `flags.css` subset are the right architecture. The current fixed boxes are approximately 3:2 while the standard `flag-icons` assets are 4:3, which can crop edge detail when combined with `background-size: cover`.

### Implement

- change standard flag boxes to exact 4:3 dimensions, for example 32×24, 24×18, 16×12 and 36×27;
- use `background-size: contain` unless a reviewed visual reason requires cropping;
- generate the supported country-code stylesheet from authoritative team and venue data;
- add a build-time test that every configured country or subdivision code has an emitted class;
- render an explicit neutral fallback for an unknown code;
- support decorative and meaningful accessibility modes so a flag beside a visible team name is not announced twice;
- keep the thin outline for white-heavy flags.

### Acceptance criteria

- no configured team or venue can render an empty flag silently;
- the generated subset remains materially smaller than the full library;
- all flag snapshots pass in light and dark themes;
- England, Scotland, Wales and Northern Ireland subdivision codes remain covered.

## 3. Formalise the shared motion system

Framer Motion is already installed and the premium prototype already respects reduced-motion preferences. The next step is to move its best patterns into a small shared policy rather than adding another animation library.

### Implement

Create shared tokens for:

- fast, standard and emphasis durations;
- standard, enter and exit easing;
- small and medium translation distances;
- pressed and hover scale;
- reduced-motion fallbacks.

Use CSS transitions for simple colour, border, opacity and small transform changes. Use Framer Motion for layout changes, sheets, modals, route-level transitions and state replacement.

Apply first to:

- competition switching;
- modal and choice-sheet entry/exit;
- prediction save confirmation;
- league-rank movement;
- locked/open state changes;
- signed-in landing-page cards.

### Acceptance criteria

- `prefers-reduced-motion` produces a fully usable static experience;
- hover is never the only interaction signal;
- ordinary data does not animate on every refresh;
- motion values are not redefined independently inside feature files.

## 4. Turn the existing component preview into a protected visual contract

The repository already has a substantial `ComponentsPreview` dev harness with normal, hostile and edge-case data. Build on it instead of creating a parallel component-workshop system.

### Implement

- give major preview sections stable anchors or routes;
- add deterministic fake time and disable non-essential animation during screenshots;
- add Playwright screenshot assertions for key viewport widths and both themes;
- include hostile states: longest names, three-digit values, missing assets, loading, empty, unavailable, locked and error;
- keep baselines reviewed and small; do not snapshot every component permutation;
- run visual checks on UI-changing PRs and a scheduled full sweep.

### Acceptance criteria

- baselines are deterministic on CI;
- a visual difference produces a useful diff artefact;
- approved mobile-first screens are represented;
- the visual suite does not require production data or hosted credentials.

## 5. Adopt a Vitest/Playwright testing convention

Adapt the useful Better Specs principles rather than importing its Ruby-specific structure.

### Convention

- `describe`: the subject, service or user journey;
- nested `describe`: `when`, `with` or `without` a material condition;
- `it`: the observable behaviour in present tense;
- unit test: normally one principal behaviour/assertion;
- integration or end-to-end test: multiple related assertions are acceptable when they prove one user outcome;
- cover valid, boundary, invalid and unauthorised cases;
- prefer real domain behaviour over implementation-detail mocks;
- create only the fixture data needed by the scenario.

### Rollout

Pilot the convention in scoring, H2H, entry locking, provider decoding and one authenticated Playwright flow. Do not rewrite stable tests only to change wording.