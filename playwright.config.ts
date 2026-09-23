import { defineConfig, devices } from '@playwright/test';

// Overridable because `reuseExistingServer` is on locally: with a second
// checkout of the repo (a git worktree) already previewing on 4321, this suite
// would run against that checkout's build and pass or fail on code that is not
// the code under test. `E2E_PORT=4322 npm run test:e2e` keeps the two apart.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    // Mobile first: the primary target is a phone held one-handed, so it runs
    // before the desktop project.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],

  // Tests run against the real static build, not the dev server.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
