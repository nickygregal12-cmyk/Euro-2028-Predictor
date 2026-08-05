from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'docs' / 'quality' / 'feature-baseline.md'
text = path.read_text(encoding='utf-8')
old = '| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes/Supabase; Turnstile and recovery delivery are implemented, while ownership/incident readiness remains operational |'
new = '| `FEAT-001` | Authentication, signup/login, password recovery, moderation and sign-out | Implemented and production-hosted | Auth routes/Supabase and recovery delivery exist; Turnstile integration remains opt-in, the production build does not require its key, and the six-character password floor remains tracked under `ACQ-R09` |'
if text.count(old) != 1:
    raise RuntimeError(f'expected one stale FEAT-001 row, found {text.count(old)}')
text = text.replace(old, new, 1)
if 'Turnstile and recovery delivery are implemented' in text:
    raise RuntimeError('stale Turnstile claim survived')
if 'production build does not require its key' not in text:
    raise RuntimeError('ACQ-R09 boundary missing')
path.write_text(text, encoding='utf-8')
print('Corrected FEAT-001 against the executable ACQ-R09 before-state')
