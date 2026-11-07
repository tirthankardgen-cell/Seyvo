import { describe, expect, it, vi } from 'vitest';
import { SessionCoordinator, type SessionPorts } from '../../src/main/session-coordinator';
import { settingsSchema } from '../../src/shared/contracts';
import { AppError } from '../../src/shared/errors';
function fixture() {
  const settings = settingsSchema.parse({});
  const provider = {
    text: '',
    connect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    finish: vi
      .fn()
      .mockResolvedValue({ text: 'Hello नमस्ते 🌍\nSecond paragraph.', complete: true }),
    close: vi.fn(),
  };
  const ports: SessionPorts = {
    settings: () => settings,
    key: vi.fn().mockResolvedValue('test-not-real'),
    provider: () => provider,
    capture: vi.fn().mockResolvedValue({
      token: 'private-target',
      app: 'notepad.exe',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    }),
    record: vi.fn().mockResolvedValue(undefined),
    stopRecord: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn(),
    saveHistory: vi.fn().mockResolvedValue(undefined),
    changed: vi.fn(),
    overlay: vi.fn(),
    cue: vi.fn(),
  };
  return { settings, provider, ports, coordinator: new SessionCoordinator(ports) };
}
describe('single session authority', () => {
  it.each(['paste', 'unicode', 'copy'] as const)(
    'cancellation revokes %s delivery while history persistence is pending',
    async (method) => {
      const f = fixture();
      f.settings.insertion = method;
      f.settings.historyEnabled = true;
      let persisted!: () => void;
      vi.mocked(f.ports.saveHistory).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            persisted = resolve;
          }),
      );
      await f.coordinator.start();
      const stopping = f.coordinator.stop();
      await vi.waitFor(() => expect(f.ports.saveHistory).toHaveBeenCalledOnce());
      await f.coordinator.cancel();
      const cancelledMessage = f.coordinator.message;
      persisted();
      await stopping;
      expect(f.ports.insert).not.toHaveBeenCalled();
      expect(f.ports.copy).not.toHaveBeenCalled();
      expect(f.coordinator.message).toBe(cancelledMessage);
      expect(f.coordinator.recovery).toContain('नमस्ते');
      expect(f.coordinator.busy).toBe(false);
      expect(f.coordinator.microphoneActive).toBe(false);
    },
  );
  it('shutdown revokes pending delivery without waiting for history storage', async () => {
    const f = fixture();
    let persisted!: () => void;
    vi.mocked(f.ports.saveHistory).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          persisted = resolve;
        }),
    );
    await f.coordinator.start();
    const stopping = f.coordinator.stop();
    await vi.waitFor(() => expect(f.ports.saveHistory).toHaveBeenCalledOnce());
    expect(f.coordinator.busy).toBe(true);
    expect(() => f.coordinator.dismiss()).toThrow('active operation');
    await f.coordinator.shutdown();
    persisted();
    await stopping;
    expect(f.ports.insert).not.toHaveBeenCalled();
    expect(f.ports.copy).not.toHaveBeenCalled();
    expect(f.coordinator.busy).toBe(false);
  });
  it('a cancelled history failure cannot overwrite a later recording or deliver stale text', async () => {
    const f = fixture();
    let failed!: (error: Error) => void;
    vi.mocked(f.ports.saveHistory).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          failed = reject;
        }),
    );
    await f.coordinator.start();
    const stopping = f.coordinator.stop();
    await vi.waitFor(() => expect(f.ports.saveHistory).toHaveBeenCalledOnce());
    await f.coordinator.cancel();
    f.coordinator.dismiss();
    await f.coordinator.start(true);
    const nextMessage = f.coordinator.message;
    failed(new Error('Synthetic disk failure'));
    await stopping;
    expect(f.coordinator.phase).toBe('listening');
    expect(f.coordinator.message).toBe(nextMessage);
    expect(f.coordinator.microphoneActive).toBe(true);
    expect(f.ports.insert).not.toHaveBeenCalled();
    expect(f.ports.copy).not.toHaveBeenCalled();
    await f.coordinator.cancel();
  });
  it('honors opt-in cues without duplicates, and only plays stop after microphone drain', async () => {
    const f = fixture();
    f.settings.soundCues = true;
    await f.coordinator.start();
    expect(f.ports.cue).toHaveBeenCalledExactlyOnceWith('start');
    let drained!: () => void;
    vi.mocked(f.ports.stopRecord).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          drained = resolve;
        }),
    );
    const stopping = f.coordinator.stop();
    await f.coordinator.stop();
    expect(f.ports.cue).not.toHaveBeenCalledWith('stop');
    drained();
    await stopping;
    expect(vi.mocked(f.ports.cue).mock.calls).toEqual([['start'], ['stop']]);
    f.coordinator.dismiss();
    vi.mocked(f.ports.cue).mockClear();
    await f.coordinator.start(true);
    await f.coordinator.stop();
    expect(f.ports.cue).not.toHaveBeenCalled();
  });
  it('keeps cues off by default and emits an error cue after cleanup when enabled', async () => {
    const f = fixture();
    await f.coordinator.start();
    await f.coordinator.cancel();
    expect(f.ports.cue).not.toHaveBeenCalled();
    f.settings.soundCues = true;
    await f.coordinator.start();
    await f.coordinator.fail(new AppError('Network lost'));
    expect(f.coordinator.microphoneActive).toBe(false);
    expect(vi.mocked(f.ports.cue).mock.calls).toEqual([['start'], ['error']]);
  });
  it('refuses a new session until microphone cancellation has finished', async () => {
    const f = fixture();
    await f.coordinator.start();
    let release!: () => void;
    vi.mocked(f.ports.stopRecord).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const cancelling = f.coordinator.cancel();
    await expect(f.coordinator.start()).rejects.toThrow('current session');
    release();
    await cancelling;
    expect(f.coordinator.phase).toBe('idle');
  });
  it('waits for insertion to settle during shutdown so clipboard restoration can finish', async () => {
    const f = fixture();
    let finishInsertion!: () => void;
    vi.mocked(f.ports.insert).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishInsertion = resolve;
        }),
    );
    await f.coordinator.start();
    const stopping = f.coordinator.stop();
    await vi.waitFor(() => expect(f.ports.insert).toHaveBeenCalled());
    let closed = false;
    const shutdown = f.coordinator.shutdown().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    finishInsertion();
    await Promise.all([stopping, shutdown]);
    expect(closed).toBe(true);
  });
  it('captures before mic, inserts only finalized text once, and always keeps uncertain results', async () => {
    const f = fixture();
    await f.coordinator.start();
    expect(f.coordinator.phase).toBe('listening');
    expect(vi.mocked(f.ports.capture).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(f.ports.record).mock.invocationCallOrder[0]!,
    );
    await Promise.all([f.coordinator.stop(), f.coordinator.stop()]);
    expect(f.ports.insert).toHaveBeenCalledTimes(1);
    expect(f.coordinator.recovery).toContain('नमस्ते');
    expect(f.coordinator.message).toContain('may have failed');
    expect(f.coordinator.microphoneActive).toBe(false);
    expect(f.provider.close).toHaveBeenCalled();
    await expect(f.coordinator.start()).rejects.toThrow('dismiss');
    f.coordinator.dismiss();
    expect(f.coordinator.recovery).toBe('');
  });
  it('does not open microphone in excluded apps', async () => {
    const f = fixture();
    f.settings.excludedApps = ['NOTEPAD.exe'];
    await f.coordinator.start();
    expect(f.ports.record).not.toHaveBeenCalled();
    expect(f.provider.connect).not.toHaveBeenCalled();
    expect(f.coordinator.message).toContain('excluded');
  });
  it('cancels pending setup without starting the microphone or accepting stale completion', async () => {
    const f = fixture();
    let connected!: () => void;
    f.provider.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          connected = resolve;
        }),
    );
    const starting = f.coordinator.start();
    await vi.waitFor(() => expect(f.provider.connect).toHaveBeenCalled());
    await f.coordinator.cancel();
    connected();
    await starting;
    expect(f.ports.record).not.toHaveBeenCalled();
    expect(f.ports.insert).not.toHaveBeenCalled();
    expect(f.coordinator.phase).toBe('idle');
  });
  it('never inserts partial output on timeout, empty input, or target failure', async () => {
    const f = fixture();
    f.provider.finish.mockResolvedValue({ text: 'Partial', complete: false });
    await f.coordinator.start();
    await f.coordinator.stop();
    expect(f.ports.insert).not.toHaveBeenCalled();
    expect(f.coordinator.recovery).toBe('Partial');
    f.coordinator.dismiss();
    f.provider.finish.mockResolvedValue({ text: '  ', complete: true });
    await f.coordinator.start();
    await f.coordinator.stop();
    expect(f.ports.insert).not.toHaveBeenCalled();
    f.provider.finish.mockResolvedValue({ text: 'Recover me', complete: true });
    vi.mocked(f.ports.insert).mockRejectedValue(new AppError('Target changed'));
    await f.coordinator.start();
    await f.coordinator.stop();
    expect(f.coordinator.recovery).toBe('Recover me');
    expect(f.coordinator.message).toBe('Target changed');
  });
  it('local microphone test never loads a key, calls Google, captures a target, or inserts', async () => {
    const f = fixture();
    await f.coordinator.start(true);
    await f.coordinator.stop();
    expect(f.ports.key).not.toHaveBeenCalled();
    expect(f.provider.connect).not.toHaveBeenCalled();
    expect(f.ports.capture).not.toHaveBeenCalled();
    expect(f.ports.insert).not.toHaveBeenCalled();
  });
  it('retains finalized segments on provider failure and refuses late audio', async () => {
    const f = fixture();
    await f.coordinator.start();
    f.provider.text = 'Saved final';
    await f.coordinator.fail(new AppError('Network lost'));
    expect(f.coordinator.recovery).toBe('Saved final');
    expect(
      f.coordinator.packet({ id: 'old', sequence: 0, pcm: new ArrayBuffer(100), level: 0 }),
    ).toBe(false);
  });
});
