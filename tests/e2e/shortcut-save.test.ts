import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';

test('shortcut capture confirms persisted saves and keeps the active binding after a conflict', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-shortcut-save-'));
  await writeFile(join(profile, 'settings.json'), JSON.stringify({ version: 1, paused: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const args = [process.cwd(), `--user-data-dir=${profile}`];
  let app = await electron.launch({ args, env });
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: '3 Shortcut', exact: true }).click();
    const capture = async (combo: string) => {
      await page.getByLabel('Dictation shortcut', { exact: true }).click();
      await page.getByLabel('Dictation shortcut', { exact: true }).press(combo);
    };
    await capture('Control+Alt+Space');
    await expect(page.getByTestId('shortcut-status')).toContainText('Unsaved change');
    await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
    await expect(page.getByTestId('shortcut-status')).toContainText('Shortcut saved.');
    await expect(page.getByTestId('shortcut-status')).toContainText(
      'Saved shortcut (paused): Ctrl+Alt+Space',
    );
    await expect(page.getByRole('button', { name: 'Save shortcut', exact: true })).toBeDisabled();
    expect(JSON.parse(await readFile(join(profile, 'settings.json'), 'utf8')).shortcut).toBe(
      'Control+Alt+Space',
    );
    await capture('A');
    await expect(page.getByRole('button', { name: 'Save shortcut', exact: true })).toBeDisabled();
    await capture('F6');
    await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
    await expect(page.getByTestId('shortcut-status')).toContainText('Shortcut saved.');
    await expect(page.getByTestId('shortcut-status')).toContainText('Saved shortcut (paused): F6');
    await expect(page.getByRole('button', { name: 'Save shortcut', exact: true })).toBeDisabled();
    const resumed = await page.evaluate(() => window.seyvo.updateSettings({ paused: false }));
    expect(resumed.ok, resumed.ok ? '' : resumed.error).toBe(true);
    await expect(page.getByTestId('shortcut-status')).toContainText('Active shortcut: F6');
    // F12 may already be reserved by Windows. Otherwise occupy it in this
    // fixture; either case must refuse the rebind without losing F6.
    await app.evaluate(({ globalShortcut }) => globalShortcut.register('F12', () => {}));
    await capture('F12');
    await page.getByRole('button', { name: 'Save shortcut', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('already in use');
    await expect(page.getByTestId('shortcut-status')).toContainText('Active shortcut: F6');
    expect(JSON.parse(await readFile(join(profile, 'settings.json'), 'utf8')).shortcut).toBe('F6');
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('F6'))).toBe(
      true,
    );
    await quitApp(app);
    app = await electron.launch({ args, env });
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByTestId('shortcut-status')).toContainText('Active shortcut: F6');
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
    await page.getByLabel('Activation method', { exact: true }).selectOption('single-key');
    await expect(page.getByTestId('shortcut-status')).toContainText('Right Ctrl');
    await page.getByLabel('Single-key behavior', { exact: true }).selectOption('toggle');
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).settings.singleKeyMode)
      .toBe('toggle');
    await quitApp(app);
    app = await electron.launch({ args, env });
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Activation method', { exact: true })).toHaveValue('single-key');
    await expect(page.getByLabel('Single-key behavior', { exact: true })).toHaveValue('toggle');
    expect((await page.evaluate(() => window.seyvo.status())).singleKeyRegistered).toBe(true);
    await page.getByLabel('Activation method', { exact: true }).selectOption('shortcut');
    await expect(page.getByTestId('shortcut-status')).toContainText('Active shortcut: F6');
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
