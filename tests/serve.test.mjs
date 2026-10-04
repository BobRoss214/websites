// order: 130
// browser: yes
// covers: tools/serve.py, js/content.js, 404.html
/* tools/serve.py, the little web server for the person who edits the site (needs python3; a browser for the last part), run on a temporary copy of the site:
 *   - it starts, picks a free port, prints the address and how to stop it
 *   - /, a page without .html, /js/content.js, a language file and a picture come back with the right type; a missing file gives the 404 page with status 404;
 *     hidden files and ".." are refused; nothing is kept by the browser (no-store); only this computer can reach it
 *   - a typo in js/content.js, saved while it runs, is shown at once in the Site check box WITH its line number (a file:// page never gets one)
 *   - SIGTERM stops it tidily; a busy port and a folder without index.html give a plain message, not a Python error
 * Your own files are not touched. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, ok, okSoon, run, until, ms } from './lib.mjs';

const PY = process.env.WA_PYTHON || 'python3';
const get = (port, pathname, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: pathname, method }, (res) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })); });
  req.on('error', reject); req.setTimeout(ms(10000), () => req.destroy(new Error('timeout'))); req.end();
});

await run('serve', async ({ browser, errs }) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-serve-'));
  const site = path.join(tmp, 'site');
  fs.cpSync(ROOT, site, { recursive: true, filter: (src) => !/(^|[\\/])(\.git|node_modules|deploy|\.visual|__pycache__|tests)([\\/]|$)/.test(path.relative(ROOT, src)) });
  let child = null, out = '';
  try {
    child = spawn(PY, ['tools/serve.py', '--no-open', '--port', '0'], { cwd: site, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    const exited = new Promise((resolve) => child.on('close', (code, sig) => resolve({ code, sig })));
    await okSoon('it starts and prints the address', async () => out, (v) => /Address:\s+http:\/\/localhost:\d+\//.test(v), 20000);
    const port = +((out.match(/Address:\s+http:\/\/localhost:(\d+)\//) || [])[1] || 0);
    ok('...the folder it shows, and how to stop it, are printed in plain words', /Folder:\s+\S/.test(out) && /Close this window \(or press Ctrl\+C\) to stop\./.test(out), out.slice(0, 300));
    ok('...it picked a port by itself (--port 0)', port > 1024, String(port));

    // ---- what it sends
    let r = await get(port, '/');
    ok('/ : the home page, as HTML in UTF-8', r.status === 200 && /^text\/html; charset=utf-8$/.test(r.headers['content-type']) && /Wise Acres/.test(r.body), r.status + ' ' + r.headers['content-type']);
    ok('...never kept by the browser (no-store) and nosniff, as on the live site', r.headers['cache-control'] === 'no-store' && r.headers['x-content-type-options'] === 'nosniff', JSON.stringify(r.headers));
    r = await get(port, '/js/content.js');
    ok('/js/content.js : JavaScript (text/javascript), with the settings', r.status === 200 && /^text\/javascript/.test(r.headers['content-type']) && /window\.WISE_ACRES = \{/.test(r.body), r.status + ' ' + r.headers['content-type']);
    r = await get(port, '/lang/es.js');
    ok('/lang/es.js : JavaScript', r.status === 200 && /^text\/javascript/.test(r.headers['content-type']), r.status + ' ' + r.headers['content-type']);
    r = await get(port, '/assets/favicon.svg');
    ok('a picture comes back with its own type (svg)', r.status === 200 && r.headers['content-type'] === 'image/svg+xml', r.headers['content-type']);
    r = await get(port, '/manifest.webmanifest');
    ok('the manifest has its own type', r.status === 200 && /^application\/manifest\+json/.test(r.headers['content-type']), r.headers['content-type']);
    r = await get(port, '/wise-pie');
    ok('/wise-pie (no .html) finds wise-pie.html, as the live site does', r.status === 200 && /Wise Pie/.test(r.body), String(r.status));
    r = await get(port, '/no-such-page.png');
    ok('a missing file: status 404 and the site\'s own 404 page', r.status === 404 && /^text\/html/.test(r.headers['content-type']) && r.body === fs.readFileSync(path.join(site, '404.html'), 'utf8'), r.status + ' ' + r.body.slice(0, 60));
    ok('...and the window says which file was not found', /not found: \/no-such-page\.png/.test(out), out.slice(-200));
    r = await get(port, '/', 'HEAD');
    ok('HEAD works (no body)', r.status === 200 && r.body === '', String(r.status));
    for (const bad of ['/.git/config', '/../README.md', '/%2e%2e/README.md', '/js/../../README.md', '/lang/', '/.hidden', '/js/%00.js']) {
      r = await get(port, bad);
      ok('refused or not found, never a file outside the folder or a hidden one: ' + bad, r.status === 404, r.status + ' ' + r.body.slice(0, 40));
    }
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) { const reach = await new Promise((resolve) => { const s = net.connect({ host: lan.address, port, timeout: 2000 }, () => { s.destroy(); resolve(true); }); s.on('error', () => resolve(false)); s.on('timeout', () => { s.destroy(); resolve(false); }); }); ok('only this computer can reach it (not the computer\'s network address ' + lan.address + ')', reach === false, 'reachable'); }

    // ---- a typo in js/content.js, saved while it runs: the Site check box names the line (over http; file:// never gets one)
    const file = path.join(site, 'js', 'content.js'), original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original.replace("  noticeUntil: '',\n", "  noticeUntil: ''\n"));
    const line = original.split('\n').findIndex((l) => l.startsWith('  closures: [],')) + 1;
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } }), pg = await ctx.newPage(); pg.on('pageerror', () => {});
    await pg.goto('http://localhost:' + port + '/', { waitUntil: 'load', timeout: ms(60000) });
    await until(pg, () => !!document.getElementById('wa-problems'), null, 20000);
    const box = await pg.evaluate(() => (document.getElementById('wa-problems') || {}).textContent || '');
    ok('a typo saved while it runs shows at once, with the line number, in the Site check box at http://localhost:' + port + '/', new RegExp('js/content\\.js stopped at line ' + line + '\\b').test(box) && /open on this computer/.test(box), box.slice(0, 260));
    fs.writeFileSync(file, original);
    await pg.reload({ waitUntil: 'load' });
    await until(pg, () => !!(window.WISE_ACRES && window.WISE_ACRES.features), null, 20000);   // the scripts have run: a box would be there now
    ok('after the fix is saved, a refresh shows a clean page (no box)', await pg.evaluate(() => !document.getElementById('wa-problems')), 'the box is still there');
    await ctx.close();

    // ---- stopping
    child.kill('SIGTERM');
    const end = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), ms(10000)))]);
    ok('it stops when told to, tidily ("Stopped.")', end !== null && /Stopped\./.test(out) && !/Traceback/.test(out), JSON.stringify(end) + ' ' + out.slice(-120));
    const gone = await get(port, '/').then(() => false, () => true);
    ok('...and nothing answers on that port any more', gone, 'still answering');
    child = null;

    // ---- plain messages instead of Python errors
    const holder = net.createServer(); await new Promise((resolve) => holder.listen(0, '127.0.0.1', resolve));
    const busy = spawnSync(PY, ['tools/serve.py', '--no-open', '--port', String(holder.address().port)], { cwd: site, encoding: 'utf8', timeout: ms(20000) });
    holder.close();
    ok('a port that is already in use: a plain message with the way out, not a Python error', busy.status === 1 && /I could not start on port \d+/.test(busy.stdout) && /--port 0/.test(busy.stdout) && !/Traceback/.test(busy.stderr || ''), (busy.stdout + busy.stderr).trim().slice(0, 200));
    const none = spawnSync(PY, ['tools/serve.py', '--no-open', 'no-such-folder'], { cwd: site, encoding: 'utf8', timeout: ms(20000) });
    ok('a folder without index.html: it says so and how to run it', none.status === 1 && /There is no index\.html in .*no-such-folder/.test(none.stdout) && !/Traceback/.test(none.stderr || ''), (none.stdout + none.stderr).trim().slice(0, 200));
    const help = spawnSync(PY, ['tools/serve.py', '--help'], { cwd: site, encoding: 'utf8', timeout: ms(20000) });
    ok('--help lists the options', help.status === 0 && /--no-open/.test(help.stdout) && /--port/.test(help.stdout), help.stdout.slice(0, 100));
  } finally {
    if (child) child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
