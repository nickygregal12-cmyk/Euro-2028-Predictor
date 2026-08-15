export default {
  mutate: ['src/domain/tournament/calculateScore.ts'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  reporters: ['progress', 'clear-text', 'html'],
  concurrency: 2,
  tempDirName: '.stryker-tmp',
  thresholds: {
    high: 85,
    low: 70,
    break: 60,
  },
}
