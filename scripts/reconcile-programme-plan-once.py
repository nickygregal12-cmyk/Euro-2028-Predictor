from pathlib import Path

path = Path('docs/architecture/programme-plan.md')
text = path.read_text()
marker = '## 7. Repository-verification boundary\n'
if text.count(marker) != 1:
    raise SystemExit('expected one repository-verification boundary')
head, old = text.split(marker, 1)
if 'Verified against `main` at `1fb8ffd36ad113079181829a8bcc47175c43b6da`' not in old:
    raise SystemExit('historical snapshot marker missing')
replacement = '''## 7. Delivery progress overlay — 5 August 2026

The programme phases and gates above remain the authority of this document, but the implementation has moved materially beyond the repository snapshot originally recorded below.

Delivered backend foundations now include:

- shared competition context, competition-season and game-membership identity;
- recurring domestic Match Predictor scheduling, lock handling, scoring and standings;
- season Last Man Standing persistence, settlement and an idempotent wipeout-restart lifecycle transition;
- Predictor Championship neutral Cup sources, split-stage persistence, one-parent ancestry and a continuing table derived across both phases;
- provider-response custody and strict decoding boundaries;
- repeatable competition instances with explicit live/current resolution and correction-safe rederivation.

These are backend capabilities, not proof that the programme's product gates have passed. The LMS successor created by the restart transition has no windows until a separately reviewed calendar authority schedules the next eligible league round. The Championship still lacks its phase-transition driver, bounded product reads and completed user surface. The first bounded provider rehearsal, season-game surfaces, instrumentation, external-user discovery and cohort evidence also remain open.

Moving repository, hosted and deployment contract values belong only in [`../quality/current-status.md`](../quality/current-status.md), the machine contract records and operational inventory. This programme plan deliberately does not duplicate them.

## 8. Historical repository-verification snapshot — 29 July 2026

The following section is retained as dated evidence of what was verified when this plan was written. It is **not current implementation authority**; later code, tests and verified hosted records supersede it.

'''
path.write_text(head + replacement + old)
