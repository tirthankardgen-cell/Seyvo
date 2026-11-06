import type { Transcription } from '@google/genai';
import { AppError } from '../../shared/errors';
export class TranscriptAssembler {
  private segments: string[] = [];
  private seen = new Set<string>();
  interim = '';
  final(segment: Transcription, audioSequence: number): void {
    const text = segment.text;
    if (!text) return;
    const identity =
      segment.startOffset !== undefined && segment.endOffset !== undefined
        ? `${segment.startOffset}:${segment.endOffset}:${text}`
        : `${audioSequence}:${text}`;
    if (this.seen.has(identity)) return;
    if (this.text.length + text.length > 100000)
      throw new AppError(
        'Transcript reached the safety limit. The completed text has been preserved.',
      );
    this.seen.add(identity);
    this.segments.push(text);
    this.interim = '';
  }
  get text(): string {
    return this.segments.reduce(
      (output, text) =>
        output + (output && !/\s$/.test(output) && !/^\s|^[.,!?;:]/.test(text) ? ' ' : '') + text,
      '',
    );
  }
}
