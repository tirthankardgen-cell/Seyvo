import { afterEach, describe, expect, it, vi } from 'vitest';
import { SingleKeyShortcut } from '../../src/main/single-key-shortcut';
import { settingsSchema, settingsPatchSchema, type Phase } from '../../src/shared/contracts';

function fixture(mode: 'hold' | 'toggle' = 'hold') {
  vi.useFakeTimers();
  let phase: Phase = 'idle';
  const ports = {
    phase: () => phase,
    start: vi.fn(async () => {
      phase = 'connecting';
    }),
    stop: vi.fn(async () => {
      phase = 'finalizing';
    }),
    cancel: vi.fn(async () => {
      phase = 'idle';
    }),
    error: vi.fn(),
  };
  const shortcut = new SingleKeyShortcut(ports);
  shortcut.configure(true, mode);
  return {
    shortcut,
    ports,
    phase: (next: Phase) => {
      phase = next;
    },
  };
}
afterEach(() => vi.useRealTimers());
describe('single-key activation', () => {
  it('preserves existing shortcuts on migration and validates only the new preferences', () => {
    const migrated = settingsSchema.parse({ shortcut: 'Control+Alt+Space' });
    expect(migrated.activation).toBe('shortcut');
    expect(migrated.shortcut).toBe('Control+Alt+Space');
    expect(settingsPatchSchema.parse({ activation: 'single-key' })).toEqual({
      activation: 'single-key',
    });
    expect(settingsPatchSchema.safeParse({ singleKeyMode: 'always-listen' }).success).toBe(false);
  });
  it('requires a continuous three seconds and ignores autorepeat', async () => {
    const f = fixture();
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(2999);
    expect(f.ports.start).not.toHaveBeenCalled();
    f.shortcut.edge('up');
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.ports.start).not.toHaveBeenCalled();
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(3000);
    f.phase('listening');
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(4000);
    expect(f.ports.start).toHaveBeenCalledTimes(1);
    expect(f.ports.stop).not.toHaveBeenCalled();
    f.shortcut.edge('up');
    f.shortcut.edge('up');
    expect(f.ports.stop).toHaveBeenCalledTimes(1);
  });
  it('keeps toggle mode listening on the first release and stops on the next tap release', async () => {
    const f = fixture('toggle');
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(3000);
    f.phase('listening');
    f.shortcut.edge('up');
    expect(f.ports.stop).not.toHaveBeenCalled();
    f.shortcut.edge('down');
    expect(f.ports.stop).not.toHaveBeenCalled();
    f.shortcut.edge('up');
    expect(f.ports.stop).toHaveBeenCalledTimes(1);
  });
  it('cancels pending setup when hold mode releases and allows toggle setup to finish', async () => {
    const f = fixture();
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(3000);
    f.shortcut.edge('up');
    expect(f.ports.cancel).toHaveBeenCalledTimes(1);
    f.shortcut.configure(true, 'toggle');
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(3000);
    f.shortcut.edge('up');
    expect(f.ports.cancel).toHaveBeenCalledTimes(1);
    f.shortcut.edge('down');
    f.shortcut.edge('up');
    expect(f.ports.cancel).toHaveBeenCalledTimes(2);
  });
  it('disarms Ctrl combinations until release and does not stop toggle mode for Ctrl+C', async () => {
    const f = fixture('toggle');
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(2500);
    f.shortcut.edge('interrupted');
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(3000);
    expect(f.ports.start).not.toHaveBeenCalled();
    f.shortcut.edge('up');
    f.phase('listening');
    f.shortcut.edge('down');
    f.shortcut.edge('interrupted');
    f.shortcut.edge('up');
    expect(f.ports.stop).not.toHaveBeenCalled();
  });
  it('disarms pending activation on pause/rebind and refuses overlapping sessions', async () => {
    const f = fixture();
    f.shortcut.edge('down');
    await vi.advanceTimersByTimeAsync(2000);
    f.shortcut.configure(false, 'hold');
    await vi.advanceTimersByTimeAsync(3000);
    f.shortcut.edge('down');
    expect(f.ports.start).not.toHaveBeenCalled();
    f.shortcut.configure(true, 'hold');
    f.shortcut.edge('down');
    f.phase('finalizing');
    await vi.advanceTimersByTimeAsync(3000);
    expect(f.ports.start).not.toHaveBeenCalled();
  });
});
