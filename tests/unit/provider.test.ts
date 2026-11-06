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
  it('accepts the live transcription generationComplete signal without optional finished or turnComplete fields', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const ready = f.connect();
    f.socket.message({ setupComplete: {} });
    await ready;
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
    expect(() => f.provider.send(new ArrayBuffer(100), 3)).toThrow('lost');
    f.socket.bufferedAmount = 64001;
    expect(() => f.provider.send(new ArrayBuffer(100), 0)).toThrow('fell behind');
    f.socket.message({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } });
    expect(f.error.mock.calls[0]![0].message).toContain('quota');
    expect(f.socket.terminate).toHaveBeenCalled();
  });
});
