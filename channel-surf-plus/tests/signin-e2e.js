// The whole Google sign-in, start to finish, through the real tv.py:
//   Setup → "Sign in with Google" → (a stand-in Google page) → back to tv.py on 127.0.0.1
//   → tv.py swaps the code for a sign-in (at a stand-in Google token server)
//   → forwarded to http://localhost, where the TV's settings still are → signed in
//   → a like goes to (pretend) YouTube with the short-lived pass, and signing out works.
//   node tests/signin-e2e.js
// Needs Python 3, Node and Playwright. Nothing touches the real Google or your settings.
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const mock = require('./mock-data-api');

const TV_PORT = 18661, G_PORT = 18662, HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-e2e-'));
const CLIENT_ID = '1234567890-e2etest.apps.googleusercontent.com', SECRET = 'GOCSPX-e2e';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '  -> ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// stand-in for Google: the sign-in page (the person picks their account and allows it),
// and the token and revoke endpoints that tv.py talks to
const google = { exchanges: [], revoked: [], auth: null };
const gserver = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/auth') {
    const p = google.auth = Object.fromEntries(u.searchParams);
    res.writeHead(302, { location: p.redirect_uri + '?code=code-e2e&scope=' + encodeURIComponent(p.scope) + '&state=' + encodeURIComponent(p.state) }); return res.end();
  }
  let body = ''; req.on('data', d => body += d); req.on('end', () => {
    const f = Object.fromEntries(new URLSearchParams(body));
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/token' && f.grant_type === 'authorization_code') { google.exchanges.push(f); return res.end(JSON.stringify({ access_token: 'tok-e2e-1', expires_in: 3599, refresh_token: 'refresh-e2e', scope: 'https://www.googleapis.com/auth/youtube.force-ssl', token_type: 'Bearer' })); }
    if (req.url === '/token' && f.grant_type === 'refresh_token') return res.end(JSON.stringify({ access_token: 'tok-e2e-2', expires_in: 3599, token_type: 'Bearer' }));
    if (req.url === '/revoke') { google.revoked.push(f.token); return res.end('{}'); }
    res.statusCode = 404; res.end('{}');
  });
});

(async () => {
  await new Promise(r => gserver.listen(G_PORT, '127.0.0.1', r));
  const tv = spawn('python3', [path.join(__dirname, '..', 'tv.py'), '--no-browser', '--port', String(TV_PORT)], {
    env: { ...process.env, HOME, CS_GOOGLE_AUTH_URL: `http://127.0.0.1:${G_PORT}/auth`, CS_GOOGLE_TOKEN_URL: `http://127.0.0.1:${G_PORT}/token`, CS_GOOGLE_REVOKE_URL: `http://127.0.0.1:${G_PORT}/revoke`, no_proxy: '127.0.0.1,localhost', NO_PROXY: '127.0.0.1,localhost' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let tvlog = ''; tv.stdout.on('data', d => tvlog += d); tv.stderr.on('data', d => tvlog += d);
  for (let i = 0; i < 40; i++) { try { await new Promise((res, rej) => http.get(`http://127.0.0.1:${TV_PORT}/api/health`, r => { r.resume(); r.statusCode === 200 ? res() : rej(); }).on('error', rej)); break; } catch { await sleep(150); } }
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.route('https://www.youtube.com/iframe_api', r => r.fulfill({ contentType: 'text/javascript', body: `window.__mockDur=${JSON.stringify(mock.durations())};\n` + fs.readFileSync(path.join(__dirname, 'mock-iframe-api.js'), 'utf8') }));
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, DELETE' };
    await ctx.route('https://www.googleapis.com/youtube/v3/**', async r => {
      const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const [status, body] = mock.handle(q.url(), { method: q.method(), headers: q.headers(), body: q.postData() });
      await r.fulfill(status === 204 ? { status, headers: CORS } : { status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) }).catch(() => {});
    });
    await ctx.route('https://i.ytimg.com/**', r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"/>' }));
    const settings = { apiKey: 'AIzaGOODGOODGOODGOODGOODGOODGOODGOOD12', pin: '1111', setupDone: true, tv: { sounds: false, remote: 'never', staticOn: false }, channels: [{ id: 't-wood', num: 2, name: 'Woodshop', call: 'WOOD', sources: [{ type: 'channel', id: mock.ids.WOOD, title: 'Mock Woodshop' }], filters: {}, fav: false }] };
    await ctx.addInitScript(s => { if (!localStorage.getItem('channelSurfPlus.v1')) localStorage.setItem('channelSurfPlus.v1', s); }, JSON.stringify(settings));
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${TV_PORT}/`); await page.waitForTimeout(600);
    await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
    await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.SetupHome('youtube'))); await page.waitForTimeout(600);
    // set up the sign-in client
    await page.fill('#cid', CLIENT_ID); await page.fill('#csecret', SECRET); await page.click('#saveClient'); await page.waitForTimeout(800);
    check('saving the sign-in client works and offers "Sign in with Google"', await page.isVisible('#signIn'));
    const saved = path.join(HOME, '.config', 'channel-surf', 'google-oauth.json');
    check('the client is saved in a private file (only you can read it)', fs.existsSync(saved) && (fs.statSync(saved).mode & 0o077) === 0);
    // sign in
    await page.click('#signIn');
    await page.waitForURL(u => u.hostname === 'localhost' && !u.pathname.startsWith('/api/'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const googleParams = google.auth;
    check('Google is asked for YouTube permission with PKCE', googleParams && googleParams.scope.includes('youtube.force-ssl') && googleParams.code_challenge_method === 'S256' && googleParams.client_id === CLIENT_ID, JSON.stringify(googleParams));
    check('Google sends the browser back to 127.0.0.1', googleParams && googleParams.redirect_uri === `http://127.0.0.1:${TV_PORT}/api/oauth/callback`);
    check('tv.py swapped the one-time code, with the PKCE check word', google.exchanges.length === 1 && google.exchanges[0].code === 'code-e2e' && google.exchanges[0].code_verifier && google.exchanges[0].code_verifier.length >= 43, JSON.stringify(google.exchanges));
    check('…and the browser ends up back on the TV at localhost', new URL(page.url()).hostname === 'localhost', page.url());
    check('the TV\'s settings are still there afterwards (same address)', await page.evaluate(() => !!JSON.parse(localStorage.getItem('channelSurfPlus.v1') || '{}').apiKey));
    check('the power screen says "Signed in to YouTube"', await page.evaluate(() => /Signed in to YouTube/.test(document.getElementById('demoNote').textContent)));
    const tokenFile = path.join(HOME, '.config', 'channel-surf', 'google-token.json');
    check('the lasting sign-in is in a private file, not in the browser', fs.existsSync(tokenFile) && (fs.statSync(tokenFile).mode & 0o077) === 0 && !(await page.evaluate(() => JSON.stringify(localStorage) + document.cookie)).includes('refresh-e2e'));
    // use it
    await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
    await page.waitForFunction(() => channelSurf.settings.account && channelSurf.settings.account.name === 'Mock Viewer', null, { timeout: 6000 }).catch(() => {});
    check('the account name shows up', await page.evaluate(() => (channelSurf.settings.account || {}).name === 'Mock Viewer'));
    mock.state.writes = [];
    await page.evaluate(() => channelSurf.screen.open(new channelSurf.pages.VideoPage({ id: 'wd00_______', title: 'Woodshop Show 0', channelId: 'x', channelTitle: 'Mock Woodshop' })));
    await page.waitForTimeout(900);
    await page.evaluate(() => { const t = channelSurf.screen.top(); t.sel = t.items.findIndex(i => /Like on YouTube/.test(i.html)); }); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
    check('a like goes to YouTube with the short-lived pass from tv.py', mock.account.ratings['wd00_______'] === 'like');
    // sign out
    await page.evaluate(() => { channelSurf.screen.closePages(true); channelSurf.screen.open(new channelSurf.pages.SetupHome('youtube')); }); await page.waitForTimeout(800);
    await page.click('#signOut'); await page.click('#signOut'); await page.waitForTimeout(900);
    check('signing out deletes the saved sign-in and tells Google', !fs.existsSync(tokenFile) && google.revoked.includes('refresh-e2e'), JSON.stringify(google.revoked));
    check('no script errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  } catch (e) { fail++; console.log('FAIL test run crashed: ' + e.stack + '\n' + tvlog); }
  await browser.close(); tv.kill(); gserver.close(); fs.rmSync(HOME, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
