import { z } from 'zod';
import { brand } from './brand';

// Provider keys are opaque credentials, not a fixed prefix or base64 alphabet.
// Keep transport-safe bounds here; Google determines validity and model access.
export const apiKeySchema = z
  .string()
  .trim()
  .min(10)
  .max(512)
  .regex(/^[\x21-\x7e]+$/);

export const shortcutSchema = z
  .string()
  .max(80)
  .refine(
    (s) =>
      /^F(?:[6-9]|1[0-2])$/.test(s) ||
      (/^(?:Control|Alt|Shift)(?:\+(?:Control|Alt|Shift)){0,2}\+(?:Space|[A-Z]|F(?:[1-9]|1[0-2]))$/.test(
        s,
      ) &&
        s.includes('Control+') &&
        s.split('+').length >= 3 &&
        new Set(s.split('+')).size === s.split('+').length),
    'Use Ctrl with Shift or Alt and a key, or F6–F12.',
  );
export const vocabularySchema = z.array(z.string().trim().min(1).max(100)).max(1000);
export const settingsSchema = z
  .object({
    version: z.literal(1).default(1),
    onboardingComplete: z.boolean().default(false),
    shortcut: shortcutSchema.default('Control+Shift+Space'),
    paused: z.boolean().default(false),
    keepConnectionReady: z.boolean().default(true),
    startMinimized: z.boolean().default(false),
    closeToTray: z.boolean().default(true),
    deviceId: z.string().max(300).default('default'),
    mode: z.enum(['SMART', 'VERBATIM']).default('SMART'),
    languages: z
      .array(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/))
      .max(5)
      .default([]),
    maxSeconds: z.number().int().min(30).max(540).default(300),
    insertion: z.enum(['paste', 'copy', 'unicode']).default('paste'),
    trimWhitespace: z.boolean().default(true),
    theme: z.enum(['system', 'dark', 'light']).default('system'),
    reducedMotion: z.boolean().default(false),
    showOverlay: z.boolean().default(true),
    captions: z.boolean().default(false),
    overlayPosition: z.enum(['bottom', 'top', 'caret', 'custom']).default('bottom'),
    overlayCustomX: z.number().int().min(0).max(100).default(50),
    overlayCustomY: z.number().int().min(0).max(100).default(100),
    overlaySize: z.enum(['compact', 'standard', 'large']).default('standard'),
    waveform: z.enum(['bars', 'dots']).default('bars'),
    accent: z.enum(['blue', 'violet', 'teal']).default('blue'),
    soundCues: z.boolean().default(false),
    codingVocabulary: z.boolean().default(false),
    historyEnabled: z.boolean().default(false),
    historyDays: z.number().int().min(1).max(90).default(7),
    historyLimit: z.number().int().min(10).max(500).default(100),
    historyAppNames: z.boolean().default(false),
    dictionary: vocabularySchema.default([]),
    excludedApps: z
      .array(
        z
          .string()
          .regex(/^[\w .-]+\.exe$/i)
          .max(100),
      )
      .max(100)
      .default([]),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
// Zod 4 applies inner defaults even under optional(). Strip defaults first so
// a patch cannot reset unrelated preferences or silently erase a dictionary.
const patchFields = Object.fromEntries(
  Object.entries(settingsSchema.shape)
    .filter(([key]) => key !== 'version')
    .map(([key, field]) => [key, field.removeDefault().optional()]),
);
export const settingsPatchSchema = z.object(patchFields).strict() as z.ZodType<
  Partial<Omit<Settings, 'version'>>
>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type Phase =
  'idle' | 'connecting' | 'listening' | 'finalizing' | 'inserting' | 'recovery' | 'error';
export interface Microphone {
  deviceId: string;
  label: string;
}
export interface Status {
  phase: Phase;
  message: string;
  hasKey: boolean;
  providerVerified: boolean;
  connectionState: 'off' | 'connecting' | 'ready' | 'active' | 'limited';
  connectionMessage: string;
  microphoneActive: boolean;
  microphones: Microphone[];
  level: number;
  elapsed: number;
  interim: string;
  recovery: string;
  targetApp: string;
  shortcutRegistered: boolean;
  nativeAvailable: boolean;
  startup: boolean;
  startupAvailable: boolean;
  version: string;
  buildHash: string;
  settings: Settings;
}
export interface HistoryEntry {
  id: string;
  text: string;
  timestamp: number;
  app?: string;
}
export type ActionResult<T = void> = { ok: true; value: T } | { ok: false; error: string };
export type Link = keyof typeof brand.links;
export interface Bridge {
  status(): Promise<Status>;
  subscribe(listener: (status: Status) => void): () => void;
  updateSettings(patch: SettingsPatch): Promise<ActionResult<Settings>>;
  saveKey(key: string): Promise<ActionResult>;
  testKey(): Promise<ActionResult>;
  removeKey(): Promise<ActionResult>;
  action(
    action:
      | 'start'
      | 'practice'
      | 'stop'
      | 'cancel'
      | 'copy'
      | 'retry'
      | 'dismiss'
      | 'quit'
      | 'micTest'
      | 'micStop'
      | 'testSound'
      | 'previewOverlay'
      | 'diagnostics'
      | 'pasteTest',
  ): Promise<ActionResult>;
  startup(enabled: boolean): Promise<ActionResult<boolean>>;
  history(
    action: 'list' | 'clear' | 'delete' | 'copy' | 'export',
    id?: string,
  ): Promise<ActionResult<HistoryEntry[]>>;
  dictionary(action: 'import' | 'export'): Promise<ActionResult<Settings>>;
  openLink(link: Link): Promise<ActionResult>;
}
export type RecorderCommand =
  { kind: 'start'; id: string; deviceId: string } | { kind: 'stop' | 'cancel'; id: string };
export interface AudioPacket {
  id: string;
  sequence: number;
  pcm: ArrayBuffer;
  level: number;
}
export interface RecorderBridge {
  command(listener: (command: RecorderCommand) => void): () => void;
  packet(packet: AudioPacket): Promise<boolean>;
  event(
    event:
      | { id: string; kind: 'started' | 'stopped' | 'error'; error?: string }
      | { id: string; kind: 'devices'; devices: Microphone[] },
  ): void;
}
declare global {
  interface Window {
    seyvo: Bridge;
    recorder: RecorderBridge;
  }
}
