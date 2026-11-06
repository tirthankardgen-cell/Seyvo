import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../../src/main/storage';
const folders: string[] = [];
const cipher = {
  encrypt: async (s: string) => Buffer.from(Buffer.from(s).map((v) => v ^ 0x5a)),
  decrypt: async (b: Buffer) => Buffer.from(b.map((v) => v ^ 0x5a)).toString(),
};
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'seyvo-test-'));
  folders.push(folder);
  const store = new Storage(folder, cipher);
  await store.initialize();
  return { folder, store };
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});
describe('versioned local storage', () => {
  it('saves and reads encrypted credentials when a redirected Windows profile rejects rename', async () => {
    const { folder, store } = await fixture();
    vi.spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error('cross-device'), { code: 'EXDEV' }),
    );
    await store.saveKey('synthetic-redirected-profile-key');
    expect(await store.key()).toBe('synthetic-redirected-profile-key');
    expect((await readFile(join(folder, 'key.enc'))).toString()).not.toContain('synthetic');
    expect(await readdir(folder)).not.toContain('key.enc.pending');
  });
  it('recovers a committed journal after a failed destination write and removes it with the key', async () => {
    const { folder, store } = await fixture();
    const keyPath = join(folder, 'key.enc');
    vi.spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error('cross-device'), { code: 'EXDEV' }),
    );
    const open = fs.open.bind(fs);
    const fault = vi.spyOn(fs, 'open').mockImplementation((...args: Parameters<typeof fs.open>) => {
      if (args[0] === keyPath)
        return Promise.reject(Object.assign(new Error('interrupted copy'), { code: 'EACCES' }));
      return open(...args);
    });
    await store.saveKey('synthetic-recoverable-key');
    expect(await store.key()).toBe('synthetic-recoverable-key');
    expect((await readFile(keyPath + '.pending')).toString()).not.toContain('synthetic');
    const restarted = new Storage(folder, cipher);
    await restarted.initialize();
    expect(await restarted.key()).toBe('synthetic-recoverable-key');
    fault.mockRestore();
    await restarted.saveKey('synthetic-replacement-key');
    expect(await restarted.key()).toBe('synthetic-replacement-key');
    await restarted.removeKey();
    expect(await restarted.hasKey()).toBe(false);
    expect(await readdir(folder)).not.toContain('key.enc.pending');
  });
  it('ignores an incomplete journal and retains the previous durable value', async () => {
    const { folder, store } = await fixture();
    await store.saveKey('synthetic-previous-key');
    await writeFile(join(folder, 'key.enc.pending'), 'SEYVO-WRITE-1\npartial');
    expect(await store.key()).toBe('synthetic-previous-key');
    await store.removeKey();
    expect(await readdir(folder)).not.toContain('key.enc.pending');
  });
  it('encrypts secrets separately, never includes them in public settings, and removes them', async () => {
    const { folder, store } = await fixture();
    await store.saveKey('test-key-not-real');
    expect((await readFile(join(folder, 'key.enc'))).toString()).not.toContain('test-key');
    expect(await store.key()).toBe('test-key-not-real');
    expect(JSON.stringify(store.settings)).not.toContain('test-key');
    await store.removeKey();
    expect(await store.hasKey()).toBe(false);
  });
  it('preserves corrupted settings and restores defaults', async () => {
    const { folder } = await fixture();
    await writeFile(join(folder, 'settings.json'), '{broken');
    const store = new Storage(folder, cipher);
    await store.initialize();
    expect(store.warning).toContain('Defaults');
    expect(store.settings.historyEnabled).toBe(false);
    expect((await readdir(folder)).some((name) => name.startsWith('settings-invalid-'))).toBe(true);
  });
  it('serializes history changes, applies retention, and deletes storage when disabled', async () => {
    const { folder, store } = await fixture();
    await store.saveSettings({ ...store.settings, historyEnabled: true });
    await Promise.all([
      store.changeHistory((entries) => [
        { id: '1', text: 'hello', timestamp: Date.now() },
        ...entries,
      ]),
      store.changeHistory((entries) => [
        { id: '2', text: 'नमस्ते', timestamp: Date.now() },
        ...entries,
      ]),
    ]);
    expect(await store.history()).toHaveLength(2);
    expect((await readFile(join(folder, 'history.enc'))).toString()).not.toContain('hello');
    await store.saveSettings({ ...store.settings, historyEnabled: false });
    expect(await store.history()).toEqual([]);
    expect(await readdir(folder)).not.toContain('history.enc');
  });
});
