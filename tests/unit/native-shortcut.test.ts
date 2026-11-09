import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it.skipIf(process.platform !== 'win32')(
  'real Windows key-state polling recovers a lost release without generating a press',
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'seyvo-key-release-'));
    const exe = join(directory, 'ShortcutRelease.exe');
    try {
      const compiled = spawnSync(
        join(process.env.WINDIR!, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
        [
          '/nologo',
          '/target:exe',
          '/platform:x64',
          '/reference:System.Windows.Forms.dll',
          `/out:${exe}`,
          resolve('native-win/ShortcutListener.cs'),
          resolve('native-win/FnProbe.cs'),
          resolve('tests/native/ShortcutRelease.cs'),
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 },
      );
      expect(compiled.status, compiled.stdout).toBe(0);
      const result = spawnSync(exe, [], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Lost release recovered once');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  30000,
);
