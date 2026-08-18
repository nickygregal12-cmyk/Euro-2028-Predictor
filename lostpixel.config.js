export const config = {
  storybookShots: {
    storybookUrl: './storybook-static',
  },
  // The managed Lost Pixel product is being sunset. Keep the OSS engine as an
  // optional reviewer/exporter only; Playwright visual contracts remain the
  // repository's blocking, reviewed baseline authority.
  generateOnly: true,
  failOnDifference: false,
}
