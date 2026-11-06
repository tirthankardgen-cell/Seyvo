import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const licenses = Object.entries(lock.packages)
  .filter(([path]) => path && !path.startsWith('.'))
  .map(([path, pkg]) => ({
    path,
    name: pkg.name ?? path.split('node_modules/').at(-1),
    version: pkg.version,
    license: pkg.license ?? 'REVIEW REQUIRED',
    development: Boolean(pkg.dev),
    integrity: pkg.integrity,
  }));
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/licenses.json', JSON.stringify(licenses, null, 2) + '\n');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['sbom', '--sbom-format', 'cyclonedx', '--omit=dev'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (result.status !== 0)
  throw new Error('SBOM generation failed. Run npm sbom to inspect the dependency tree.');
await writeFile('artifacts/sbom.cdx.json', result.stdout);
console.log(
  `Generated inventory for ${licenses.length} locked packages and runtime CycloneDX SBOM.`,
);
const review = licenses.filter(
  (entry) =>
    !entry.development &&
    !/^(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC|0BSD|\(MIT OR Apache-2\.0\))$/.test(
      entry.license,
    ),
);
if (review.length)
  console.log(
    'Runtime licenses requiring explicit review:',
    review.map((entry) => `${entry.name}: ${entry.license}`).join(', '),
  );
