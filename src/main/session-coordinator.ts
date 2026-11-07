import { randomUUID } from 'node:crypto';
import type { AudioPacket, Phase, Settings } from '../shared/contracts';
import { AppError, publicError } from '../shared/errors';
import type { Target } from './native';
import type { TranscriptionProvider } from './transcription/provider';

export interface SessionPorts {
  settings(): Settings;
  key(): Promise<string>;
  provider(): TranscriptionProvider;
  capture(): Promise<Target | undefined>;
  record(id: string, deviceId: string): Promise<void>;
  stopRecord(id: string, cancel: boolean): Promise<void>;
  insert(target: Target, text: string, method: 'paste' | 'unicode'): Promise<void>;
  copy(text: string): void;
  saveHistory(text: string, app: string): Promise<void>;
  changed(): void;
  overlay(target?: Target): void;
  cue(kind: 'start' | 'stop' | 'error'): void;
}
export class SessionCoordinator {
  phase: Phase = 'idle';
  message = 'Ready when you are.';
  recovery = '';
  interim = '';
  level = 0;
  microphoneActive = false;
  elapsed = 0;
  targetApp = '';
  private session?: {
    id: string;
    abort: AbortController;
    provider?: TranscriptionProvider;
    target?: Target;
    settings: Settings;
    started: number;
    sequence: number;
    local: boolean;
  };
  private recoveryTarget?: Target;
  // Delivery remains cancellable after microphone/provider cleanup, including
  // while encrypted history is being written. Never reuse it for a later session.
  private pendingDelivery?: string;
  private insertionOperation?: Promise<void>;
  private cleanupOperation?: Promise<void>;
  private timer?: NodeJS.Timeout;
  constructor(private ports: SessionPorts) {}
  private change(phase: Phase, message: string): void {
    this.phase = phase;
    this.message = message;
    this.ports.changed();
  }
  get busy(): boolean {
    return Boolean(this.session || this.pendingDelivery);
  }
  async start(local = false): Promise<void> {
    if (this.busy || this.cleanupOperation || !['idle', 'error', 'recovery'].includes(this.phase))
      throw new AppError('Finish or cancel the current session first.');
    if (this.recovery)
      throw new AppError('Copy or dismiss the current result before starting another dictation.');
    const settings = structuredClone(this.ports.settings());
    if (settings.paused && !local) throw new AppError('Seyvo is paused. Resume it to dictate.');
    const current = {
      id: randomUUID(),
      abort: new AbortController(),
      settings,
      started: Date.now(),
      sequence: -1,
      local,
    } as NonNullable<typeof this.session>;
    this.session = current;
    this.interim = '';
    this.level = 0;
    this.elapsed = 0;
    this.targetApp = '';
    this.change('connecting', local ? 'Opening microphone locally…' : 'Connecting to Google…');
    try {
      if (!local) {
        current.target = await this.ports.capture();
        if (this.session !== current) return;
        if (!current.target && (settings.insertion !== 'copy' || settings.excludedApps.length))
          throw new AppError(
            'Windows target checks are unavailable. Use Copy only without exclusions, or restart Seyvo.',
          );
        this.targetApp = current.target?.app ?? 'Copy only';
        if (
          settings.excludedApps.some(
            (name) => name.toLowerCase() === current.target?.app.toLowerCase(),
          )
        )
          throw new AppError('Dictation is excluded in this application. Microphone remains off.');
        this.ports.overlay(current.target);
        const key = await this.ports.key();
        if (this.session !== current) return;
        const provider = this.ports.provider();
        current.provider = provider;
        await provider.connect(
          key,
          settings,
          current.abort.signal,
          (text) => {
            if (this.session === current) {
              this.interim = settings.captions ? text : '';
              this.ports.changed();
            }
          },
          (error) => {
            if (this.session === current) void this.fail(error);
          },
        );
        if (this.session !== current) {
          provider.close();
          return;
        }
      } else this.ports.overlay();
      await this.ports.record(current.id, settings.deviceId);
      if (this.session !== current) {
        await this.ports.stopRecord(current.id, true);
        return;
      }
      this.microphoneActive = true;
      if (!local && settings.soundCues) this.ports.cue('start');
      current.started = Date.now();
      this.change(
        'listening',
        local
          ? 'Local microphone test. No audio is uploaded.'
          : 'Listening. Press your shortcut again to finish.',
      );
      this.timer = setInterval(() => {
        this.elapsed = Math.floor((Date.now() - current.started) / 1000);
        const limit = local ? 15 : settings.maxSeconds;
        if (this.elapsed >= limit) void this.stop();
        else {
          if (limit - this.elapsed <= 15)
            this.message = `Finishing automatically in ${limit - this.elapsed} seconds.`;
          this.ports.changed();
        }
      }, 250);
    } catch (error) {
      if (this.session === current) await this.fail(error);
    }
  }
  packet(packet: AudioPacket): boolean {
    const current = this.session;
    if (
      !current ||
      packet.id !== current.id ||
      !['connecting', 'listening', 'finalizing'].includes(this.phase)
    )
      return false;
    if (packet.sequence !== current.sequence + 1) {
      void this.fail(new AppError('Audio packet sequence interrupted. Please retry.'));
      return false;
    }
    current.sequence = packet.sequence;
    this.level = packet.level;
    try {
      if (!current.local) current.provider?.send(packet.pcm, packet.sequence);
      this.ports.changed();
      return true;
    } catch (error) {
      void this.fail(error);
      return false;
    }
  }
  async stop(): Promise<void> {
    const current = this.session;
    if (!current || this.phase !== 'listening') return;
    this.clearTimer();
    this.change('finalizing', 'Finishing your transcript…');
    try {
      await this.ports.stopRecord(current.id, false);
      this.microphoneActive = false;
      this.level = 0;
      if (this.session !== current) return;
      if (!current.local && current.settings.soundCues) this.ports.cue('stop');
      if (current.local) {
        await this.cleanup(current);
        this.change('idle', 'Microphone test finished. No audio was uploaded.');
        return;
      }
      const final = await current.provider!.finish();
      if (this.session !== current) return;
      const text = current.settings.trimWhitespace ? final.text.trim() : final.text;
      this.recovery = text;
      this.recoveryTarget = current.target;
      this.pendingDelivery = current.id;
      await this.cleanup(current);
      if (this.pendingDelivery !== current.id) return;
      if (!text.trim()) {
        this.pendingDelivery = undefined;
        this.recovery = '';
        this.change('idle', 'No finalized speech was received. Nothing was inserted.');
        return;
      }
      await this.ports.saveHistory(text, this.targetApp).catch(() => {
        if (this.pendingDelivery === current.id)
          this.message = 'Could not save history. Current text remains available.';
      });
      if (this.pendingDelivery !== current.id) return;
      if (!final.complete) {
        this.pendingDelivery = undefined;
        if (current.settings.soundCues) this.ports.cue('error');
        this.change(
          'recovery',
          'Finalization timed out. Completed segments are saved here; the last words may be missing.',
        );
        return;
      }
      if (current.settings.insertion === 'copy') {
        this.ports.copy(text);
        this.pendingDelivery = undefined;
        this.change(
          'recovery',
          'Copied. Paste when you are ready; your previous clipboard was replaced.',
        );
        return;
      }
      this.pendingDelivery = undefined;
      await this.insert(current.settings.insertion);
    } catch (error) {
      if (this.session === current) await this.fail(error);
      else if (this.pendingDelivery === current.id) {
        this.pendingDelivery = undefined;
        this.change('recovery', publicError(error));
      }
    }
  }
  async retry(): Promise<void> {
    if (this.busy || !this.recovery) throw new AppError('No result is available to insert.');
    await this.insert(this.ports.settings().insertion === 'unicode' ? 'unicode' : 'paste');
  }
  private async insert(method: 'paste' | 'unicode'): Promise<void> {
    if (!this.recoveryTarget) {
      this.change('recovery', 'Original target is no longer available. Copy the transcript.');
      return;
    }
    this.change('inserting', 'Inserting into the original field…');
    try {
      this.insertionOperation = this.ports.insert(this.recoveryTarget, this.recovery, method);
      await this.insertionOperation;
      this.change('recovery', 'Insertion may have failed. Check your target before retrying.');
    } catch (error) {
      if (this.ports.settings().soundCues) this.ports.cue('error');
      this.change('recovery', publicError(error));
    } finally {
      this.insertionOperation = undefined;
    }
  }
  async shutdown(): Promise<void> {
    await this.insertionOperation?.catch(() => {});
    await this.cancel();
  }
  async fail(error: unknown): Promise<void> {
    const current = this.session;
    if (!current) return;
    this.recovery = current.provider?.text ?? '';
    this.recoveryTarget = current.target;
    await this.cleanup(current);
    if (!current.local && current.settings.soundCues) this.ports.cue('error');
    this.change(this.recovery ? 'recovery' : 'error', publicError(error));
  }
  async cancel(): Promise<void> {
    if (this.phase === 'inserting')
      throw new AppError('An insertion transaction is already in progress.');
    this.pendingDelivery = undefined;
    if (this.session) {
      const current = this.session;
      await this.cleanup(current);
      if (!current.local && current.settings.soundCues) this.ports.cue('stop');
    } else await this.cleanupOperation;
    this.interim = '';
    this.change(this.recovery ? 'recovery' : 'idle', 'Recording cancelled. Microphone is off.');
  }
  dismiss(): void {
    if (this.busy || this.phase === 'inserting')
      throw new AppError('Finish the active operation first.');
    this.recovery = '';
    this.recoveryTarget = undefined;
    this.interim = '';
    this.change('idle', 'Ready when you are.');
  }
  copy(): void {
    if (!this.recovery) throw new AppError('No text to copy.');
    this.ports.copy(this.recovery);
    this.change('recovery', 'Copied to your clipboard.');
  }
  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private async cleanup(current: NonNullable<typeof this.session>): Promise<void> {
    if (this.session === current) this.session = undefined;
    this.clearTimer();
    current.abort.abort();
    current.provider?.close();
    const cleanup = this.ports.stopRecord(current.id, true).catch(() => {});
    this.cleanupOperation = cleanup;
    await cleanup;
    if (this.cleanupOperation === cleanup) this.cleanupOperation = undefined;
    this.microphoneActive = false;
    this.level = 0;
    this.interim = '';
  }
}
