import type { Phase } from '../shared/contracts';

export type ShortcutEdge = 'down' | 'up' | 'interrupted';
interface Ports {
  phase(): Phase;
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  error(error: unknown): void;
  pending(pending: boolean): void;
}

// Main owns the three-second gesture and session actions. No renderer timer or
// keyboard event can start the mic. Native events contain no typed key data.
export class SingleKeyShortcut {
  private timer?: ReturnType<typeof setTimeout>;
  private held = false;
  private started = false;
  private stopOnRelease = false;
  private enabled = false;
  private mode: 'hold' | 'toggle' = 'hold';
  private generation = 0;
  constructor(private ports: Ports) {}

  configure(enabled: boolean, mode: 'hold' | 'toggle'): void {
    this.reset();
    this.enabled = enabled;
    this.mode = mode;
  }

  reset(): void {
    ++this.generation;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.ports.pending(false);
    this.held = false;
    this.started = false;
    this.stopOnRelease = false;
  }

  edge(edge: ShortcutEdge): void {
    if (!this.enabled) return;
    if (edge === 'interrupted') {
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.ports.pending(false);
      this.stopOnRelease = false;
      return;
    }
    if (edge === 'up') {
      if (!this.held) return;
      const finish = (this.mode === 'hold' && this.started) || this.stopOnRelease;
      this.reset();
      if (finish) this.finish();
      return;
    }
    if (this.held) return; // OS autorepeat must never toggle a session.
    this.held = true;
    if (['connecting', 'listening'].includes(this.ports.phase())) {
      // Wait for Ctrl to be released before finalization/insertion.
      this.stopOnRelease = true;
      return;
    }
    if (!['idle', 'error', 'recovery'].includes(this.ports.phase())) return;
    const generation = this.generation;
    this.ports.pending(true);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.held || !['idle', 'error', 'recovery'].includes(this.ports.phase())) {
        this.ports.pending(false);
        return;
      }
      this.started = true;
      void this.ports.start().catch((error: unknown) => {
        if (generation !== this.generation) return;
        this.started = false;
        this.ports.error(error);
      });
      this.ports.pending(false);
    }, 3000);
  }

  private finish(): void {
    // Releasing while setup is pending must cancel it immediately; it must not
    // open the microphone later when a slow provider/recorder completes.
    if (this.ports.phase() === 'connecting') void this.ports.cancel().catch(this.ports.error);
    else if (this.ports.phase() === 'listening') void this.ports.stop().catch(this.ports.error);
  }
}
