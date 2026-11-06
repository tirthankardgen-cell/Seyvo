import { describe, it, expect, vi } from 'vitest';
import {
  settingsSchema,
  settingsPatchSchema,
  shortcutSchema,
  apiKeySchema,
} from '../../src/shared/contracts';
import { PcmEncoder } from '../../src/shared/pcm';
import { Shortcuts } from '../../src/main/shortcuts';
import { TranscriptAssembler } from '../../src/main/transcription/assembler';
import { providerError } from '../../src/shared/errors';
describe('safe defaults and shortcut registration', () => {
  it('accepts opaque dotted credentials without weakening whitespace and size bounds', () => {
    expect(apiKeySchema.parse('  AQ.example.test-token  ')).toBe('AQ.example.test-token');
    expect(apiKeySchema.safeParse('token-with\nnewline').success).toBe(false);
    expect(apiKeySchema.safeParse('x'.repeat(513)).success).toBe(false);
  });
  it('does not populate defaults in partial settings updates', () => {
    expect(settingsPatchSchema.parse({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(settingsPatchSchema.parse({ dictionary: ['Custom'] })).toEqual({
      dictionary: ['Custom'],
    });
  });
  it('never opts into storage, startup or recording', () => {
    const settings = settingsSchema.parse({});
    expect(settings.historyEnabled).toBe(false);
    expect(settings.onboardingComplete).toBe(false);
    expect(settings.maxSeconds).toBe(300);
    expect(shortcutSchema.safeParse('A').success).toBe(false);
    expect(shortcutSchema.safeParse('Control+A').success).toBe(false);
    expect(shortcutSchema.safeParse('Control+Shift+Space').success).toBe(true);
  });
  it('keeps previous registered shortcut on conflict', () => {
    const registry = {
      register: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
      unregister: vi.fn(),
    };
    const service = new Shortcuts(registry, () => {});
    service.set('F8', false);
    expect(() => service.set('F9', false)).toThrow('already in use');
    expect(registry.unregister).not.toHaveBeenCalled();
    expect(service.current).toBe('F8');
    service.set('F8', true);
    expect(registry.unregister).toHaveBeenCalledWith('F8');
  });
});
describe('streaming audio', () => {
  it('converts stereo 48 kHz to headerless mono 16 kHz signed little-endian packets', () => {
    const chunks: ArrayBuffer[] = [];
    const encoder = new PcmEncoder(48000, (chunk) => chunks.push(chunk));
    const left = new Float32Array(4800).fill(0.75),
      right = new Float32Array(4800).fill(0.25);
    encoder.push([left, right]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.byteLength).toBe(3200);
    expect(new DataView(chunks[0]!).getInt16(200, true)).toBeCloseTo(16384, -1);
  });
  it('preserves rate and remainder across noninteger resampling and input block boundaries', () => {
    const chunks: ArrayBuffer[] = [];
    const encoder = new PcmEncoder(44100, (chunk) => chunks.push(chunk));
    for (let offset = 0; offset < 44100; offset += 128)
      encoder.push([new Float32Array(Math.min(128, 44100 - offset)).fill(-1)]);
    encoder.flush();
    expect(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)).toBe(32000);
    expect(new DataView(chunks[2]!).getInt16(0, true)).toBe(-32768);
  });
});
describe('transcript assembly and safe errors', () => {
  it('deduplicates events without removing genuinely repeated speech', () => {
    const assembler = new TranscriptAssembler();
    assembler.interim = 'unconfirmed';
    assembler.final({ text: 'नमस्ते 🌍', startOffset: '0s', endOffset: '1s' }, 1);
    assembler.final({ text: 'नमस्ते 🌍', startOffset: '0s', endOffset: '1s' }, 2);
    assembler.final({ text: 'नमस्ते 🌍', startOffset: '2s', endOffset: '3s' }, 3);
    expect(assembler.text).toBe('नमस्ते 🌍 नमस्ते 🌍');
    expect(assembler.interim).toBe('');
  });
  it('never echoes transport credentials or request text', () => {
    expect(providerError(new Error('401 secret=private-key')).message).not.toContain('private-key');
    expect(providerError(new Error('429')).message).toContain('quota');
  });
});
