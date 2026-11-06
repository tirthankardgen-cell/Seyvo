import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
await mkdir('artifacts/native', { recursive: true });
const compiler = join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const compiled = spawnSync(
  compiler,
  [
    '/nologo',
    '/target:exe',
    '/platform:x64',
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Drawing.dll',
    `/out:${join(process.cwd(), 'artifacts/native/TestHost.exe')}`,
    join(process.cwd(), 'tests/native/TestHost.cs'),
  ],
  { encoding: 'utf8' },
);
if (compiled.status) throw new Error(compiled.stdout);
function processLines(file) {
  const child = spawn(file, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const queue = [];
  const waiting = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const next = waiting.shift();
    if (next) next(line);
    else queue.push(line);
  });
  return {
    child,
    next: () =>
      queue.length
        ? Promise.resolve(queue.shift())
        : new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Native test timed out')), 8000);
            waiting.push((line) => {
              clearTimeout(timer);
              resolve(line);
            });
          }),
    send: (data) => child.stdin.write(data + '\n'),
  };
}
const helper = processLines('native-win/bin/Seyvo.Native.exe');
const host = processLines('artifacts/native/TestHost.exe');
let id = 0;
async function call(command, params = {}) {
  helper.send(JSON.stringify({ id: ++id, command, ...params }));
  return JSON.parse(await helper.next());
}
const results = [];
try {
  assert.equal(await host.next(), 'ready');
  host.send('focus');
  assert.equal(
    await host.next(),
    'focused',
    'Windows did not grant foreground to the isolated host; no input was sent.',
  );
  const target = await call('capture', { ownPid: process.pid });
  assert.equal(target.ok, true, JSON.stringify(target));
  assert.equal(
    target.result.app.toLowerCase(),
    'testhost.exe',
    'The isolated test host must be foreground; no input is sent elsewhere.',
  );
  const text = 'Seyvo Windows test — नमस्ते 🌍\nSecond paragraph.';
  const directText = 'Seyvo Windows test — नमस्ते 🌍';
  const direct = await call('insert', {
    token: target.result.token,
    text: directText,
    method: 'unicode',
  });
  assert.equal(direct.ok, true, JSON.stringify(direct));
  await new Promise((resolve) => setTimeout(resolve, 200));
  host.send('text');
  assert.equal(Buffer.from(await host.next(), 'base64').toString(), directText);
  results.push('PASS: real SendInput Unicode injection; Hindi and emoji preserved.');
  const caretChanged = await call('insert', {
    token: target.result.token,
    text: 'must not insert',
    method: 'paste',
  });
  assert.equal(caretChanged.ok, false);
  results.push('PASS: one-shot target token blocks a duplicate input attempt.');
  // Only seed an empty clipboard. Never back up or replace user clipboard data.
  host.send('clipboard-test');
  const prepared = await host.next();
  if (prepared === 'clipboard-prepared') {
    host.send('clear');
    await host.next();
    host.send('focus');
    assert.equal(await host.next(), 'focused');
    const pasteTarget = await call('capture', { ownPid: process.pid });
    assert.equal(pasteTarget.result.app.toLowerCase(), 'testhost.exe');
    const pasted = await call('insert', { token: pasteTarget.result.token, text, method: 'paste' });
    assert.equal(pasted.ok, true, JSON.stringify(pasted));
    assert.equal(pasted.result.restored, true);
    host.send('text');
    assert.equal(
      Buffer.from(await host.next(), 'base64')
        .toString()
        .replaceAll('\r\n', '\n'),
      text,
    );
    host.send('clipboard-original');
    assert.equal(await host.next(), 'clipboard-preserved');
    results.push(
      'PASS: real multiline clipboard paste preserves Hindi/emoji and restores the synthetic original clipboard.',
    );
    host.send('clear');
    await host.next();
    host.send('clipboard-race');
    await host.next();
    host.send('focus');
    assert.equal(await host.next(), 'focused');
    const raceTarget = await call('capture', { ownPid: process.pid });
    assert.equal(raceTarget.result.app.toLowerCase(), 'testhost.exe');
    const race = await call('insert', {
      token: raceTarget.result.token,
      text: 'Synthetic race test',
      method: 'paste',
    });
    assert.ok(
      race.ok ? race.result.restored === false : race.error === 'clipboard-busy',
      JSON.stringify(race),
    );
    host.send('clipboard-changed');
    assert.equal(await host.next(), 'new-clipboard-preserved');
    results.push(
      'PASS: concurrent clipboard change is preserved instead of being overwritten by restoration.',
    );
  } else {
    assert.equal(prepared, 'clipboard-not-empty');
    results.push(
      'SKIP: controlled clipboard restoration/race cases require an empty desktop clipboard.',
    );
  }
  host.send('readonly');
  await host.next();
  const readOnly = await call('capture', { ownPid: process.pid });
  assert.equal(readOnly.ok, false);
  results.push('PASS: read-only field rejected before input.');
  host.send('button');
  assert.equal(await host.next(), 'button-focused');
  let nonText;
  for (let attempt = 0; attempt < 10; attempt++) {
    nonText = await call('capture', { ownPid: process.pid });
    if (nonText.error === 'choose-text-field') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(nonText.ok, false);
  assert.equal(nonText.error, 'choose-text-field');
  results.push('PASS: buttons and other non-text controls are rejected before input.');
  await writeFile('artifacts/native/results.txt', results.join('\n') + '\n');
  console.log(results.join('\n'));
} finally {
  try {
    host.send('clipboard-restore');
    assert.equal(
      await host.next(),
      'clipboard-restored',
      'Original desktop clipboard must be restored.',
    );
  } finally {
    host.send('quit');
    host.child.kill();
    helper.child.kill();
  }
}
