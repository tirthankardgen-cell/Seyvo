import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';

const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
  ),
) as Record<string, string>;

for (const scale of [1, 1.25, 1.5, 2]) {
  test(`settings, overlay and zoom at emulated ${scale * 100}% scaling`, async () => {
    const profile = await mkdtemp(join(tmpdir(), 'seyvo-layout-'));
    const args = [
      process.cwd(),
      `--user-data-dir=${profile}`,
      `--force-device-scale-factor=${scale}`,
      '--use-fake-device-for-media-stream',
    ];
    let app = await electron.launch({ args, env });
    try {
      const page = await app.firstWindow();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByLabel('Bubble size', { exact: true }).selectOption('large');
      await expect(page.getByLabel('Bubble size', { exact: true })).toHaveValue('large');
      await page.getByLabel('Sound cues', { exact: true }).click();
      await expect(page.getByLabel('Sound cues', { exact: true })).toBeChecked();
      await page.getByRole('button', { name: 'Preview sound cue', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.getByRole('button', { name: 'Dictionary', exact: true }).click();
      await page.getByLabel('Coding vocabulary', { exact: true }).click();
      await expect(page.getByLabel('Coding vocabulary', { exact: true })).toBeChecked();
      await page.getByLabel('Add a word or phrase').fill('OriginalTerm');
      await page.getByRole('button', { name: 'Add word', exact: true }).click();
      await page.getByRole('button', { name: 'Edit OriginalTerm', exact: true }).click();
      await page.getByLabel('Edit word or phrase').fill('EditedTerm');
      await page.getByRole('button', { name: 'Save word', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Edit EditedTerm', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'About', exact: true }).click();
      await expect(page.getByTestId('build-hash')).toHaveText(/^[a-f0-9]{12}(?:-modified)?$/);
      await app.evaluate(({ BrowserWindow }) => {
        const dashboard = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('index.html'),
        )!;
        dashboard.setSize(760, 580);
        dashboard.webContents.setZoomFactor(2);
      });
      for (const name of ['Home', 'Settings', 'Dictionary', 'History', 'About']) {
        await page.getByRole('button', { name, exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        ).toBe(true);
      }
      // Capture the native surface; page zoom changes Playwright's screenshot clip.
      const png = await app.evaluate(async ({ BrowserWindow }) => {
        const dashboard = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('index.html'),
        )!;
        return (await dashboard.webContents.capturePage()).toPNG().toString('base64');
      });
      await writeFile(
        `artifacts/screenshots/about-scale-${scale}-zoom-2.png`,
        Buffer.from(png, 'base64'),
      );
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('index.html'))!
          .webContents.setZoomFactor(1);
      });
      // Fake capture tests the real recorder lifecycle without uploading audio.
      await page.evaluate(() =>
        window.seyvo.updateSettings({ captions: true, overlaySize: 'large' }),
      );
      await page.evaluate(() => window.seyvo.action('micTest'));
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(true);
      const overlay = app.windows().find((p) => p.url().includes('#overlay'))!;
      await page.evaluate(() => window.seyvo.action('micStop'));
      // Only display data is synthetic; no production path invents transcripts.
      // Stop live level broadcasts before injecting the static caption fixture.
      const state = await page.evaluate(() => window.seyvo.status());
      await app.evaluate(({ BrowserWindow }, state) => {
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('#overlay'))!
          .webContents.send('app:state', { ...state, interim: 'Synthetic caption layout check.' });
      }, state);
      await expect(overlay.locator('.caption')).toBeVisible();
      const caption = await overlay.locator('.caption').boundingBox();
      expect(caption!.y).toBeGreaterThanOrEqual(0);
      expect(caption!.y + caption!.height).toBeLessThan(await overlay.evaluate(() => innerHeight));
      const bounds = await app.evaluate(({ BrowserWindow, screen }) => {
        const window = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes('#overlay'),
        )!;
        const bounds = window.getBounds();
        return {
          bounds,
          area: screen.getDisplayMatching(bounds).workArea,
          focusable: window.isFocusable(),
        };
      });
      expect(bounds.focusable).toBe(false);
      expect(bounds.bounds.x).toBeGreaterThanOrEqual(bounds.area.x);
      expect(bounds.bounds.y).toBeGreaterThanOrEqual(bounds.area.y);
      expect(bounds.bounds.y + bounds.bounds.height).toBeLessThanOrEqual(
        bounds.area.y + bounds.area.height,
      );
      await quitApp(app);
      app = await electron.launch({ args, env });
      const reopened = await app.firstWindow();
      await reopened.waitForFunction(() => Boolean(window.seyvo));
      const persisted = await reopened.evaluate(() => window.seyvo.status());
      expect(persisted.settings).toMatchObject({
        soundCues: true,
        codingVocabulary: true,
        overlaySize: 'large',
        dictionary: ['EditedTerm'],
      });
      expect(persisted.microphoneActive).toBe(false);
    } finally {
      await quitApp(app);
      await rm(profile, { recursive: true, force: true });
    }
  });
}

test('recorder crash, suspend and screen lock release capture; close hides to tray', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-lifecycle-'));
  const app = await electron.launch({
    args: [process.cwd(), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.seyvo));
    for (const event of ['suspend', 'lock-screen', 'crash'] as const) {
      await page.evaluate(() => window.seyvo.action('micTest'));
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(true);
      await app.evaluate(({ powerMonitor, BrowserWindow }, event) => {
        if (event === 'crash')
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('recorder.html'))!
            .webContents.forcefullyCrashRenderer();
        else powerMonitor.emit(event);
      }, event);
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(false);
      await expect
        .poll(async () =>
          app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().some((w) =>
              w.webContents.getURL().endsWith('recorder.html'),
            ),
          ),
        )
        .toBe(false);
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('index.html'))!
        .close(),
    );
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('index.html'))!
          .isVisible(),
      ),
    ).toBe(false);
    const executable = await app.evaluate(() => process.execPath);
    const second = spawn(executable, [process.cwd(), `--user-data-dir=${profile}`], {
      env,
      windowsHide: true,
      stdio: 'ignore',
    });
    await new Promise<void>((resolve, reject) => {
      second.once('error', reject);
      second.once('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Second instance failed to hand off.')),
      );
    });
    await expect
      .poll(async () =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('index.html'))!
            .isVisible(),
        ),
      )
      .toBe(true);
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
