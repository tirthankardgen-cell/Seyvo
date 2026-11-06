import workletUrl from './audio-worklet.ts?worker&url';
import type { RecorderCommand } from '../shared/contracts';
let active:
  | {
      id: string;
      stream?: MediaStream;
      context?: AudioContext;
      node?: AudioWorkletNode;
      pending: Set<Promise<unknown>>;
      cancelled: boolean;
      sequence: number;
    }
  | undefined;
async function cleanup(id: string): Promise<void> {
  const current = active;
  if (!current || current.id !== id) return;
  current.cancelled = true;
  current.stream?.getTracks().forEach((track) => track.stop());
  current.node?.disconnect();
  await current.context?.close().catch(() => {});
  if (active === current) active = undefined;
}
async function start(command: Extract<RecorderCommand, { kind: 'start' }>): Promise<void> {
  if (active) await cleanup(active.id);
  const current: NonNullable<typeof active> = {
    id: command.id,
    pending: new Set(),
    cancelled: false,
    sequence: 0,
  };
  active = current;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: command.deviceId === 'default' ? undefined : { exact: command.deviceId },
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (current.cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    current.stream = stream;
    for (const track of stream.getTracks())
      track.onended = () => {
        window.recorder.event({
          id: current.id,
          kind: 'error',
          error: 'Microphone disconnected. Choose an available input device.',
        });
        void cleanup(current.id);
      };
    const context = new AudioContext({ sampleRate: 48000 });
    current.context = context;
    await context.audioWorklet.addModule(workletUrl);
    if (current.cancelled) return;
    const node = new AudioWorkletNode(context, 'seyvo-recorder');
    current.node = node;
    const source = context.createMediaStreamSource(stream);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);
    node.port.onmessage = (
      event: MessageEvent<{ pcm?: ArrayBuffer; level: number; stopped?: boolean }>,
    ) => {
      if (current.cancelled) return;
      if (event.data.stopped) {
        void Promise.all(current.pending).then(async () => {
          await cleanup(current.id);
          window.recorder.event({ id: current.id, kind: 'stopped' });
        });
        return;
      }
      if (!event.data.pcm) return;
      if (current.pending.size >= 4) {
        window.recorder.event({
          id: current.id,
          kind: 'error',
          error: 'Audio delivery fell behind. Please retry with a stable connection.',
        });
        void cleanup(current.id);
        return;
      }
      const promise = window.recorder
        .packet({
          id: current.id,
          pcm: event.data.pcm,
          level: event.data.level,
          sequence: current.sequence++,
        })
        .then((accepted) => {
          if (!accepted) void cleanup(current.id);
        })
        .catch(() => {
          void cleanup(current.id);
        })
        .finally(() => current.pending.delete(promise));
      current.pending.add(promise);
    };
    await context.resume();
    if (!current.cancelled) window.recorder.event({ id: current.id, kind: 'started' });
  } catch (error) {
    if (!current.cancelled)
      window.recorder.event({
        id: current.id,
        kind: 'error',
        error:
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Microphone access denied. Enable microphone access for desktop apps in Windows Settings.'
            : 'Microphone unavailable. Check the selected device and Windows privacy settings.',
      });
    await cleanup(current.id);
  }
}
window.recorder.command((command) => {
  if (command.kind === 'start') void start(command);
  else if (active?.id === command.id) {
    if (command.kind === 'stop' && active.node) active.node.port.postMessage('stop');
    else
      void cleanup(command.id).then(() =>
        window.recorder.event({ id: command.id, kind: 'stopped' }),
      );
  }
});
