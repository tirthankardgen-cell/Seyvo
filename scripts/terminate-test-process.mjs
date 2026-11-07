import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** Last-resort cleanup for a process created and still owned by a test. */
export function terminateTestProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0)
    throw new Error('Test process has no valid owned process ID.');
  if (process.platform === 'win32') {
    // Playwright launches Electron through cmd.exe on Windows. Killing just
    // that shell can leave Electron, renderers and the native helper alive.
    const result = spawnSync(
      join(process.env.SystemRoot, 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'],
      { windowsHide: true, stdio: 'ignore', timeout: 5000 },
    );
    if (result.error || result.status !== 0)
      throw new Error('Owned test process tree cleanup did not finish.');
  } else child.kill('SIGKILL');
}
