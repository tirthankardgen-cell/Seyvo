import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('acceptance diagnostics', () => {
  it('withholds both values when an uncaught text comparison fails', () => {
    const actual = 'synthetic-private-clipboard-sentinel';
    const expected = 'synthetic-private-transcript-sentinel';
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "import { assertPrivateText } from './scripts/private-text.mjs'; assertPrivateText(process.env.SEYVO_TEST_ACTUAL, process.env.SEYVO_TEST_EXPECTED);",
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, SEYVO_TEST_ACTUAL: actual, SEYVO_TEST_EXPECTED: expected },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('contents withheld');
    expect(result.stdout + result.stderr).not.toContain(actual);
    expect(result.stdout + result.stderr).not.toContain(expected);
  });

  it('accepts matching Unicode without printing it', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        "import { assertPrivateText } from './scripts/private-text.mjs'; assertPrivateText('नमस्ते 🌍', 'नमस्ते 🌍');",
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
  });
});
