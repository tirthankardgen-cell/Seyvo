import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { AppError } from '../shared/errors';
import type { ShortcutEdge } from './single-key-shortcut';
export const targetSchema = z.object({
  token: z.string(),
  app: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  caret: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().min(0).max(2000),
      height: z.number().positive().max(2000),
    })
    .nullable()
    .optional(),
});
export type Target = z.infer<typeof targetSchema>;
export class NativeBridge {
  private child?: ChildProcessWithoutNullStreams;
  private next = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  available = false;
  onShortcut?: (edge: ShortcutEdge) => void;
  onUnavailable?: () => void;
  private shortcutGeneration = 0;
  constructor(private executable: string) {}
  async start(): Promise<void> {
    const child = spawn(this.executable, [], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      if (line.length > 240000) {
        this.close();
        return;
      }
      try {
        const input: unknown = JSON.parse(line);
        const shortcut = z
          .object({
            event: z.literal('shortcut'),
            generation: z.number().int().positive(),
            state: z.enum(['down', 'up', 'interrupted']),
          })
          .strict()
          .safeParse(input);
        if (shortcut.success) {
          if (shortcut.data.generation === this.shortcutGeneration)
            this.onShortcut?.(shortcut.data.state);
          return;
        }
        const reply = z
          .object({
            id: z.number().int(),
            ok: z.boolean(),
            result: z.unknown().optional(),
            error: z.string().max(80).optional(),
          })
          .parse(input);
        const pending = this.pending.get(reply.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(reply.id);
        if (reply.ok) pending.resolve(reply.result);
        else pending.reject(new AppError(this.errorMessage(reply.error)));
      } catch {
        this.close();
      }
    });
    child.stderr.resume(); // Native errors must never be copied into diagnostics.
    child.on('error', () => this.close());
    child.on('exit', () => this.close());
    // A cold Windows/.NET installation may scan and initialize the executable
    // before its first response. Keep insertion/capture budgets at five seconds.
    await this.request('ping', {}, 15000);
    this.available = true;
  }
  private errorMessage(code?: string): string {
    if (code === 'shortcut-unavailable')
      return 'The single-key listener is unavailable. Choose Key combination or restart Seyvo.';
    if (code === 'sound-unavailable')
      return 'Windows could not play the sound. Check your output device and volume mixer.';
    if (code === 'input-already-attempted')
      return 'Input was already attempted once. Check your destination; use Copy to avoid an automatic duplicate.';
    if (code === 'choose-target' || code === 'choose-text-field')
      return 'Click a text field in another application, then use your shortcut.';
    if (code?.startsWith('clipboard'))
      return 'The clipboard could not be safely preserved. Use Copy or direct Unicode mode, then retry.';
    if (code === 'use-clipboard-mode')
      return 'Direct Unicode mode supports up to 5,000 characters without newlines. Use clipboard paste for this text.';
    if (code === 'notepad-use-clipboard')
      return 'Direct Unicode input is unavailable for Notepad because it can change the text. No input was sent. Use clipboard paste or Copy, then inspect the result.';
    if (code === 'release-modifiers')
      return 'Release Ctrl, Alt, Shift and Windows keys before inserting.';
    return 'The original field is unavailable, changed, or protected. Nothing further was inserted. Copy your text or refocus the original field and retry.';
  }
  request(
    command: 'ping' | 'capture' | 'insert' | 'clear' | 'cue' | 'watchShortcut',
    fields: Record<string, unknown> = {},
    timeoutMs = 5000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.child || this.child.killed) {
        reject(
          new AppError(
            'Windows integration is unavailable. Restart Seyvo; copy-only dictation remains available.',
          ),
        );
        return;
      }
      const id = ++this.next;
      const timer = setTimeout(() => this.close(), timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, command, ...fields }) + '\n', (error) => {
        if (error) this.close();
      });
    });
  }
  async capture(allowPractice = false): Promise<Target> {
    return targetSchema.parse(
      await this.request('capture', { ownPid: process.pid, allowPractice }),
    );
  }
  async watchShortcut(enabled: boolean): Promise<void> {
    const generation = ++this.shortcutGeneration;
    await this.request('watchShortcut', { enabled, generation });
  }
  async cue(cue: 'start' | 'stop' | 'error'): Promise<void> {
    await this.request('cue', { cue });
  }
  async insert(target: Target, text: string, method: 'paste' | 'unicode'): Promise<void> {
    await this.request('insert', { token: target.token, text, method });
  }
  close(): void {
    const child = this.child;
    this.child = undefined;
    this.available = false;
    if (child && !child.killed) child.kill();
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(
        new AppError(
          'Windows integration stopped responding. Your text is available for recovery.',
        ),
      );
    }
    this.pending.clear();
    if (child) this.onUnavailable?.();
  }
}
