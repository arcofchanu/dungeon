/**
 * Minimal CDP driver — launches headless Edge, navigates, evaluates a script
 * in the page with real (not virtual) time, prints the JSON result.
 *
 *   node scripts/drive.mjs <url> <script-file> [timeoutMs]
 *
 * The script file is evaluated as the body of an async function; whatever it
 * returns is JSON-serialised to stdout. Console messages and page errors are
 * forwarded so a failure inside the page is visible here.
 *
 * Exists because `msedge --headless --screenshot/--dump-dom` fires at the load
 * event and runs on a virtual clock — Pagefind's WASM never settles under it,
 * so neither flag can test search.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [, , url, scriptFile, timeoutArg] = process.argv;
if (!url || !scriptFile) {
  console.error('usage: node scripts/drive.mjs <url> <script-file> [timeoutMs]');
  process.exit(2);
}
const TIMEOUT = Number(timeoutArg ?? 60000);

const EDGE =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const PORT = 9333 + (process.pid % 200);
const body = await readFile(scriptFile, 'utf8');

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '\\yozakura-cdp-' + process.pid,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws;
const cleanup = () => {
  try {
    ws?.close();
  } catch {}
  edge.kill();
};
process.on('exit', cleanup);

/** Poll the DevTools HTTP endpoint until the browser is listening. */
async function targets() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await response.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await delay(250);
  }
  throw new Error('Edge did not expose a DevTools page target');
}

const page = await targets();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const events = [];

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  events.push(message);
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = (message.params.args ?? [])
      .map((a) => a.value ?? a.description ?? a.type)
      .join(' ');
    console.error(`[page:${message.params.type}] ${text}`);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const d = message.params.exceptionDetails;
    console.error(`[page:error] ${d.text} ${d.exception?.description ?? ''}`);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send('Runtime.enable');
await send('Page.enable');

const loaded = new Promise((resolve) => {
  const check = setInterval(() => {
    if (events.some((e) => e.method === 'Page.loadEventFired')) {
      clearInterval(check);
      resolve();
    }
  }, 50);
});

await send('Page.navigate', { url });
await Promise.race([loaded, delay(TIMEOUT).then(() => {
  throw new Error('navigation timed out');
})]);

const result = await send('Runtime.evaluate', {
  expression: `(async () => { ${body} })()`,
  awaitPromise: true,
  returnByValue: true,
  timeout: TIMEOUT,
});

if (result.exceptionDetails) {
  console.error('page exception:', JSON.stringify(result.exceptionDetails, null, 2));
  cleanup();
  process.exit(1);
}

console.log(
  typeof result.result.value === 'string'
    ? result.result.value
    : JSON.stringify(result.result.value, null, 2),
);

cleanup();
process.exit(0);
