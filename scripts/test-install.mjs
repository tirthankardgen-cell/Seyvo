// Destructive only to the disposable .tools/installed application installation.
// The NSIS policy preserves the user profile and encrypted credentials.
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const target = resolve('.tools/installed');
const executable = join(target, 'Seyvo.exe');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const installer = resolve(`dist/Seyvo-${version}-windows-x64-setup.exe`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
async function launch() {
  const processApp = spawn(executable, ['--remote-debugging-port=0'], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const exited = new Promise((done) => processApp.once('exit', done));
  const endpoint = await new Promise((done, fail) => {
    const timer = setTimeout(
      () => fail(new Error('Installed application launch timed out')),
      20000,
    );
    processApp.on('error', fail);
    processApp.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
  });
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page =
    context.pages().find((p) => p.url().includes('index.html') && !p.url().includes('#')) ??
    (await context.waitForEvent('page'));
  await page.waitForFunction(() => Boolean(window.seyvo));
  return {
    page,
    close: async () => {
      await page.evaluate(() => window.seyvo.action('quit')).catch(() => {});
      await browser.close().catch(() => {});
      await exited;
    },
  };
}
async function run(exe, args) {
  const child = spawn(exe, args, { windowsHide: true, stdio: 'ignore' });
  await new Promise((done, fail) => {
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error('Installer operation failed')),
    );
  });
}
const first = await launch();
const initial = await first.page.evaluate(() => window.seyvo.status());
assert.equal(initial.microphoneActive, false);
assert.ok(!initial.recovery, 'Resolve existing recovery first.');
const enabled = await first.page.evaluate(() => window.seyvo.startup(true));
assert.equal(enabled.ok && enabled.value, true);
await first.close();
await run(join(target, 'Uninstall Seyvo.exe'), ['/S']);
let removed = false;
for (let i = 0; i < 100; i++) {
  try {
    await access(executable);
  } catch {
    removed = true;
    break;
  }
  await new Promise((done) => setTimeout(done, 200));
}
assert.equal(removed, true, 'Uninstaller did not remove the disposable application.');
const entry = spawnSync(
  'reg.exe',
  ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'Seyvo'],
  { windowsHide: true, stdio: 'ignore' },
);
assert.equal(entry.status, 1, 'Startup registration survived uninstall.');
await run(installer, ['/S', `/D=${target}`]);
const second = await launch();
try {
  const status = await second.page.evaluate(() => window.seyvo.status());
  assert.equal(status.hasKey, initial.hasKey);
  assert.equal(status.startup, false);
  assert.equal(status.settings.shortcut, initial.settings.shortcut);
  assert.equal(status.nativeAvailable, true);
  if (initial.startup) await second.page.evaluate(() => window.seyvo.startup(true));
  const report = {
    uninstallRemovedExecutable: true,
    uninstallRemovedStartup: true,
    reinstallLaunched: true,
    encryptedKeyPresencePreserved: initial.hasKey,
    settingsPreserved: true,
    nativeAvailable: true,
  };
  await mkdir('artifacts/packaged', { recursive: true });
  await writeFile('artifacts/packaged/install-cycle.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await second.close();
}
