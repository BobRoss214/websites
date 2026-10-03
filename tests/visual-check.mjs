#!/usr/bin/env node
/*
 * Wise Acres: visual check. Tells you when a change to the site changed how it LOOKS (not part of node tests/run-all.mjs: it needs
 * a baseline of its own and takes a while).
 *
 *   node tests/visual-check.mjs --update   look at the site and save it as the baseline (do this on a version you trust, BEFORE you change things)
 *   node tests/visual-check.mjs            after your change: list what looks different from the baseline, with a picture of each
 *   node tests/visual-check.mjs --help     all options
 *
 * What it does, in plain words
 *   1. Starts its own small web server for the site folder (any free port), so nothing else has to be running.
 *   2. Opens every page (home, first visit, pumpkin patch, school trips, strawberry picking, Wise Pie) in all 5 languages,
 *      on a phone (390 px wide) and a computer (1440 px wide). The home page also shows the hero picture in all 4 seasons.
 *   3. Freezes everything that moves (fixed date, fixed "random" numbers, animations stopped at their first frame, the bee
 *      hidden, all pictures and fonts loaded), so the same site gives the same picture.
 *   4. Cuts each page into its sections (top bar, menu, hero, "Visit", "Pizza" ... footer) and, for each section, writes
 *      down a short fingerprint (a few hundred characters) of how it looks.
 *   5. Compare mode takes the pictures again and says which sections look different from the baseline, in plain words,
 *      with a picture of each one (baseline | now | what changed).
 *
 * Where things are kept: the baseline (tests/.visual/baseline.json, about 1 MB of text) and, next to it, the baseline pictures
 * (tests/.visual/pictures, about 100 MB) are made on YOUR computer by --update and are not part of the repository (.gitignore): fonts and
 * the browser version change how text is drawn, so a baseline only fits the computer and browser that made it. The fingerprints alone are
 * enough to detect a change; the pictures are only for looking (use --no-pictures to skip them). The last report and its pictures are
 * in tests/.visual/last-run.
 *
 * Needs: Node 18+, Playwright with Chromium (see tests/README.md). One browser, two pages at a time. A full run (70 pages) took 11 to 12 minutes
 * on a 4-core computer that was running at ten times its capacity (other programs); a quiet computer is much faster. --quick (English
 * only, 14 pages) took under 2 minutes on the same busy computer. Same settings as the other tests: WA_CHROME, WA_DATE, WA_SLOW, WA_URL.
 *
 * Exit code: 0 nothing changed, 1 something looks different, 2 the tool itself failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startServer, startSite, loadPlaywright, ROOT, TODAY } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T0 = Date.now();

/* ------------------------------------------------------------------ options */
const VDIR = path.join(HERE, '.visual');
function parseArgs(argv) {
  const o = { retries: 2, parallel: 2, tolA: 4, tolC: 24, tolP: 0.02, tolPx: 100 };
  const need = (i, n) => { if (i + 1 >= argv.length) { console.error('Missing value after ' + n); process.exit(2); } return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') o.update = true;
    else if (a === '--quick') o.quick = true;
    else if (a === '--strict') o.strict = true;
    else if (a === '--list') o.list = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--only') o.only = new RegExp(need(i++, a));
    else if (a === '--manifest') o.manifest = path.resolve(need(i++, a));
    else if (a === '--site') { o.site = path.resolve(need(i++, a)); o.siteGiven = true; }
    else if (a === '--out') o.out = path.resolve(need(i++, a));
    else if (a === '--pictures') o.pictures = path.resolve(need(i++, a));
    else if (a === '--no-pictures') o.noPictures = true;
    else if (a === '--keep-new') o.keep = path.resolve(need(i++, a));
    else if (a === '--retries') o.retries = +need(i++, a);
    else if (a === '--parallel') o.parallel = Math.max(1, +need(i++, a));
    else if (a === '--tolerance-shape') o.tolA = +need(i++, a);
    else if (a === '--tolerance-color') o.tolC = +need(i++, a);
    else if (a === '--tolerance-area') o.tolP = +need(i++, a);
    else { console.error('Unknown option ' + a + ' (try --help)'); process.exit(2); }
  }
  o.site = o.site || ROOT;
  o.manifest = o.manifest || path.join(VDIR, 'baseline.json');
  o.out = o.out || path.join(VDIR, 'last-run');
  o.pictures = o.pictures || path.join(VDIR, 'pictures');
  return o;
}
const opt = parseArgs(process.argv.slice(2));
if (opt.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\n?/, '').replace(/^ \*( |$)/gm, ''));
  console.log(`Options
  --update               save what the site looks like now as the baseline (fingerprints in ${path.relative(process.cwd(), path.join(VDIR, 'baseline.json'))} and pictures in ${path.relative(process.cwd(), path.join(VDIR, 'pictures'))})
  --no-pictures          with --update: keep only the fingerprints (the report then has no side-by-side pictures)
  --pictures <folder>    where the baseline pictures are kept (default: next to the baseline)
  --only <regex>         only pages whose name matches. Names look like index|es|390, so use a dot for the bar: --only "^index.es" or --only "wise-pie"
  --quick                English only (14 pages, a quarter of the time)
  --retries <n>          how many times to look again at a page that looks different, to rule out a flicker (default 2)
  --strict               also count tiny differences (a few pixels of text edge); normally they are only listed
  --tolerance-shape <n>  how many of the 256 shape bits may differ before a section counts as changed (default 4)
  --tolerance-color <n>  how far (0-255) a color may move before a section counts as changed (default 24)
  --tolerance-area <n>   how many percent of a section may change color before it counts as changed (default 0.02)
  --keep-new <folder>    when comparing: also keep today's whole-page pictures there
  --manifest <file>      where the baseline is kept (default ${path.relative(process.cwd(), path.join(VDIR, 'baseline.json'))})
  --site <folder>        check another copy of the site (default: the folder above tests/)
  --out <folder>         where the report and the side-by-side pictures go (default ${path.relative(process.cwd(), path.join(VDIR, 'last-run'))})
  --parallel <n>         look at n pages at once (default 2; use 1 on a busy computer, 3 on a fast one)
  --verbose              also list the sections that differ by only a few pixels
  --list                 only list the pages that would be checked`);
  process.exit(0);
}

/* ------------------------------------------------------------------ the list of pages to look at */
const PAGES = ['index', 'first-visit', 'pumpkin-patch', 'school-field-trips', 'strawberry-picking', 'wise-pie'];
const LANGS = ['en', 'es', 'hi', 'zh', 'vi'];
const WIDTHS = [390, 1440];
const HERO_SEASONS = ['spring', 'summer', 'winter'];          // the home page's default (fall, from the fixed date) is its normal hero section
const FIXED_DATE = TODAY;                                     // the same moment the other tests use: Friday Oct 2 2026, noon in New York (fall)
const LANG_NAME = { en: 'English', es: 'Spanish', hi: 'Hindi', zh: 'Chinese', vi: 'Vietnamese' };
const FIRST_NAME = 'first screen (before scrolling)';
const jobs = [];
for (const w of WIDTHS) for (const lang of opt.quick ? ['en'] : LANGS) for (const pg of PAGES) {
  const key = `${pg}|${lang}|${w}`;
  if (!opt.only || opt.only.test(key)) jobs.push({ key, pg, lang, w, kind: 'page' });
  if (pg === 'index' && (!opt.only || opt.only.test(key + '|hero'))) jobs.push({ key: key + '|hero', pg, lang, w, kind: 'hero', seasons: HERO_SEASONS });
}
if (opt.list) { jobs.forEach((j) => console.log(j.key + (j.kind === 'hero' ? '  (hero picture in ' + HERO_SEASONS.join(', ') + ')' : ''))); console.log(jobs.length + ' pages'); process.exit(0); }
if (!jobs.length) { console.error('No pages match --only.'); process.exit(2); }

/* ------------------------------------------------------------------ the site (served by tests/lib.mjs, on a free port) */
fs.mkdirSync(opt.out, { recursive: true });
const TMP = fs.mkdtempSync(path.join(opt.out, 'run-'));
const site = (opt.siteGiven || !process.env.WA_URL) ? await startServer({ root: opt.site }) : await startSite();
const ORIGIN = site.url.replace(/\/$/, ''), PORT = (/:(\d+)$/.exec(ORIGIN) || [, '?'])[1];

/* ------------------------------------------------------------------ browser */
let chromium;
try { ({ chromium } = await loadPlaywright()); } catch (e) { console.error(e.message); await site.close(); process.exit(2); }
// (partial raster and several raster threads make the same drawing come out with slightly different edge pixels from run to run)
const launchOpts = { args: ['--font-render-hinting=none', '--disable-lcd-text', '--disable-partial-raster', '--num-raster-threads=1'] };
if (process.env.WA_CHROME) launchOpts.executablePath = process.env.WA_CHROME;
let browser;
try { browser = await chromium.launch(launchOpts); }
catch (e) { console.error('Could not start Chromium (' + String(e.message).split('\n')[0] + '). Run  npx playwright install chromium  or set WA_CHROME to a Chrome program.'); await site.close(); process.exit(2); }
const BROWSER = 'Chromium ' + browser.version();

/* ------------------------------------------------------------------ freezing: the same site must always give the same picture */
const SEED = `(() => { let s = 1234567; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;
// The site redraws some things (the crop rows along the section edges) a moment after every window resize, and taking a whole-page
// picture resizes the window: once everything is frozen, the page's resize listeners are switched off so nothing is redrawn mid-picture.
const MUTE_RESIZE = `(() => { const add = window.addEventListener; window.addEventListener = function (type, fn, opts) { if (type !== 'resize' || typeof fn !== 'function') return add.call(this, type, fn, opts); return add.call(this, type, function () { if (!window.__vcFrozen) return fn.apply(this, arguments); }, opts); }; })();`;
const NO_TRANSITIONS = `(() => { const add = () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important}'; (document.head || document.documentElement).appendChild(s); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); })();`;

// Runs inside the page: switch off transitions, make every section drawable (whole-page jobs), wake the "appear when scrolled to" pieces.
async function freezePage(p, light) {
  await p.evaluate((light) => {
    const st = document.createElement('style');
    st.textContent = (light ? '' : 'html.cv .cv-sec{content-visibility:visible!important}') + '*,*::before,*::after{transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}#bee{visibility:hidden!important}';
    document.head.appendChild(st);
    if (!light) document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; });
    document.querySelectorAll('.reveal, .crop-row, .goat-nook').forEach((el) => el.classList.add('in'));
  }, !!light);
  await settlePage(p, false, !!light);
  if (light) await holdAnimations(p, { roots: ['#top'] });
}
// Waits until the farm map is drawn, every picture is decoded and every font is loaded.
async function settlePage(p, wantMap, heroOnly) {
  await p.evaluate(async ({ wantMap, heroOnly }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = document.querySelector('[data-farm-map]');
    for (let i = 0; wantMap && i < 60 && m && !m.hidden && !document.querySelector('.map-svg'); i++) await sleep(100);
    document.querySelectorAll('.reveal, .crop-row, .goat-nook').forEach((el) => el.classList.add('in'));
    await document.fonts.ready;
    for (let round = 0; round < 2; round++) {
      const imgs = [...(heroOnly ? document.querySelectorAll('#top img') : document.images)].filter((i) => i.currentSrc || i.src);
      imgs.forEach((i) => { i.loading = 'eager'; i.decoding = 'sync'; });
      await Promise.all(imgs.map((i) => Promise.race([i.decode().catch(() => {}), sleep(10000)])));
      await sleep(120);
    }
  }, { wantMap: !!wantMap, heroOnly: !!heroOnly });
}
// Pauses CSS animations on their first frame (the browser's animation clock is already stopped), hides the bee, cancels leftover timers.
async function holdAnimations(p, o = {}) {
  await p.evaluate((o) => {
    if (!document.getElementById('vc-hold')) {
      const st = document.createElement('style'); st.id = 'vc-hold';
      st.textContent = '*,*::before,*::after{animation-play-state:paused!important}#bee{visibility:hidden!important}';
      document.head.appendChild(st);
    }
    if (o.timers !== false) {
      const max = setTimeout(() => {}, 0);
      for (let i = Math.max(0, max - 20000); i <= max; i++) { try { clearTimeout(i); clearInterval(i); cancelAnimationFrame(i); } catch (x) { /* ignore */ } }
    }
    if (o.freezeResize) window.__vcFrozen = true;
    const roots = o.roots ? o.roots.flatMap((q) => [...document.querySelectorAll(q)]) : [document];
    const seen = new Set();
    roots.forEach((root) => (root.getAnimations ? root.getAnimations({ subtree: true }) : document.getAnimations()).forEach((a) => { if (seen.has(a)) return; seen.add(a); try { const it = a.effect && a.effect.getTiming().iterations; if (it === Infinity) a.currentTime = 0; else a.finish(); } catch (x) { /* ignore */ } }));
  }, o);
  await p.waitForTimeout(200);
}

// Names of the blocks of one page, with their position, as the page is now (scrolled to the top).
function listSegments(p) {
  return p.evaluate(() => {
    const MAXBAND = 1100;
    const label = (el) => { const t = el.tagName.toLowerCase(); if (el.id) return t + '#' + el.id; const c = (el.getAttribute('class') || '').split(/\s+/).filter((x) => x && !/^(reveal|in|wrap|section)$/.test(x))[0]; return c ? t + '.' + c : t; };
    const els = [...document.querySelectorAll('body > .announce, body > #site-notice, body > header, body > main > *, body > footer')];
    const used = new Map(); const out = [];
    for (const el of els) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.height < 6 || r.width < 6) continue;
      let name = label(el); const n = used.get(name) || 0; used.set(name, n + 1); if (n) name += '~' + (n + 1);
      const top = Math.round(r.top + window.scrollY), h = Math.round(r.height), bands = Math.max(1, Math.ceil(h / MAXBAND));
      for (let b = 0; b < bands; b++) {
        const y = top + Math.round((h / bands) * b), y2 = top + Math.round((h / bands) * (b + 1));
        out.push({ name: bands > 1 ? `${name} [part ${b + 1}/${bands}]` : name, y, h: y2 - y });
      }
    }
    return out;
  });
}

const TIMING = !!process.env.VC_TIMING; const lapT = (() => { let t = Date.now(); return (m) => { if (TIMING) console.log('   ' + m + ' ' + (Date.now() - t) + 'ms'); t = Date.now(); }; })();
async function openJob(job, attempt) {
  const mobile = job.w < 600;
  const ctx = await browser.newContext({ viewport: { width: job.w, height: mobile ? (job.kind === 'hero' ? 1000 : 844) : 900 }, timezoneId: 'America/New_York', locale: 'en-US', deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', (x) => p._errs.push('pageerror: ' + x.message));
  await p.route('**/*', (r) => (r.request().url().startsWith(ORIGIN + '/') ? r.continue() : r.abort()));   // nothing from outside the site
  await p.addInitScript(SEED);
  await p.addInitScript(MUTE_RESIZE);
  await p.addInitScript(NO_TRANSITIONS);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await p.clock.setFixedTime(new Date(FIXED_DATE));
  await p.goto(`${ORIGIN}/${job.pg}.html${job.lang === 'en' ? '' : '?lang=' + job.lang}`, { waitUntil: 'load', timeout: 60000 });
  lapT('goto');
  await freezePage(p, job.kind === 'hero');
  lapT('freeze');
  return { ctx, p };
}

/* ------------------------------------------------------------------ fingerprints (computed by a second page of the same browser, so Node needs no image library) */
let hashPage;
async function getHashPage() {
  if (hashPage) return hashPage;
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  hashPage = await ctx.newPage();
  // this page reads the pictures this run took (tmp) and the baseline pictures (base) through the site's own address, so nothing else has to be served
  await hashPage.route(`${ORIGIN}/__tool/**`, (r) => {
    const u = new URL(r.request().url()).pathname, m = /^\/__tool\/(tmp|base)\/([^/]+)$/.exec(u);
    if (u === '/__tool/blank') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>hash</title>' });
    const f = m && path.join(m[1] === 'tmp' ? TMP : opt.pictures, decodeURIComponent(m[2]));
    return f && fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' });
  });
  await hashPage.goto(`${ORIGIN}/__tool/blank`);
  return hashPage;
}
// pieces: [{ name, file, x, y, w, h }] with file under TMP. Returns [{ name, x (exact), a (shape), c (color) }]
async function fingerprint(pieces) {
  const hp = await getHashPage();
  const byFile = new Map(); pieces.forEach((s) => { if (!byFile.has(s.file)) byFile.set(s.file, []); byFile.get(s.file).push(s); });
  const out = [];
  for (const [file, list] of byFile) {
    const res = await hp.evaluate(async ({ url, list }) => {
      const img = new Image(); img.src = url; await img.decode();
      const hex = (n) => n.toString(16);
      const W = img.naturalWidth, H = img.naturalHeight; const results = [];
      for (const s of list) {
        const sx = Math.max(0, Math.min(W - 1, s.x || 0)), sy = Math.max(0, Math.min(H - 1, s.y)), sw = Math.min(s.w || W, W - sx), sh = Math.min(s.h, H - sy);
        const full = document.createElement('canvas'); full.width = sw; full.height = sh;
        const g = full.getContext('2d', { willReadFrequently: true }); g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        const px = g.getImageData(0, 0, sw, sh).data;
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', px.buffer));
        const x = [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
        // which colors are used and how much of the section each covers (8 steps per color channel, so 512 colors): catches a changed color
        // even when it is only a few words or a small icon. Only colors covering at least 0.03% are kept: 3 hex digits for the color, 4 for its share.
        const cnt = new Uint32Array(512), total = sw * sh;
        for (let i = 0; i < px.length; i += 4) cnt[((px[i] >> 5) << 6) | ((px[i + 1] >> 5) << 3) | (px[i + 2] >> 5)]++;
        let hist = '';
        for (let k = 0; k < 512; k++) if (cnt[k] >= total * 0.0003) hist += k.toString(16).padStart(3, '0') + Math.min(65535, Math.round(cnt[k] / total * 65535)).toString(16).padStart(4, '0');
        const small = document.createElement('canvas'); small.width = 256; small.height = 256;
        const g2 = small.getContext('2d', { willReadFrequently: true }); g2.imageSmoothingQuality = 'high'; g2.drawImage(full, 0, 0, sw, sh, 0, 0, 256, 256);
        const d = g2.getImageData(0, 0, 256, 256).data;
        const lum = new Float64Array(256), rgb = new Float64Array(64 * 3);
        for (let yy = 0; yy < 256; yy++) for (let xx = 0; xx < 256; xx++) {
          const i = (yy * 256 + xx) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
          lum[((yy >> 4) * 16) + (xx >> 4)] += 0.299 * r + 0.587 * gg + 0.114 * b;
          const c = ((yy >> 5) * 8 + (xx >> 5)) * 3; rgb[c] += r; rgb[c + 1] += gg; rgb[c + 2] += b;
        }
        let mean = 0; for (let i = 0; i < 256; i++) { lum[i] /= 256; mean += lum[i]; } mean /= 256;
        let bits = ''; for (let i = 0; i < 256; i++) bits += lum[i] > mean ? '1' : '0';
        let a = ''; for (let i = 0; i < 256; i += 4) a += hex(parseInt(bits.slice(i, i + 4), 2));
        let c = ''; for (let i = 0; i < 192; i++) c += hex(Math.min(15, Math.round(rgb[i] / 1024 / 17)));
        results.push({ name: s.name, x, a, c, p: hist, w: sw, h: sh });
      }
      return results;
    }, { url: `${ORIGIN}/__tool/tmp/${path.basename(file)}`, list: list.map((s) => ({ name: s.name, x: s.x, y: s.y, w: s.w, h: s.h })) });
    out.push(...res);
  }
  return out;
}

/* ------------------------------------------------------------------ capture one page */
async function captureJob(job, attempt) {
  const { ctx, p } = await openJob(job, attempt);
  const base = `${job.key.replace(/\|/g, '_')}-${attempt}`;
  const pieces = []; const files = {}; let height = 0, fullFile = null;
  try {
    const shot = async (file, o) => { const f = path.join(TMP, file); await p.screenshot({ path: f, type: 'jpeg', quality: 90, caret: 'hide', ...o }); return f; };
    if (job.kind === 'hero') {
      // the home page's hero picture in the seasons other than the one the fixed date gives (that one is in the whole-page job)
      for (const s of job.seasons) {
        lapT('before ' + s);
        await p.evaluate((season) => window.WISE_ACRES.hero.setSeason(season), s);
        lapT('setSeason call');
        await p.waitForTimeout(450);
        await holdAnimations(p, { timers: false, roots: ['#top'] });
        lapT('hold');
        const r = await p.evaluate(() => { window.scrollTo(0, 0); const e = document.querySelector('#top'); const b = e.getBoundingClientRect(); return { y: Math.round(b.top + window.scrollY), h: Math.round(b.height) }; });
        const h = Math.min(r.h, (job.w < 600 ? 1000 : 900) - r.y);
        const name = `hero picture in ${s}`;
        const f = await shot(`${base}__hero-${s}.jpg`, { clip: { x: 0, y: r.y, width: job.w, height: h } });
        pieces.push({ name, file: f, x: 0, y: 0, w: job.w, h }); files[name] = f;
      }
      lapT('hero seasons');
    } else {
      // 1. what a visitor sees first (top bar, menu, hero, the sticky Reserve bar on phones)
      await holdAnimations(p, { timers: false, roots: ['.announce', '#site-notice', 'header', '#top', '.action-bar'] });
      const fs1 = await shot(base + '__first.jpg', {});
      pieces.push({ name: FIRST_NAME, file: fs1, x: 0, y: 0, w: job.w, h: (job.w < 600 ? 844 : 900) }); files[FIRST_NAME] = fs1;
      lapT('first screen shot');
      // 2. the whole page, without the things that float over it. The window is made as tall as the page, so everything that
      //    draws itself "when it comes into view" does so at once, and one picture of the window is the whole page.
      await p.addStyleTag({ content: '.action-bar,.to-top,.ach-stack,#wa-problems{visibility:hidden!important}' });
      height = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let round = 0; round < 3; round++) {
        await p.setViewportSize({ width: job.w, height: Math.min(Math.max(height, 400), 60000) });
        await p.waitForTimeout(round ? 300 : 900);
        const h2 = await p.evaluate(() => document.documentElement.scrollHeight);
        if (h2 <= height + 1) break;
        height = h2;
      }
      lapT('tall window');
      await settlePage(p, true);
      // the page reacts to scrolling and resizing (the three-step tractor, the crop rows): let that happen now, in full, so it can never half-happen later
      await p.evaluate(async () => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll')); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise((r) => setTimeout(r, 450)); });
      await holdAnimations(p, { freezeResize: true });
      const segs = await listSegments(p);
      height = await p.evaluate(() => document.documentElement.scrollHeight);
      lapT('segments+settle');
      fullFile = await shot(base + '__page.jpg', { fullPage: true });
      lapT('full page shot');
      segs.forEach((s) => pieces.push({ name: s.name, file: fullFile, x: 0, y: s.y, w: job.w, h: s.h }));
    }
    const errs = p._errs.slice();
    await ctx.close();
    const prints = await fingerprint(pieces);
    lapT('fingerprints');
    const placed = new Map(pieces.map((s) => [s.name, s]));
    const segments = {};
    for (const f of prints) { const s = placed.get(f.name); segments[f.name] = { y: s.y, h: f.h, w: f.w, x: f.x, a: f.a, c: f.c, p: f.p }; files[f.name] = s.file; }
    return { key: job.key, height, segments, files, fullFile, errs };
  } catch (e) { try { await ctx.close(); } catch (x) { /* ignore */ } throw e; }
}

/* ------------------------------------------------------------------ comparing */
const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
function hamming(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += popcount(parseInt(a[i], 16) ^ parseInt(b[i], 16)); return d; }
function colorDiff(a, b) { let max = 0, sum = 0; const cells = []; for (let i = 0; i < a.length; i++) { const d = Math.abs(parseInt(a[i], 16) - parseInt(b[i], 16)) * 17; sum += d; if (d > max) max = d; if (i % 3 === 2) { const cell = (i - 2) / 3; const m = Math.max(...[0, 1, 2].map((k) => Math.abs(parseInt(a[cell * 3 + k], 16) - parseInt(b[cell * 3 + k], 16)) * 17)); if (m > 20) cells.push(cell); } } return { max, mean: sum / a.length, cells }; }
function shapeCells(a, b) { const cells = []; for (let i = 0; i < a.length; i++) { const x = parseInt(a[i], 16) ^ parseInt(b[i], 16); for (let k = 0; k < 4; k++) if (x & (8 >> k)) cells.push(i * 4 + k); } return cells; }
function where(cellsIdx, grid) {            // cell numbers -> "top left", "middle", "bottom" ...
  if (!cellsIdx.length) return '';
  const xs = cellsIdx.map((i) => (i % grid) / (grid - 1)), ys = cellsIdx.map((i) => Math.floor(i / grid) / (grid - 1));
  const avg = (v) => v.reduce((s, n) => s + n, 0) / v.length; const ax = avg(xs), ay = avg(ys);
  const v = ay < 0.34 ? 'top' : ay > 0.66 ? 'bottom' : 'middle', h = ax < 0.34 ? 'left' : ax > 0.66 ? 'right' : 'center';
  if (cellsIdx.length > grid * grid * 0.45) return 'across most of it';
  return v === 'middle' && h === 'center' ? 'in the middle' : (v === 'middle' ? 'in the middle ' : v + ' ') + h;
}
// share of a section's pixels that moved to a different color (0 to 1), from the color lists
function parsePalette(p) { const m = new Map(); for (let i = 0; i + 7 <= (p || '').length; i += 7) m.set(p.slice(i, i + 3), parseInt(p.slice(i + 3, i + 7), 16) / 65535); return m; }
function colorsMoved(p1, p2) { if (!p1 || !p2) return 0; const a = parsePalette(p1), b = parsePalette(p2); let sum = 0; for (const k of new Set([...a.keys(), ...b.keys()])) sum += Math.abs((a.get(k) || 0) - (b.get(k) || 0)); return sum / 2; }
// verdicts: same | tiny | changed | resized | added | removed
// On the home page the hero, the first screen and the season scenes are big drawn pictures (hills, pumpkins, clouds, fields): the browser
// sometimes draws the soft edges of them a little differently from one run to the next (up to about 0.3% of the picture), so these sections
// get 20 times the room before a change in colors counts: a changed button, headline or picture is still found, a single small detail is not.
// Everything else is held to the normal tolerance (on a quiet run it is pixel for pixel the same).
const DRAWN = (pg, name) => pg === 'index' && (name === FIRST_NAME || name === 'section#top' || name.startsWith('hero picture in') || name.startsWith('section#seasons'));
const DRAWN_ROOM = 20;
function compareSegment(oldS, newS, name, pg) {
  if (!oldS) return { v: 'added' };
  if (!newS) return { v: 'removed' };
  if (Math.abs(oldS.h - newS.h) > 2 || Math.abs(oldS.w - newS.w) > 2) return { v: 'resized', from: oldS.h, to: newS.h };
  if (oldS.x === newS.x) return { v: 'same' };
  const ham = hamming(oldS.a, newS.a), col = colorDiff(oldS.c, newS.c), moved = colorsMoved(oldS.p, newS.p) * 100;
  const bigShape = ham > opt.tolA, bigColor = col.max > opt.tolC, bigArea = moved > opt.tolP * (DRAWN(pg, name) ? DRAWN_ROOM : 1) && moved / 100 * newS.w * newS.h >= opt.tolPx * (DRAWN(pg, name) ? DRAWN_ROOM : 1);
  if (!bigShape && !bigColor && !bigArea) return { v: 'tiny', ham, colMax: col.max, moved: +moved.toFixed(3) };
  return { v: 'changed', ham, colMax: Math.round(col.max), moved: +moved.toFixed(3), where: bigColor ? where(col.cells, 8) : bigShape ? where(shapeCells(oldS.a, newS.a), 16) : 'a small part', cells: bigColor ? col.cells : null, why: bigShape ? 'shape' : bigColor ? 'color' : 'colors' };
}
function compareJob(oldJob, now, pg) {
  const res = {}; const names = new Set([...Object.keys(oldJob.segments), ...Object.keys(now.segments)]);
  for (const n of names) res[n] = compareSegment(oldJob.segments[n], now.segments[n], n, pg);
  return res;
}
const BAD = new Set(['changed', 'resized', 'added', 'removed']);
const RANK = { same: 0, tiny: 1, changed: 2, resized: 3, added: 3, removed: 3 };

/* ------------------------------------------------------------------ run */
const manifest = fs.existsSync(opt.manifest) ? JSON.parse(fs.readFileSync(opt.manifest, 'utf8')) : null;
if (!opt.update && !manifest) { console.error('There is no baseline yet (' + path.relative(process.cwd(), opt.manifest) + '). Run (on a version of the site you trust, before you change anything): node tests/visual-check.mjs --update'); await browser.close(); await site.close(); process.exit(2); }
if (!opt.update && manifest.fixedDate && manifest.fixedDate !== FIXED_DATE) console.log(`Note: the baseline was made for the date ${manifest.fixedDate}, now it is ${FIXED_DATE} (WA_DATE). Pages that depend on the date will look different.`);
if (!opt.update && manifest.browser && manifest.browser !== BROWSER) console.log(`Note: the baseline was made with ${manifest.browser}; this is ${BROWSER}. Small differences in how text is drawn are normal; if many pages show up, run --update once.`);


const results = {};         // key -> { attempts: [capture], verdicts }
const failures = [];        // pages the tool could not look at
let stableConfirmed = 0;    // how many pages kept the same difference when looked at twice: after 3, stop retrying (the change is real, not a flicker)
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// A page that cannot be looked at (the browser is busy, a picture could not be decoded) is tried again before giving up.
async function capture(job, attempt) {
  for (let t = 0; ; t++) {
    try { return await captureJob(job, attempt); }
    catch (e) { if (t >= 2) throw e; await sleepMs(1000 * (t + 1)); }
  }
}
async function runJob(job, idx) {
  const label = `[${idx + 1}/${jobs.length}] ${job.key}`;
  let cap;
  try { cap = await capture(job, 0); }
  catch (e) { failures.push({ key: job.key, error: e.message }); console.log(label + '  COULD NOT CHECK: ' + e.message.split('\n')[0]); return; }
  if (opt.update) {
    results[job.key] = { attempts: [cap] };
    console.log(label + `  saved (${Object.keys(cap.segments).length} sections)`);
    return;
  }
  const old = manifest.jobs[job.key];
  if (!old) { results[job.key] = { attempts: [cap], verdicts: null, isNew: true }; console.log(label + '  not in the baseline (new page)'); return; }
  let verdicts = compareJob(old, cap, job.pg); const attempts = [cap];
  const differing = (vs) => Object.keys(vs).filter((n) => vs[n].v !== 'same');
  let diff = differing(verdicts);
  // a flicker (for example a picture that flips) shows up once and not again: look again before reporting
  for (let r = 0; r < opt.retries && diff.length; r++) {
    const onlyTiny = diff.every((n) => verdicts[n].v === 'tiny');
    if (!onlyTiny && stableConfirmed >= 3) break;          // the same real change was seen twice on 3 pages already: no need to keep proving it
    let again; try { again = await capture(job, r + 1); } catch (e) { break; }
    attempts.push(again);
    const v2 = compareJob(old, again, job.pg), diff2 = differing(v2);
    const sameSet = diff.length === diff2.length && diff.every((n) => diff2.includes(n));
    // only what is different in every look is kept (the milder of the readings); what matched the baseline once was a flicker
    const final = {};
    for (const n of Object.keys(verdicts)) {
      const x = verdicts[n], y = v2[n], dx = x.v !== 'same', dy = y.v !== 'same';
      final[n] = dx && dy ? (RANK[x.v] <= RANK[y.v] ? x : y) : (dx !== dy ? { ...(dx ? y : x), flicker: true } : x);
    }
    verdicts = final; if (sameSet && !onlyTiny) stableConfirmed++;
    diff = differing(verdicts);
  }
  results[job.key] = { attempts, verdicts, old };
  const flick = Object.values(verdicts).filter((v) => v.flicker).length;
  const bad = Object.keys(verdicts).filter((n) => BAD.has(verdicts[n].v)), tiny = Object.keys(verdicts).filter((n) => verdicts[n].v === 'tiny');
  console.log(label + (bad.length ? `  CHANGED: ${bad.length} section(s)` : '  same') + (tiny.length ? `  (${tiny.length} tiny)` : '') + (flick ? `  (${flick} flicker${flick > 1 ? 's' : ''} ignored)` : ''));
}

console.log(`${opt.update ? 'Saving the baseline from' : 'Checking'} ${jobs.length} pages (${BROWSER}, port ${PORT}). Output: ${opt.out}`);
{
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const i = next++; await runJob(jobs[i], i); } };
  await Promise.all(Array.from({ length: opt.parallel }, worker));
}

/* ------------------------------------------------------------------ update: write the baseline */
// keeps the pictures of one page: the whole-page picture and the small separate ones (first screen, hero seasons)
function clearPictures(dir, key) {                 // an older set of pictures of the same page must never be shown next to a newer baseline
  const stem = key.replace(/\|/g, '_') + '__';
  try { for (const f of fs.readdirSync(dir)) if (f.startsWith(stem)) fs.unlinkSync(path.join(dir, f)); } catch (e) { /* no folder yet */ }
}
function savePictures(dir, key, c) {
  fs.mkdirSync(dir, { recursive: true });
  clearPictures(dir, key);
  const stem = key.replace(/\|/g, '_');
  if (c.fullFile) fs.copyFileSync(c.fullFile, path.join(dir, stem + '__page.jpg'));
  for (const [n, f] of Object.entries(c.files)) if (f !== c.fullFile) fs.copyFileSync(f, path.join(dir, stem + '__' + n.replace(/[^a-z0-9]+/gi, '-') + '.jpg'));
}
function git(...a) { try { return execFileSync('git', a, { cwd: opt.site, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return null; } }
async function finish(code) { try { await browser.close(); } catch (e) { /* ignore */ } try { await site.close(); } catch (e) { /* ignore */ } try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } process.exit(code); }

if (opt.update) {
  const next = manifest && opt.only ? { ...manifest } : { jobs: {} };
  next.format = 1;
  next.about = 'Fingerprints of how every page looks (made by tests/visual-check.mjs --update). Not pictures. See the top of that file.';
  next.created = new Date().toISOString(); next.browser = BROWSER; next.platform = process.platform + ' ' + os.release();
  next.commit = git('rev-parse', '--short', 'HEAD'); next.fixedDate = FIXED_DATE;
  next.jobs = { ...(manifest && opt.only ? manifest.jobs : {}) };
  for (const j of jobs) { const r = results[j.key]; if (!r) continue; const c = r.attempts[0]; next.jobs[j.key] = { height: c.height, segments: c.segments }; }
  next.jobs = Object.fromEntries(Object.entries(next.jobs).sort(([a], [b]) => a.localeCompare(b)));
  const lines = ['{'];
  for (const k of ['format', 'about', 'created', 'browser', 'platform', 'commit', 'fixedDate']) lines.push(`"${k}": ${JSON.stringify(next[k] ?? null)},`);
  lines.push('"jobs": {');
  const js = Object.entries(next.jobs);
  js.forEach(([k, v], i) => {
    lines.push(`${JSON.stringify(k)}: {"height": ${v.height}, "segments": {`);
    const ss = Object.entries(v.segments);
    ss.forEach(([n, s], j) => lines.push(`  ${JSON.stringify(n)}: ${JSON.stringify(s)}${j < ss.length - 1 ? ',' : ''}`));
    lines.push('}}' + (i < js.length - 1 ? ',' : ''));
  });
  lines.push('}', '}');
  fs.writeFileSync(opt.manifest, lines.join('\n') + '\n');
  for (const j of jobs) { const r = results[j.key]; if (!r) continue; if (opt.noPictures) clearPictures(opt.pictures, j.key); else savePictures(opt.pictures, j.key, r.attempts[0]); }
  const kb = (fs.statSync(opt.manifest).size / 1024).toFixed(0);
  console.log(`\nBaseline saved: ${path.relative(process.cwd(), opt.manifest)} (${kb} KB, ${js.length} pages, ${js.reduce((n, [, v]) => n + Object.keys(v.segments).length, 0)} sections) in ${((Date.now() - T0) / 1000).toFixed(0)} s.${opt.noPictures ? '' : ' Pictures kept in ' + path.relative(process.cwd(), opt.pictures) + '.'}`);
  if (failures.length) { console.log('Could not look at: ' + failures.map((f) => f.key).join(', ')); await finish(2); }
  await finish(0);
}

/* ------------------------------------------------------------------ compare: the plain-words report */
const widthName = (w) => (w < 600 ? 'phone' : 'computer');
const ID_NAME = { 'section#top': 'hero (the big picture at the top)', 'section.hero': 'hero (the big picture at the top)', 'header.site-header': 'top menu', 'div.announce': 'top bar', 'footer.site-footer': 'footer', 'section.facts': 'quick facts strip', 'section.next-up': 'next-season countdown', 'section#this-week': '"this week" box', 'section#visit': 'Visit section', 'section#farm-map': 'farm map', 'section#seasons': 'seasons section', 'section#tomatoes': 'tomatoes section', 'section#pizza': 'Pizza section', 'section#greenhouse': 'GreenHouse section', 'section#shop': 'Shop section', 'section#flowers': 'Flowers section', 'section#groups': 'Groups section', 'section#about': 'Our story section', 'section#reviews': 'reviews section', 'section#gallery': 'photo gallery', 'section#faq': 'FAQ section', 'section#reserve': 'Reserve strip', 'section#contact': 'Contact section' };
const niceName = (n) => { const m = /^(.*?)( \[part \d+\/\d+\])?$/.exec(n); const base = ID_NAME[m[1]] || m[1]; return base + (m[2] || ''); };
const outDir = path.join(opt.out, 'changed'); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });

// side-by-side picture of one section: baseline | now | what changed (baseline picture needed), else the new picture with the changed spots marked
const FIRST = 'first screen (before scrolling)';
const ownPicture = (name) => name === FIRST || name.startsWith('hero picture in');   // these are saved as their own small pictures, the rest are cut from the whole-page picture
const sanitize = (n) => n.replace(/[^a-z0-9]+/gi, '-');
async function makePicture(key, name, verdict, cap) {
  const hp = await getHashPage(); const stem = key.replace(/\|/g, '_');
  const newSeg = cap.segments[name]; const oldSeg = results[key].old.segments[name];
  const newFile = cap.files[name]; if (!newFile || !newSeg) return null;
  let baseUrl = null;
  if (oldSeg && fs.existsSync(opt.pictures)) {
    const f = ownPicture(name) ? `${stem}__${sanitize(name)}.jpg` : `${stem}__page.jpg`;
    if (fs.existsSync(path.join(opt.pictures, f))) baseUrl = `${ORIGIN}/__tool/base/${f}`;
  }
  const rect = (seg) => ({ x: 0, y: ownPicture(name) ? 0 : seg.y, w: seg.w, h: seg.h });
  const dataUrl = await hp.evaluate(async ({ nowUrl, nowRect, baseUrl, baseRect, cells }) => {
    // only the wanted part of each (very tall) picture is kept in memory
    const crop = async (u, r) => createImageBitmap(await (await fetch(u)).blob(), r.x, r.y, r.w, r.h);
    const now = await crop(nowUrl, nowRect); const base = baseUrl ? await crop(baseUrl, baseRect) : null;
    const scale = Math.min(1, 700 / nowRect.w);
    const pw = Math.round(nowRect.w * scale), ph = Math.round(nowRect.h * scale);
    const panels = base ? 3 : 1; const c = document.createElement('canvas'); c.width = panels * pw + (panels - 1) * 8; c.height = ph + 22; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.font = '14px sans-serif'; g.fillStyle = '#000';
    const draw = (img, i) => g.drawImage(img, 0, 0, img.width, img.height, i * (pw + 8), 22, pw, ph);
    if (base) {
      draw(base, 0); draw(now, 1);
      g.fillText('baseline', 4, 15); g.fillText('now', pw + 12, 15); g.fillText('what changed (white = same)', 2 * (pw + 8) + 4, 15);
      const grab = (img) => { const k = document.createElement('canvas'); k.width = pw; k.height = ph; const gk = k.getContext('2d', { willReadFrequently: true }); gk.drawImage(img, 0, 0, img.width, img.height, 0, 0, pw, ph); return gk.getImageData(0, 0, pw, ph); };
      const da = grab(base), db = grab(now), out = g.createImageData(pw, ph);
      for (let i = 0; i < da.data.length; i += 4) { const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2])); const v = d < 12 ? 255 : 255 - Math.min(255, d * 3); out.data[i] = 255; out.data[i + 1] = v; out.data[i + 2] = v; out.data[i + 3] = 255; }
      g.putImageData(out, 2 * (pw + 8), 22);
    } else {
      draw(now, 0); g.fillText('now' + (cells ? ' (red boxes: where it differs from the baseline)' : ''), 4, 15);
      if (cells) { g.strokeStyle = 'red'; g.lineWidth = 2; for (const i of cells) { const cx = (i % 8) * (pw / 8), cy = Math.floor(i / 8) * (ph / 8); g.strokeRect(cx + 1, 22 + cy + 1, pw / 8 - 2, ph / 8 - 2); } }
    }
    return c.toDataURL('image/png');
  }, { nowUrl: `${ORIGIN}/__tool/tmp/${path.basename(newFile)}`, nowRect: rect(newSeg), baseUrl, baseRect: oldSeg ? rect(oldSeg) : null, cells: verdict.cells || null });
  const file = path.join(outDir, `${stem}__${sanitize(name)}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return file;
}

if (opt.keep) for (const j of jobs) { const r = results[j.key]; if (r) savePictures(opt.keep, j.key, r.attempts[r.attempts.length - 1]); }
const report = { checked: jobs.length, changed: [], tiny: 0, tinyList: [], flickers: 0, newPages: [], failures, baseline: { created: manifest.created, commit: manifest.commit, browser: manifest.browser } };
const lines = [];
const keysChanged = [];
for (const j of jobs) {
  const r = results[j.key]; if (!r) continue;
  if (r.isNew) { report.newPages.push(j.key); continue; }
  const last = r.attempts[r.attempts.length - 1];
  const names = Object.keys(r.verdicts);
  const bad = names.filter((n) => BAD.has(r.verdicts[n].v));
  if (!opt.strict) names.filter((n) => r.verdicts[n].v === 'tiny').forEach((n) => { report.tiny++; report.tinyList.push(`${j.key} / ${n}`); if (opt.verbose) console.log('   tiny: ' + j.key + ' / ' + n + '  shape bits ' + r.verdicts[n].ham + ', color ' + r.verdicts[n].colMax + ', area ' + r.verdicts[n].moved + '%'); });
  report.flickers += names.filter((n) => r.verdicts[n].flicker).length;
  if (opt.strict) names.filter((n) => r.verdicts[n].v === 'tiny').forEach((n) => { r.verdicts[n].v = 'changed'; r.verdicts[n].where = 'a few pixels (fine detail)'; bad.push(n); });
  if (!bad.length) continue;
  keysChanged.push(j.key);
  const item = { page: j.key, sections: [] };
  for (const n of bad) {
    const v = r.verdicts[n]; let picture = null;
    if (v.v === 'changed' || v.v === 'resized') { try { picture = await makePicture(j.key, n, v, last); } catch (e) { picture = null; if (opt.verbose) console.log('   (no picture for ' + j.key + ' / ' + n + ': ' + String(e.message).split('\n')[0] + ')'); } }
    item.sections.push({ name: n, nice: niceName(n), verdict: v.v, where: v.where || null, from: v.from, to: v.to, picture, unstable: r.attempts.length > 1 });
  }
  report.changed.push(item);
}
const pageWords = (key) => { const [pg, lang, w, extra] = key.split('|'); return `${pg === 'index' ? 'home page' : pg}${extra === 'hero' ? ' hero in other seasons' : ''} (${LANG_NAME[lang]}, ${widthName(+w)})`; };
const total = report.changed.reduce((n, c) => n + c.sections.length, 0);
lines.push(`Visual check: ${jobs.length} pages looked at, compared with the baseline made ${manifest.created ? manifest.created.slice(0, 10) : '?'}${manifest.commit ? ' on version ' + manifest.commit : ''}.`);
if (!report.changed.length) lines.push('Nothing looks different.');
else {
  lines.push(`${total} section(s) on ${report.changed.length} page(s) look different:`);
  for (const c of report.changed) {
    lines.push('');
    lines.push('  ' + pageWords(c.page));
    for (const s of c.sections) {
      const what = s.verdict === 'resized' ? `got ${s.to > s.from ? 'taller' : 'shorter'} (${s.from}px to ${s.to}px)` : s.verdict === 'added' ? 'is new (not in the baseline)' : s.verdict === 'removed' ? 'is gone' : `looks different${s.where ? ', mostly ' + s.where : ''}`;
      lines.push(`    - ${s.nice}: ${what}${s.picture ? '\n      picture: ' + s.picture : ''}`);
    }
  }
}
if (report.tiny) {
  const names = report.tinyList.map((t) => { const [k, n] = t.split(' / '); return pageWords(k) + ': ' + niceName(n); });
  lines.push(`\n${report.tiny} more section(s) differ by only a few pixels (a font edge, a short word change): not counted as changes${opt.strict ? '' : ' (use --strict to count them)'}.`);
  names.slice(0, 8).forEach((t) => lines.push('    - ' + t));
  if (names.length > 8) lines.push(`    ... and ${names.length - 8} more (see report.json)`);
}
if (report.flickers) lines.push(`${report.flickers} section(s) flickered once and matched when looked at again (ignored).`);
if (report.newPages.length) lines.push(`${report.newPages.length} page(s) are not in the baseline yet: ${report.newPages.slice(0, 6).join(', ')}${report.newPages.length > 6 ? ' ...' : ''}. Run --update to add them.`);
if (failures.length) lines.push(`Could not look at ${failures.length} page(s): ${failures.map((f) => f.key + ' (' + f.error.split('\n')[0] + ')').join('; ')}`);
lines.push(`\nTook ${((Date.now() - T0) / 1000).toFixed(0)} s. Report: ${path.join(opt.out, 'report.txt')}`);
fs.writeFileSync(path.join(opt.out, 'report.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(opt.out, 'report.json'), JSON.stringify(report, null, 1));
{   // today's fingerprints too (same layout as the baseline), so a tolerance can be tried out later without looking at the pages again
  const now = {}; for (const j of jobs) { const r = results[j.key]; if (r) { const c = r.attempts[r.attempts.length - 1]; now[j.key] = { height: c.height, segments: c.segments }; } }
  fs.writeFileSync(path.join(opt.out, 'now.json'), JSON.stringify({ browser: BROWSER, jobs: now }));
}
{
  const rows = report.changed.map((c) => `<h3>${pageWords(c.page)}</h3>` + c.sections.map((s) => `<p><b>${s.nice}</b>: ${s.verdict}${s.where ? ' (' + s.where + ')' : ''}</p>${s.picture ? `<p><img src="changed/${path.basename(s.picture)}" style="max-width:100%;border:1px solid #888"></p>` : ''}`).join('')).join('');
  fs.writeFileSync(path.join(opt.out, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Visual check</title><body style="font:15px sans-serif;max-width:1200px;margin:20px auto"><h2>Visual check</h2><pre>${lines.join('\n').replace(/</g, '&lt;')}</pre>${rows}`);
}
console.log('\n' + lines.join('\n'));
await finish(failures.length ? 2 : (report.changed.length ? 1 : 0));
