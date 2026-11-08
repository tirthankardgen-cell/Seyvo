import type { Settings, Status } from '../../shared/contracts';
import { AppError, ConnectionError, publicError } from '../../shared/errors';
import type { TranscriptionProvider } from './provider';

// A local guard, not a claim about the user's project-wide Google quota or tier.
// Key tests, foreground setup and background renewal share this rolling budget.
export class ConnectionBudget {
  private attempts: number[] = [];
  delay(): number {
    const now = Date.now();
    this.attempts = this.attempts.filter((time) => now - time < 60000);
    return this.attempts.length < 4 ? 0 : Math.max(1, this.attempts[0]! + 60000 - now);
  }
  take(): void {
    if (this.delay())
      throw new AppError(
        'Connection attempts are limited to four per minute. Wait a minute and try again.',
      );
    this.attempts.push(Date.now());
  }
}

type Entry = {
  provider: TranscriptionProvider;
  abort: AbortController;
  ready: Promise<void>;
  connected: boolean;
  started: number;
  fingerprint: string;
  owner?: { interim(text: string): void; failed(error: Error): void };
};

/** One silent, setup-only socket. A dictation takes ownership and always closes it.
 * Never reuse a previous transcript/activity or stream silence to keep it alive. */
export class StandbyConnection {
  state: Status['connectionState'] = 'off';
  message = 'Connects when you start dictation.';
  private entry?: Entry;
  private timer?: NodeJS.Timeout;
  private enabled = false;
  private blocked = false;
  private failures = 0;
  private settings?: Settings;
  constructor(
    private factory: () => TranscriptionProvider,
    private key: () => Promise<string>,
    private changed: () => void,
    readonly budget = new ConnectionBudget(),
  ) {}
  private fingerprint(settings: Settings): string {
    return JSON.stringify([
      settings.mode,
      settings.languages,
      settings.dictionary,
      settings.codingVocabulary,
      settings.maxSeconds,
    ]);
  }
  private lifetime(settings: Settings): number {
    // Reserve the entire configured recording plus setup/finalization margin
    // within Google's ten-minute session limit, measured from connection start.
    // Real Google idle sessions closed at ~60 s with code 1008 despite pong
    // replies. Renew beforehand without sending billable silence/model input.
    return Math.min(45, 600 - settings.maxSeconds - 30) * 1000;
  }
  private change(state: Status['connectionState'], message: string): void {
    this.state = state;
    this.message = message;
    this.changed();
  }
  configure(settings: Settings, enabled: boolean): void {
    const wasEnabled = this.enabled;
    const changed = this.settings && this.fingerprint(this.settings) !== this.fingerprint(settings);
    this.settings = structuredClone(settings);
    this.enabled = enabled && settings.keepConnectionReady && !settings.paused;
    if (!this.enabled || changed) this.discardIdle();
    if (!this.enabled) {
      if (!this.entry?.owner) this.change('off', 'Connects when you start dictation.');
      return;
    }
    if (!wasEnabled || changed) {
      this.blocked = false;
      this.failures = 0;
    }
    this.prepare();
  }
  stop(): void {
    this.enabled = false;
    this.discardIdle();
    if (!this.entry?.owner) this.change('off', 'Background connection is off.');
  }
  private discardIdle(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    const entry = this.entry;
    if (entry && !entry.owner) {
      this.entry = undefined;
      entry.abort.abort();
      entry.provider.close();
    }
  }
  private prepare(): void {
    if (!this.enabled || this.blocked || this.entry || !this.settings) return;
    const delay = this.budget.delay();
    if (delay) {
      this.change('limited', 'Waiting before reconnecting to limit API requests.');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.prepare(), delay);
      return;
    }
    const entry = this.open(this.settings, this.key);
    void entry.ready
      .then(() => {
        if (this.entry !== entry || entry.owner) return;
        this.change('ready', 'Google ready. Microphone off.');
        this.timer = setTimeout(
          () => {
            this.failures = 0;
            this.discardIdle();
            this.prepare();
          },
          Math.max(1, this.lifetime(this.settings!) - (Date.now() - entry.started)),
        );
      })
      .catch(() => {}); // open reports redacted errors and owns bounded idle retry.
  }
  private open(settings: Settings, key: () => Promise<string>): Entry {
    const entry: Entry = {
      provider: this.factory(),
      abort: new AbortController(),
      ready: Promise.resolve(),
      connected: false,
      started: Date.now(),
      fingerprint: this.fingerprint(settings),
    };
    this.entry = entry;
    this.change('connecting', 'Preparing Google. Microphone stays off until activation.');
    const fault = (error: Error): void => {
      if (this.entry !== entry) return;
      if (
        !entry.owner &&
        this.enabled &&
        error instanceof ConnectionError &&
        (error.retry === 'renew' || (error.retry === 'transient' && this.failures < 3))
      ) {
        const delay = error.retry === 'renew' ? 5000 : 30000 * 2 ** this.failures++;
        this.discardIdle();
        // Preserve this deadline across unrelated preference changes.
        this.blocked = true;
        this.change(
          'limited',
          'Google connection interrupted. Reconnecting shortly; microphone stays off.',
        );
        this.timer = setTimeout(() => {
          this.blocked = false;
          this.prepare();
        }, delay);
        return;
      }
      this.blocked = true;
      this.change('limited', `${publicError(error)} Automatic reconnect is stopped.`);
      entry.owner?.failed(error);
      if (!entry.owner) this.discardIdle();
    };
    entry.ready = (async () => {
      try {
        const credential = await key();
        if (entry.abort.signal.aborted) throw new AppError('Connection cancelled.');
        this.budget.take();
        await entry.provider.connect(
          credential,
          settings,
          entry.abort.signal,
          (text) => entry.owner?.interim(text),
          fault,
        );
        entry.connected = true;
      } catch (error) {
        fault(error instanceof Error ? error : new AppError('Connection unavailable.'));
        throw error;
      }
    })();
    return entry;
  }
  get ready(): boolean {
    return Boolean(
      this.entry?.connected &&
      !this.entry.owner &&
      this.settings &&
      Date.now() - this.entry.started < this.lifetime(this.settings),
    );
  }
  provider(): TranscriptionProvider {
    let held: Entry | undefined;
    let detach: (() => void) | undefined;
    let closed = false;
    const release = (): void => {
      if (closed) return;
      closed = true;
      detach?.();
      if (held) {
        if (this.entry === held) this.entry = undefined;
        held.abort.abort();
        held.provider.close();
      }
      if (!this.blocked) {
        this.change('off', 'Microphone off.');
        this.prepare();
      }
    };
    return {
      connect: async (key, settings, signal, interim, failed) => {
        if (closed || signal.aborted) throw new AppError('Dictation cancelled.');
        if (this.entry?.owner) throw new AppError('A Google session is already in use.');
        if (
          this.entry &&
          (this.entry.fingerprint !== this.fingerprint(settings) ||
            Date.now() - this.entry.started >= this.lifetime(settings))
        )
          this.discardIdle();
        clearTimeout(this.timer);
        this.timer = undefined;
        this.blocked = false; // A shortcut is an explicit retry, never a retry loop.
        this.failures = 0;
        held = this.entry ?? this.open(settings, async () => key);
        held.owner = { interim, failed };
        signal.addEventListener('abort', release, { once: true });
        detach = () => signal.removeEventListener('abort', release);
        await held.ready;
        if (closed || signal.aborted) throw new AppError('Dictation cancelled.');
        this.change('active', 'Google connected for this dictation.');
      },
      begin: () => held!.provider.begin(),
      send: (pcm, sequence) => held!.provider.send(pcm, sequence),
      finish: () => held!.provider.finish(),
      close: release,
      get text() {
        return held?.provider.text ?? '';
      },
    };
  }
}
