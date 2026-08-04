from __future__ import annotations

import re
from pathlib import Path

MIGRATIONS = Path('supabase/migrations')
OUTPUT = Path('docs/quality/contract-104-latest-function-definitions.sql')

TARGETS = [
    'predictor_internal.enforce_season_matchweek_lock',
    'predictor_internal.prepare_competition_season_scope',
    'predictor_internal.recompute_ko_predictor_for_match',
    'predictor_internal.recompute_lms_for_tournament',
    'public.create_league',
    'public.get_bonus_games',
    'public.get_competition_games',
    'public.get_ko_predictor_standings',
    'public.get_my_cup',
    'public.get_my_lms',
]

HEADER = re.compile(
    r'create\s+(?:or\s+replace\s+)?function\s+'
    r'(?P<name>[a-zA-Z_][\w$]*(?:\.[a-zA-Z_][\w$]*)?)\s*'
    r'(?P<args>\([^;]*?\))'
    r'(?P<between>.*?)\bas\s+(?P<tag>\$[A-Za-z0-9_]*\$)',
    re.IGNORECASE | re.DOTALL,
)


def definitions(sql: str, source: Path):
    for match in HEADER.finditer(sql):
        tag = match.group('tag')
        body_start = match.end()
        body_end = sql.find(tag, body_start)
        if body_end < 0:
            raise SystemExit(f'unclosed body: {source}: {match.group("name")}')
        statement_end = sql.find(';', body_end + len(tag))
        if statement_end < 0:
            raise SystemExit(f'unterminated definition: {source}: {match.group("name")}')
        yield (
            match.group('name').lower(),
            sql[match.start():statement_end + 1].strip(),
            source,
            sql.count('\n', 0, match.start()) + 1,
        )


def main() -> None:
    latest: dict[str, tuple[str, Path, int]] = {}
    for path in sorted(MIGRATIONS.glob('*.sql')):
        sql = path.read_text()
        for name, statement, source, line in definitions(sql, path):
            if name in TARGETS:
                latest[name] = (statement, source, line)

    missing = [name for name in TARGETS if name not in latest]
    if missing:
        raise SystemExit(f'missing target definitions: {missing}')

    parts = [
        '-- GENERATED REVIEW AID ONLY — remove before Contract 104 review.',
        '-- Latest definitions in migration order for the ten measured callers.',
        '',
    ]
    for name in TARGETS:
        statement, source, line = latest[name]
        parts.extend([
            f'-- SOURCE {source}:{line}',
            statement,
            '',
        ])

    OUTPUT.write_text('\n'.join(parts))
    print(f'wrote {len(TARGETS)} exact definitions')


if __name__ == '__main__':
    main()
