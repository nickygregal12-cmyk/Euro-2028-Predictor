from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'docs' / 'quality' / 'feature-baseline.md'
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
    '- repeatable competition instances, explicit live/current resolution and correction-safe rederivation after completion.',
    '- repeatable competition instances, explicit live/current resolution, correction-safe rederivation after completion and an idempotent LMS wipeout restart that creates a linked successor while copying no selections, used cycles, projections or windows.',
    'feature overlay lifecycle',
)
replace_once(
    'The missing lifecycle/phase drivers, bounded browser reads and season product surfaces remain partial/planned work in the roadmap.',
    'The LMS successor-window scheduler, Championship phase driver, bounded browser reads and season product surfaces remain partial/planned work in the roadmap.',
    'feature remaining boundary',
)
replace_once(
    '- treat a backend authority as a completed or production-hosted surface without journey evidence;',
    '- treat a backend authority as a completed or production-hosted surface without journey evidence;\n- describe the Contract 107 successor as playable before an authoritative next-round/window scheduler has populated it;',
    'feature Contract 107 regression rule',
)

for needle in (
    'idempotent LMS wipeout restart',
    'LMS successor-window scheduler',
    'Contract 107 successor as playable',
):
    if needle not in text:
        raise RuntimeError(f'missing Contract 107 feature-baseline guard: {needle}')

compact = text.split('## Identifier continuity and archived dispositions', 1)[0]
rows = [
    line for line in compact.splitlines()
    if line.startswith('| ') and not line.startswith('| ID |') and not line.startswith('| --- |')
]
if len(rows) != 61:
    raise RuntimeError(f'compact feature row count changed: {len(rows)}')

path.write_text(text, encoding='utf-8')
print('Refreshed feature baseline for merged Contract 107')
