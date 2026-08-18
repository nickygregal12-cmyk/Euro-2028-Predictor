import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('AI Lab Python toolchain', () => {
  it('owns one locked Python 3.12 project with bounded quality tools', () => {
    const project = read('ai/pyproject.toml')

    expect(project).toContain('requires-python = ">=3.12,<3.13"')
    expect(project).toContain('ruff==0.16.3')
    expect(project).toContain('pip-audit==2.10.1')
    expect(project).toContain('pytest-cov==7.1.0')
    expect(project).toContain('hypothesis==6.165.10')
    expect(project).toContain('branch = true')
    expect(project).toContain('fail_under =')
    expect(existsSync(resolve(repositoryRoot, 'ai/uv.lock'))).toBe(true)
  })

  it('installs the exact central uv pin and refuses to resolve around the lock', () => {
    const installer = read('scripts/agent-tools/ai-sync.sh')

    expect(installer).toContain("require('./config/agent-tools.json').uv.version")
    expect(installer).toContain('uv==${uv_version}')
    expect(installer).toContain('uv sync --directory ai --locked')
    expect(installer).toContain('core|test|observability')
  })

  it('gates lint, branch coverage and dependency vulnerabilities in the AI test workflow', () => {
    const workflow = read('.github/workflows/ai-lab-tests.yml')

    expect(workflow).toContain('bash scripts/agent-tools/ai-sync.sh test')
    expect(workflow).toContain('ruff check .')
    expect(workflow).toContain('pytest --cov')
    expect(workflow).toContain('uv export --locked --no-dev')
    expect(workflow).toContain('pip-audit --require-hashes')
    expect(workflow).not.toContain('pip install -r')
  })

  it('makes every hosted AI workflow consume the same lock', () => {
    const workflows = [
      'ai-lab.yml',
      'ai-lab-value-catchup.yml',
      'ai-morning-value-catchup.yml',
      'ai-observability-extras.yml',
      'ai-odds-scheduler-reconcile.yml',
      'ai-selected-auto-activate.yml',
      'ai-selected-challenger-materialize.yml',
    ]

    for (const name of workflows) {
      const workflow = read(`.github/workflows/${name}`)
      expect(workflow, name).toContain('scripts/agent-tools/ai-sync.sh')
      expect(workflow, name).toContain('ai/uv.lock')
      expect(workflow, name).not.toContain('pip install -r')
      expect(workflow, name).not.toContain("pip install 'psycopg")
    }
  })

  it('extends the existing CodeQL scanner to Python instead of adding a second SAST tool', () => {
    const workflow = read('.github/workflows/codeql.yml')

    expect(workflow).toContain('- python')
  })

  it('uses Hypothesis for probability invariants that examples can silently miss', () => {
    const properties = read('ai/test_probability_properties.py')

    expect(properties).toContain('from hypothesis import given')
    expect(properties).toContain('calibration._clean')
    expect(properties).toContain('confidence.probability_uncertainty')
  })
})
