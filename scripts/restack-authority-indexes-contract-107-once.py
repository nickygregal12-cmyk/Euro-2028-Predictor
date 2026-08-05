from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


design = ROOT / 'docs' / 'design' / 'README.md'
replace_once(
    design,
    '| 106 | tournament Bonus rederivation remained correction-safe after completion |',
    '| 106 | tournament Bonus rederivation remained correction-safe after completion |\n| 107 | the idempotent LMS wipeout restart creates a linked successor and copies no picks, cycles, projections or windows |',
    'design Contract 107 row',
)

structure = ROOT / 'docs' / 'competition-structure.md'
replace_once(
    structure,
    'The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances and split persistence. Their remaining lifecycle/phase drivers, bounded browser reads and product surfaces still land through the roadmap sequence; backend presence is not a completed user journey.',
    'The Euro baseline implements Original Predictor, KO Predictor, tournament LMS and tournament Predictor Cup machinery. The reusable competition-season catalogue and substantial backend authorities for season Match Predictor, season LMS and Predictor Championship are also present, including recurring jobs, scoring/settlement, standings, repeatable instances, the idempotent LMS wipeout restart transition and split persistence. The LMS successor still needs an authoritative next-round/window scheduler; the Championship still needs its phase driver; both also need bounded browser reads and product surfaces. Those remaining journeys land through the roadmap sequence—backend presence is not a completed user journey.',
    'competition Contract 107 boundary',
)

plan = ROOT / 'docs' / 'architecture' / 'multi-competition-hub-build-plan.md'
replace_once(
    plan,
    'Since then the shared context migration, Stage C/C1b, provider custody and the season Match Predictor/LMS/Championship backend foundations have landed.',
    'Since then the shared context migration, Stage C/C1b, provider custody, the season Match Predictor/LMS/Championship backend foundations and the idempotent LMS wipeout restart transition have landed.',
    'build-plan Contract 107 overlay',
)

for path, needle in {
    design: '| 107 | the idempotent LMS wipeout restart',
    structure: 'The LMS successor still needs an authoritative next-round/window scheduler',
    plan: 'idempotent LMS wipeout restart transition have landed',
}.items():
    if needle not in path.read_text(encoding='utf-8'):
        raise RuntimeError(f'{path}: missing {needle}')

print('Refreshed authority indexes for merged Contract 107')
