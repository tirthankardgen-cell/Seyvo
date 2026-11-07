import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { quitTestedApp } from './quit-tested-app.mjs';

// Requires an interactive English-language Windows desktop. Uses a new key-free,
// paused profile and native file dialogs. Never touches the desktop clipboard.
const execute = promisify(execFile);
const executable = resolve(process.argv[2] ?? '.tools/installed/Seyvo.exe');
await access(executable);
await mkdir('.tools', { recursive: true });
await mkdir('artifacts/file-dialogs', { recursive: true });
const root = await mkdtemp(resolve('.tools/seyvo-files-'));
const profile = join(root, 'profile');
await mkdir(profile);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const terms = ['Seyvo', 'नमस्ते', 'বাংলা 🌍'];
const now = Date.now();
const history = [
  { id: 'synthetic-english', text: 'Synthetic history acceptance.', timestamp: now },
  {
    id: 'synthetic-multilingual',
    text: 'नमस्ते বাংলা 🌍\nSecond synthetic line.',
    timestamp: now - 1000,
  },
  { id: 'synthetic-expired', text: 'Expired synthetic entry.', timestamp: now - 10 * 86400000 },
];
await writeFile(join(root, 'history-fixture.json'), JSON.stringify(history));
await writeFile(
  join(profile, 'settings.json'),
  JSON.stringify({
    version: 1,
    paused: true,
    onboardingComplete: true,
    historyEnabled: true,
    historyDays: 7,
    dictionary: terms,
  }),
);
// Chromium's Windows encryption context belongs to this isolated profile.
// Seed and read with the same user-data directory, never the user's real one.
await execute(
  resolve('node_modules/electron/dist/electron.exe'),
  [
    resolve('tests/native/seed-history.cjs'),
    profile,
    join(root, 'history-fixture.json'),
    `--user-data-dir=${profile}`,
  ],
  { env, windowsHide: true, timeout: 15000 },
);
const encrypted = await readFile(join(profile, 'history.enc'));
assert.ok(!encrypted.includes(Buffer.from(history[0].text)));
assert.ok(!encrypted.includes(Buffer.from(history[0].text, 'utf16le')));
await writeFile(
  join(root, 'import.json'),
  JSON.stringify(['  Seyvo  ', 'नमस्ते', 'বাংলা 🌍', 'Seyvo']),
);
await writeFile(join(root, 'invalid.json'), JSON.stringify({ wrong: 'shape' }));
await writeFile(join(root, 'malformed.json'), '{not valid JSON');
await writeFile(join(root, 'oversized.json'), ' '.repeat(256001));
const child = spawn(executable, ['--remote-debugging-port=0', `--user-data-dir=${profile}`], {
  env,
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let browser, page, launchTimer;
const report = {
  completed: false,
  timestamp: new Date().toISOString(),
  version: '',
  buildHash: '',
  clipboardUsed: false,
  microphoneUsed: false,
  cases: [],
};
function passed(name) {
  report.cases.push(name);
  console.log(`PASS: ${name}`);
}
async function dialog(action, file) {
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('tests/native/file-dialog.ps1'),
      '-AppProcessId',
      String(child.pid),
      '-Action',
      action,
      ...(file ? ['-FixtureRoot', root, '-FilePath', join(root, file)] : []),
    ],
    { windowsHide: true, timeout: 15000 },
  );
}
async function dictionaryAction(action, file) {
  await page
    .getByRole('button', { name: action === 'import' ? 'Import JSON' : 'Export JSON', exact: true })
    .click();
  await dialog(file ? (action === 'import' ? 'open' : 'save') : 'cancel', file);
  await expect(page.getByRole('button', { name: 'Import JSON', exact: true })).toBeEnabled();
}
try {
  const endpoint = await new Promise((done, fail) => {
    launchTimer = setTimeout(() => fail(new Error('Installed file test did not start')), 20000);
    child.once('error', () => fail(new Error('Installed file test launch failed')));
    child.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(launchTimer);
        done(match[1]);
      }
    });
  });
  browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  page =
    context
      .pages()
      .find(
        (candidate) => candidate.url().includes('index.html') && !candidate.url().includes('#'),
      ) ?? (await context.waitForEvent('page'));
  await page.waitForFunction(() => Boolean(window.seyvo));
  const status = await page.evaluate(() => window.seyvo.status());
  assert.equal(status.hasKey, false, 'Must use a new profile without the user key.');
  assert.equal(status.settings.paused, true);
  assert.equal(status.microphoneActive, false);
  report.version = status.version;
  report.buildHash = status.buildHash;
  await page.getByRole('button', { name: 'Dictionary', exact: true }).click();
  await dictionaryAction('export', 'dictionary-नमस्ते.json');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'dictionary-नमस्ते.json'), 'utf8')), terms);
  passed('native dictionary export preserves Unicode and a Unicode filename');
  const cleared = await page.evaluate(() => window.seyvo.updateSettings({ dictionary: [] }));
  assert.equal(cleared.ok, true);
  await dictionaryAction('import', 'import.json');
  assert.deepEqual((await page.evaluate(() => window.seyvo.status())).settings.dictionary, terms);
  passed('native dictionary import trims and deduplicates Unicode terms');
  for (const file of ['invalid.json', 'malformed.json', 'oversized.json']) {
    await dictionaryAction('import', file);
    await expect(page.locator('[role="alert"]')).toBeVisible();
    assert.deepEqual((await page.evaluate(() => window.seyvo.status())).settings.dictionary, terms);
    passed(`${file} is rejected without changing the existing dictionary`);
  }
  await dictionaryAction('import');
  assert.deepEqual((await page.evaluate(() => window.seyvo.status())).settings.dictionary, terms);
  await dictionaryAction('export');
  passed('native import/export cancellation preserves settings');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-entry')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search history' }).fill('বাংলা');
  await expect(page.locator('.history-entry')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search history' }).fill('');
  passed('Windows-encrypted synthetic history loads, filters expired entries and searches Unicode');
  await page.getByRole('button', { name: 'Export unencrypted JSON' }).click();
  await dialog('save', 'history-नमस्ते.json');
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await readFile(join(root, 'history-नमस्ते.json'), 'utf8'));
      } catch {
        return undefined;
      }
    })
    .toEqual(history.slice(0, 2));
  passed('native history export preserves exact multiline Unicode and omits expired entries');
  await page
    .locator('.history-entry')
    .first()
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.locator('.history-entry')).toHaveCount(1);
  passed('history delete removes the chosen entry');
  page.once('dialog', (prompt) => prompt.accept());
  await page.getByRole('button', { name: 'Clear all history' }).click();
  await expect(page.locator('.history-entry')).toHaveCount(0);
  await assert.rejects(access(join(profile, 'history.enc')), { code: 'ENOENT' });
  passed('confirmed history clear removes encrypted storage');
  assert.equal((await page.evaluate(() => window.seyvo.status())).microphoneActive, false);
  await quitTestedApp(page, child, browser);
  passed('isolated installed test exits cleanly with no microphone or clipboard use');
  report.completed = true;
} finally {
  clearTimeout(launchTimer);
  if (child.exitCode === null) {
    await dialog('cancel').catch(() => {});
    if (page && browser) await quitTestedApp(page, child, browser).catch(() => {});
    if (child.exitCode === null) child.kill();
  }
  await browser?.close().catch(() => {});
  await writeFile('artifacts/file-dialogs/results.json', JSON.stringify(report, null, 2));
}
