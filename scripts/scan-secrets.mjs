import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { listPackage, extractFile } from '@electron/asar';
const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
});
if (git.status) throw new Error('Cannot enumerate repository files.');
const patterns = [
  /AIza[A-Za-z0-9_-]{30,}/,
  /AQ\.[A-Za-z0-9_-]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
];
const findings = [];
function scan(name, bytes) {
  if (patterns.some((pattern) => pattern.test(bytes.toString('utf8')))) findings.push(name);
}
for (const name of git.stdout.split('\0').filter(Boolean)) {
  if (['.png', '.ico', '.jpg', '.gif'].includes(extname(name))) continue;
  scan(name, await readFile(name));
}
const archive = process.argv[2];
if (archive) {
  for (const name of listPackage(archive)) {
    if (!/[/\\]out[/\\].*\.(js|html|css)$/.test(name)) continue;
    scan(`app.asar:${name}`, extractFile(archive, normalize(name.replace(/^[/\\]+/, ''))));
  }
}
if (findings.length) {
  console.error(
    'Potential credentials found in these files (values deliberately omitted):\n' +
      findings.join('\n'),
  );
  process.exitCode = 1;
} else
  console.log(
    'No credential patterns found in publishable repository files' +
      (archive ? ' or bundled application code.' : '.'),
  );
