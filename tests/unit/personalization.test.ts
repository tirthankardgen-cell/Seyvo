import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../../src/shared/contracts';
import { overlayBounds } from '../../src/shared/overlay';
import { providerVocabulary } from '../../src/shared/vocabulary';

describe('personalization boundaries', () => {
  it('upgrades existing settings without opting into sound or provider hints', () => {
    const settings = settingsSchema.parse({ version: 1, dictionary: ['My term'], theme: 'light' });
    expect(settings.soundCues).toBe(false);
    expect(settings.codingVocabulary).toBe(false);
    expect(settings.overlaySize).toBe('standard');
    expect(settings.overlayPosition).toBe('bottom');
    expect(settings.overlayCustomX).toBe(50);
    expect(settings.overlayCustomY).toBe(100);
    expect(providerVocabulary(settings)).toEqual(['My term']);
  });
  it('merges opt-in hints without duplicates or exceeding the provider cap', () => {
    const settings = settingsSchema.parse({
      dictionary: ['typescript', 'MyProject'],
      codingVocabulary: true,
    });
    const terms = providerVocabulary(settings);
    expect(terms).toContain('MyProject');
    expect(terms).toContain('WebSocket');
    expect(terms.filter((term) => term.toLowerCase() === 'typescript')).toEqual(['typescript']);
    settings.dictionary = Array.from({ length: 1000 }, (_, i) => `User term ${i}`);
    expect(providerVocabulary(settings)).toEqual(settings.dictionary);
  });
  it('keeps all sizes and captions inside a negative-origin monitor and tiny work area', () => {
    for (const area of [
      { x: -1920, y: -300, width: 1280, height: 680 },
      { x: 40, y: 50, width: 160, height: 70 },
    ])
      for (const overlaySize of ['compact', 'standard', 'large'] as const) {
        for (const overlayPosition of ['top', 'bottom', 'caret', 'custom'] as const)
          for (const captions of [false, true]) {
            const bounds = overlayBounds(area, { overlaySize, overlayPosition, captions });
            expect(bounds.x).toBeGreaterThanOrEqual(area.x);
            expect(bounds.y).toBeGreaterThanOrEqual(area.y);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
          }
      }
  });
  it('places the bubble below the caret or above it when the bottom edge is close', () => {
    const area = { x: 0, y: 0, width: 1280, height: 720 };
    const settings = settingsSchema.parse({ overlayPosition: 'caret' });
    expect(overlayBounds(area, settings, { x: 640, y: 200, width: 1, height: 20 })).toEqual({
      x: 490,
      y: 232,
      width: 300,
      height: 90,
    });
    const above = overlayBounds(area, settings, { x: 5, y: 660, width: 1, height: 20 });
    expect(above.x).toBe(20);
    expect(above.y + above.height).toBe(648);
  });
  it('falls back to bottom placement for missing, invalid or off-monitor caret geometry', () => {
    const area = { x: -1280, y: 0, width: 1280, height: 720 };
    const settings = settingsSchema.parse({ overlayPosition: 'caret' });
    const bottom = overlayBounds(area, { ...settings, overlayPosition: 'bottom' });
    for (const caret of [
      undefined,
      { x: Number.NaN, y: 100, width: 1, height: 20 },
      { x: 20, y: 100, width: 1, height: 20 },
      { x: -100, y: 100, width: 1, height: 0 },
    ])
      expect(overlayBounds(area, settings, caret)).toEqual(bottom);
  });
  it('maps custom percentages to safe corners and rejects invalid saved coordinates', () => {
    const area = { x: -1920, y: -200, width: 1920, height: 1080 };
    const settings = settingsSchema.parse({
      overlayPosition: 'custom',
      overlayCustomX: 0,
      overlayCustomY: 100,
    });
    expect(overlayBounds(area, settings)).toEqual({ x: -1900, y: 770, width: 300, height: 90 });
    expect(overlayBounds(area, { ...settings, overlayCustomX: 100, overlayCustomY: 0 })).toEqual({
      x: -320,
      y: -180,
      width: 300,
      height: 90,
    });
    for (const value of [-1, 101, 50.5, Number.NaN])
      expect(settingsSchema.safeParse({ overlayCustomX: value }).success).toBe(false);
  });
});
