import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const cache = join(process.cwd(), '.tools', 'builder-cache');
const temporary = join(process.cwd(), '.tools', 'builder-temp');
await mkdir(cache, { recursive: true });
await mkdir(temporary, { recursive: true });
const env = { ...process.env, ELECTRON_BUILDER_CACHE: cache, TEMP: temporary, TMP: temporary };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  process.execPath,
  ['node_modules/electron-builder/out/cli/cli.js', '--win', 'nsis', '--x64'],
  { stdio: 'inherit', env },
);
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
