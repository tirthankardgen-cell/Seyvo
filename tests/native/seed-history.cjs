// Encrypt only a synthetic acceptance fixture; never read a real Seyvo profile.
const { app, safeStorage } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const { resolve, basename, dirname, join } = require('node:path');
const profile = resolve(process.argv[2]);
const fixture = resolve(process.argv[3]);
app
  .whenReady()
  .then(async () => {
    if (
      basename(profile) !== 'profile' ||
      !basename(dirname(profile)).startsWith('seyvo-files-') ||
      dirname(fixture) !== dirname(profile) ||
      !(await safeStorage.isAsyncEncryptionAvailable())
    )
      throw new Error('Synthetic encrypted fixture prerequisites failed.');
    const text = await readFile(fixture, 'utf8');
    await writeFile(join(profile, 'history.enc'), await safeStorage.encryptStringAsync(text));
    console.log('Synthetic history encrypted with Windows safeStorage.');
    app.quit();
  })
  .catch(() => {
    console.error('Synthetic history fixture could not be encrypted.');
    app.exit(1);
  });
