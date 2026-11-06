import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { getCurrentFuseWire, FuseV1Options, FuseState } from '@electron/fuses';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('artifacts/packaged', { recursive: true });
const executable = resolve(process.argv[2] ?? '.tools/installed/Seyvo.exe');
const fuses = await getCurrentFuseWire(executable);
for (const fuse of [
  FuseV1Options.RunAsNode,
  FuseV1Options.EnableNodeOptionsEnvironmentVariable,
  FuseV1Options.EnableNodeCliInspectArguments,
])
  assert.equal(fuses[fuse], FuseState.DISABLE);
for (const fuse of [
  FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
  FuseV1Options.OnlyLoadAppFromAsar,
])
  assert.equal(fuses[fuse], FuseState.ENABLE);
const profile = resolve('.tools/packaged-profile');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_RENDERER_URL = 'https://untrusted.invalid'; // Packaged builds must ignore dev overrides.
const processApp = spawn(executable, ['--remote-debugging-port=0', `--user-data-dir=${profile}`], {
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const endpoint = await new Promise((resolveEndpoint, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Packaged app did not expose test debugging endpoint')),
    20000,
  );
  processApp.on('error', reject);
  processApp.stderr.on('data', (chunk) => {
    const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) {
      clearTimeout(timer);
      resolveEndpoint(match[1]);
    }
  });
});
let browser;
try {
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  let page = context
    .pages()
    .find((p) => p.url().includes('index.html') && !p.url().includes('#overlay'));
  if (!page) page = await context.waitForEvent('page');
  await page.waitForFunction(() => Boolean(window.seyvo));
  assert.ok(
    page.url().startsWith('file:'),
    'Packaged app must ignore the development URL override.',
  );
  const status = await page.evaluate(() => window.seyvo.status());
  assert.equal(status.startupAvailable, true);
  assert.equal(status.nativeAvailable, true);
  assert.equal(status.microphoneActive, false);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await page.screenshot({ path: 'artifacts/packaged/installed-onboarding.png' });
  const enabled = await page.evaluate(() => window.seyvo.startup(true));
  assert.equal(enabled.ok && enabled.value, true);
  const disabled = await page.evaluate(() => window.seyvo.startup(false));
  assert.equal(disabled.ok && disabled.value, false);
  const mic = await page.evaluate(() => window.seyvo.action('micTest'));
  assert.equal(mic.ok, true);
  await expect
    .poll(async () => (await page.evaluate(() => window.seyvo.status())).phase)
    .toMatch(/listening|error/);
  const recording = await page.evaluate(() => window.seyvo.status());
  let deviceSelection = 'not exercised; microphone unavailable';
  if (recording.microphoneActive) {
    await expect
      .poll(async () =>
        (await page.evaluate(() => window.seyvo.status())).microphones.some(
          (device) => device.deviceId !== 'default',
        ),
      )
      .toBe(true);
    const discovered = (await page.evaluate(() => window.seyvo.status())).microphones;
    await page.evaluate(() => window.seyvo.action('micStop'));
    const deviceId = discovered.find((device) => device.deviceId !== 'default').deviceId;
    assert.equal(
      (await page.evaluate((deviceId) => window.seyvo.updateSettings({ deviceId }), deviceId)).ok,
      true,
    );
    assert.equal((await page.evaluate(() => window.seyvo.action('micTest'))).ok, true);
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(true);
    await page.evaluate(() => window.seyvo.action('micStop'));
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
      .toBe(false);
    assert.equal(
      (await page.evaluate(() => window.seyvo.updateSettings({ deviceId: 'default' }))).ok,
      true,
    );
    deviceSelection = 'discovered input selected, opened and stopped';
  }
  const result = {
    version: status.version,
    buildHash: status.buildHash,
    nativeAvailable: status.nativeAvailable,
    startupRoundtrip: true,
    rendererNodeDisabled: true,
    localMicrophone: recording.microphoneActive ? 'hardware opened and stopped' : recording.message,
    deviceSelection,
    productionFuses: 'verified',
    developmentUrlIgnored: true,
    liveGoogle:
      'This smoke test does not contact Google; opt-in live results are recorded separately.',
    executable,
  };
  await writeFile('artifacts/packaged/results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await page.evaluate(() => window.seyvo.action('quit')).catch(() => {});
} finally {
  await browser?.close().catch(() => {});
  if (!processApp.killed) processApp.kill();
}
