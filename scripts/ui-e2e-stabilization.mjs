import { spawn } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const DATE = '2026-05-17';
const ROOT = process.cwd();
const NODE_BIN = process.execPath;
const CHROME_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE_URL = 'http://127.0.0.1:3000';
const DEVTOOLS_PORT = 9333;
const APP_IDB_NAME = 'dersrotasi-app-state-v1';

const ARTIFACT_DIR = path.join(ROOT, 'docs', `e2e-artifacts-${DATE}-stabilization`);
const CHROME_PROFILE_ROOT = path.join(ROOT, 'node_modules', '.cache', 'ui-e2e-profiles');
const JSON_PATH = path.join(ARTIFACT_DIR, 'ui-e2e-result.json');
const RUN_LOG = path.join(ARTIFACT_DIR, 'ui-e2e.log');
const VITE_LOG = path.join(ARTIFACT_DIR, 'vite.log');
const HEAVY_LOG = path.join(ARTIFACT_DIR, 'test-heavy.log');
const REPORT_PATH = path.join(ROOT, 'docs', `ebeveyn-karar-ekrani-ui-e2e-raporu-${DATE}.md`);

const nowIso = () => new Date().toISOString();
const toLink = (p) => p.replace(/\\/g, '/');
const wait = (ms) => delay(ms);

const log = async (line) => appendFile(RUN_LOG, `${nowIso()} ${line}\n`, 'utf8');

const shotName = (id, label) => `${String(id).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;

const probeHttp = async (url, timeoutMs = 2000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return true;
    } catch {
      // retry
    }
    await wait(250);
  }
  return false;
};

const waitForHttp = async (url, timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeHttp(url, 400)) return true;
    await wait(350);
  }
  return false;
};

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.seq = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });

    this.ws.addEventListener('message', async (evt) => {
      let raw = evt.data;
      try {
        if (typeof raw !== 'string') {
          if (typeof raw?.text === 'function') raw = await raw.text();
          else if (raw instanceof Uint8Array) raw = Buffer.from(raw).toString('utf8');
          else raw = String(raw);
        }
        const payload = JSON.parse(raw);
        if (!payload.id) return;
        const waiter = this.pending.get(payload.id);
        if (!waiter) return;
        this.pending.delete(payload.id);
        if (payload.error) waiter.reject(new Error(payload.error.message || 'CDP error'));
        else waiter.resolve(payload.result || {});
      } catch {
        // ignore non-JSON frames/parse errors
      }
    });
  }

  async send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      return { ok: false, error: result.exceptionDetails.text || 'Runtime.evaluate failed' };
    }
    return { ok: true, value: result.result?.value };
  }

  async screenshot(filePath) {
    const response = await this.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });
    await writeFile(filePath, Buffer.from(response.data, 'base64'));
    return filePath;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // noop
    }
  }
}

const waitPageReady = async (client, timeoutMs = 25000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await client.evaluate(`(() => document.readyState === 'complete')()`);
    if (ready.ok && ready.value) return true;
    await wait(250);
  }
  return false;
};

const waitForSelector = async (client, selector, timeoutMs = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const exists = await evalValue(client, `(() => Boolean(document.querySelector(${JSON.stringify(selector)})))()`, false);
    if (exists) return true;
    await wait(250);
  }
  return false;
};

const evalValue = async (client, expression, fallback = null) => {
  const result = await client.evaluate(expression);
  return result.ok ? result.value : fallback;
};

const clickSelector = async (client, selector) =>
  evalValue(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return { clicked: false, reason: 'not-found' };
    element.click();
    return { clicked: true };
  })()`, { clicked: false, reason: 'eval-failed' });

const textOf = async (client, selector) =>
  evalValue(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    return (element?.textContent || '').trim();
  })()`, '');

const numberFromText = (value) => {
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const setSelectValue = async (client, selector, value) =>
  evalValue(client, `(() => {
    const select = document.querySelector(${JSON.stringify(selector)});
    if (!select) return { ok: false, reason: 'not-found' };
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: select.value };
  })()`, { ok: false, reason: 'eval-failed' });

const startViteIfNeeded = async () => {
  if (await probeHttp(`${BASE_URL}/`, 1000)) {
    await log('vite already running');
    return null;
  }

  const vite = spawn(
    NODE_BIN,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000', '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  vite.stdout.on('data', (chunk) => appendFile(VITE_LOG, chunk.toString(), 'utf8'));
  vite.stderr.on('data', (chunk) => appendFile(VITE_LOG, chunk.toString(), 'utf8'));

  const ready = await waitForHttp(`${BASE_URL}/`, 60000);
  if (!ready) throw new Error('Vite server did not become ready.');
  await log('vite started by ui-e2e script');
  return vite;
};

const startChrome = async () => {
  await mkdir(CHROME_PROFILE_ROOT, { recursive: true });
  const profileDir = path.join(CHROME_PROFILE_ROOT, `chrome-profile-${Date.now()}-${process.pid}`);
  const chrome = spawn(CHROME_BIN, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--no-first-run',
    `--remote-debugging-port=${DEVTOOLS_PORT}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const ready = await waitForHttp(`http://127.0.0.1:${DEVTOOLS_PORT}/json/version`, 30000);
  if (!ready) throw new Error('Chrome CDP endpoint did not become ready.');
  return chrome;
};

const createTargetWsUrl = async (url) => {
  const endpoint = `http://127.0.0.1:${DEVTOOLS_PORT}/json/new?${encodeURIComponent(url)}`;
  let response;
  try {
    response = await fetch(endpoint, { method: 'PUT' });
  } catch {
    response = await fetch(endpoint);
  }
  if (!response.ok) throw new Error(`CDP target create failed: ${response.status}`);
  const payload = await response.json();
  if (!payload.webSocketDebuggerUrl) throw new Error('No webSocketDebuggerUrl found.');
  return payload.webSocketDebuggerUrl;
};

const resetAppStorageDeterministic = async (client) => {
  await client.send('Page.navigate', { url: 'about:blank' });
  await waitPageReady(client, 10000);
  await wait(120);
  const idbDeleteResult = await evalValue(client, `(() => new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve('no-idb');
      return;
    }
    const req = indexedDB.deleteDatabase(${JSON.stringify(APP_IDB_NAME)});
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.onsuccess = () => done('success');
    req.onerror = () => done('error');
    req.onblocked = () => done('blocked');
    setTimeout(() => done('timeout'), 1800);
  }))()`, 'unknown');
  return idbDeleteResult;
};

const waitForAnalysisSurface = async (client, timeoutMs = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snapshot = await evalValue(client, `(() => {
      const workspace = Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]'));
      const heading = Boolean(Array.from(document.querySelectorAll('h1,h2,h3')).find((node) => (node.textContent || '').includes('Ebeveyn Karar Ekrani')));
      const loading = (document.body?.innerText || '').includes('Analiz yukleniyor');
      const stateCard = Boolean(document.querySelector('[data-testid^="analysis-state-card-"]'));
      const fatal = Boolean(document.querySelector('[data-testid="fatal-error-screen"]'));
      return { workspace, heading, loading, stateCard, fatal };
    })()`, { workspace: false, heading: false, loading: false, stateCard: false, fatal: false });
    if (snapshot.fatal || snapshot.workspace || snapshot.heading || snapshot.loading || snapshot.stateCard) {
      return snapshot;
    }
    await wait(250);
  }
  return { workspace: false, heading: false, loading: false, stateCard: false, fatal: false, timeout: true };
};

const go = async (client, { qaRecords = 'manual', analysisTab = 'overview', e2e = true } = {}) => {
  const query = new URLSearchParams({
    quick: 'analysis',
    qaRecords,
    analysisTab,
    t: String(Date.now()),
  });
  if (e2e) query.set('e2e', '1');
  const url = `${BASE_URL}/?${query.toString()}`;
  await client.send('Page.navigate', { url });
  await waitPageReady(client, 30000);
  await wait(350);
  if (e2e) {
    let parentReady = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      parentReady = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]')) )()`, false);
      if (parentReady) break;

      const lockVisible = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="parent-lock-screen"]')) )()`, false);
      if (lockVisible) {
        await evalValue(client, `(() => {
          const input = document.querySelector('[data-testid="parent-lock-password-input"]');
          if (!input) return false;
          input.value = '1234';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`, false);
      }

      const childVisible = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="child-dashboard-root"]')) )()`, false);
      if (childVisible) {
        await clickSelector(client, '[data-testid="switch-parent-mode-btn"]');
      }
      await wait(350);
    }
    await clickSelector(client, `[data-testid="analysis-tab-${analysisTab}"]`);
    await wait(300);
  }
  return url;
};

const runNpmScript = async (scriptName, logPath) => {
  const command = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`], { cwd: ROOT, shell: false })
    : spawn('npm', ['run', scriptName], { cwd: ROOT, shell: false });

  const output = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    command.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    command.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    command.on('error', reject);
    command.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${scriptName} failed with code ${code}\n${stdout}\n${stderr}`));
    });
  });

  await writeFile(logPath, `${output.stdout}\n${output.stderr}`, 'utf8');
  return output;
};

const writeMarkdownReport = async ({ tests, isolationChecks, summary }) => {
  const lines = [];
  lines.push(`# Ebeveyn Karar Ekrani UI/E2E Raporu (${DATE})`);
  lines.push('');
  lines.push('## Test ortami');
  lines.push(`- Uygulama URL: \`${summary.appUrl}\``);
  lines.push(`- Kanit klasoru: [${path.basename(ARTIFACT_DIR)}](${toLink(ARTIFACT_DIR)})`);
  lines.push(`- Ham JSON: [ui-e2e-result.json](${toLink(JSON_PATH)})`);
  lines.push(`- Kosu logu: [ui-e2e.log](${toLink(RUN_LOG)})`);
  lines.push(`- Vite logu: [vite.log](${toLink(VITE_LOG)})`);
  lines.push('');

  for (const item of tests) {
    lines.push(`## ${item.id}) ${item.name}`);
    lines.push(`- test adi: \`${item.name}\``);
    lines.push(`- kullanilan veri: \`${item.data}\``);
    lines.push(`- kullanilan selector/test-id: ${(item.selectors || []).map((entry) => `\`${entry}\``).join(', ') || '-'}`);
    lines.push(`- beklenen sonuc: ${item.expected}`);
    lines.push(`- gercek sonuc: ${item.actualSummary || `\`${JSON.stringify(item.actual)}\``}`);
    lines.push(`- PASS/FAIL: \`${item.pass ? 'PASS' : 'FAIL'}\``);
    lines.push(`- ilgili dosya: ${item.related}`);
    const evidences = Array.isArray(item.evidence) ? item.evidence : [];
    if (evidences.length > 0) {
      lines.push(`- screenshot/log: ${evidences.map((entry) => `[${path.basename(entry)}](${toLink(entry)})`).join(', ')}`);
    } else {
      lines.push('- screenshot/log: -');
    }
    lines.push('- ham JSON sonucu:');
    lines.push('```json');
    lines.push(JSON.stringify({
      id: item.id,
      name: item.name,
      selectors: item.selectors || [],
      expected: item.expected,
      actual: item.actual,
      pass: item.pass,
      elapsedMs: item.elapsedMs,
      evidence: item.evidence || [],
    }, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push('## E2E-only izolasyon kontrolleri');
  lines.push('');
  for (const check of isolationChecks) {
    lines.push(`### ${check.id}) ${check.name}`);
    lines.push(`- test adi: \`${check.name}\``);
    lines.push(`- kullanilan veri: \`${check.data}\``);
    lines.push(`- kullanilan selector/test-id: ${(check.selectors || []).map((entry) => `\`${entry}\``).join(', ') || '-'}`);
    lines.push(`- beklenen sonuc: ${check.expected}`);
    lines.push(`- gercek sonuc: ${check.actualSummary || `\`${JSON.stringify(check.actual)}\``}`);
    lines.push(`- PASS/FAIL: \`${check.pass ? 'PASS' : 'FAIL'}\``);
    const evidences = Array.isArray(check.evidence) ? check.evidence : [];
    if (evidences.length > 0) {
      lines.push(`- screenshot/log: ${evidences.map((entry) => `[${path.basename(entry)}](${toLink(entry)})`).join(', ')}`);
    } else {
      lines.push('- screenshot/log: -');
    }
    lines.push('- ham JSON sonucu:');
    lines.push('```json');
    lines.push(JSON.stringify({
      id: check.id,
      name: check.name,
      selectors: check.selectors || [],
      expected: check.expected,
      actual: check.actual,
      pass: check.pass,
      evidence: check.evidence || [],
    }, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Ozet');
  lines.push(`- PASS: \`${summary.passCount}\``);
  lines.push(`- FAIL: \`${summary.failCount}\``);
  lines.push(`- Hedef: \`PASS: 14 / FAIL: 0\``);
  lines.push(`- E2E-only izolasyon PASS: \`${summary.isolationPassCount}\` / \`${summary.isolationTotal}\``);
  lines.push('');
  await writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
};

const main = async () => {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(RUN_LOG, '', 'utf8');
  await writeFile(VITE_LOG, '', 'utf8');
  await log('ui e2e stabilization run started');

  const tests = [];
  const isolationChecks = [];
  const vite = await startViteIfNeeded();
  const chrome = await startChrome();
  const wsUrl = await createTargetWsUrl(`${BASE_URL}/?quick=analysis&e2e=1`);
  const client = new CdpClient(wsUrl);

  const capture = async (id, label) => {
    const filePath = path.join(ARTIFACT_DIR, shotName(id, label));
    await client.screenshot(filePath);
    return filePath;
  };

  const runCase = async (meta, handler, target = tests) => {
    const started = Date.now();
    try {
      const output = await handler();
      const elapsedMs = Date.now() - started;
      const result = { ...meta, ...output, elapsedMs };
      target.push(result);
      await log(`[${result.pass ? 'PASS' : 'FAIL'}] #${meta.id} ${meta.name} (${elapsedMs}ms)`);
    } catch (error) {
      const elapsedMs = Date.now() - started;
      const result = {
        ...meta,
        pass: false,
        actual: { error: error instanceof Error ? error.message : String(error) },
        actualSummary: error instanceof Error ? error.message : String(error),
        evidence: [],
        elapsedMs,
      };
      target.push(result);
      await log(`[ERROR] #${meta.id} ${meta.name}: ${result.actualSummary}`);
    }
  };

  try {
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await waitPageReady(client, 25000);

    await runCase(
      {
        id: 1,
        name: 'Ebeveyn ana ekran karar sinyalleri',
        data: 'qaRecords=manual, analysisTab=overview, e2e=1',
        selectors: ['[data-testid^="decision-signal-"]', '[data-testid="parent-analysis-workspace"]'],
        expected: 'Ana karar sinyal kartlari gorunmeli.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'overview', e2e: true });
        const signalCount = await evalValue(client, `(() => document.querySelectorAll('[data-testid^="decision-signal-"]').length)()`, 0);
        const workspaceReady = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]')) )()`, false);
        const shot = await capture(1, 'main-signals');
        const pass = Number(signalCount) >= 4 && Number(signalCount) <= 6 && workspaceReady;
        return {
          pass,
          actual: { signalCount, workspaceReady },
          actualSummary: `Karar sinyal sayisi: ${signalCount}, workspace: ${workspaceReady ? 'hazir' : 'hazir degil'}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 2,
        name: 'Ders karti -> ders detay akisi',
        data: 'qaRecords=manual, analysisTab=overview, e2e=1',
        selectors: ['[data-testid^="course-summary-btn-"]', '[data-testid="course-detail-panel"]'],
        expected: 'Ders kartina tiklaninca ilgili ders detayi acilmali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'overview', e2e: true });
        const firstButton = await evalValue(client, `(() => {
          const node = document.querySelector('[data-testid^="course-summary-btn-"]');
          return node?.getAttribute('data-testid') || '';
        })()`, '');
        const clicked = await clickSelector(client, '[data-testid^="course-summary-btn-"]');
        await wait(300);
        const detailCourseId = await evalValue(client, `(() => document.querySelector('[data-testid="course-detail-panel"]')?.getAttribute('data-course-id') || '')()`, '');
        const selectedCourseId = String(firstButton).replace('course-summary-btn-', '');
        const shot = await capture(2, 'course-detail-flow');
        const pass = clicked.clicked && Boolean(selectedCourseId) && selectedCourseId === detailCourseId;
        return {
          pass,
          actual: { firstButton, clicked, selectedCourseId, detailCourseId },
          actualSummary: `Secilen ders: ${selectedCourseId || '-'}, detay paneli: ${detailCourseId || '-'}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 3,
        name: 'Zaman filtreleri',
        data: 'qaRecords=manual, analysisTab=reports, e2e=1',
        selectors: ['[data-testid="report-period-select"]', '[data-testid="analysis-reports-section"]'],
        expected: 'Haftalik/Aylik/3 Aylik/Tum Zamanlar secimleri statei dogru guncellemeli.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx, App.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'reports', e2e: true });
        const periods = ['Haftal\u0131k', 'Ayl\u0131k', '3 Ayl\u0131k', 'T\u00fcm Zamanlar'];
        const checks = [];
        for (const period of periods) {
          const change = await setSelectValue(client, '[data-testid="report-period-select"]', period);
          await wait(250);
          const state = await evalValue(client, `(() => document.querySelector('[data-testid="analysis-reports-section"]')?.getAttribute('data-report-period') || '')()`, '');
          checks.push({ period, change, state, ok: change.ok && state === period });
        }
        const shot = await capture(3, 'time-filters');
        const pass = checks.every((item) => item.ok);
        return {
          pass,
          actual: checks,
          actualSummary: `Filtre dogrulama: ${checks.map((item) => `${item.period}:${item.ok ? 'ok' : 'hata'}`).join(', ')}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 4,
        name: 'Uzun ders/konu adlari UI stabilitesi',
        data: 'qaRecords=manual, analysisTab=insights, e2e=1',
        selectors: ['[data-testid^="weak-topic-card-"]'],
        expected: 'Uzun adlar yatay tasma olusturmamali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'insights', e2e: true });
        const overflow = await evalValue(client, `(() => {
          const rootOverflow = document.documentElement.scrollWidth - window.innerWidth;
          const cards = Array.from(document.querySelectorAll('[data-testid^="weak-topic-card-"]'));
          const cardOverflow = cards.map((card) => card.scrollWidth - card.clientWidth);
          return { rootOverflow, cardOverflow, cardCount: cards.length };
        })()`, { rootOverflow: 999, cardOverflow: [999], cardCount: 0 });
        const shot = await capture(4, 'long-name-overflow');
        const cardsOk = Array.isArray(overflow.cardOverflow) ? overflow.cardOverflow.every((value) => Number(value) <= 2) : false;
        const pass = Number(overflow.rootOverflow) <= 2 && cardsOk;
        return {
          pass,
          actual: overflow,
          actualSummary: `Root overflow: ${overflow.rootOverflow}, kart sayisi: ${overflow.cardCount}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 5,
        name: 'Bos veri / az veri state',
        data: 'qaRecords=empty + qaRecords=low, analysisTab=overview, e2e=1',
        selectors: ['[data-testid="analysis-state-card-overview"]', '[data-testid="analysis-state-text-overview"]'],
        expected: 'Bos ve az veri durumunda low-data mesajlari gelmeli.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx, App.tsx',
      },
      async () => {
        await resetAppStorageDeterministic(client);
        await go(client, { qaRecords: 'empty', analysisTab: 'overview', e2e: true });
        const emptyState = await evalValue(client, `(() => document.querySelector('[data-testid="analysis-state-card-overview"]')?.getAttribute('data-analysis-state') || '')()`, '');
        const emptyText = await textOf(client, '[data-testid="analysis-state-text-overview"]');
        const emptyShot = await capture(5, 'empty-state');

        await resetAppStorageDeterministic(client);
        await go(client, { qaRecords: 'low', analysisTab: 'overview', e2e: true });
        const lowState = await evalValue(client, `(() => document.querySelector('[data-testid="analysis-state-card-overview"]')?.getAttribute('data-analysis-state') || '')()`, '');
        const lowText = await textOf(client, '[data-testid="analysis-state-text-overview"]');
        const lowShot = await capture(5, 'low-state');

        const expectedText = 'Ilk analiz icin en az 3 tamamlanan calisma gerekli';
        const pass = emptyState === 'low-data'
          && lowState === 'low-data'
          && emptyText.includes(expectedText)
          && lowText.includes(expectedText);
        return {
          pass,
          actual: { emptyState, lowState, emptyText, lowText },
          actualSummary: `empty=${emptyState}, low=${lowState}`,
          evidence: [emptyShot, lowShot],
        };
      },
    );

    await runCase(
      {
        id: 6,
        name: 'Hata/cache/sync guard',
        data: 'bozuk localStorage + qaRecords=none, e2e=1',
        selectors: ['[data-testid="parent-analysis-workspace"]'],
        expected: 'Bozuk cache durumunda ekran cokmeden acilmali.',
        related: 'App.tsx',
      },
      async () => {
        await resetAppStorageDeterministic(client);
        await go(client, { qaRecords: 'none', analysisTab: 'overview', e2e: true });
        await evalValue(client, `(() => {
          localStorage.setItem('tasks', '{"broken":');
          localStorage.setItem('performanceData', '{"broken":');
          return true;
        })()`, false);
        await client.send('Page.reload', { ignoreCache: true });
        await waitPageReady(client, 25000);
        const surface = await waitForAnalysisSurface(client, 12000);
        const rootVisible = Boolean(surface.workspace || surface.heading);
        const loadingVisible = Boolean(surface.loading || surface.stateCard);
        const fatalErrorVisible = Boolean(surface.fatal);
        const shot = await capture(6, 'error-guard');
        const pass = (rootVisible || loadingVisible) && !fatalErrorVisible;
        return {
          pass,
          actual: { rootVisible, loadingVisible, fatalErrorVisible, surface },
          actualSummary: `root=${rootVisible}, loading=${loadingVisible}, fatalError=${fatalErrorVisible}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 7,
        name: 'Hedef karti',
        data: 'qaRecords=manual, analysisTab=goals, e2e=1',
        selectors: ['[data-testid="analysis-goals-section"]', '[data-testid="top-goal-alert-level"]'],
        expected: 'Hedef karar alani gorunmeli ve ust uyari etiketi olmali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        const hasSection = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="analysis-goals-section"]')) )()`, false);
        const topLevel = await textOf(client, '[data-testid="top-goal-alert-level"]');
        const shot = await capture(7, 'goal-panel');
        const pass = hasSection && topLevel.length > 0;
        return {
          pass,
          actual: { hasSection, topLevel },
          actualSummary: `section=${hasSection}, topLevel=${topLevel || '-'}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 8,
        name: 'Deneme/LGS karti',
        data: 'qaRecords=manual, analysisTab=goals, e2e=1',
        selectors: ['[data-testid="exam-card-school"]', '[data-testid="exam-card-mock"]', '[data-testid="exam-card-trend"]'],
        expected: 'Deneme/LGS ozet kartlari gorunmeli.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        const school = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="exam-card-school"]')) )()`, false);
        const mock = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="exam-card-mock"]')) )()`, false);
        const trend = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="exam-card-trend"]')) )()`, false);
        const shot = await capture(8, 'exam-cards');
        const pass = school && mock && trend;
        return {
          pass,
          actual: { school, mock, trend },
          actualSummary: `school=${school}, mock=${mock}, trend=${trend}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 9,
        name: 'Uyari seviyeleri',
        data: 'qaRecords=manual, analysisTab=goals, e2e=1',
        selectors: ['[data-testid="top-goal-alert-level"]', '[data-testid^="goal-alert-"]'],
        expected: 'Uyari etiketleri sadece izinli seviye setinde olmali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        const topLevel = await textOf(client, '[data-testid="top-goal-alert-level"]');
        const levels = await evalValue(client, `(() => Array.from(document.querySelectorAll('[data-testid^="goal-alert-"]')).map((node) => node.getAttribute('data-alert-level') || ''))()`, []);
        const allowed = ['Kritik', 'Dikkat', 'Takip et', 'Stabil'];
        const all = [topLevel, ...(Array.isArray(levels) ? levels : [])].filter(Boolean);
        const pass = all.every((item) => allowed.includes(item));
        const shot = await capture(9, 'alert-levels');
        return {
          pass,
          actual: { topLevel, levels, allowed },
          actualSummary: `etiketler=${all.join(', ') || '-'}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 10,
        name: 'Veli aksiyonu -> ogrenci gorev zinciri',
        data: 'qaRecords=manual, analysisTab=goals, e2e=1',
        selectors: ['[data-testid="track-topic-btn"]', '[data-testid="switch-child-mode-btn"]', '[data-plan-task-id^="parent-action-"]'],
        expected: 'Veli aksiyonundan sonra cocuk ekraninda parent-action gorevi olusmali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx, components/child/ChildDashboard.tsx, App.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        await evalValue(client, `(() => {
          const raw = localStorage.getItem('tasks');
          const tasks = raw ? JSON.parse(raw) : [];
          const filtered = Array.isArray(tasks) ? tasks.filter((task) => !String(task?.planTaskId || '').startsWith('parent-action-')) : [];
          localStorage.setItem('tasks', JSON.stringify(filtered));
          return true;
        })()`, false);
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        const beforePending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        const clicked = await clickSelector(client, '[data-testid="track-topic-btn"]');
        await wait(350);
        const afterPending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        await clickSelector(client, '[data-testid="switch-child-mode-btn"]');
        const childReady = await waitForSelector(client, '[data-testid="child-dashboard-root"]', 15000);
        await wait(350);
        const childCount = await evalValue(client, `(() => document.querySelectorAll('[data-plan-task-id^="parent-action-"]').length)()`, 0);
        const shot = await capture(10, 'parent-to-child-task');
        const pass = clicked.clicked && afterPending >= beforePending + 1 && childReady && Number(childCount) > 0;
        return {
          pass,
          actual: { beforePending, afterPending, childReady, childCount, clicked },
          actualSummary: `pending ${beforePending} -> ${afterPending}, childReady=${childReady}, childTask=${childCount}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 11,
        name: 'Child complete -> parent refresh',
        data: 'qaRecords=manual, analysisTab=goals, e2e=1',
        selectors: ['[data-testid^="child-quick-complete-task-"]', '[data-testid="switch-parent-mode-btn"]', '[data-testid="parent-action-completed-count"]'],
        expected: 'Cocukta tamamlanan parent-action gorevi ebeveyn ozetine yansimali.',
        related: 'components/child/ChildDashboard.tsx, components/parent/ParentAnalysisWorkspace.tsx, App.tsx',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        await evalValue(client, `(() => {
          const raw = localStorage.getItem('tasks');
          const tasks = raw ? JSON.parse(raw) : [];
          const filtered = Array.isArray(tasks) ? tasks.filter((task) => !String(task?.planTaskId || '').startsWith('parent-action-')) : [];
          localStorage.setItem('tasks', JSON.stringify(filtered));
          return true;
        })()`, false);
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        await clickSelector(client, '[data-testid="track-topic-btn"]');
        await wait(350);
        const beforePending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        const beforeDone = numberFromText(await textOf(client, '[data-testid="parent-action-completed-count"]'));
        await clickSelector(client, '[data-testid="switch-child-mode-btn"]');
        const childReady = await waitForSelector(client, '[data-testid="child-dashboard-root"]', 15000);
        await wait(350);
        await waitForSelector(client, '[data-testid^="child-quick-complete-task-"]', 10000);
        const quickDone = await clickSelector(client, '[data-testid^="child-quick-complete-task-"]');
        await wait(500);
        await clickSelector(client, '[data-testid="switch-parent-mode-btn"]');
        await wait(500);
        await clickSelector(client, '[data-testid="analysis-tab-goals"]');
        await wait(250);
        const afterPending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        const afterDone = numberFromText(await textOf(client, '[data-testid="parent-action-completed-count"]'));
        const shot = await capture(11, 'child-complete-parent');
        const pass = childReady && quickDone.clicked && afterPending <= Math.max(0, beforePending - 1) && afterDone >= beforeDone + 1;
        return {
          pass,
          actual: { childReady, quickDone, beforePending, afterPending, beforeDone, afterDone },
          actualSummary: `childReady=${childReady}, pending ${beforePending} -> ${afterPending}, done ${beforeDone} -> ${afterDone}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 12,
        name: '6000 kayit performans testi',
        data: 'npm run test:heavy',
        selectors: ['scripts/heavy-real-data-tests.ts'],
        expected: 'Ağir veri analizi hata vermeden tamamlanmali.',
        related: 'scripts/heavy-real-data-tests.ts',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'reports', e2e: true });
        const shot = await capture(12, 'performance-context');
        const output = await runNpmScript('test:heavy', HEAVY_LOG);
        const text = `${output.stdout}\n${output.stderr}`;
        const elapsedMatch = text.match(/analysisElapsedMs["']?\s*[:=]\s*(\d+)/i);
        const heavyPassed = text.includes('HEAVY_REAL_DATA_TESTS_OK') || text.includes('HEAVY_TESTS_OK');
        return {
          pass: heavyPassed,
          actual: {
            heavyPassed,
            analysisElapsedMs: elapsedMatch ? Number(elapsedMatch[1]) : null,
            logPath: HEAVY_LOG,
          },
          actualSummary: `heavyPassed=${heavyPassed}, analysisElapsedMs=${elapsedMatch ? elapsedMatch[1] : 'n/a'}`,
          evidence: [shot, HEAVY_LOG],
        };
      },
    );

    await runCase(
      {
        id: 13,
        name: 'Duplicate event idempotency',
        data: 'qaRecords=manual, track-topic iki kez, e2e=1',
        selectors: ['[data-testid="track-topic-btn"]', 'task.planTaskId^="parent-action-"'],
        expected: 'Ayni parent aksiyonu duplicate gorev olusturmamali.',
        related: 'components/parent/ParentAnalysisWorkspace.tsx, App.tsx',
      },
      async () => {
        await resetAppStorageDeterministic(client);
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: true });
        const beforePending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        await clickSelector(client, '[data-testid="track-topic-btn"]');
        await wait(400);
        await clickSelector(client, '[data-testid="track-topic-btn"]');
        await wait(500);
        const afterPending = numberFromText(await textOf(client, '[data-testid="parent-action-pending-count"]'));
        await clickSelector(client, '[data-testid="switch-child-mode-btn"]');
        await waitForSelector(client, '[data-testid="child-dashboard-root"]', 12000);
        await wait(350);
        const domResult = await evalValue(client, `(() => {
          const nodes = Array.from(document.querySelectorAll('[data-plan-task-id^="parent-action-"]'));
          const ids = nodes.map((node) => node.getAttribute('data-plan-task-id') || '').filter(Boolean);
          const unique = new Set(ids);
          return { total: ids.length, unique: unique.size, duplicateCount: ids.length - unique.size };
        })()`, { total: 0, unique: 0, duplicateCount: 0 });
        await clickSelector(client, '[data-testid="switch-parent-mode-btn"]');
        await wait(300);
        await clickSelector(client, '[data-testid="analysis-tab-goals"]');
        await wait(250);
        const shot = await capture(13, 'idempotency');
        const atLeastOneCreated = Number(afterPending) >= Number(beforePending) + 1 || Number(domResult.total) >= 1;
        const pendingDelta = Number(afterPending) - Number(beforePending);
        const pass = atLeastOneCreated
          && Number(domResult.total) >= 1
          && Number(domResult.duplicateCount) === 0
          && Number(domResult.unique) === Number(domResult.total);
        return {
          pass,
          actual: { beforePending, afterPending, pendingDelta, ...domResult, atLeastOneCreated },
          actualSummary: `pending ${beforePending}->${afterPending} (delta=${pendingDelta}), total=${domResult.total}, unique=${domResult.unique}, duplicate=${domResult.duplicateCount}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 14,
        name: 'Notification cooldown UI',
        data: 'qaRecords=low, notifications interaction, e2e=1',
        selectors: ['[data-testid="topbar-notifications-toggle"]', '[data-testid^="notification-item-"]', '[data-cooldown-group]'],
        expected: 'Ayni cooldown grubundaki bildirim aksiyon sonrasi tekrar listelenmemeli.',
        related: 'App.tsx',
      },
      async () => {
        await resetAppStorageDeterministic(client);
        await go(client, { qaRecords: 'low', analysisTab: 'goals', e2e: true });
        await evalValue(client, `(() => {
          localStorage.setItem('dismissedNotificationKeys', JSON.stringify([]));
          localStorage.setItem('notificationCooldownMap', JSON.stringify({}));
          return true;
        })()`, false);
        await go(client, { qaRecords: 'low', analysisTab: 'goals', e2e: true });
        await waitForSelector(client, '[data-testid="topbar-notifications-toggle"]', 10000);
        await clickSelector(client, '[data-testid="topbar-notifications-toggle"]');
        await waitForSelector(client, '[data-testid="notifications-popover"]', 5000);
        await wait(220);
        const firstItem = await evalValue(client, `(() => {
          const node = document.querySelector('[data-testid^="notification-item-"]');
          if (!node) return null;
          return {
            key: node.getAttribute('data-notification-key') || '',
            group: node.getAttribute('data-cooldown-group') || '',
          };
        })()`, null);
        if (!firstItem || !firstItem.key || !firstItem.group) {
          const shot = await capture(14, 'notification-no-item');
          return {
            pass: false,
            actual: { reason: 'notification item missing', firstItem },
            actualSummary: 'Bildirim listesinde test edilecek item bulunamadi.',
            evidence: [shot],
          };
        }
        await clickSelector(client, '[data-testid^="notification-item-"]');
        await wait(300);
        await clickSelector(client, '[data-testid="topbar-notifications-toggle"]');
        await wait(300);
        const remainingCount = await evalValue(client, `(() => {
          const selector = '[data-cooldown-group="${firstItem.group.replace(/"/g, '\\"')}"]';
          return document.querySelectorAll(selector).length;
        })()`, 0);
        const cooldownValue = await evalValue(client, `(() => {
          try {
            const raw = localStorage.getItem('notificationCooldownMap');
            const map = raw ? JSON.parse(raw) : {};
            return map[${JSON.stringify(firstItem.group)}] || null;
          } catch {
            return null;
          }
        })()`, null);
        const shot = await capture(14, 'notification-cooldown');
        const pass = Number(remainingCount) === 0 && typeof cooldownValue === 'number';
        return {
          pass,
          actual: { firstItem, remainingCount, cooldownValue },
          actualSummary: `group=${firstItem.group}, remaining=${remainingCount}, cooldown=${cooldownValue}`,
          evidence: [shot],
        };
      },
    );

    await runCase(
      {
        id: 'E1',
        name: 'e2e=1 olmadan quick complete butonu gorunmuyor',
        data: 'qaRecords=manual, e2e parametresi yok',
        selectors: ['[data-testid="switch-child-mode-btn"]', '[data-testid^="child-quick-complete-task-"]'],
        expected: 'Test-only quick complete butonu normal modda render edilmemeli.',
      },
      async () => {
        await go(client, { qaRecords: 'manual', analysisTab: 'goals', e2e: false });
        await clickSelector(client, '[data-testid="switch-child-mode-btn"]');
        await wait(450);
        const childRoot = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="child-dashboard-root"]')) )()`, false);
        const quickButtons = await evalValue(client, `(() => document.querySelectorAll('[data-testid^="child-quick-complete-task-"]').length)()`, 0);
        const shot = await capture('e1', 'no-e2e-quick-complete');
        const pass = childRoot && Number(quickButtons) === 0;
        return {
          pass,
          actual: { childRoot, quickButtons },
          actualSummary: `childRoot=${childRoot}, quickButtons=${quickButtons}`,
          evidence: [shot],
        };
      },
      isolationChecks,
    );

    await runCase(
      {
        id: 'E2',
        name: 'e2e=1 olmadan test-seed akisi calismiyor',
        data: 'qaRecords=manual, e2e parametresi yok, localStorage temiz baslangic',
        selectors: ['localStorage.__qa_manual_records_seeded_at', 'task.id^="qa_manual_"'],
        expected: 'qa seed timestamp yazilmamali ve qa_manual tasklari uretilmemeli.',
      },
      async () => {
        await go(client, { qaRecords: 'none', analysisTab: 'overview', e2e: false });
        await evalValue(client, `(() => {
          localStorage.removeItem('__qa_manual_records_seeded_at');
          localStorage.setItem('tasks', JSON.stringify([]));
          localStorage.setItem('performanceData', JSON.stringify([]));
          localStorage.setItem('userType', JSON.stringify('parent'));
          localStorage.setItem('isParentLocked', JSON.stringify(true));
          return true;
        })()`, false);
        await go(client, { qaRecords: 'manual', analysisTab: 'overview', e2e: false });
        const seedMarker = await evalValue(client, `(() => localStorage.getItem('__qa_manual_records_seeded_at'))()`, null);
        const qaTaskCount = await evalValue(client, `(() => {
          const raw = localStorage.getItem('tasks');
          const tasks = raw ? JSON.parse(raw) : [];
          return Array.isArray(tasks) ? tasks.filter((task) => String(task?.id || '').startsWith('qa_manual_')).length : 0;
        })()`, 0);
        const shot = await capture('e2', 'no-e2e-seed');
        const pass = seedMarker === null && Number(qaTaskCount) === 0;
        return {
          pass,
          actual: { seedMarker, qaTaskCount },
          actualSummary: `seedMarker=${seedMarker}, qaTaskCount=${qaTaskCount}`,
          evidence: [shot],
        };
      },
      isolationChecks,
    );

    await runCase(
      {
        id: 'E3',
        name: 'Normal parent/child akisi e2e olmadan bozuk degil',
        data: 'qaRecords=none, e2e parametresi yok',
        selectors: ['[data-testid="switch-child-mode-btn"]', '[data-testid="switch-parent-mode-btn"]', '[data-testid="parent-lock-screen"]'],
        expected: 'Childe gecis ve parenta donuste lock screen gorunmeli; akista kirilma olmamali.',
      },
      async () => {
        await go(client, { qaRecords: 'none', analysisTab: 'overview', e2e: false });
        await clickSelector(client, '[data-testid="switch-child-mode-btn"]');
        await wait(450);
        const childRoot = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="child-dashboard-root"]')) )()`, false);
        await clickSelector(client, '[data-testid="switch-parent-mode-btn"]');
        await wait(450);
        const lockScreen = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="parent-lock-screen"]')) )()`, false);
        const passwordInput = await evalValue(client, `(() => Boolean(document.querySelector('[data-testid="parent-lock-password-input"]')) )()`, false);
        const shot = await capture('e3', 'no-e2e-parent-child');
        const pass = childRoot && lockScreen && passwordInput;
        return {
          pass,
          actual: { childRoot, lockScreen, passwordInput },
          actualSummary: `childRoot=${childRoot}, lockScreen=${lockScreen}, passwordInput=${passwordInput}`,
          evidence: [shot],
        };
      },
      isolationChecks,
    );
  } finally {
    client.close();
    try { chrome.kill('SIGKILL'); } catch {}
    if (vite) {
      try { vite.kill('SIGKILL'); } catch {}
    }
  }

  const passCount = tests.filter((item) => item.pass).length;
  const failCount = tests.length - passCount;
  const isolationPassCount = isolationChecks.filter((item) => item.pass).length;
  const isolationTotal = isolationChecks.length;

  const summary = {
    generatedAt: nowIso(),
    appUrl: `${BASE_URL}/?quick=analysis&qaRecords=manual&analysisTab=goals&e2e=1`,
    passCount,
    failCount,
    isolationPassCount,
    isolationTotal,
    tests,
    isolationChecks,
    logs: {
      run: RUN_LOG,
      vite: VITE_LOG,
      heavy: HEAVY_LOG,
    },
  };

  await writeFile(JSON_PATH, JSON.stringify(summary, null, 2), 'utf8');
  await writeMarkdownReport({ tests, isolationChecks, summary });
  await log(`summary pass=${passCount} fail=${failCount} isolation=${isolationPassCount}/${isolationTotal}`);

  if (failCount > 0) {
    throw new Error(`UI/E2E testleri basarisiz: ${failCount} adet FAIL var.`);
  }
  if (isolationPassCount !== isolationTotal) {
    throw new Error(`E2E-only izolasyon kontrolleri basarisiz: ${isolationPassCount}/${isolationTotal} PASS.`);
  }
};

main().catch(async (error) => {
  await log(`fatal: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  console.error(error);
  process.exitCode = 1;
});
