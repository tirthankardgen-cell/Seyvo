import type { Settings } from '../../shared/contracts';
export interface FinalTranscript {
  text: string;
  complete: boolean;
}
export interface TranscriptionProvider {
  connect(
    key: string,
    settings: Settings,
    signal: AbortSignal,
    interim: (text: string) => void,
    failed: (error: Error) => void,
  ): Promise<void>;
  begin(): void;
  send(pcm: ArrayBuffer, sequence: number): void;
  finish(): Promise<FinalTranscript>;
  close(): void;
  readonly text: string;
}
