from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

roadmap = ROOT / 'docs' / 'roadmap.md'
replace_once(
    roadmap,
    '- repeatable competition instances, explicit live/current instance resolution and correction-safe terminal rederivation.',
    '- repeatable competition instances, explicit live/current instance resolution, correction-safe terminal rederivation and an idempotent LMS wipeout restart that creates a fresh successor without copying picks, cycles, projections or windows.',
    'roadmap delivered lifecycle',
)
replace_once(
    roadmap,
    'These are backend and control foundations. They do not mean that the season game surfaces, split driver, restart lifecycle, provider rehearsal or closed-cohort product have been delivered.',
    'These are backend and control foundations. They do not mean that the season game surfaces, Championship split driver, LMS successor-window scheduler, provider rehearsal or closed-cohort product have been delivered.',
    'roadmap remaining boundary',
)
replace_once(
    roadmap,
    '1. **Finish the LMS restart lifecycle governed by ADR 0025.** A public `restart_all_reentered` wipeout creates a new linked competition row, copies immutable setup only, re-enters the previous field with no picks or used-team state, starts at the next eligible round and records one idempotent audited lifecycle event. Settlement continues to report the outcome rather than creating the successor itself.',
    '1. **Schedule the LMS restart successor from an authoritative league calendar.** Contract 107 now completes the wiped-out predecessor and creates one idempotent, linked successor with a fresh field and no copied picks, cycles, projections or windows. The next contract must identify the next eligible league round, create the successor windows exactly once and keep the new competition inert rather than guessing when no valid round exists.',
    'roadmap next executable item',
)

master = ROOT / 'MASTER-TODO.md'
replace_once(
    master,
    '**Rules, storage and settlement delivered; lifecycle and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. The settlement job deliberately reports a large public wipeout without creating its successor.',
    '**Rules, storage, settlement and restart transition delivered; scheduling and surfaces remain.** Eligibility, deterministic C-collation auto-assignment, used-team cycles, lock-time selection writes, correction-aware replay, entrant-state projection and the recurring settlement job are implemented. Contract 107 now converts a qualifying public wipeout into one idempotent linked successor, re-entering the field and copying no selections, cycles, projections or windows.',
    'master LMS stage summary',
)
replace_once(
    master,
    '- [ ] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation.',
    '- [x] Implement the ADR 0025 `restart_all_reentered` lifecycle as a separate idempotent, advisory-lock-protected successor operation. *(Contract 107; successor intentionally arrives with no windows.)*\n- [ ] Add the separate calendar authority/driver that starts the successor at the next eligible league round and creates its windows exactly once.',
    'master restart checklist',
)

claude = ROOT / 'CLAUDE.md'
replace_once(
    claude,
    'The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances and split persistence.',
    'The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances, the idempotent LMS wipeout restart transition and split persistence.',
    'claude delivered boundary',
)
replace_once(
    claude,
    'Do not mistake backend presence for a completed product. The remaining work is governed by the roadmap and includes lifecycle/phase drivers, bounded browser reads and surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations.',
    'Do not mistake backend presence for a completed product. The remaining work is governed by the roadmap and includes the LMS successor-window scheduler, Championship phase driver, bounded browser reads and surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations.',
    'claude remaining boundary',
)

for path, required in {
    roadmap: ['Schedule the LMS restart successor', 'successor-window scheduler'],
    master: ['Contract 107', 'next eligible league round'],
    claude: ['idempotent LMS wipeout restart transition', 'successor-window scheduler'],
}.items():
    text = path.read_text(encoding='utf-8')
    for needle in required:
        if needle not in text:
            raise RuntimeError(f'{path}: missing {needle}')

print('Refreshed active plans for merged Contract 107')
