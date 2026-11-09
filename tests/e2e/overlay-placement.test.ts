import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';

test('custom placement persists, caret preview falls back safely, and preview never starts a microphone', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-placement-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const args = [process.cwd(), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream'];
  let app = await electron.launch({ args, env });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Bubble placement', { exact: true }).selectOption('custom');
    const horizontal = page.getByLabel('Horizontal position (%)', { exact: true });
    await horizontal.fill('100');
    await horizontal.press('Tab');
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).settings.overlayCustomX)
      .toBe(100);
    const vertical = page.getByLabel('Vertical position (%)', { exact: true });
    await vertical.fill('0');
    await vertical.press('Tab');
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).settings.overlayCustomY)
      .toBe(0);
    await page.getByRole('button', { name: 'Preview bubble', exact: true }).click();
    const geometry = () =>
      app.evaluate(({ BrowserWindow, screen }) => {
        const overlay = BrowserWindow.getAllWindows().find((window) =>
          window.webContents.getURL().includes('#overlay'),
        );
        if (!overlay) return null;
        const bounds = overlay.getBounds();
        return {
          bounds,
          area: screen.getDisplayMatching(bounds).workArea,
          visible: overlay.isVisible(),
          focusable: overlay.isFocusable(),
          recorder: BrowserWindow.getAllWindows().some((window) =>
            window.webContents.getURL().endsWith('recorder.html'),
          ),
        };
      });
    await expect.poll(async () => (await geometry())?.visible).toBe(true);
    const custom = (await geometry())!;
    expect(custom.bounds.x + custom.bounds.width).toBe(custom.area.x + custom.area.width - 20);
    expect(custom.bounds.y).toBe(custom.area.y + 20);
    expect(custom.focusable).toBe(false);
    expect(custom.recorder).toBe(true); // Preloaded page, without microphone permission.
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
    const overlayPage = app.windows().find((candidate) => candidate.url().includes('#overlay'))!;
    for (const theme of ['light', 'dark', 'system'] as const) {
      await page.evaluate((theme) => window.seyvo.updateSettings({ theme }), theme);
      await expect(overlayPage.locator('html')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(overlayPage.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    const alpha = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().includes('#overlay'),
      )!;
      const image = await window.webContents.capturePage();
      const bitmap = image.toBitmap();
      return { corner: bitmap[3], nonempty: bitmap.some((value, i) => i % 4 === 3 && value > 0) };
    });
    expect(alpha).toEqual({ corner: 0, nonempty: true });
    await page.getByLabel('Bubble placement', { exact: true }).selectOption('caret');
    await page.getByRole('button', { name: 'Preview bubble', exact: true }).click();
    const fallback = (await geometry())!;
    expect(fallback.bounds.x).toBe(
      Math.round(fallback.area.x + (fallback.area.width - fallback.bounds.width) / 2),
    );
    expect(fallback.bounds.y + fallback.bounds.height).toBe(
      fallback.area.y + fallback.area.height - 20,
    );
    await page.evaluate(() => window.seyvo.action('micTest'));
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(true);
    expect((await page.evaluate(() => window.seyvo.action('previewOverlay'))).ok).toBe(false);
    // A preview expiry must never hide a newer active recording overlay.
    await page.waitForTimeout(3300);
    expect((await geometry())?.visible).toBe(true);
    await page.evaluate(() => window.seyvo.action('micStop'));
    await page.evaluate(() => window.seyvo.action('micTest'));
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('#overlay'))!
        .webContents.forcefullyCrashRenderer();
    });
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(false);
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).phase)
      .toBe('error');
    await page.evaluate(() => window.seyvo.action('micTest'));
    await expect.poll(async () => (await geometry())?.visible).toBe(true);
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(true);
    await page.evaluate(() => window.seyvo.action('micStop'));
    await quitApp(app);
    app = await electron.launch({ args, env });
    const reopened = await app.firstWindow();
    await reopened.waitForFunction(() => Boolean(window.seyvo));
    const status = await reopened.evaluate(() => window.seyvo.status());
    expect(status.settings).toMatchObject({
      overlayPosition: 'caret',
      overlayCustomX: 100,
      overlayCustomY: 0,
    });
    expect(status.microphoneActive).toBe(false);
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
