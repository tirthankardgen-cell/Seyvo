import { PcmEncoder } from '../shared/pcm';
declare const sampleRate: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class RecorderProcessor extends AudioWorkletProcessor {
  private active = true;
  private level = 0;
  private encoder = new PcmEncoder(sampleRate, (pcm) =>
    this.port.postMessage({ pcm, level: this.level }, [pcm]),
  );
  constructor() {
    super();
    this.port.onmessage = () => {
      this.active = false;
      this.encoder.flush();
      this.port.postMessage({ stopped: true });
    };
  }
  process(inputs: Float32Array[][]): boolean {
    if (this.active && inputs[0]?.[0]) this.level = this.encoder.push(inputs[0]);
    return this.active;
  }
}
registerProcessor('seyvo-recorder', RecorderProcessor);
