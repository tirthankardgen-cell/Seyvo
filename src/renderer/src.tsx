import React, { useEffect, useState, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ActionResult, HistoryEntry, SettingsPatch, Status } from '../shared/contracts';
import { brand } from '../shared/brand';
import { codingVocabulary } from '../shared/vocabulary';
import './styles.css';

function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
function Wave({
  level,
  reduced,
  dots = false,
}: {
  level: number;
  reduced: boolean;
  dots?: boolean;
}) {
  return (
    <div
      className={`wave ${dots ? 'dots' : ''}`}
      aria-label={`Microphone level ${Math.round(level * 100)} percent`}
    >
      {Array.from({ length: 11 }, (_, i) => (
        <i
          key={i}
          style={{
            opacity: dots ? 0.25 + Math.min(0.75, level * 6) : 1,
            height: reduced
              ? 8
              : 5 + Math.min(1, level * 6) * (12 + 28 * (1 - Math.abs(i - 5) / 6)),
          }}
        />
      ))}
    </div>
  );
}
class ErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>Let’s get you back.</h1>
        <p>The window could not render. Restart Seyvo from the tray. Your key remains encrypted.</p>
        <button onClick={() => location.reload()}>Reload window</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [status, setStatus] = useState<Status>();
  const [page, setPage] = useState('Home');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [visibleKey, setVisibleKey] = useState(false);
  const [word, setWord] = useState('');
  const [editingWord, setEditingWord] = useState<string>();
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shortcut, setShortcut] = useState('');
  const [step, setStep] = useState(0);
  const practice = useRef<HTMLTextAreaElement>(null);
  const overlay = location.hash === '#overlay';
  useEffect(() => {
    void window.seyvo
      .status()
      .then(setStatus)
      .catch(() => setError('Could not connect to Seyvo. Restart the app.'));
    return window.seyvo.subscribe(setStatus);
  }, []);
  useEffect(() => {
    if (!status) return;
    document.documentElement.dataset.theme = status.settings.theme;
    document.documentElement.dataset.accent = status.settings.accent;
    document.documentElement.dataset.reduced = String(status.settings.reducedMotion);
    document.body.classList.toggle('overlay-body', overlay);
  }, [status?.settings.theme, status?.settings.accent, status?.settings.reducedMotion, overlay]);
  async function run<T>(action: Promise<ActionResult<T>>): Promise<T | undefined> {
    setBusy(true);
    setError('');
    try {
      const result = await action;
      if (!result.ok) setError(result.error);
      else return result.value;
    } catch {
      setError('The operation could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function patch(patch: SettingsPatch) {
    await run(window.seyvo.updateSettings(patch));
  }
  async function loadHistory() {
    const value = await run(window.seyvo.history('list'));
    if (value) setHistory(value);
  }
  const link = (label: string, id: keyof typeof brand.links) => (
    <button className="text-button" onClick={() => void run(window.seyvo.openLink(id))}>
      {label} ↗
    </button>
  );
  if (!status)
    return (
      <main className="loading">
        <Mark />
        <p>{error || 'Opening Seyvo…'}</p>
      </main>
    );
  const s = status.settings;
  const devices = status.microphones;
  const active = ['connecting', 'listening', 'finalizing', 'inserting'].includes(status.phase);
  const title = s.paused
    ? 'Paused'
    : status.phase === 'listening'
      ? 'Listening'
      : status.phase === 'connecting'
        ? 'Connecting'
        : status.phase === 'finalizing'
          ? 'Finishing'
          : status.phase === 'inserting'
            ? 'Inserting'
            : status.recovery
              ? 'Your words are ready'
              : status.phase === 'error'
                ? 'Needs attention'
                : status.hasKey
                  ? 'Ready when you are'
                  : 'A little setup. A lot less typing';
  const time = `${Math.floor(status.elapsed / 60)}:${String(status.elapsed % 60).padStart(2, '0')}`;
  if (overlay)
    return (
      <div className={`overlay-frame ${s.overlaySize}`}>
        <div className={`bubble ${status.phase}`} role="status">
          <Mark small />
          <Wave level={status.level} reduced={s.reducedMotion} dots={s.waveform === 'dots'} />
          <div>
            <strong>{active ? title : status.recovery ? 'Check your text' : 'Mic off'}</strong>
            <small>{status.microphoneActive ? time : 'Seyvo'}</small>
          </div>
          {s.captions && status.interim && <p className="caption">{status.interim}</p>}
        </div>
      </div>
    );
  const toggle = (
    label: string,
    detail: string,
    checked: boolean,
    change: (value: boolean) => void,
    disabled = false,
  ) => (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        className="toggle"
        aria-label={label}
        type="checkbox"
        checked={checked}
        disabled={disabled || busy}
        onChange={(e) => change(e.target.checked)}
      />
    </label>
  );
  const select = (
    label: string,
    value: string,
    options: [string, string][],
    change: (value: string) => void,
  ) => (
    <label className="setting-row">
      <strong>{label}</strong>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={busy || active}
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const micPanel = (
    <>
      <div className="setting-row">
        <span>
          <strong>Microphone</strong>
          <small>{status.microphoneActive ? 'Microphone active' : 'Not recording'}</small>
        </span>
        <select
          aria-label="Microphone"
          value={s.deviceId}
          disabled={active}
          onChange={(e) => void patch({ deviceId: e.target.value })}
        >
          <option value="default">Windows default</option>
          {s.deviceId !== 'default' &&
            !devices.some((device) => device.deviceId === s.deviceId) && (
              <option value={s.deviceId}>Saved microphone · test to check</option>
            )}
          {devices
            .filter((d) => d.deviceId !== 'default')
            .map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
        </select>
      </div>
      <div className="mic-test">
        <Wave level={status.level} reduced={s.reducedMotion} />
        <button
          disabled={busy || (active && status.phase !== 'listening')}
          onClick={() =>
            void run(window.seyvo.action(status.microphoneActive ? 'micStop' : 'micTest'))
          }
        >
          {status.microphoneActive ? 'Stop microphone' : 'Test microphone'}
        </button>
      </div>
      <p className="hint">
        A 15-second local level test. Nothing is sent to Google. Device names refresh during testing
        or dictation. After connecting a new input, test Windows default, stop, then choose it.
      </p>
    </>
  );
  const keyPanel = (
    <>
      <p>
        Your microphone audio goes directly to Google only when you dictate. Your key is encrypted
        on this Windows account. Google usage charges and data terms apply.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const candidate = key;
          setKey('');
          void run(window.seyvo.saveKey(candidate));
        }}
      >
        <label htmlFor="api-key">Gemini API key</label>
        <div className="input-line">
          <input
            id="api-key"
            autoComplete="off"
            spellCheck={false}
            type={visibleKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={status.hasKey ? 'Enter a replacement key' : 'Paste your own API key'}
            maxLength={512}
          />
          <button
            type="button"
            aria-label={visibleKey ? 'Hide key' : 'Show key'}
            onClick={() => setVisibleKey(!visibleKey)}
          >
            {visibleKey ? 'Hide' : 'Show'}
          </button>
          <button className="primary" disabled={busy || key.length < 10}>
            Save & test
          </button>
        </div>
      </form>
      <div className="button-row">
        <span className={`pill ${status.hasKey ? 'good' : ''}`}>
          {status.hasKey
            ? status.providerVerified
              ? 'Model access verified'
              : 'Key saved · test connection'
            : 'No key saved'}
        </span>
        {status.hasKey && (
          <>
            <button disabled={busy || active} onClick={() => void run(window.seyvo.testKey())}>
              Test saved key
            </button>
            <button
              className="danger-text"
              disabled={busy || active}
              onClick={() => {
                if (confirm('Remove your saved Gemini key?')) void run(window.seyvo.removeKey());
              }}
            >
              Remove key
            </button>
          </>
        )}
      </div>
      <div className="button-row">
        {link('Get an API key', 'keys')}
        {link('Google pricing', 'pricing')}
        {link('Data terms', 'terms')}
      </div>
    </>
  );
  const shortcutPanel = (
    <>
      <label htmlFor="shortcut">Dictation shortcut</label>
      <div className="input-line">
        <input
          id="shortcut"
          value={shortcut || s.shortcut}
          readOnly
          onFocus={() => setShortcut('Press a combination…')}
          onBlur={() => {
            if (shortcut === 'Press a combination…') setShortcut('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Tab') return;
            e.preventDefault();
            const key =
              e.code === 'Space'
                ? 'Space'
                : /^Key[A-Z]$/.test(e.code)
                  ? e.code.slice(3)
                  : /^F\d+$/.test(e.key)
                    ? e.key
                    : '';
            if (key)
              setShortcut(
                [e.ctrlKey ? 'Control' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', key]
                  .filter(Boolean)
                  .join('+'),
              );
          }}
        />
        <button
          disabled={busy || active || !shortcut || shortcut.startsWith('Press')}
          onClick={() => void patch({ shortcut })}
        >
          Save shortcut
        </button>
        <button
          onClick={() => {
            setShortcut('');
            void patch({ shortcut: 'Control+Shift+Space' });
          }}
          disabled={busy || active}
        >
          Reset
        </button>
      </div>
      <p className="hint">
        Click the field and press Ctrl + Shift + a key, or F6–F12. Conflicts keep the previous
        working shortcut. Toggle mode: press once to start, again to stop.
      </p>
      <p className="hint">
        Push-to-talk is unavailable in this release; global key-up handling has not been validated.
      </p>
    </>
  );

  return (
    <div className="app-shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('Home');
          }}
        >
          <Mark />
          <span>
            {brand.name}
            <small>VOICE DICTATION</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {['Home', 'Settings', 'Dictionary', 'History', 'About'].map((name, i) => (
            <button
              className={page === name ? 'selected' : ''}
              key={name}
              onClick={() => {
                setPage(name);
                if (name === 'History') void loadHistory();
              }}
            >
              <span aria-hidden="true">{['⌂', '⚙', 'Aa', '◷', 'ⓘ'][i]}</span>
              {name}
              {name === 'History' && !s.historyEnabled && <small>off</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className={`status-dot ${status.microphoneActive ? 'live' : ''}`} />
            {status.microphoneActive ? 'Microphone active' : 'Microphone off'}
          </div>
          <small>Your key. Your control.</small>
          <span className="version">v{status.version}</span>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>{page}</span>
          <span className="quiet">
            {status.hasKey ? 'GEMINI LIVE TRANSCRIBE' : 'WELCOME TO SEYVO'}
          </span>
        </header>
        <main>
          {(error || status.phase === 'error') && (
            <div className="notice error" role="alert">
              <span>{error || status.message}</span>
              <button
                aria-label="Dismiss error"
                onClick={() => {
                  setError('');
                  if (status.phase === 'error') void run(window.seyvo.action('dismiss'));
                }}
              >
                ×
              </button>
            </div>
          )}
          {page === 'Home' && (
            <>
              <div className="eyebrow">A LITTLE VOICE. A LITTLE LESS FRICTION.</div>
              <h1>
                {title}
                <span className="accent">.</span>
              </h1>
              <p className="lead">
                From a thought to a text field.
                <br />
                Just speak, and keep your flow.
              </p>
              {!s.onboardingComplete && (
                <section className="onboarding">
                  <div className="steps" aria-label="Setup progress">
                    {['Connect', 'Microphone', 'Shortcut', 'Try it'].map((label, i) => (
                      <button
                        className={step === i ? 'current' : ''}
                        key={label}
                        onClick={() => setStep(i)}
                      >
                        <b>{i + 1}</b>
                        {label}
                      </button>
                    ))}
                  </div>
                  <h2>
                    {
                      [
                        'Bring your own key',
                        'Find your voice',
                        'Make it your shortcut',
                        'Your first dictation',
                      ][step]
                    }
                  </h2>
                  {step === 0 ? (
                    keyPanel
                  ) : step === 1 ? (
                    micPanel
                  ) : step === 2 ? (
                    shortcutPanel
                  ) : (
                    <>
                      <p>
                        Open Notepad or a browser text field. Keep the caret there, press{' '}
                        <kbd>{s.shortcut.replaceAll('Control', 'Ctrl')}</kbd>, speak, then press
                        again. Seyvo never sends Enter.
                      </p>
                      <label htmlFor="practice">Dictation practice</label>
                      <textarea
                        id="practice"
                        aria-label="Dictation practice"
                        ref={practice}
                        placeholder="Your real dictation will appear here."
                      />
                      <button
                        disabled={!status.hasKey || busy || active}
                        onClick={() => {
                          practice.current?.focus();
                          void run(window.seyvo.action('practice'));
                        }}
                      >
                        Start practice · use shortcut to finish
                      </button>
                      <p>
                        Check the result in your target application. If insertion is uncertain, your
                        transcript stays in recovery.
                      </p>
                      <div className="button-row">
                        <button onClick={() => void run(window.seyvo.action('pasteTest'))}>
                          Copy Unicode paste test
                        </button>
                        <button
                          className="primary"
                          disabled={!status.hasKey || busy}
                          onClick={() => void patch({ onboardingComplete: true })}
                        >
                          Start using Seyvo
                        </button>
                      </div>
                    </>
                  )}
                  <div className="onboard-footer">
                    <small>No Seyvo account. No subscription.</small>
                    {step < 3 && <button onClick={() => setStep(step + 1)}>Continue →</button>}
                  </div>
                </section>
              )}
              {(s.onboardingComplete || active || status.recovery) && (
                <section className="dictation-card">
                  <div className="card-top">
                    <span className="pill">
                      <span className={`status-dot ${status.microphoneActive ? 'live' : ''}`} />
                      {status.microphoneActive ? 'RECORDING' : 'DICTATION'}
                    </span>
                    <kbd>{s.shortcut.replaceAll('Control', 'Ctrl')}</kbd>
                  </div>
                  <div className="dictation-visual">
                    <Mark />
                    <Wave
                      level={status.level}
                      reduced={s.reducedMotion}
                      dots={s.waveform === 'dots'}
                    />
                    {status.microphoneActive && <span>{time}</span>}
                  </div>
                  <p role="status">{status.message}</p>
                  <div className="button-row">
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        s.paused ||
                        !status.hasKey ||
                        (active && status.phase !== 'listening') ||
                        Boolean(status.recovery)
                      }
                      onClick={() =>
                        void run(
                          window.seyvo.action(status.phase === 'listening' ? 'stop' : 'start'),
                        )
                      }
                    >
                      {status.phase === 'listening' ? 'Finish dictation' : 'Start in 3 seconds'}
                    </button>
                    {active ? (
                      <button onClick={() => void run(window.seyvo.action('cancel'))}>
                        Cancel · Esc
                      </button>
                    ) : (
                      <button onClick={() => void patch({ paused: !s.paused })}>
                        {s.paused ? 'Resume Seyvo' : 'Pause Seyvo'}
                      </button>
                    )}
                  </div>
                  <small className="hint">
                    Start hides this window. Click your destination field within 3 seconds, or use
                    the shortcut there directly.
                  </small>
                </section>
              )}
              {status.recovery && (
                <section className="recovery">
                  <div className="section-heading">
                    <h2>Your transcript</h2>
                    <span className="pill">Temporary · in memory</span>
                  </div>
                  <p className="hint">
                    {status.message} Retry only after checking for an existing paste.
                  </p>
                  <pre>{status.recovery}</pre>
                  <div className="button-row">
                    <button
                      className="primary"
                      onClick={() => void run(window.seyvo.action('copy'))}
                    >
                      Copy text
                    </button>
                    <button
                      disabled={active}
                      onClick={() => {
                        if (
                          confirm(
                            'Check the original field first. Retrying can duplicate text that already pasted. Continue?',
                          )
                        )
                          void run(window.seyvo.action('retry'));
                      }}
                    >
                      Retry inserting
                    </button>
                    <button
                      disabled={active}
                      onClick={() => void run(window.seyvo.action('dismiss'))}
                    >
                      Dismiss
                    </button>
                  </div>
                </section>
              )}
              <div className="feature-grid">
                <div>
                  <span>01</span>
                  <h3>Put your cursor anywhere</h3>
                  <p>Choose a supported text field in the app you’re already using.</p>
                </div>
                <div>
                  <span>02</span>
                  <h3>Say it naturally</h3>
                  <p>Smart transcription handles punctuation and spoken corrections.</p>
                </div>
                <div>
                  <span>03</span>
                  <h3>Keep the final say</h3>
                  <p>Your words are inserted, never automatically submitted.</p>
                </div>
              </div>
              <footer>
                <span>⌁ &nbsp; Cloud transcription · Local control</span>
                {link('Compatibility guide', 'help')}
              </footer>
            </>
          )}
          {page === 'Settings' && (
            <>
              <div className="eyebrow">MAKE ROOM FOR YOUR FLOW</div>
              <h1>
                Preferences<span className="accent">.</span>
              </h1>
              <section>
                <h2>Google connection</h2>
                {keyPanel}
              </section>
              <section>
                <h2>Dictation</h2>
                {shortcutPanel}
                {micPanel}
                {select(
                  'Transcription',
                  s.mode,
                  [
                    ['SMART', 'Smart · clean & structured'],
                    ['VERBATIM', 'Verbatim · as spoken'],
                  ],
                  (value) => void patch({ mode: value as 'SMART' | 'VERBATIM' }),
                )}
                {select(
                  'Language hint',
                  s.languages.join(','),
                  [
                    ['', 'Automatic · multilingual'],
                    ['en-IN', 'English (India)'],
                    ['hi-IN', 'Hindi'],
                    ['hi-IN,en-IN', 'Hindi + English'],
                    ['bn-IN', 'Bengali'],
                    ['en-US', 'English (US)'],
                  ],
                  (value) => void patch({ languages: value ? value.split(',') : [] }),
                )}
                {select(
                  'When finished',
                  s.insertion,
                  [
                    ['paste', 'Paste into original field'],
                    ['copy', 'Copy only'],
                    ['unicode', 'Direct Unicode · single line'],
                  ],
                  (value) => void patch({ insertion: value as 'paste' | 'copy' | 'unicode' }),
                )}
                {select(
                  'Maximum duration',
                  String(s.maxSeconds),
                  [
                    ['60', '1 minute'],
                    ['180', '3 minutes'],
                    ['300', '5 minutes'],
                    ['540', '9 minutes'],
                  ],
                  (value) => void patch({ maxSeconds: Number(value) }),
                )}
                {toggle(
                  'Trim outer whitespace',
                  'Paragraphs and internal newlines are preserved.',
                  s.trimWhitespace,
                  (value) => void patch({ trimWhitespace: value }),
                )}
                {toggle(
                  'Sound cues',
                  'Short start, stop and error tones. Uses Windows output volume and mute.',
                  s.soundCues,
                  (value) => void patch({ soundCues: value }),
                  active,
                )}
                <button
                  disabled={!s.soundCues || busy || active}
                  onClick={() => void run(window.seyvo.action('testSound'))}
                >
                  Preview sound cue
                </button>
              </section>
              <section>
                <h2>General</h2>
                {toggle(
                  'Launch when I sign in',
                  status.startupAvailable
                    ? 'Per-user Windows startup registration.'
                    : 'Available in the installed build.',
                  status.startup,
                  (value) => void run(window.seyvo.startup(value)),
                  !status.startupAvailable,
                )}
                {toggle(
                  'Start minimized',
                  'Open quietly in the system tray after setup.',
                  s.startMinimized,
                  (value) => void patch({ startMinimized: value }),
                )}
                {toggle(
                  'Keep running when closed',
                  'Close hides the window. Quit from the tray to exit.',
                  s.closeToTray,
                  (value) => void patch({ closeToTray: value }),
                )}
                {toggle(
                  'Pause dictation',
                  'Unregisters the global shortcut and cancels recording.',
                  s.paused,
                  (value) => void patch({ paused: value }),
                )}
                <button
                  onClick={() => {
                    setStep(0);
                    setPage('Home');
                    void patch({ onboardingComplete: false });
                  }}
                >
                  Show setup again
                </button>
              </section>
              <section>
                <h2>Appearance</h2>
                {select(
                  'Theme',
                  s.theme,
                  [
                    ['system', 'Follow Windows'],
                    ['dark', 'Dark'],
                    ['light', 'Light'],
                  ],
                  (value) => void patch({ theme: value as 'system' | 'dark' | 'light' }),
                )}
                {select(
                  'Accent',
                  s.accent,
                  [
                    ['blue', 'Glacier blue'],
                    ['violet', 'Violet'],
                    ['teal', 'Teal'],
                  ],
                  (value) => void patch({ accent: value as 'blue' | 'violet' | 'teal' }),
                )}
                {toggle(
                  'Show recording bubble',
                  'The tray always shows microphone state.',
                  s.showOverlay,
                  (value) => void patch({ showOverlay: value }),
                )}
                {select(
                  'Bubble placement',
                  s.overlayPosition,
                  [
                    ['bottom', 'Bottom of active monitor'],
                    ['top', 'Top of active monitor'],
                  ],
                  (value) => void patch({ overlayPosition: value as 'bottom' | 'top' }),
                )}
                {select(
                  'Bubble size',
                  s.overlaySize,
                  [
                    ['compact', 'Compact'],
                    ['standard', 'Standard'],
                    ['large', 'Large'],
                  ],
                  (value) => void patch({ overlaySize: value as 'compact' | 'standard' | 'large' }),
                )}
                {select(
                  'Waveform',
                  s.waveform,
                  [
                    ['bars', 'Bars'],
                    ['dots', 'Dots'],
                  ],
                  (value) => void patch({ waveform: value as 'bars' | 'dots' }),
                )}
                {toggle(
                  'Reduced motion',
                  'Use static levels; Windows motion preferences are also respected.',
                  s.reducedMotion,
                  (value) => void patch({ reducedMotion: value }),
                )}
                {toggle(
                  'Live captions',
                  'Show interim speech on screen. It may contain sensitive text.',
                  s.captions,
                  (value) => void patch({ captions: value }),
                )}
              </section>
              <section>
                <h2>Privacy & data</h2>
                {toggle(
                  'Store local transcript history',
                  'Encrypted on this account. Turning off deletes saved history. Audio is never saved.',
                  s.historyEnabled,
                  (value) => {
                    if (value || confirm('Turn history off and delete saved transcripts?'))
                      void patch({ historyEnabled: value });
                  },
                )}
                {select(
                  'History retention',
                  String(s.historyDays),
                  [
                    ['1', '1 day'],
                    ['7', '7 days'],
                    ['30', '30 days'],
                    ['90', '90 days'],
                  ],
                  (value) => void patch({ historyDays: Number(value) }),
                )}
                {toggle(
                  'Include destination app in history',
                  'App executable name only; no window titles or field contents.',
                  s.historyAppNames,
                  (value) => void patch({ historyAppNames: value }),
                )}
                <label htmlFor="excluded">Excluded applications</label>
                <textarea
                  id="excluded"
                  defaultValue={s.excludedApps.join('\n')}
                  placeholder={'One executable per line, e.g.\nKeePass.exe'}
                  onBlur={(e) =>
                    void patch({
                      excludedApps: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="hint">
                  No microphone activation in excluded apps. No analytics, audio files, or Seyvo
                  server.
                </p>
                {link('Google privacy policy', 'privacy')}
              </section>
              <section>
                <h2>Troubleshooting</h2>
                <dl>
                  <dt>Windows helper</dt>
                  <dd>{status.nativeAvailable ? 'Available' : 'Unavailable · restart Seyvo'}</dd>
                  <dt>Global shortcut</dt>
                  <dd>
                    {status.shortcutRegistered
                      ? 'Registered'
                      : s.paused
                        ? 'Paused'
                        : 'Not registered'}
                  </dd>
                  <dt>Last target</dt>
                  <dd>{status.targetApp || 'None'}</dd>
                </dl>
                <div className="button-row">
                  <button onClick={() => void run(window.seyvo.action('diagnostics'))}>
                    Copy safe diagnostics
                  </button>
                  <button onClick={() => void run(window.seyvo.action('pasteTest'))}>
                    Copy Unicode paste test
                  </button>
                </div>
                <p className="hint">
                  Diagnostics include only version and coarse status, never keys, transcripts or
                  clipboard contents. Copying diagnostics replaces your clipboard.
                </p>
                {link('Troubleshooting guide', 'help')}
              </section>
            </>
          )}
          {page === 'Dictionary' && (
            <>
              <div className="eyebrow">THE WORDS THAT MATTER TO YOU</div>
              <h1>
                Your vocabulary<span className="accent">.</span>
              </h1>
              <p className="lead">Names, acronyms, and the things you say your way.</p>
              <section>
                {toggle(
                  'Coding vocabulary',
                  `${codingVocabulary.length} optional technical terms, sent to Google with dictation. No app contents are read.`,
                  s.codingVocabulary,
                  (value) => void patch({ codingVocabulary: value }),
                  active,
                )}
                <details>
                  <summary>View coding terms</summary>
                  <p>
                    {codingVocabulary.join(', ')}. Your own dictionary takes priority at the
                    1,000-term limit.
                  </p>
                </details>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (word.trim()) {
                      const dictionary = editingWord
                        ? s.dictionary.map((term) => (term === editingWord ? word.trim() : term))
                        : [...s.dictionary, word.trim()];
                      void run(
                        window.seyvo.updateSettings({ dictionary: [...new Set(dictionary)] }),
                      ).then((saved) => {
                        if (saved) {
                          setWord('');
                          setEditingWord(undefined);
                        }
                      });
                    }
                  }}
                >
                  <label htmlFor="word">
                    {editingWord ? 'Edit word or phrase' : 'Add a word or phrase'}
                  </label>
                  <div className="input-line">
                    <input
                      id="word"
                      value={word}
                      onChange={(e) => setWord(e.target.value)}
                      placeholder="e.g. Kubernetes, Tirthankar, Seyvo"
                      maxLength={100}
                    />
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        active ||
                        !word.trim() ||
                        (!editingWord && s.dictionary.length >= 1000)
                      }
                    >
                      {editingWord ? 'Save word' : 'Add word'}
                    </button>
                    {editingWord && (
                      <button
                        type="button"
                        onClick={() => {
                          setWord('');
                          setEditingWord(undefined);
                        }}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
                <p className="hint">
                  {s.dictionary.length} / 1,000 terms. About 100 focused entries work best. Your
                  vocabulary is sent to Google with each dictation session.
                </p>
                <div className="word-list">
                  {s.dictionary.map((term) => (
                    <span key={term}>
                      <button
                        className="word-edit"
                        aria-label={`Edit ${term}`}
                        disabled={busy || active}
                        onClick={() => {
                          setEditingWord(term);
                          setWord(term);
                          document.getElementById('word')?.focus();
                        }}
                      >
                        {term}
                      </button>
                      <button
                        aria-label={`Remove ${term}`}
                        disabled={busy || active}
                        onClick={() =>
                          void patch({ dictionary: s.dictionary.filter((t) => t !== term) })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {!s.dictionary.length && (
                  <div className="empty">
                    <span>Aa</span>
                    <h3>A space for your words</h3>
                    <p>Add technical terms and names to guide recognition.</p>
                  </div>
                )}
                <div className="button-row">
                  <button
                    disabled={busy || active}
                    onClick={() => void run(window.seyvo.dictionary('import'))}
                  >
                    Import JSON
                  </button>
                  <button onClick={() => void run(window.seyvo.dictionary('export'))}>
                    Export JSON
                  </button>
                  <button
                    disabled={!s.dictionary.length || busy || active}
                    onClick={() => {
                      if (confirm('Clear all dictionary entries?')) void patch({ dictionary: [] });
                    }}
                  >
                    Clear dictionary
                  </button>
                </div>
              </section>
            </>
          )}
          {page === 'History' && (
            <>
              <div className="eyebrow">ONLY IF YOU CHOOSE TO KEEP IT</div>
              <h1>
                A trail of thoughts<span className="accent">.</span>
              </h1>
              <p className="lead">Your finalized words, encrypted on this device.</p>
              {!s.historyEnabled ? (
                <section className="empty">
                  <span>◷</span>
                  <h2>History is off</h2>
                  <p>
                    Dictations are not saved by default. Temporary recovery stays in memory until
                    you dismiss it or quit.
                  </p>
                  <button
                    onClick={() => {
                      void patch({ historyEnabled: true });
                    }}
                  >
                    Enable local history
                  </button>
                </section>
              ) : (
                <section>
                  <div className="input-line">
                    <input
                      aria-label="Search history"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search your transcripts"
                    />
                    <button onClick={() => void loadHistory()}>Refresh</button>
                  </div>
                  {history
                    .filter((e) => e.text.toLowerCase().includes(search.toLowerCase()))
                    .map((entry) => (
                      <article className="history-entry" key={entry.id}>
                        <small>
                          {new Date(entry.timestamp).toLocaleString()}
                          {entry.app ? ` · ${entry.app}` : ''}
                        </small>
                        <p>{entry.text}</p>
                        <button onClick={() => void run(window.seyvo.history('copy', entry.id))}>
                          Copy
                        </button>
                        <button
                          onClick={async () => {
                            const value = await run(window.seyvo.history('delete', entry.id));
                            if (value) setHistory(value);
                          }}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
                  {!history.length && (
                    <div className="empty">
                      <p>Your next finalized dictation will appear here.</p>
                    </div>
                  )}
                  <div className="button-row">
                    <button onClick={() => void run(window.seyvo.history('export'))}>
                      Export unencrypted JSON
                    </button>
                    <button
                      className="danger-text"
                      onClick={async () => {
                        if (confirm('Permanently delete all local transcript history?')) {
                          const value = await run(window.seyvo.history('clear'));
                          if (value) setHistory(value);
                        }
                      }}
                    >
                      Clear all history
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          {page === 'About' && (
            <>
              <div className="about-brand">
                <Mark />
                <h1>
                  {brand.name}
                  <span className="accent">.</span>
                </h1>
                <p>{brand.tagline}</p>
              </div>
              <section>
                <h2>Less typing. More you.</h2>
                <p>
                  An independent, open-source Windows utility by Tirthankar Dasgupta. No Seyvo
                  subscription or account. Bring your own Gemini API key; Google pricing, quotas,
                  and data terms apply.
                </p>
                <dl>
                  <dt>Version</dt>
                  <dd>{status.version} · development release</dd>
                  <dt>Build</dt>
                  <dd data-testid="build-hash">{status.buildHash}</dd>
                  <dt>Maintainer</dt>
                  <dd>{brand.maintainer}</dd>
                  <dt>License</dt>
                  <dd>MIT · commercial use permitted</dd>
                  <dt>Updates</dt>
                  <dd>Manual download from GitHub Releases</dd>
                  <dt>Architecture</dt>
                  <dd>Windows x64</dd>
                </dl>
                <div className="button-row">
                  {link('Source & license', 'source')}
                  {link('Check releases', 'releases')}
                  {link('Google pricing', 'pricing')}
                  {link('Google terms', 'terms')}
                  {link('Seyvo privacy policy', 'appPrivacy')}
                  {link('Contributors', 'contributors')}
                </div>
                <p className="hint">
                  Seyvo is not affiliated with Google or Wispr Flow. Working brand pending trademark
                  clearance. No automatic updates are installed.
                </p>
              </section>
              <section>
                <h2>Built with care</h2>
                <p>
                  Electron, React, Google Gen AI types, and Windows APIs. Original Seyvo artwork;
                  system Segoe UI typography. Third-party license notices ship with the application.
                </p>
                <p>
                  Cloud audio is processed by Google. Clipboard insertion temporarily places text on
                  the system clipboard; other apps or Windows clipboard history may observe it.
                  Protected and elevated apps may refuse insertion.
                </p>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
