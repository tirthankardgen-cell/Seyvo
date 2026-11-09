import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { settingsSchema, type Settings, type HistoryEntry } from '../shared/contracts';
import { AppError } from '../shared/errors';
import { fnBindingSchema, type FnBinding } from './fn-key';

export interface Cipher {
  encrypt(text: string): Promise<Buffer>;
  decrypt(data: Buffer): Promise<string>;
}
const journalPrefix = 'SEYVO-WRITE-1\n';
function journal(data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(journalPrefix + createHash('sha256').update(data).digest('hex') + '\n'),
    data,
  ]);
}
function unjournal(bytes?: Buffer): Buffer | undefined {
  if (!bytes) return undefined;
  const offset = journalPrefix.length + 65;
  if (
    bytes.length < offset ||
    !bytes.subarray(0, journalPrefix.length).equals(Buffer.from(journalPrefix))
  )
    return undefined;
  const data = bytes.subarray(offset);
  return bytes.subarray(journalPrefix.length, offset).toString() ===
    createHash('sha256').update(data).digest('hex') + '\n'
    ? data
    : undefined;
}
async function durableWrite(path: string, data: string | Buffer): Promise<void> {
  const file = await fs.open(path, 'w', 0o600);
  try {
    await file.writeFile(data);
    await file.sync();
  } finally {
    await file.close();
  }
}
export async function atomicWrite(path: string, data: string | Buffer): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  const pending = `${path}.pending`;
  // Finish a previously committed journal before replacing it. Readers prefer a
  // complete checksummed journal, so a interrupted destination copy is recoverable.
  const previous = unjournal(await readFileOptional(pending));
  if (previous) await durableWrite(path, previous);
  await fs.rm(pending, { force: true });
  try {
    await durableWrite(temp, data);
    try {
      await fs.rename(temp, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      // Some redirected Windows profiles reject even same-directory rename.
      // Commit a durable journal before copying; key/history bytes are already encrypted.
      await durableWrite(pending, journal(Buffer.isBuffer(data) ? data : Buffer.from(data)));
      try {
        await durableWrite(path, data);
        await fs.rm(pending, { force: true });
      } catch {
        /* The committed journal remains the authoritative readable value. */
      }
    }
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
async function readFileOptional(path: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
async function readOptional(path: string): Promise<Buffer | undefined> {
  return unjournal(await readFileOptional(`${path}.pending`)) ?? readFileOptional(path);
}
async function removeStored(path: string): Promise<void> {
  await fs.rm(path, { force: true });
  await fs.rm(`${path}.pending`, { force: true });
}
export class Storage {
  async fnBinding(): Promise<FnBinding | undefined> {
    try {
      const bytes = await readOptional(join(this.directory, 'fn-key.json'));
      if (!bytes || bytes.length > 1024) return undefined;
      return fnBindingSchema.parse(JSON.parse(bytes.toString()));
    } catch {
      return undefined;
    }
  }
  async saveFnBinding(binding: FnBinding): Promise<void> {
    await atomicWrite(
      join(this.directory, 'fn-key.json'),
      JSON.stringify(fnBindingSchema.parse(binding)),
    );
  }
  settings = settingsSchema.parse({});
  warning = '';
  private writes = Promise.resolve();
  constructor(
    readonly directory: string,
    private cipher: Cipher,
  ) {}
  async initialize(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const raw = await readOptional(join(this.directory, 'settings.json'));
    if (!raw) return;
    try {
      this.settings = settingsSchema.parse(JSON.parse(raw.toString()));
    } catch {
      await atomicWrite(join(this.directory, `settings-invalid-${Date.now()}.json`), raw);
      await removeStored(join(this.directory, 'settings.json'));
      this.warning =
        'Settings were unreadable. Defaults restored; the original file was kept for recovery.';
    }
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.writes.then(operation);
    this.writes = task.then(
      () => {},
      () => {},
    );
    return task;
  }
  saveSettings(settings: Settings): Promise<void> {
    return this.serialize(async () => {
      const valid = settingsSchema.parse(settings);
      await atomicWrite(join(this.directory, 'settings.json'), JSON.stringify(valid, null, 2));
      this.settings = valid;
      try {
        if (!valid.historyEnabled) await removeStored(join(this.directory, 'history.enc'));
        else {
          const entries = await this.history();
          await atomicWrite(
            join(this.directory, 'history.enc'),
            await this.cipher.encrypt(JSON.stringify(entries)),
          );
        }
      } catch {
        this.warning =
          'Preferences were saved, but history maintenance failed. Clear history or check disk access.';
      }
    });
  }
  async hasKey(): Promise<boolean> {
    return Boolean(await readOptional(join(this.directory, 'key.enc')));
  }
  async key(): Promise<string> {
    const raw = await readOptional(join(this.directory, 'key.enc'));
    if (!raw) throw new AppError('Add and test your Gemini API key in Settings.');
    try {
      return await this.cipher.decrypt(raw);
    } catch {
      throw new AppError('Windows could not unlock the saved key. Replace it in Settings.');
    }
  }
  async saveKey(key: string): Promise<void> {
    await atomicWrite(join(this.directory, 'key.enc'), await this.cipher.encrypt(key));
  }
  async removeKey(): Promise<void> {
    await removeStored(join(this.directory, 'key.enc'));
  }
  async history(): Promise<HistoryEntry[]> {
    if (!this.settings.historyEnabled) return [];
    const raw = await readOptional(join(this.directory, 'history.enc'));
    if (!raw) return [];
    try {
      const schema = z
        .array(
          z.object({
            id: z.string(),
            text: z.string().max(100000),
            timestamp: z.number(),
            app: z.string().optional(),
          }),
        )
        .max(500);
      return schema
        .parse(JSON.parse(await this.cipher.decrypt(raw)))
        .filter((e) => e.timestamp >= Date.now() - this.settings.historyDays * 86400000)
        .slice(0, this.settings.historyLimit);
    } catch {
      throw new AppError('Encrypted history could not be read. You can clear it from History.');
    }
  }
  changeHistory(change: (entries: HistoryEntry[]) => HistoryEntry[]): Promise<void> {
    return this.serialize(async () => {
      if (!this.settings.historyEnabled) return;
      const entries = change(await this.history()).slice(0, this.settings.historyLimit);
      await atomicWrite(
        join(this.directory, 'history.enc'),
        await this.cipher.encrypt(JSON.stringify(entries)),
      );
    });
  }
  async clearHistory(): Promise<void> {
    await this.serialize(() => removeStored(join(this.directory, 'history.enc')));
  }
}
