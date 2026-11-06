import type { Settings } from './contracts';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Coordinates are Electron logical pixels, including negative monitor origins. */
export function overlayBounds(
  area: Rect,
  settings: Pick<Settings, 'overlaySize' | 'overlayPosition' | 'captions'>,
): Rect {
  const sizes = { compact: [260, 82], standard: [300, 90], large: [360, 106] } as const;
  const size = sizes[settings.overlaySize];
  const width = Math.min(size[0], area.width);
  const height = Math.min(size[1] + (settings.captions ? 120 : 0), area.height);
  const inset = Math.min(20, Math.max(0, (area.height - height) / 2));
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(
      settings.overlayPosition === 'top' ? area.y + inset : area.y + area.height - height - inset,
    ),
    width,
    height,
  };
}
