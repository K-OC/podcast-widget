import { defineConfig, devices } from '@playwright/test';

// Browser tests for the built package (run `npm run test:e2e`, which builds first).
// Pages and assets are served by request interception (see e2e/helpers.ts), so
// there's no web server and no network access. One worker keeps runs light.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
  },
  expect: {
    // Exact match: baselines are per browser and rendered on this machine, so any
    // difference is a real change (small ones matter — e.g. an icon showing through)
    toHaveScreenshot: { animations: 'disabled' },
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', launchOptions: { args: ['--mute-audio'] } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
