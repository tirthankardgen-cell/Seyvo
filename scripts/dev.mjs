import { spawn } from 'node:child_process';
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(process.execPath, ['node_modules/electron-vite/bin/electron-vite.js', 'dev'], {
  stdio: 'inherit',
  env,
});
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
