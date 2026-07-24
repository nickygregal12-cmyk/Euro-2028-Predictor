#!/usr/bin/env bash

# Euro 2028 Predictor — create a production logical-backup bundle
#
# This script is intentionally fail-closed. It does not link a project, apply a
# migration, change data or upload files. It requires an explicit production DB
# URL and writes a restricted plaintext staging bundle OUTSIDE the repository.
# The bundle is not qualifying recovery evidence until it is encrypted, copied
# off the working machine and successfully restored to a disposable target.

set -Eeuo pipefail
umask 077

readonly EXPECTED_PROJECT_REF="vkfnsqdyhvtwyqkisxhk"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
readonly INVENTORY_SQL="${SCRIPT_DIR}/production-backup-inventory.sql"
readonly MANAGED_CUSTOMIZATIONS_SQL="${SCRIPT_DIR}/managed-schema-customizations.sql"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_file() {
  [[ -f "$1" ]] || fail "Required repository file not found: $1"
}

require_command supabase
require_command psql
require_command git
require_command python3
require_command docker
require_file "${INVENTORY_SQL}"
require_file "${MANAGED_CUSTOMIZATIONS_SQL}"

[[ -n "${PRODUCTION_DB_URL:-}" ]] || fail \
  'Set PRODUCTION_DB_URL to the verified production Postgres connection string.'
[[ -n "${BACKUP_ROOT:-}" ]] || fail \
  'Set BACKUP_ROOT to a secure directory outside this repository.'
[[ "${CONFIRM_PRODUCTION_PROJECT_REF:-}" == "${EXPECTED_PROJECT_REF}" ]] || fail \
  "Set CONFIRM_PRODUCTION_PROJECT_REF=${EXPECTED_PROJECT_REF} to acknowledge the target."

case "${PRODUCTION_DB_URL}" in
  *"${EXPECTED_PROJECT_REF}"*) ;;
  *) fail "PRODUCTION_DB_URL does not contain expected project ref ${EXPECTED_PROJECT_REF}." ;;
esac

[[ -z "$(git -C "${REPO_ROOT}" status --porcelain)" ]] || fail \
  'Repository working tree must be clean so backup provenance is reproducible.'

mkdir -p "${BACKUP_ROOT}"
readonly BACKUP_ROOT_ABS="$(cd "${BACKUP_ROOT}" && pwd -P)"

case "${BACKUP_ROOT_ABS}/" in
  "${REPO_ROOT}/"*) fail 'BACKUP_ROOT must be outside the repository.' ;;
esac

[[ ! -L "${BACKUP_ROOT_ABS}" ]] || fail 'BACKUP_ROOT must not be a symbolic link.'

docker info >/dev/null 2>&1 || fail 'Docker must be running for Supabase CLI dump/diff commands.'

readonly CAPTURED_AT="$(date -u +'%Y%m%dT%H%M%SZ')"
readonly BUNDLE_NAME="euro28-prod-${CAPTURED_AT}"
readonly FINAL_DIR="${BACKUP_ROOT_ABS}/${BUNDLE_NAME}"
readonly TEMP_DIR="$(mktemp -d "${BACKUP_ROOT_ABS}/.${BUNDLE_NAME}.XXXXXX")"
readonly REPO_COMMIT="$(git -C "${REPO_ROOT}" rev-parse HEAD)"

cleanup() {
  local exit_code=$?
  if [[ ${exit_code} -ne 0 && -d "${TEMP_DIR}" ]]; then
    rm -rf "${TEMP_DIR}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

[[ ! -e "${FINAL_DIR}" ]] || fail "Backup bundle already exists: ${FINAL_DIR}"

mkdir -p "${TEMP_DIR}/verification"
chmod 700 "${TEMP_DIR}" "${TEMP_DIR}/verification"

printf '%s\n' "${REPO_COMMIT}" > "${TEMP_DIR}/repository-commit.txt"
printf '%s\n' "${EXPECTED_PROJECT_REF}" > "${TEMP_DIR}/project-ref.txt"
git -C "${REPO_ROOT}" ls-files 'supabase/migrations/*.sql' | sort \
  > "${TEMP_DIR}/migration-files.txt"

supabase --version > "${TEMP_DIR}/supabase-cli-version.txt"
psql --version > "${TEMP_DIR}/psql-version.txt"
docker --version > "${TEMP_DIR}/docker-version.txt"

printf 'Capturing read-only source inventory...\n'
psql "${PRODUCTION_DB_URL}" \
  -X \
  -v ON_ERROR_STOP=1 \
  -A \
  -t \
  -f "${INVENTORY_SQL}" \
  > "${TEMP_DIR}/database-state.json"

[[ -s "${TEMP_DIR}/database-state.json" ]] || fail 'Source inventory was empty.'

grep -q "${EXPECTED_PROJECT_REF}" "${TEMP_DIR}/project-ref.txt" || fail \
  'Project reference evidence was not written correctly.'

printf 'Dumping database roles...\n'
supabase db dump \
  --db-url "${PRODUCTION_DB_URL}" \
  --file "${TEMP_DIR}/roles.sql" \
  --role-only

printf 'Dumping database schema...\n'
supabase db dump \
  --db-url "${PRODUCTION_DB_URL}" \
  --file "${TEMP_DIR}/schema.sql"

printf 'Dumping database data with COPY statements...\n'
supabase db dump \
  --db-url "${PRODUCTION_DB_URL}" \
  --file "${TEMP_DIR}/data.sql" \
  --use-copy \
  --data-only \
  -x storage.buckets_vectors \
  -x storage.vector_indexes

for required_dump in roles.sql schema.sql data.sql; do
  [[ -s "${TEMP_DIR}/${required_dump}" ]] || fail "Dump is empty: ${required_dump}"
done

# The production project has Auth users. A qualifying data dump must visibly
# contain the auth.users COPY/INSERT statement; otherwise stop for manual review.
if ! grep -Eq '(COPY|INSERT INTO)[[:space:]]+"?auth"?\."?users"?' "${TEMP_DIR}/data.sql"; then
  fail 'data.sql does not contain auth.users. Do not treat this as a complete backup.'
fi

if ! grep -Eq '(COPY|INSERT INTO)[[:space:]]+"?public"?\."?profiles"?' "${TEMP_DIR}/data.sql"; then
  fail 'data.sql does not contain public.profiles. Do not treat this as a complete backup.'
fi

printf 'Capturing managed Auth/Storage schema drift evidence...\n'
(
  cd "${REPO_ROOT}"
  supabase db diff \
    --db-url "${PRODUCTION_DB_URL}" \
    --schema auth,storage \
    > "${TEMP_DIR}/auth-storage-diff.sql"
)

cp "${MANAGED_CUSTOMIZATIONS_SQL}" \
  "${TEMP_DIR}/managed-schema-customizations.sql"

# Retain the exact verification scripts associated with this repository commit.
cp "${REPO_ROOT}/scripts/database-rollout/production-baseline-1-20-verification.sql" \
  "${TEMP_DIR}/verification/"
cp "${REPO_ROOT}/scripts/database-rollout/production-preflight.sql" \
  "${TEMP_DIR}/verification/"
cp "${REPO_ROOT}/scripts/database-rollout/post-rollout-verification.sql" \
  "${TEMP_DIR}/verification/"

python3 - "${TEMP_DIR}" "${CAPTURED_AT}" "${REPO_COMMIT}" <<'PY'
import hashlib
import json
import pathlib
import sys

bundle = pathlib.Path(sys.argv[1])
captured_at = sys.argv[2]
commit = sys.argv[3]

state_path = bundle / "database-state.json"
try:
    state = json.loads(state_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    raise SystemExit(f"database-state.json is not valid JSON: {exc}")

manifest = {
    "bundle_format": 1,
    "captured_at_utc": captured_at,
    "project_ref": "vkfnsqdyhvtwyqkisxhk",
    "repository_commit": commit,
    "plaintext_contains_sensitive_auth_data": True,
    "qualifying_recovery_evidence": False,
    "qualification_requirements": [
        "encrypt the bundle",
        "copy it off the working machine",
        "record custody and retention",
        "restore it to a disposable Supabase-compatible target",
        "verify Auth signup trigger and critical application data",
    ],
    "database_state": state,
}
(bundle / "manifest.json").write_text(
    json.dumps(manifest, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)

lines: list[str] = []
for path in sorted(p for p in bundle.rglob("*") if p.is_file() and p.name != "SHA256SUMS"):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(bundle).as_posix()}")
(bundle / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

find "${TEMP_DIR}" -type d -exec chmod 700 {} +
find "${TEMP_DIR}" -type f -exec chmod 600 {} +

mv "${TEMP_DIR}" "${FINAL_DIR}"
trap - EXIT

cat <<EOF
Backup staging bundle created:
  ${FINAL_DIR}

This directory contains sensitive Auth data and is NOT yet qualifying recovery
evidence. Encrypt it, copy it off this machine, record its SHA256SUMS and
successfully restore it to a disposable Supabase-compatible target before any
production migration window can be approved.
EOF
