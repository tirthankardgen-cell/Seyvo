import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';

test('Fn remains selectable, a missing event preserves Right Ctrl, and sleep cancels calibration', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-fn-check-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const app = await electron.launch({ args: [process.cwd(), `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.seyvo));
    expect(
      (await page.evaluate(() => window.seyvo.updateSettings({ activation: 'single-key' }))).ok,
    ).toBe(true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(
      page.getByLabel('Single key', { exact: true }).locator('option[value="fn"]'),
    ).toBeEnabled();
    await page.getByLabel('Single key', { exact: true }).selectOption('fn');
    await expect(page.getByRole('status').filter({ hasText: 'Checking Fn:' })).toBeVisible();
    expect((await page.evaluate(() => window.seyvo.action('micTest'))).ok).toBe(false);
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).fnChecking, {
        timeout: 15000,
      })
      .toBe(false);
    const unobserved = await page.evaluate(() => window.seyvo.status());
    expect(unobserved.fnAvailable).toBe(false);
    expect(unobserved.settings.singleKey).toBe('right-control');
    expect(unobserved.singleKeyRegistered).toBe(true);
    expect(unobserved.microphoneActive).toBe(false);
    await expect(
      page.getByText('No usable Fn press and release were detected.', { exact: false }),
    ).toBeVisible();
    const checking = page.evaluate(() => window.seyvo.action('testFn'));
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).fnChecking)
      .toBe(true);
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
    expect((await checking).ok).toBe(false);
    expect((await page.evaluate(() => window.seyvo.status())).nativeAvailable).toBe(true);
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'));
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).singleKeyRegistered)
      .toBe(true);
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
