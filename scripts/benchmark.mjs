import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { quitTestedApp } from './quit-tested-app.mjs';

const execute = promisify(execFile);
const temporaryRoot = await realpath(tmpdir());
const profile = await mkdtemp(join(temporaryRoot, 'seyvo-benchmark-'));
const executable = resolve(process.argv[2] ?? '.tools/installed/Seyvo.exe');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const launchedAt = performance.now();
const child = spawn(executable, ['--remote-debugging-port=0', `--user-data-dir=${profile}`], {
  env,
  windowsHide: false,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let browser, page, launchTimer, failure;
async function sample() {
  const { stdout } = await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('scripts/sample-process.ps1'),
      '-RootProcessId',
      String(child.pid),
    ],
    { windowsHide: true, timeout: 15000 },
  );
  return JSON.parse(stdout);
}
try {
  const endpoint = await new Promise((done, fail) => {
    launchTimer = setTimeout(() => fail(new Error('Benchmark application did not start')), 20000);
    child.once('error', () => fail(new Error('Benchmark launch failed')));
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
  await page.waitForLoadState('load');
  const status = await page.evaluate(() => window.seyvo.status());
  assert.equal(status.hasKey, false, 'Benchmark must use a fresh, key-free profile.');
  assert.equal(status.nativeAvailable, true);
  assert.equal(status.microphoneActive, false);
  const launchToReadyMilliseconds = Math.round(performance.now() - launchedAt);
  // Exercise the normal close-to-tray path; the dashboard remains resident.
  await execute(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('scripts/sample-process.ps1'),
      '-RootProcessId',
      String(child.pid),
      '-CloseToTray',
    ],
    { windowsHide: true, timeout: 10000 },
  );
  await new Promise((done) => setTimeout(done, 3000));
  const before = await sample();
  await new Promise((done) => setTimeout(done, 10000));
  const after = await sample();
  assert.equal(before.visibleMainWindow, false);
  assert.equal(after.visibleMainWindow, false);
  const elapsed = after.timestampMilliseconds - before.timestampMilliseconds;
  const earlierCpu = new Map(
    before.processes.map((process) => [process.id, process.cpuMilliseconds]),
  );
  const cpuMilliseconds = after.processes.reduce(
    (sum, process) =>
      sum + Math.max(0, process.cpuMilliseconds - (earlierCpu.get(process.id) ?? 0)),
    0,
  );
  const total = (field) => after.processes.reduce((sum, process) => sum + process[field], 0);
  assert.equal((await page.evaluate(() => window.seyvo.status())).microphoneActive, false);
  const result = {
    version: status.version,
    buildHash: status.buildHash,
    capturedAt: new Date().toISOString(),
    launchToReadyMilliseconds,
    observedIdleMilliseconds: elapsed,
    idleCpuPercentOfOneCore: Number(((100 * cpuMilliseconds) / elapsed).toFixed(3)),
    idleCpuPercentOfMachine: Number(
      ((100 * cpuMilliseconds) / elapsed / after.logicalProcessors).toFixed(3),
    ),
    logicalProcessors: after.logicalProcessors,
    processCount: after.processes.length,
    processTreeStable:
      before.processes.length === after.processes.length &&
      after.processes.every((process) => earlierCpu.has(process.id)),
    privateCommitMiB: Number((total('privateBytes') / 1048576).toFixed(1)),
    summedWorkingSetMiB: Number((total('workingSetBytes') / 1048576).toFixed(1)),
    externalTcpConnectionsAtSamples: [before.externalTcpConnections, after.externalTcpConnections],
    microphoneActive: false,
    scope:
      'Single packaged run on this workstation, fresh profile, normal close-to-tray with dashboard resident. OS cache may be warm. CDP test connection adds overhead. Working-set sums can double-count shared pages. This is not a clean-machine, cold-boot, battery, or hotkey-latency certification.',
  };
  await quitTestedApp(page, child, browser);
  result.cleanExit = true;
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile('artifacts/performance/packaged.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  failure = error;
  console.error('Benchmark failed:', error.message);
} finally {
  clearTimeout(launchTimer);
  if (child.exitCode === null) {
    const exited = new Promise((done) => child.once('exit', done));
    child.kill();
    await exited;
  }
  await browser?.close().catch(() => {});
  const actualProfile = await realpath(profile);
  assert.equal(dirname(actualProfile).toLowerCase(), temporaryRoot.toLowerCase());
  assert.ok(basename(actualProfile).startsWith('seyvo-benchmark-'));
  await rm(actualProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
if (failure) process.exitCode = 1;
