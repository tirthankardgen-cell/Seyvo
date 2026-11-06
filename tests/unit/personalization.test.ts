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
        for (const overlayPosition of ['top', 'bottom'] as const)
          for (const captions of [false, true]) {
            const bounds = overlayBounds(area, { overlaySize, overlayPosition, captions });
            expect(bounds.x).toBeGreaterThanOrEqual(area.x);
            expect(bounds.y).toBeGreaterThanOrEqual(area.y);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.x + area.width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.y + area.height);
          }
      }
  });
});
