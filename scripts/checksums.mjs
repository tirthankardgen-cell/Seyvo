import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const files = (await readdir('dist')).filter(
  (name) => name === `Seyvo-${version}-windows-x64-setup.exe`,
);
if (!files.length) throw new Error('No installer exists. Run npm run dist:win first.');
const sums = await Promise.all(
  files.map(
    async (name) =>
      `${createHash('sha256')
        .update(await readFile(`dist/${name}`))
        .digest('hex')}  ${name}`,
  ),
);
await writeFile('dist/SHA256SUMS.txt', sums.join('\n') + '\n');
console.log(sums.join('\n'));
