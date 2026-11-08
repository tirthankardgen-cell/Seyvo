import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';
import { GeminiLive } from '../../src/main/transcription/gemini-live';
import { settingsSchema } from '../../src/shared/contracts';
class Socket extends EventEmitter {
  sent: unknown[] = [];
  bufferedAmount = 0;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  terminate = vi.fn();
  message(value: unknown) {
    this.emit('message', Buffer.from(JSON.stringify(value)));
  }
}
function fixture() {
  const socket = new Socket();
  const provider = new GeminiLive(() => socket as unknown as WebSocket);
  const interim = vi.fn(),
    error = vi.fn();
  const abort = new AbortController();
  return {
    socket,
    provider,
    interim,
    error,
    abort,
    connect: () =>
      provider.connect(
        'test-credential-not-real',
        settingsSchema.parse({}),
        abort.signal,
        interim,
        error,
      ),
  };
}
afterEach(() => vi.useRealTimers());
describe('Google wire adapter', () => {
  it('keeps setup-only standby silent and ignores unsolicited transcripts until explicit begin', async () => {
    const f = fixture();
    const ready = f.connect();
    f.socket.emit('open');
    f.socket.message({ setupComplete: {} });
    await ready;
    expect(f.socket.sent).toHaveLength(1);
    expect(() => f.provider.send(new ArrayBuffer(3200), 0)).toThrow('not ready');
    f.socket.message({ serverContent: { inputTranscription: { text: 'Unsolicited' } } });
    expect(f.provider.text).toBe('');
    f.provider.begin();
    expect(f.socket.sent[1]).toEqual({ realtimeInput: { activityStart: {} } });
    expect(() => f.provider.begin()).toThrow('not ready');
    f.provider.close();
  });
  it.each([
    [401, 'rejected'],
    [403, 'rejected'],
    [404, 'cannot access'],
    [429, 'quota'],
    [500, 'temporarily unavailable'],
    [503, 'temporarily unavailable'],
  ])('reports setup failure %s without exposing provider detail', async (code, expected) => {
    const f = fixture();
    const ready = f.connect();
    const failed = expect(ready).rejects.toThrow(String(expected));
    f.socket.message({ error: { code, status: 'synthetic-private-detail' } });
    await failed;
    expect(f.socket.terminate).toHaveBeenCalled();
    expect(f.error).not.toHaveBeenCalled();
  });
  it('times out missing setup and suppresses late readiness', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const ready = f.connect();
    const failed = expect(ready).rejects.toThrow('setup timed out');
    f.socket.emit('open');
    await vi.advanceTimersByTimeAsync(12000);
    await failed;
    f.socket.message({ setupComplete: {} });
    expect(() => f.provider.send(new ArrayBuffer(100), 0)).toThrow('not ready');
    expect(f.socket.terminate).toHaveBeenCalledOnce();
  });
  it('preserves committed text when the connection drops during finalization', async () => {
    const f = fixture();
    const ready = f.connect();
    f.socket.message({ setupComplete: {} });
    await ready;
    f.provider.begin();
    f.socket.message({
      serverContent: { inputTranscription: { text: 'Synthetic final segment' } },
    });
    const result = f.provider.finish();
    f.socket.emit('close', 1006, Buffer.from('synthetic-private-detail'));
    expect(await result).toEqual({ text: 'Synthetic final segment', complete: false });
    expect(f.error).toHaveBeenCalledOnce();
    expect(f.error.mock.calls[0]![0].message).not.toContain('synthetic-private-detail');
    f.socket.message({ serverContent: { inputTranscription: { text: 'Late words' } } });
    expect(f.provider.text).toBe('Synthetic final segment');
  });
  it('sends the coding preset only after opt-in, alongside user vocabulary', async () => {
    for (const enabled of [false, true]) {
      const socket = new Socket();
      const provider = new GeminiLive(() => socket as unknown as WebSocket);
      const ready = provider.connect(
        'test-not-real',
        settingsSchema.parse({
          codingVocabulary: enabled,
          dictionary: ['MyProduct'],
        }),
        new AbortController().signal,
        () => {},
        () => {},
      );
      socket.emit('open');
      socket.message({ setupComplete: {} });
      await ready;
      const setup = socket.sent[0] as {
        setup: { inputAudioTranscription: { customVocabulary: string[] } };
      };
      const terms = setup.setup.inputAudioTranscription.customVocabulary;
      expect(terms).toContain('MyProduct');
      expect(terms.includes('TypeScript')).toBe(enabled);
      provider.close();
    }
  });
  it('accepts the live transcription generationComplete signal without optional finished or turnComplete fields', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const ready = f.connect();
    f.socket.message({ setupComplete: {} });
    await ready;
    f.provider.begin();
    const result = f.provider.finish();
    f.socket.message({
      serverContent: { inputTranscription: { text: 'Verified final transcript.' } },
    });
    f.socket.message({ serverContent: { generationComplete: true } });
    await vi.advanceTimersByTimeAsync(1100);
    expect(await result).toEqual({ text: 'Verified final transcript.', complete: true });
    f.provider.close();
  });
  it('gates audio on setup, replaces interim, and drains final events after stream end', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const ready = f.connect();
    f.socket.emit('open');
    expect(() => f.provider.send(new ArrayBuffer(3200), 0)).toThrow('not ready');
    f.socket.message({ setupComplete: {} });
    await ready;
    f.provider.begin();
    f.provider.send(new ArrayBuffer(3200), 0);
    f.socket.message({ serverContent: { interimInputTranscription: { text: 'rough preview' } } });
    expect(f.provider.text).toBe('');
    const final = f.provider.finish();
    f.socket.message({ serverContent: { turnComplete: true } });
    await vi.advanceTimersByTimeAsync(500);
    f.socket.message({
      serverContent: { inputTranscription: { text: 'Final words.', finished: true } },
    });
    await vi.advanceTimersByTimeAsync(800);
    expect(await final).toEqual({ text: 'Final words.', complete: true });
    expect(f.socket.sent[0]).toMatchObject({
      setup: { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } },
    });
    expect(f.socket.sent[1]).toEqual({ realtimeInput: { activityStart: {} } });
    expect(f.socket.sent.at(-1)).toEqual({ realtimeInput: { activityEnd: {} } });
    f.provider.close();
  });
  it('closes a pending connection on cancellation and suppresses stale messages', async () => {
    const f = fixture();
    const ready = f.connect();
    const rejected = expect(ready).rejects.toThrow('cancelled');
    f.abort.abort();
    await rejected;
    f.socket.message({
      setupComplete: {},
      serverContent: { inputTranscription: { text: 'late secret' } },
    });
    expect(f.provider.text).toBe('');
    expect(f.socket.terminate).toHaveBeenCalled();
  });
  it('times out finalization with recoverable committed text', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const ready = f.connect();
    f.socket.message({ setupComplete: {} });
    await ready;
    f.provider.begin();
    f.socket.message({ serverContent: { inputTranscription: { text: 'Completed segment' } } });
    const final = f.provider.finish();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await final).toEqual({ text: 'Completed segment', complete: false });
    f.provider.close();
  });
  it('bounds upload queues, detects lost packets, and maps provider faults', async () => {
    const f = fixture();
    const ready = f.connect();
    f.socket.message({ setupComplete: {} });
    await ready;
    f.provider.begin();
    expect(() => f.provider.send(new ArrayBuffer(100), 3)).toThrow('lost');
    f.socket.bufferedAmount = 64001;
    expect(() => f.provider.send(new ArrayBuffer(100), 0)).toThrow('fell behind');
    f.socket.message({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } });
    expect(f.error.mock.calls[0]![0].message).toContain('quota');
    expect(f.socket.terminate).toHaveBeenCalled();
  });
});
