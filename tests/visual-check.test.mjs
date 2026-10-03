/* The visual check's own test (tests/visual-check.mjs): on a temporary copy of the site and one small page (Wise Pie, English, phone) it makes a
 * baseline, checks that an unchanged copy gives "Nothing looks different", that a changed heading color is reported with a picture, and that a missing
 * baseline is refused. It never touches tests/.visual (your real baseline). Needs a browser; takes one to three minutes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, ok, info, skip, finish, loadPlaywright, ms } from './lib.mjs';

const chk = (name, cond, detail = '') => ok(name, cond, cond ? '' : detail);   // the detail is only shown when a check fails
const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'visual-check.mjs');
try { await loadPlaywright(); } catch (e) { skip('Playwright is not installed, so the visual check cannot be tested (see tests/README.md)'); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-visual-'));
const site = path.join(tmp, 'site');
fs.cpSync(ROOT, site, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|tests|__pycache__)([\\/]|$)/.test(src) });
const base = ['--site', site, '--manifest', path.join(tmp, 'baseline.json'), '--pictures', path.join(tmp, 'pictures'), '--out', path.join(tmp, 'out'), '--only', '^wise-pie.en.390$', '--parallel', '1'];

// runs the tool (not through lib's server: the tool serves --site itself) and returns { code, text }
function tool(args) {
  return new Promise((resolve) => {
    const out = [];
    const env = { ...process.env }; delete env.WA_URL;
    const child = spawn(process.execPath, [TOOL, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { out.push('\nTIMEOUT'); child.kill('SIGKILL'); }, ms(420000));
    child.stdout.on('data', (d) => out.push(String(d))); child.stderr.on('data', (d) => out.push(String(d)));
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, text: out.join('') }); });
  });
}

try {
  // 1. no baseline: refused, with the command to make one
  const none = await tool([...base, '--manifest', path.join(tmp, 'nothing-here.json')]);
  chk('a missing baseline is refused (exit code 2, says how to make one)', none.code === 2 && /--update/.test(none.text), none.text.slice(-200));

  // 2. the baseline
  const up = await tool(['--update', ...base]);
  const manifestFile = path.join(tmp, 'baseline.json');
  let man = null; try { man = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { /* checked below */ }
  const segs = man && man.jobs && man.jobs['wise-pie|en|390'] ? Object.keys(man.jobs['wise-pie|en|390'].segments) : [];
  chk('--update saves a baseline with the page cut into sections', up.code === 0 && segs.length >= 5, 'exit ' + up.code + ', sections: ' + segs.length + ' ' + up.text.slice(-200));
  chk('--update keeps the baseline pictures', fs.existsSync(path.join(tmp, 'pictures', 'wise-pie_en_390__page.jpg')));
  chk('the baseline is small text, not pictures', fs.existsSync(manifestFile) && fs.statSync(manifestFile).size < 100000, fs.existsSync(manifestFile) ? fs.statSync(manifestFile).size + ' bytes' : 'missing');

  // 3. nothing changed
  const same = await tool(base);
  chk('an unchanged site: "Nothing looks different", exit code 0', same.code === 0 && /Nothing looks different/.test(same.text), 'exit ' + same.code + ' ' + same.text.slice(-300));

  // 4. one color changed
  fs.appendFileSync(path.join(site, 'css', 'styles.css'), '\nh1,h2,h3{color:#1f5fbf!important}\n');
  const diff = await tool(base);
  let report = null; try { report = JSON.parse(fs.readFileSync(path.join(tmp, 'out', 'report.json'), 'utf8')); } catch (e) { /* checked below */ }
  const changed = report ? report.changed.flatMap((c) => c.sections.map((s) => ({ page: c.page, ...s }))) : [];
  chk('a changed heading color: exit code 1 and sections listed', diff.code === 1 && changed.length >= 1, 'exit ' + diff.code + ', sections: ' + changed.length + ' ' + diff.text.slice(-300));
  chk('only the page that was looked at is named', changed.length > 0 && changed.every((c) => c.page === 'wise-pie|en|390'), changed.map((c) => c.page).join(', '));
  chk('the answer is in plain words and names the sections', /look different/.test(diff.text) && /Wise Pie|wise-pie/.test(diff.text));
  chk('each changed section comes with a side-by-side picture', changed.length > 0 && changed.every((c) => c.picture && fs.existsSync(c.picture)), changed.map((c) => c.picture).join(', '));
  info('changed: ' + changed.map((c) => c.nice).join('; '));
  chk('the sections that did not change are not listed', changed.length < segs.length, changed.length + ' of ' + segs.length);

  // 5. the list of pages needs no browser
  const list = await tool(['--list']);
  chk('--list shows the 70 pages that a full run looks at', list.code === 0 && /70 pages/.test(list.text), list.text.slice(-100));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
await finish({});
