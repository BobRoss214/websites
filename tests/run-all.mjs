#!/usr/bin/env node
/* Runs the site tests one at a time and prints a short summary.
 *
 *   node tests/run-all.mjs               everything
 *   node tests/run-all.mjs i18n map      only the tests whose file name contains one of these words
 *   node tests/run-all.mjs --list        show the tests and what they need
 *   node tests/run-all.mjs --stop        stop at the first test that fails
 *
 * One web server (on a free port) is started for all of them. Environment: WA_URL, WA_PORT, WA_CHROME, WA_SLOW (see tests/README). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startSite, loadPlaywright, axeSource, ms } from './lib.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// the cheap checks first, then the browser tests from fast to slow
const ORDER = ['public-site', 'pipeline', 'live', 'dated', 'drive', 'pause', 'gallery', 'analytics', 'print-qr', 'farm-seasons', 'npc', 'i18n', 'i18n-early', 'languages', 'axe', 'map', 'features', 'hero'];
const NEEDS_BROWSER = (name) => !['public-site', 'pipeline'].includes(name);
const args = process.argv.slice(2), flags = args.filter((a) => a.startsWith('--')), words = args.filter((a) => !a.startsWith('--'));
const names = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs')).map((f) => f.replace(/\.test\.mjs$/, ''))
  .sort((a, b) => (ORDER.indexOf(a) < 0 ? 99 : ORDER.indexOf(a)) - (ORDER.indexOf(b) < 0 ? 99 : ORDER.indexOf(b)) || a.localeCompare(b))
  .filter((n) => !words.length || words.some((w) => n.includes(w)));

if (flags.includes('--list')) {
  for (const n of names) {
    const first = (fs.readFileSync(path.join(DIR, n + '.test.mjs'), 'utf8').match(/\/\*\s*([\s\S]*?)\*\//) || [, ''])[1].replace(/\s*\n\s*\*?\s*/g, ' ').trim();
    console.log(n.padEnd(14) + (NEEDS_BROWSER(n) ? '[browser] ' : '[no browser] ') + first.slice(0, 150));
  }
  process.exit(0);
}
if (!names.length) { console.log('No test matches: ' + words.join(' ')); process.exit(1); }

let playwright = true;
try { await loadPlaywright(); } catch (e) { playwright = false; console.log('Playwright is not installed, so the browser tests cannot run.\n  Fix: npm i -D playwright axe-core && npx playwright install chromium   (see tests/README)\n'); }
if (!axeSource() && names.includes('axe')) console.log('(axe-core is not installed: the accessibility test will be skipped. npm i -D axe-core)\n');

const site = await startSite();
const LIMIT = ms(900000);   // no single test may run longer than 15 minutes (scaled by WA_SLOW); the slowest, drive, needs about 8 on a busy computer
const results = [];
function runOne(name) {
  return new Promise((resolve) => {
    const t0 = Date.now(), out = [];
    const child = spawn(process.execPath, [path.join(DIR, name + '.test.mjs')], { env: { ...process.env, WA_URL: site.url }, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { out.push('\nTIMEOUT: stopped after ' + Math.round(LIMIT / 1000) + ' s'); child.kill('SIGKILL'); }, LIMIT);
    child.stdout.on('data', (d) => out.push(String(d))); child.stderr.on('data', (d) => out.push(String(d)));
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.join(''), lines = text.split('\n');
      const sum = text.match(/(\d+) passed, (\d+) failed(?: \(skipped\))?/);
      resolve({ name, code, secs: Math.round((Date.now() - t0) / 1000), passed: sum ? +sum[1] : 0, failed: sum ? +sum[2] : 0, skipped: /^SKIP /m.test(text), crashed: !sum, failLines: lines.filter((l) => l.startsWith('FAIL ')), tail: lines.filter(Boolean).slice(-6) });
    });
  });
}

for (const n of names) {
  if (NEEDS_BROWSER(n) && !playwright) { results.push({ name: n, skipped: true, passed: 0, failed: 0, secs: 0, why: 'no Playwright' }); console.log(`SKIP  ${n.padEnd(14)} (Playwright is not installed)`); continue; }
  process.stdout.write(`...   ${n.padEnd(14)} running\r`);
  const r = await runOne(n);
  results.push(r);
  const bad = r.code !== 0 || r.failed > 0 || r.crashed;
  console.log(`${bad ? 'FAIL' : r.skipped ? 'SKIP' : 'PASS'}  ${n.padEnd(14)} ${r.skipped ? 'skipped' : r.crashed ? 'did not finish (exit code ' + r.code + ')' : r.passed + ' passed' + (r.failed ? ', ' + r.failed + ' FAILED' : '')}  (${r.secs}s)`);
  if (bad) { (r.failLines.length ? r.failLines : r.tail).slice(0, 12).forEach((l) => console.log('      ' + l.slice(0, 220))); if (flags.includes('--stop')) break; }
}
await site.close();

const failed = results.filter((r) => !r.skipped && (r.code !== 0 || r.failed > 0 || r.crashed));
const total = results.reduce((a, r) => a + r.passed, 0), checks = results.reduce((a, r) => a + r.failed, 0);
console.log(`\n${results.length} test files: ${results.filter((r) => !r.skipped && !failed.includes(r)).length} passed, ${failed.length} failed, ${results.filter((r) => r.skipped).length} skipped.  Checks: ${total} passed, ${checks} failed.`);
if (failed.length) console.log('Failed: ' + failed.map((r) => r.name).join(', '));
console.log(failed.length ? 'FAILED' : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
