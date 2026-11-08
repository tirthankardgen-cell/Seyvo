import { afterEach, describe, expect, it, vi } from 'vitest';
import { settingsSchema } from '../../src/shared/contracts';
import { AppError, ConnectionError } from '../../src/shared/errors';
import { ConnectionBudget, StandbyConnection } from '../../src/main/transcription/standby';

function mockProvider() {
  return {
    text: '',
    connect: vi.fn().mockResolvedValue(undefined),
    begin: vi.fn(),
    send: vi.fn(),
    finish: vi.fn().mockResolvedValue({ text: '', complete: true }),
    close: vi.fn(),
  };
}
function fixture() {
  vi.useFakeTimers();
  const settings = settingsSchema.parse({});
  const providers: ReturnType<typeof mockProvider>[] = [];
  function create() {
    const provider = mockProvider();
    providers.push(provider);
    return provider;
  }
  const key = vi.fn().mockResolvedValue('synthetic-credential');
  const pool = new StandbyConnection(create, key, vi.fn());
  const acquire = async () => {
    const provider = pool.provider();
    const abort = new AbortController();
    await provider.connect('synthetic-credential', settings, abort.signal, vi.fn(), vi.fn());
    return { provider, abort };
  };
  return { settings, providers, pool, acquire, key };
}
afterEach(() => vi.useRealTimers());
describe('silent Google standby and request budget', () => {
  it('bounds temporary idle failures to three retries and never retries speech or quota failures', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(0);
    for (const delay of [30000, 60000, 120000]) {
      const current = f.providers.at(-1)!;
      current.connect.mock.calls[0]![4](new ConnectionError('Network disconnected.', 'transient'));
      const count = f.providers.length;
      f.pool.configure({ ...f.settings, theme: 'light' }, true);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(f.providers).toHaveLength(count);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.providers).toHaveLength(count + 1);
    }
    f.providers
      .at(-1)!
      .connect.mock.calls[0]![4](new ConnectionError('Network disconnected.', 'transient'));
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(4);
    expect(f.pool.message).toContain('Automatic reconnect is stopped');
    f.pool.stop();
  });
  it('renews an idle server-ended session without audio, and cancels pending retries on stop', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(0);
    f.providers[0]!.connect.mock.calls[0]![4](
      new ConnectionError('Server session ended.', 'renew'),
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.providers).toHaveLength(2);
    expect(f.providers[1]!.begin).not.toHaveBeenCalled();
    f.providers[1]!.connect.mock.calls[0]![4](new ConnectionError('Network lost.', 'transient'));
    f.pool.stop();
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(2);
  });
  it('prepares one socket without starting activity or audio, and transfers it to explicit activation', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.pool.ready).toBe(true);
    expect(f.providers).toHaveLength(1);
    const wire = f.providers[0]!;
    expect(wire.begin).not.toHaveBeenCalled();
    expect(wire.send).not.toHaveBeenCalled();
    const active = await f.acquire();
    active.provider.begin();
    expect(wire.connect).toHaveBeenCalledOnce();
    expect(wire.begin).toHaveBeenCalledOnce();
    active.provider.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(wire.close).toHaveBeenCalled();
    expect(f.providers).toHaveLength(2);
    expect(f.providers[1]!.begin).not.toHaveBeenCalled();
    f.pool.stop();
  });
  it('shares pending setup with activation and revokes it when cancelled', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    let complete!: () => void;
    f.providers[0]!.connect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(0);
    const provider = f.pool.provider();
    const abort = new AbortController();
    const pending = provider.connect('synthetic', f.settings, abort.signal, vi.fn(), vi.fn());
    const rejected = expect(pending).rejects.toThrow('cancelled');
    f.pool.stop();
    abort.abort();
    complete();
    await rejected;
    expect(f.providers).toHaveLength(1);
    expect(f.providers[0]!.begin).not.toHaveBeenCalled();
    expect(f.pool.ready).toBe(false);
  });
  it('renews before expiry while reserving the full dictation and finalization duration', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(269999);
    expect(f.providers).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.providers).toHaveLength(2);
    expect(f.providers[0]!.close).toHaveBeenCalled();
    const active = await f.acquire();
    await vi.advanceTimersByTimeAsync(300000);
    expect(f.providers).toHaveLength(2); // Never rotate an active recording.
    f.pool.stop();
    active.provider.close();
  });
  it('invalidates old settings and cancels sockets on pause, removal, lock or shutdown', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(0);
    f.settings.languages = ['hi-IN'];
    f.pool.configure(f.settings, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.providers[0]!.close).toHaveBeenCalled();
    expect(f.providers[1]!.connect.mock.calls[0]![1].languages).toEqual(['hi-IN']);
    f.pool.stop();
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(2);
    expect(f.providers[1]!.close).toHaveBeenCalled();
  });
  it('does not retry failed setup or quota errors automatically, even after unrelated settings edits', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    f.providers[0]!.connect.mockRejectedValue(
      new AppError('Google quota or billing limit reached.'),
    );
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(1);
    expect(f.pool.state).toBe('limited');
    f.pool.configure({ ...f.settings, theme: 'light' }, true);
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(1);
    const active = await f.acquire(); // Explicit retry is permitted, within the local budget.
    f.pool.stop();
    active.provider.close();
  });
  it('stops background retry after an active connection failure and preserves final text', async () => {
    const f = fixture();
    f.pool.configure(f.settings, true);
    const active = await f.acquire();
    f.providers[0]!.text = 'Synthetic completed segment';
    f.providers[0]!.connect.mock.calls[0]![4](new AppError('Google quota reached.'));
    expect(active.provider.text).toBe('Synthetic completed segment');
    active.provider.close();
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.providers).toHaveLength(1);
    expect(f.pool.state).toBe('limited');
    f.pool.stop();
  });
  it('limits all setup attempts to four in a rolling minute and defers idle preparation', async () => {
    const f = fixture();
    for (let i = 0; i < 4; i++) f.pool.budget.take();
    f.pool.configure(f.settings, true);
    expect(f.providers).toHaveLength(0);
    expect(f.pool.state).toBe('limited');
    await vi.advanceTimersByTimeAsync(59999);
    expect(f.providers).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.providers).toHaveLength(1);
    f.pool.stop();
    const budget = new ConnectionBudget();
    for (let i = 0; i < 4; i++) budget.take();
    expect(() => budget.take()).toThrow('four per minute');
  });
  it('does not connect without a key, while paused or with standby disabled', async () => {
    const f = fixture();
    f.pool.configure(f.settings, false);
    f.pool.configure({ ...f.settings, paused: true }, true);
    f.pool.configure({ ...f.settings, keepConnectionReady: false }, true);
    await vi.advanceTimersByTimeAsync(600000);
    expect(f.key).not.toHaveBeenCalled();
    expect(f.providers).toHaveLength(0);
  });
});
