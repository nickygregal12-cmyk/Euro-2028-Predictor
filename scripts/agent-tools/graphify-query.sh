#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/agent-tools/graphify-query.sh [options] query "QUESTION" [Graphify options]
  bash scripts/agent-tools/graphify-query.sh [options] path "NODE A" "NODE B"
  bash scripts/agent-tools/graphify-query.sh [options] explain "NODE"
  bash scripts/agent-tools/graphify-query.sh [options] affected "NODE OR FILE" [Graphify options]
  bash scripts/agent-tools/graphify-query.sh [options] god-nodes [Graphify options]

Options:
  --graph PATH       Use a downloaded PR graph or another local graph.json.
  --source-sha SHA   Assert which source commit a local graph represents.
  --allow-stale      Deliberately allow an older ancestor graph when indexed inputs changed.
  --no-fetch         Use the existing local remote-tracking snapshot without fetching.
  -h, --help         Show this help.

The default reads the portable snapshot from origin/graphify-navigation and
verifies the fingerprint of Graphify's indexed inputs against origin/main. An
unrelated commit therefore does not make a still-current graph unusable. Older
snapshots without a fingerprint retain the former exact-SHA safety check.

Routine query output defaults to 1200 tokens. Pass --budget N explicitly when a
larger traversal is justified. The structural query path uses no model or
provider credentials.
EOF
}

fail() {
  printf 'Graphify query: %s\n' "$*" >&2
  exit 1
}

repository_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  fail 'run this command from a Git checkout'
cd "${repository_root}"

snapshot_ref='origin/graphify-navigation'
main_ref='origin/main'
graph_path=''
declared_source_sha=''
declared_input_fingerprint=''
allow_stale='false'
fetch_snapshot='true'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --graph)
      [ "$#" -ge 2 ] || fail '--graph requires a path'
      graph_path="$2"
      shift 2
      ;;
    --source-sha)
      [ "$#" -ge 2 ] || fail '--source-sha requires a commit SHA'
      declared_source_sha="$2"
      shift 2
      ;;
    --allow-stale)
      allow_stale='true'
      shift
      ;;
    --no-fetch)
      fetch_snapshot='false'
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

[ "$#" -gt 0 ] || {
  usage >&2
  exit 2
}

subcommand="$1"
shift
case "${subcommand}" in
  query|explain|affected)
    [ "$#" -ge 1 ] || fail "${subcommand} requires a question, node or file"
    ;;
  path)
    [ "$#" -ge 2 ] || fail 'path requires two nodes'
    ;;
  god-nodes)
    ;;
  *)
    fail "unsupported command '${subcommand}'; use query, path, explain, affected or god-nodes"
    ;;
esac

if [ -z "${graph_path}" ]; then
  if [ "${fetch_snapshot}" = 'true' ]; then
    if ! git fetch --quiet origin \
      refs/heads/main:refs/remotes/origin/main \
      refs/heads/graphify-navigation:refs/remotes/origin/graphify-navigation; then
      printf '%s\n' \
        'Graphify query: fetch failed; checking the existing remote-tracking snapshot.' >&2
    fi
  fi

  git rev-parse --verify "${snapshot_ref}^{commit}" >/dev/null 2>&1 ||
    fail "${snapshot_ref} is unavailable; fetch it or pass --graph PATH"
  git rev-parse --verify "${main_ref}^{commit}" >/dev/null 2>&1 ||
    fail "${main_ref} is unavailable; fetch it or pass --graph PATH --source-sha SHA"

  snapshot_readme="$(git show "${snapshot_ref}:README.md")" ||
    fail "${snapshot_ref}:README.md is missing"
  declared_source_sha="$({
    printf '%s\n' "${snapshot_readme}" |
      sed -nE 's/.*@([0-9a-f]{40}).*/\1/p'
  } | head -n 1)"
  [[ "${declared_source_sha}" =~ ^[0-9a-f]{40}$ ]] ||
    fail 'the snapshot README does not contain an exact 40-character source SHA'

  declared_input_fingerprint="$({
    printf '%s\n' "${snapshot_readme}" |
      sed -nE 's/.*Input fingerprint: `?(sha256:[0-9a-f]{64})`?.*/\1/p'
  } | head -n 1)"

  main_sha="$(git rev-parse "${main_ref}^{commit}")"
  if [ -n "${declared_input_fingerprint}" ]; then
    current_input_fingerprint="$(
      node scripts/agent-tools/graphify-input-fingerprint.mjs --ref "${main_ref}"
    )" || fail "could not fingerprint Graphify inputs at ${main_ref}"

    if [ "${declared_input_fingerprint}" != "${current_input_fingerprint}" ]; then
      if [ "${allow_stale}" != 'true' ]; then
        fail "snapshot inputs ${declared_input_fingerprint} differ from ${main_ref} inputs ${current_input_fingerprint}; wait for the refresh, pass a PR artifact with --graph, or explicitly use --allow-stale"
      fi
      git merge-base --is-ancestor "${declared_source_sha}" "${main_sha}" ||
        fail "snapshot ${declared_source_sha} is not an ancestor of ${main_ref} ${main_sha}"
      printf 'Graphify query: warning: indexed inputs changed since snapshot %s (main is %s).\n' \
        "${declared_source_sha}" "${main_sha}" >&2
    elif [ "${declared_source_sha}" != "${main_sha}" ]; then
      printf 'Graphify query: graph inputs are current; snapshot source %s differs from main %s only outside the indexed input set.\n' \
        "${declared_source_sha}" "${main_sha}" >&2
    fi
    printf 'Graph input fingerprint: %s\n' "${declared_input_fingerprint}" >&2
  elif [ "${declared_source_sha}" != "${main_sha}" ]; then
    # Compatibility with snapshots published before input fingerprints existed.
    if [ "${allow_stale}" != 'true' ]; then
      fail "snapshot ${declared_source_sha} predates input fingerprints and does not match ${main_ref} ${main_sha}; wait for the refresh, pass a PR artifact with --graph, or explicitly use --allow-stale"
    fi
    git merge-base --is-ancestor "${declared_source_sha}" "${main_sha}" ||
      fail "snapshot ${declared_source_sha} is not an ancestor of ${main_ref} ${main_sha}"
    printf 'Graphify query: warning: using pre-fingerprint ancestor snapshot %s (main is %s).\n' \
      "${declared_source_sha}" "${main_sha}" >&2
  fi

  artifact_dir='.artifacts/graphify'
  mkdir -p "${artifact_dir}"
  graph_path="${artifact_dir}/graph.json"
  git show "${snapshot_ref}:graph.json" > "${graph_path}" ||
    fail "${snapshot_ref}:graph.json is missing"
elif [ ! -f "${graph_path}" ]; then
  fail "graph file not found: ${graph_path}"
fi

if [ -n "${declared_source_sha}" ]; then
  git cat-file -e "${declared_source_sha}^{commit}" 2>/dev/null ||
    fail "declared graph source is not a local commit: ${declared_source_sha}"
  printf 'Graph source: %s\n' "${declared_source_sha}" >&2
else
  printf '%s\n' \
    'Graphify query: local graph has no source assertion; record its artifact SHA in the PR.' >&2
fi

node - "${graph_path}" <<'NODE'
const { readFileSync } = require('node:fs')

const graphPath = process.argv[2]
let graph
try {
  graph = JSON.parse(readFileSync(graphPath, 'utf8'))
} catch (error) {
  console.error(`Graphify query: invalid graph JSON at ${graphPath}: ${error.message}`)
  process.exit(1)
}

const size = (value) =>
  Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0
const nodes = size(graph.nodes)
const edges = size(graph.edges)
if (nodes === 0 || edges === 0) {
  console.error(`Graphify query: refusing vacuous graph (${nodes} nodes, ${edges} edges)`)
  process.exit(1)
}
console.error(`Graphify graph: ${nodes} nodes, ${edges} edges (${graphPath})`)
NODE

graphify_version="$(node -p "require('./config/agent-tools.json').graphify.version")"
[ -n "${graphify_version}" ] || fail 'config/agent-tools.json has no Graphify version'

graphify_runner=()
if command -v graphify >/dev/null 2>&1; then
  graphify_executable="$(command -v graphify)"
  resolved_executable="$(readlink -f "${graphify_executable}")"
  graphify_python="$(dirname "${resolved_executable}")/python"
  installed_version=''
  if [ -x "${graphify_python}" ]; then
    installed_version="$(${graphify_python} -c \
      "from importlib.metadata import version; print(version('graphifyy'))" 2>/dev/null || true)"
  fi
  if [ "${installed_version}" = "${graphify_version}" ]; then
    graphify_runner=("${graphify_executable}")
  fi
fi

if [ "${#graphify_runner[@]}" -eq 0 ]; then
  command -v uvx >/dev/null 2>&1 ||
    fail "Graphify ${graphify_version} is not installed and uvx is unavailable; run scripts/agent-tools/bootstrap.sh"
  graphify_runner=(uvx --from "graphifyy[sql]==${graphify_version}" graphify)
fi

graphify_args=("$@")
if [ "${subcommand}" = 'query' ]; then
  has_budget='false'
  for arg in "${graphify_args[@]}"; do
    case "${arg}" in
      --budget|--budget=*)
        has_budget='true'
        break
        ;;
    esac
  done
  if [ "${has_budget}" = 'false' ]; then
    graphify_args+=(--budget "${GRAPHIFY_QUERY_BUDGET:-1200}")
  fi
fi

exec "${graphify_runner[@]}" "${subcommand}" "${graphify_args[@]}" --graph "${graph_path}"
