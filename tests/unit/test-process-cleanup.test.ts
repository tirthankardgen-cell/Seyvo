import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import type { ElectronApplication } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { terminateTestProcess } from '../../scripts/terminate-test-process.mjs';
import { quitApp } from '../e2e/helpers';

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('owned test process cleanup', () => {
  it.skipIf(process.platform !== 'win32')(
    'terminates an owned Windows process tree while preserving a separate process',
    async () => {
      // Self-expiry bounds the disposable descendant even if the assertion fails.
      const lifetime = 'setTimeout(() => process.exit(0), 20000);';
      const parentCode = `
        const { spawn } = require('node:child_process');
        const child = spawn(process.execPath, ['--eval', ${JSON.stringify('process.send(process.pid);' + lifetime)}],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        child.once('message', pid => process.stdout.write(String(pid) + '\\n'));
        ${lifetime}
      `;
      const parent = spawn(process.execPath, ['--eval', parentCode], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const unrelated = spawn(process.execPath, ['--eval', lifetime], {
        windowsHide: true,
        stdio: 'ignore',
      });
      const lines = createInterface({ input: parent.stdout! });
      try {
        const [line] = await once(lines, 'line');
        const descendant = Number(line);
        expect(Number.isSafeInteger(descendant) && descendant > 0).toBe(true);
        expect(alive(descendant)).toBe(true);
        terminateTestProcess(parent);
        await expect.poll(() => parent.exitCode, { timeout: 5000 }).not.toBeNull();
        await expect.poll(() => alive(descendant), { timeout: 5000 }).toBe(false);
        expect(unrelated.exitCode).toBeNull();
        expect(alive(unrelated.pid!)).toBe(true);
      } finally {
        lines.close();
        terminateTestProcess(parent);
        terminateTestProcess(unrelated);
        await Promise.all([parent, unrelated].map(waitForExit));
      }
    },
    15000,
  );

  it('rejects a tested app that already exited unsuccessfully', async () => {
    const child = spawn(process.execPath, ['--eval', 'process.exit(7)'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    await once(child, 'exit');
    const app = { process: () => child } as unknown as ElectronApplication;
    await expect(quitApp(app)).rejects.toThrow('must not exit with an error');
  });
});

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
}
