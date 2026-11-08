import { WebSocket } from 'ws';
import type { AudioTranscriptionConfig, LiveServerMessage } from '@google/genai';
import { brand } from '../../shared/brand';
import type { Settings } from '../../shared/contracts';
import { providerVocabulary } from '../../shared/vocabulary';
import { AppError, providerError } from '../../shared/errors';
import { TranscriptAssembler } from './assembler';
import type { FinalTranscript, TranscriptionProvider } from './provider';

/** Verified Google wire protocol. The SDK 3.0.0 hides pending socket cancellation
 * and bufferedAmount; this narrow adapter makes both safety bounds enforceable. */
export class GeminiLive implements TranscriptionProvider {
  private socket?: WebSocket;
  private assembler = new TranscriptAssembler();
  private ready = false;
  private active = false;
  private closing = false;
  private finishing = false;
  private sequence = -1;
  private stopAt = 0;
  private lastEvent = 0;
  private terminal = false;
  private end?: (value: FinalTranscript) => void;
  private interval?: NodeJS.Timeout;
  private detach?: () => void;
  get text(): string {
    return this.assembler.text;
  }
  constructor(
    private createSocket: (url: string) => WebSocket = (url) =>
      new WebSocket(url, {
        handshakeTimeout: 12000,
        maxPayload: 1024 * 1024,
        perMessageDeflate: false,
      }),
  ) {}
  connect(
    key: string,
    settings: Settings,
    signal: AbortSignal,
    interim: (text: string) => void,
    failed: (error: Error) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new AppError('Dictation cancelled.'));
        return;
      }
      const socket = this.createSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`,
      );
      this.socket = socket;
      const timeout = setTimeout(
        () => fault(new AppError('Google setup timed out. Check your network and account access.')),
        12000,
      );
      const fault = (error: Error): void => {
        if (this.closing) return;
        const wasReady = this.ready;
        clearTimeout(timeout);
        this.close();
        reject(error);
        if (wasReady) failed(error);
      };
      const abort = (): void => {
        clearTimeout(timeout);
        this.close();
        reject(new AppError('Dictation cancelled.'));
      };
      signal.addEventListener('abort', abort, { once: true });
      this.detach = () => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
      };
      socket.on('open', () => {
        if (this.closing) return;
        const transcription: AudioTranscriptionConfig = {
          mode: settings.mode as AudioTranscriptionConfig['mode'],
          languageCodes: settings.languages,
          customVocabulary: providerVocabulary(settings),
        };
        socket.send(
          JSON.stringify({
            setup: {
              model: `models/${brand.model}`,
              generationConfig: { responseModalities: ['TEXT'] },
              inputAudioTranscription: transcription,
              realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
            },
          }),
        );
      });
      socket.on('message', (data) => {
        if (this.closing) return;
        try {
          const message = JSON.parse(data.toString()) as LiveServerMessage & {
            error?: { code?: number; status?: string };
          };
          if (message.error) {
            fault(providerError(`${message.error.code} ${message.error.status}`));
            return;
          }
          if (message.setupComplete && !this.ready) {
            this.ready = true;
            clearTimeout(timeout);
            resolve();
          }
          const content = message.serverContent;
          if (this.active && content?.interimInputTranscription?.text) {
            this.assembler.interim = content.interimInputTranscription.text.slice(0, 10000);
            interim(this.assembler.interim);
            this.lastEvent = Date.now();
          }
          if (this.active && content?.inputTranscription) {
            this.assembler.final(content.inputTranscription, this.sequence);
            interim('');
            this.lastEvent = Date.now();
            if (this.finishing && content.inputTranscription.finished) this.terminal = true;
          }
          if (this.finishing && (content?.turnComplete || content?.generationComplete)) {
            this.terminal = true;
            this.lastEvent = Date.now();
          }
          if (message.goAway)
            fault(
              new AppError(
                'Google is ending this session. Completed text has been preserved; start a new dictation.',
              ),
            );
        } catch {
          fault(
            new AppError(
              'Google returned an unreadable response. Completed text has been preserved.',
            ),
          );
        }
      });
      socket.on('error', (error) => fault(providerError(error)));
      socket.on('close', (code, reason) => {
        if (!this.closing) fault(providerError(`${code} ${reason.toString()}`));
      });
    });
  }
  begin(): void {
    if (!this.ready || this.closing || this.active || !this.socket)
      throw new AppError('Transcription is not ready for audio.');
    // Setup can happen while idle. Only explicit activation starts an activity.
    this.socket.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
    this.active = true;
  }
  send(pcm: ArrayBuffer, sequence: number): void {
    if (!this.ready || !this.active || this.closing || this.finishing || !this.socket)
      throw new AppError('Transcription is not ready for audio.');
    if (sequence !== this.sequence + 1)
      throw new AppError('An audio packet was lost. Completed text has been preserved.');
    if (this.socket.bufferedAmount > 64000)
      throw new AppError('Network upload fell behind. Completed text has been preserved.');
    this.sequence = sequence;
    this.socket.send(
      JSON.stringify({
        realtimeInput: {
          audio: { data: Buffer.from(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        },
      }),
    );
  }
  finish(): Promise<FinalTranscript> {
    if (this.finishing || this.closing || !this.ready || !this.active)
      return Promise.resolve({ text: this.text, complete: false });
    this.finishing = true;
    this.stopAt = Date.now();
    this.lastEvent = this.stopAt;
    return new Promise((resolve) => {
      this.end = resolve;
      this.socket?.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      this.interval = setInterval(() => {
        const now = Date.now();
        if (this.terminal && now - this.lastEvent >= 700 && now - this.stopAt >= 1000)
          this.settle(true);
        else if (now - this.stopAt >= 10000) this.settle(false);
      }, 100);
    });
  }
  private settle(complete: boolean): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    const end = this.end;
    this.end = undefined;
    end?.({ text: this.text, complete });
  }
  close(): void {
    this.closing = true;
    this.ready = false;
    this.detach?.();
    this.detach = undefined;
    this.settle(false);
    this.socket?.terminate();
    this.socket = undefined;
  }
}
