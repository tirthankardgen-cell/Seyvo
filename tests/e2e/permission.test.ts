import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';

test('microphone permission denial stops capture, releases its window and explains recovery', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-denied-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const app = await electron.launch({
    args: [process.cwd(), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.seyvo));
    await app.evaluate(({ session }) => {
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
    });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).phase)
      .toBe('error');
    const status = await page.evaluate(() => window.seyvo.status());
    expect(status.microphoneActive).toBe(false);
    expect(status.message).toContain('Microphone access denied');
    await expect(page.getByRole('alert')).toContainText(status.message);
    await expect
      .poll(async () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().some((w) =>
            w.webContents.getURL().endsWith('recorder.html'),
          ),
        ),
      )
      .toBe(false);
    await expect(page.getByRole('button', { name: 'Test microphone', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect((await page.evaluate(() => window.seyvo.status())).phase).toBe('idle');
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});

test('an unavailable saved microphone is visible and recovers by selecting Windows default', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-device-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const app = await electron.launch({
    args: [process.cwd(), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.seyvo));
    expect(
      (
        await page.evaluate(() =>
          window.seyvo.updateSettings({ deviceId: 'fixture-missing-input' }),
        )
      ).ok,
    ).toBe(true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Microphone', { exact: true })).toHaveValue(
      'fixture-missing-input',
    );
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Microphone unavailable');
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
    await page.getByRole('button', { name: 'Dismiss error', exact: true }).click();
    await page.getByLabel('Microphone', { exact: true }).selectOption('default');
    await expect(page.getByLabel('Microphone', { exact: true })).toHaveValue('default');
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(true);
    await page.getByRole('button', { name: 'Stop microphone', exact: true }).click();
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(false);
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
