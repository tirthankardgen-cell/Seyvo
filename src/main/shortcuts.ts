import { AppError } from '../shared/errors';
export interface ShortcutRegistry {
  register(combo: string, callback: () => void): boolean;
  unregister(combo: string): void;
}
export class Shortcuts {
  current = '';
  constructor(
    private registry: ShortcutRegistry,
    private activate: () => void,
  ) {}
  set(combo: string, paused: boolean): void {
    if (paused) {
      if (this.current) this.registry.unregister(this.current);
      this.current = '';
      return;
    }
    if (this.current === combo) return;
    if (!this.registry.register(combo, this.activate))
      throw new AppError(
        this.current
          ? 'That shortcut is already in use. Your previous shortcut remains active. Choose another combination.'
          : 'That shortcut is already in use. Choose another combination; no dictation shortcut is registered yet.',
      );
    if (this.current) this.registry.unregister(this.current);
    this.current = combo;
  }
}
