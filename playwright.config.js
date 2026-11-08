import { defineConfig, devices } from '@playwright/test';

const chromiumArgs = ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    // Locally the iOS devices run on WebKit. On Linux CI, WebKit lacks reliable WebGL,
    // so the same device profiles (viewport, touch, UA) are emulated on Chromium.
    { name: 'iPhone', use: { ...devices['iPhone 13 landscape'], ...(process.env.CI ? { browserName: 'chromium', launchOptions: { args: chromiumArgs } } : {}) } },
    { name: 'iPad', use: { ...devices['iPad Pro 11 landscape'], ...(process.env.CI ? { browserName: 'chromium', launchOptions: { args: chromiumArgs } } : {}) } },
    { name: 'Android', use: { ...devices['Pixel 7 landscape'], launchOptions: { args: chromiumArgs } } },
  ],
});
