import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0; const errs = [];
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); };
const wrap = (body) => '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>';
async function open(page, vp) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'America/New_York' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(page + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errs.push(page + ' console: ' + m.text()); });
  await p.route('http://art.local/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/assets/')) { const f = '/home/user/websites' + u.pathname; return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' }); }
    const f = 'artifact' + (u.pathname === '/' ? '/index.html' : u.pathname);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    const t = fs.readFileSync(f, 'utf8');
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: page === 'index.html' ? wrap(t) : t });
  });
  await p.goto('http://art.local/' + page); await p.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important;transition:none!important}' }); await p.waitForTimeout(900);
  return p;
}
{
  const p = await open('index.html', { width: 1440, height: 900 });
  await p.evaluate(() => { const m = document.querySelector('#farm-map'); if (m) m.scrollIntoView(); }); await p.waitForFunction(() => document.querySelectorAll('#farm-map .map-item').length > 0, null, { timeout: 15000 }).catch(() => {});
  const s = await p.evaluate(() => ({ rel: !document.querySelector('[data-rel-box]').hidden, week: !document.querySelector('[data-week]').hidden, demoLabel: !document.querySelector('[data-week-demo]').hidden, signup: !document.querySelector('[data-signup]').hidden, map: !document.querySelector('#farm-map').hidden, mapDemo: !!document.querySelector('.map-demo'), items: document.querySelectorAll('#farm-map .map-item').length, press: document.querySelectorAll('.press-list a').length, drive: document.querySelectorAll('.drive-list li').length }));
  ok('artifact index: countdown, week box (labelled example), signup demo, real map, press, drive', s.rel && s.week && s.demoLabel && s.signup && s.map && !s.mapDemo && s.items === 25 && s.press === 2 && s.drive === 6, JSON.stringify(s));
  await p.locator('#farm-map').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.locator('#farm-map').screenshot({ path: 'art-map.png' });
  await p.context().close();
}
{
  const p = await open('first-visit.html', { width: 1440, height: 900 });
  const s = await p.evaluate(() => ({ map: !document.querySelector('#farm-map').hidden, comfort: !!document.querySelector('#comfort'), drive: document.querySelectorAll('.drive-list li').length, driveText: document.querySelector('.dr-time').textContent }));
  ok('artifact first-visit: demo map, comfort, drive times', s.map && s.comfort && s.drive === 6 && /about 10 min/.test(s.driveText), JSON.stringify(s));
  await p.context().close();
}
console.log('errors:', errs.join(' | ') || 'none'); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
await b.close();
