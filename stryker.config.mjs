export default {
  // Keep this deliberately narrow: these are pure, decision-bearing scoring
  // authorities with direct unit/property coverage. Mutating React, adapters
  // or database-parity fixtures would make this a slow duplicate of other
  // gates rather than a test-strength check.
  mutate: [
    'src/domain/tournament/calculateScore.ts',
    'src/domain/tournament/scoringConfig.ts',
    'src/domain/season/standings.ts',
  ],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  // TypeScript 7's native compiler package no longer exposes the legacy
  // tsconfig parser Stryker's sandbox rewriter calls. In-place mode skips that
  // rewrite while Stryker still snapshots and restores the three target files.
  inPlace: true,
  disableTypeChecks: 'src/**/*.{ts,tsx}',
  reporters: ['progress', 'clear-text', 'html'],
  concurrency: 2,
  tempDirName: '.stryker-tmp',
  thresholds: {
    high: 90,
    low: 85,
    // 18 August 2026 measured baseline: 90.58% (297 killed, 1 timeout,
    // 29 survived, 2 uncovered). Keep a small tool/runtime tolerance while
    // refusing a material score regression.
    break: 90,
  },
}
