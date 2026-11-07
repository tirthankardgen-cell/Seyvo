/** Display measured RMS on a -60 to 0 dBFS scale without changing captured audio. */
export function audioLevel(rms: number): { scale: number; label: string } {
  const level = Number.isFinite(rms) ? Math.max(0, Math.min(1, rms)) : 0;
  const percent = level * 100;
  return {
    scale: level ? Math.max(0, Math.min(1, (20 * Math.log10(level) + 60) / 60)) : 0,
    label: percent === 0 ? '0%' : percent < 0.01 ? '<0.01%' : `${percent.toFixed(2)}%`,
  };
}
