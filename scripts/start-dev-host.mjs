import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 3000;
const url = `http://${host}:${port}/`;
const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const logDir = join(repoRoot, '.dev-server');
const outLog = join(logDir, 'vite.out.log');
const errLog = join(logDir, 'vite.err.log');

function requestStatus() {
  return new Promise((resolveStatus) => {
    const req = get(url, (res) => {
      res.resume();
      resolveStatus(res.statusCode ?? 0);
    });

    req.setTimeout(1000, () => {
      req.destroy();
      resolveStatus(0);
    });

    req.on('error', () => resolveStatus(0));
  });
}

async function waitForServer(timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await requestStatus();
    if (status >= 200 && status < 500) {
      return status;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  return 0;
}

if (!existsSync(viteBin)) {
  console.error(`Vite bulunamadi: ${viteBin}. Once npm install calistirin.`);
  process.exit(1);
}

const existingStatus = await requestStatus();
if (existingStatus >= 200 && existingStatus < 500) {
  console.log(`DersRotasi zaten calisiyor: ${url} (${existingStatus})`);
  process.exit(0);
}

mkdirSync(logDir, { recursive: true });

const out = openSync(outLog, 'a');
const err = openSync(errLog, 'a');

const child = spawn(
  process.execPath,
  [viteBin, '--host', host, '--port', String(port), '--strictPort'],
  {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true,
  },
);

child.unref();

const status = await waitForServer();
if (!status) {
  console.error(`DersRotasi dev server baslamadi. Loglar: ${outLog} / ${errLog}`);
  process.exit(1);
}

console.log(`DersRotasi hazir: ${url} (${status})`);
