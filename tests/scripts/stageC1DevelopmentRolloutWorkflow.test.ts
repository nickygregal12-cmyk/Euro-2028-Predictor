import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/stage-c1-development-rollout.yml'),
  'utf8',
)
const productionBackup = readFileSync(
  resolve(repositoryRoot, '.github/workflows/production-backup.yml'),
  'utf8',
)
const backupScript = readFileSync(
  resolve(repositoryRoot, 'scripts/ops/create-verified-supabase-backup.mjs'),
  'utf8',
)
const evidenceLibraryPath = resolve(
  repositoryRoot,
  'scripts/ops/stage-c1-evidence-lib.mjs',
)

describe('Stage C1 development rollout workflow', () => {
  it('is workflow_dispatch only and refuses non-main refs', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+push:/m)
    expect(workflow).not.toMatch(/^\s+pull_request:/m)
    expect(workflow).not.toMatch(/^\s+schedule:/m)
    expect(workflow).toContain("[ \"${GITHUB_REF}\" = 'refs/heads/main' ]")
    expect(workflow).toContain('git rev-parse origin/main')
    expect(workflow).toContain('checked-out HEAD is not exact origin/main')
  })

  it('uses only the development database URL secret and explicitly refuses production', () => {
    expect(workflow).toContain('secrets.SUPABASE_DEV_DB_URL')
    expect(workflow).not.toContain('secrets.SUPABASE_PROD_DB_URL')
    expect(workflow).toContain('PRODUCTION_PROJECT_REF: vkfnsqdyhvtwyqkisxhk')
    expect(workflow).toContain('raw.includes(production)')
    expect(workflow).not.toMatch(/echo[^\n]*\$\{?SUPABASE_DEV_DB_URL/)
    expect(workflow).not.toMatch(/printf[^\n]*\$\{?SUPABASE_DEV_DB_URL/)
  })

  it('reuses the owner public recipient and never requests an age private key', () => {
    expect(workflow).toContain('secrets.BACKUP_AGE_PUBLIC_KEY')
    expect(workflow).not.toMatch(/AGE_PRIVATE|PRIVATE_AGE|age-secret-key/i)
    expect(productionBackup).toContain('secrets.BACKUP_AGE_PUBLIC_KEY')
  })

  it('separates prepare and apply dispatch modes', () => {
    expect(workflow).toMatch(/options:\n\s+- prepare\n\s+- apply/)
    expect(workflow).toContain("if: inputs.mode == 'prepare'")
    expect(workflow).toContain("if: inputs.mode == 'apply'")
    expect(workflow).toContain('APPLY-CONTRACT-65-TO-iouzoutneyjpugbbtdem')
  })

  it('prepares, restore-rehearses, encrypts, cleans, then uploads', () => {
    const preflightAt = workflow.indexOf('Prepare — run canonical hosted preflight')
    const backupAt = workflow.indexOf(
      'Prepare — restore-rehearse, encrypt, and clean the development backup',
    )
    const dryRunAt = workflow.indexOf('Prepare — dry run the one canonical migration')
    const uploadAt = workflow.indexOf('Prepare — upload encrypted backup')

    expect(preflightAt).toBeGreaterThan(-1)
    expect(preflightAt).toBeLessThan(backupAt)
    expect(backupAt).toBeLessThan(dryRunAt)
    expect(dryRunAt).toBeLessThan(uploadAt)
    expect(backupScript.indexOf('assertEquivalentBeforeState(source')).toBeLessThan(
      backupScript.indexOf("run(age, ['-r'"),
    )
    expect(backupScript.indexOf("run(age, ['-r'")).toBeLessThan(
      backupScript.indexOf('secureRemove(bundle'),
    )
  })

  it('uploads only age backup files plus non-sensitive evidence for seven days', () => {
    expect(workflow).toMatch(
      /name: stage-c1-development-backup-\$\{\{ github\.run_id \}\}[\s\S]*?path: .*\/\*\.backup\.tar\.gz\.age/,
    )
    expect(workflow).toContain("! -name '*.backup.tar.gz.age'")
    expect(workflow).toContain('refusing artifact upload')
    expect(workflow.match(/retention-days: 7/g)?.length).toBe(3)
    expect(workflow).not.toMatch(/path: .*\.(?:sql|tar|dump)(?:\s|$)/m)
  })

  it('requires a successful same-main preparation run and exact commit', () => {
    expect(workflow).toContain("run.conclusion === 'success'")
    expect(workflow).toContain("run.head_branch === 'main'")
    expect(workflow).toContain('run.head_sha === process.env.GITHUB_SHA')
    expect(workflow).toContain(
      "run.path === '.github/workflows/stage-c1-development-rollout.yml'",
    )
    expect(workflow).toMatch(/actions\/download-artifact@[0-9a-f]{40}/)
    expect(workflow).toContain('manifest.repository_commit === process.env.GITHUB_SHA')
  })

  it('dry-runs exactly Stage C1 before applying it once, then runs postflight', () => {
    const dryRunAt = workflow.indexOf('Apply — rerun the one-migration dry run')
    const applyAt = workflow.indexOf('Apply — push contract 65 once to development')
    const postflightAt = workflow.indexOf('Apply — run canonical Stage C1 postflight')

    expect(workflow).toContain('supabase db push --db-url "${SUPABASE_DEV_DB_URL}" --dry-run')
    expect(workflow).toContain(
      '20260730235602_stage_c1_competition_season_foundation.sql',
    )
    expect(workflow).toContain('migrations.length !== 1')
    expect(dryRunAt).toBeGreaterThan(-1)
    expect(dryRunAt).toBeLessThan(applyAt)
    expect(applyAt).toBeLessThan(postflightAt)
    expect(workflow.match(/supabase db push --db-url "\$\{SUPABASE_DEV_DB_URL\}"(?! --dry-run)/g)).toHaveLength(1)
  })

  it('contains no production deployment or Netlify write', () => {
    expect(workflow).not.toMatch(/(?:npx\s+)?netlify\s+(?:deploy|env:|env:set|env:import)/i)
    expect(workflow).not.toContain('EURO28_DEPLOYED_DB_CONTRACT')
    expect(workflow).not.toMatch(/deploy --prod|production deploy/i)
    expect(workflow).not.toContain('SUPABASE_PROD_DB_URL')
  })
})

describe('Stage C1 explicit database URL mode', () => {
  const libraryUrl = pathToFileURL(evidenceLibraryPath).href

  it('accepts only a PostgreSQL URL whose identity proves development', () => {
    const program = `
      import { databaseTargetArguments } from ${JSON.stringify(libraryUrl)};
      const args = databaseTargetArguments('iouzoutneyjpugbbtdem');
      if (args[0] !== '--db-url' || args.length !== 2) process.exit(2);
    `
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
        env: {
          ...process.env,
          STAGE_C1_TARGET_MODE: 'db-url',
          SUPABASE_DEV_DB_URL:
            'postgresql://postgres.iouzoutneyjpugbbtdem:password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
        },
      }),
    ).not.toThrow()
  })

  it('fails closed for production, an unproved target, or a missing URL', () => {
    for (const databaseUrl of [
      'postgresql://postgres.vkfnsqdyhvtwyqkisxhk:password@aws-0-eu-west-2.pooler.supabase.com/postgres',
      'postgresql://postgres:password@example.com/postgres?label=iouzoutneyjpugbbtdem',
      '',
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `import { databaseTargetArguments } from ${JSON.stringify(libraryUrl)}; databaseTargetArguments('iouzoutneyjpugbbtdem')`,
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            STAGE_C1_TARGET_MODE: 'db-url',
            SUPABASE_DEV_DB_URL: databaseUrl,
          },
        },
      )
      expect(result.status).toBe(1)
      if (databaseUrl) expect(result.stderr).not.toContain(databaseUrl)
    }
  })
})
