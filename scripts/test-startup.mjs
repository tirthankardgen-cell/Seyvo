// Packaged Windows lifecycle acceptance; changes and restores the real login item.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { quitTestedApp } from './quit-tested-app.mjs';

const executable = resolve(process.argv[2] ?? 'dist/win-unpacked/Seyvo.exe');
await mkdir('.tools', { recursive: true });
const profile = await mkdtemp(resolve('.tools/startup-'));
await writeFile(
  join(profile, 'settings.json'),
  JSON.stringify({ onboardingComplete: true, paused: true }),
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
let child, browser, page, original;
async function launch(startup = false) {
  child = spawn(
    executable,
    ['--remote-debugging-port=0', `--user-data-dir=${profile}`, ...(startup ? ['--startup'] : [])],
    { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const endpoint = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('Startup endpoint timed out')), 20000);
    child.once('error', () => {
      clearTimeout(timer);
      fail(new Error('Could not launch packaged app'));
    });
    child.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
  });
  browser = await chromium.connectOverCDP(endpoint);
  if (!startup) await dashboard();
}
async function dashboard() {
  const context = browser.contexts()[0];
  page =
    context.pages().find((p) => p.url().endsWith('index.html')) ??
    (await context.waitForEvent('page'));
  await page.waitForFunction(() => Boolean(window.seyvo));
  const status = await page.evaluate(() => window.seyvo.status());
  assert.equal(status.microphoneActive, false);
  assert.equal(status.startupAvailable, true);
  return status;
}
async function close() {
  await quitTestedApp(page, child, browser);
  page = undefined;
  browser = undefined;
  child = undefined;
}
async function change(enabled) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByLabel('Launch when I sign in', { exact: true });
  await toggle.setChecked(enabled);
  await expect
    .poll(async () => (await page.evaluate(() => window.seyvo.status())).startup)
    .toBe(enabled);
  await expect(toggle).toBeChecked({ checked: enabled });
}
try {
  await launch();
  const first = await dashboard();
  original = first.startup;
  // Ensure both writes are exercised regardless of the user's initial setting.
  await change(false);
  await change(true);
  await close();
  await launch();
  assert.equal((await dashboard()).startup, true);
  await change(false);
  await close();
  await launch();
  assert.equal((await dashboard()).startup, false);
  await change(true);
  await close();
  await launch(true);
  await new Promise((done) => setTimeout(done, 1500));
  assert.equal(
    browser.contexts()[0].pages().length,
    0,
    'Sign-in launch must stay in the tray after onboarding.',
  );
  const second = spawn(executable, [`--user-data-dir=${profile}`], {
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  await expect.poll(() => second.exitCode, { timeout: 10000 }).toBe(0);
  const restarted = await dashboard();
  assert.equal(restarted.startup, true);
  assert.equal(child.exitCode, null, 'Second launch must reuse the running instance.');
  const result = await page.evaluate((initial) => window.seyvo.startup(initial), original);
  assert.equal(result.ok && result.value, original);
  await close();
  await mkdir('artifacts/startup', { recursive: true });
  const report = {
    version: first.version,
    buildHash: first.buildHash,
    enabledSurvivesRestart: true,
    disabledSurvivesRestart: true,
    signInLaunchStaysInTray: true,
    secondLaunchReusesInstance: true,
    microphoneOff: true,
    originalStartupRestored: true,
    cleanExit: true,
  };
  await writeFile('artifacts/startup/results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (page && child?.exitCode === null) {
    if (original !== undefined)
      await page.evaluate((initial) => window.seyvo.startup(initial), original).catch(() => {});
    await close().catch(() => {});
  }
  if (child?.exitCode === null) child.kill();
  await browser?.close().catch(() => {});
}
