import type { Settings } from './contracts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Coordinates are Electron logical pixels, including negative monitor origins. */
export function overlayBounds(
  area: Rect,
  settings: Pick<Settings, 'overlaySize' | 'overlayPosition' | 'captions'> &
    Partial<Pick<Settings, 'overlayCustomX' | 'overlayCustomY'>>,
  caret?: Rect,
): Rect {
  const sizes = { compact: [260, 82], standard: [300, 90], large: [360, 106] } as const;
  const size = sizes[settings.overlaySize];
  const width = Math.min(size[0], area.width);
  const height = Math.min(size[1] + (settings.captions ? 120 : 0), area.height);
  const insetX = Math.min(20, Math.max(0, (area.width - width) / 2));
  const insetY = Math.min(20, Math.max(0, (area.height - height) / 2));
  const minX = area.x + insetX;
  const maxX = area.x + area.width - width - insetX;
  const minY = area.y + insetY;
  const maxY = area.y + area.height - height - insetY;
  let x = area.x + (area.width - width) / 2;
  let y = settings.overlayPosition === 'top' ? minY : maxY;
  if (settings.overlayPosition === 'custom') {
    x = minX + (maxX - minX) * ((settings.overlayCustomX ?? 50) / 100);
    y = minY + (maxY - minY) * ((settings.overlayCustomY ?? 100) / 100);
  } else if (
    settings.overlayPosition === 'caret' &&
    caret &&
    Object.values(caret).every(Number.isFinite) &&
    caret.height > 0 &&
    caret.x >= area.x &&
    caret.x < area.x + area.width &&
    caret.y >= area.y &&
    caret.y + caret.height <= area.y + area.height
  ) {
    x = caret.x - width / 2;
    // Prefer below the caret, then above it. Bounds always stay inside the
    // work area, including when captions or a tiny monitor leave little room.
    const below = caret.y + caret.height + 12;
    const above = caret.y - height - 12;
    y = below <= maxY ? below : above >= minY ? above : maxY;
  }
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, x))),
    y: Math.round(Math.min(maxY, Math.max(minY, y))),
    width,
    height,
  };
}
