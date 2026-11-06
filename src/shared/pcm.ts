/** Streaming 63-tap low-pass FIR followed by phase-continuous sample-rate conversion.
 * Only complete 100 ms packets are emitted; flush preserves the final partial packet. */
export class PcmEncoder {
  private ring = new Float64Array(63);
  private taps: Float64Array;
  private cursor = 0;
  private phase = 0;
  private packet = new ArrayBuffer(3200);
  private view = new DataView(this.packet);
  private written = 0;
  constructor(
    private inputRate: number,
    private emit: (packet: ArrayBuffer) => void,
  ) {
    if (inputRate < 16000 || inputRate > 192000) throw new Error('Unsupported sample rate');
    const cutoff = 7200 / inputRate;
    this.taps = new Float64Array(63);
    let sum = 0;
    for (let i = 0; i < 63; i++) {
      const offset = i - 31;
      const sinc =
        offset === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * offset) / (Math.PI * offset);
      const tap = sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / 62));
      this.taps[i] = tap;
      sum += tap;
    }
    this.taps = this.taps.map((tap) => tap / sum);
  }
  push(channels: Float32Array[]): number {
    const frames = channels[0]?.length ?? 0;
    let energy = 0;
    for (let frame = 0; frame < frames; frame++) {
      let mono = 0;
      for (const channel of channels) mono += channel[frame] ?? 0;
      mono /= channels.length;
      energy += mono * mono;
      this.ring[this.cursor] = mono;
      this.phase += 16000;
      if (this.phase >= this.inputRate) {
        this.phase -= this.inputRate;
        let filtered = 0;
        for (let i = 0; i < 63; i++)
          filtered += this.taps[i]! * this.ring[(this.cursor - i + 63) % 63]!;
        const value = Math.max(-1, Math.min(1, filtered));
        this.view.setInt16(this.written * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
        if (++this.written === 1600) this.flush();
      }
      this.cursor = (this.cursor + 1) % 63;
    }
    return frames ? Math.min(1, Math.sqrt(energy / frames)) : 0;
  }
  flush(): void {
    if (!this.written) return;
    this.emit(this.packet.slice(0, this.written * 2));
    this.packet = new ArrayBuffer(3200);
    this.view = new DataView(this.packet);
    this.written = 0;
  }
}
