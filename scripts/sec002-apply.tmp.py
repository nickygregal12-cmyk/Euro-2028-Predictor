from pathlib import Path

IMPORT = "import { userFacingError } from '../../shared/errors/userFacingError'\n"

replacements = {
    'src/app/providers/PredictionsProvider.tsx': [
        ("return { ok: false, message: e instanceof Error ? e.message : 'Submission failed.' }", "return { ok: false, message: userFacingError(e, 'Submission failed. Please try again.') }"),
    ],
    'src/app/providers/TournamentDataProvider.tsx': [
        ("message: err instanceof Error ? err.message : 'Failed to load',", "message: userFacingError(err, 'Could not load tournament data. Please try again.'),"),
    ],
    'src/features/matches/MatchCentrePage.tsx': [
        ("setSaidError((err as { message?: string })?.message ?? 'Could not load predictions.')", "setSaidError(userFacingError(err, 'Could not load predictions. Please try again.'))"),
    ],
    'src/features/leagues/JoinLandingPage.tsx': [
        ("message: e instanceof Error ? e.message : 'Could not load the invite.',", "message: userFacingError(e, 'Could not load the invite. Please try again.'),"),
        ("message: e instanceof Error ? e.message : 'Could not join the league.',", "message: userFacingError(e, 'Could not join the league. Please try again.'),"),
    ],
    'src/features/leagues/CreateLeagueModal.tsx': [
        ("setError(e instanceof Error ? e.message : 'Could not create the league. Try again.')", "setError(userFacingError(e, 'Could not create the league. Try again.'))"),
    ],
    'src/features/leagues/JoinLeagueModal.tsx': [
        ("setError(e instanceof Error ? e.message : 'Could not look up that code.')", "setError(userFacingError(e, 'Could not look up that code. Please try again.'))"),
        ("setError(e instanceof Error ? e.message : 'Could not join the league.')", "setError(userFacingError(e, 'Could not join the league. Please try again.'))"),
    ],
    'src/features/leagues/TransferOwnershipModal.tsx': [
        ("setError(e instanceof Error ? e.message : 'Could not transfer ownership.')", "setError(userFacingError(e, 'Could not transfer ownership. Please try again.'))"),
    ],
    'src/features/leagues/LeagueDetailPage.tsx': [
        ("message: e instanceof Error ? e.message : 'Failed to load the league.',", "message: userFacingError(e, 'Could not load the league. Please try again.'),"),
        ("setActionError(e instanceof Error ? e.message : 'Could not leave the league.')", "setActionError(userFacingError(e, 'Could not leave the league. Please try again.'))"),
        ("setActionError(e instanceof Error ? e.message : 'Could not delete the league.')", "setActionError(userFacingError(e, 'Could not delete the league. Please try again.'))"),
    ],
    'src/features/home/useHomeData.ts': [
        ("message: e instanceof Error ? e.message : 'Failed to load your dashboard.',", "message: userFacingError(e, 'Could not load your dashboard. Please try again.'),"),
    ],
    'src/features/profile/ProfilePage.tsx': [
        ("message: e instanceof Error ? e.message : 'Failed to load your profile.',", "message: userFacingError(e, 'Could not load your profile. Please try again.'),"),
    ],
    'src/features/h2h/H2HPage.tsx': [
        ("message: e instanceof Error ? e.message : 'Head-to-head is unavailable.',", "message: userFacingError(e, 'Head-to-head is unavailable. Please try again.'),"),
    ],
    'src/features/league/OverallStandingsPage.tsx': [
        ("message: e instanceof Error ? e.message : 'Failed to load standings.',", "message: userFacingError(e, 'Could not load standings. Please try again.'),"),
    ],
    'src/features/league/LeaguePage.tsx': [
        ("message: e instanceof Error ? e.message : 'Failed to load standings.',", "message: userFacingError(e, 'Could not load standings. Please try again.'),"),
    ],
}

for path_text, edits in replacements.items():
    path = Path(path_text)
    text = path.read_text()
    changed = False
    for old, new in edits:
        if old not in text:
            raise SystemExit(f'missing expected SEC-002 surface in {path}: {old}')
        text = text.replace(old, new)
        changed = True
    if changed and 'userFacingError' not in text.split('\n', 20)[0:20]:
        text = IMPORT + text
    path.write_text(text)

# No temporary inventory mechanism may remain in the review diff.
for temporary in [
    Path('.github/workflows/sec002-inventory.yml'),
    Path('docs/sec002-inventory.tmp.md'),
    Path('docs/sec002-inventory-trigger.tmp'),
    Path('scripts/sec002-apply.tmp.py'),
]:
    if temporary.exists():
        temporary.unlink()
