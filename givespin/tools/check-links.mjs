// Checks every charity website in js/data.js and prints the ones that need a look.
//
//   node givespin/tools/check-links.mjs              (all charities, 8 at a time)
//   node givespin/tools/check-links.mjs --limit 50   (only the first 50, to try it out)
//   node givespin/tools/check-links.mjs --only wateraid,oxfam
//
// For each charity it asks for https://<url> (HEAD first, then GET when HEAD is refused), follows redirects and reports:
//   DEAD      the host does not answer, or answers with an error (404, 410, 5xx after a retry)
//   MOVED     the final address is on a different host than the one in the roster (update `url` if it is the same charity)
//   BLOCKED   the site refuses scripts (401, 403, 429): not proof of anything, check it by hand
// A result of OK means the roster host answers (possibly after a redirect inside the same site).
// It only reads public pages, sends one request per charity at a time and waits between retries; run it from a normal
// connection (a sandbox that restricts outbound traffic will report everything as DEAD).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.GS_DATA || path.join(here, '..', 'js', 'data.js');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const limit = Number(opt('--limit')) || 0;
const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
const parallel = Number(opt('--parallel')) || 8;
const scheme = process.env.GS_SCHEME || 'https'; // only changed by the self-test

const sandbox = { window: {} };
sandbox.window.GS = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataFile, 'utf8'), sandbox);
let charities = (sandbox.window.GS.data && sandbox.window.GS.data.charities) || sandbox.window.GS.charities || [];
if (!charities.length) { console.error('Could not read the charities from ' + dataFile); process.exit(2); }
if (only) { charities = charities.filter((c) => only.has(c.id)); }
if (limit) { charities = charities.slice(0, limit); }

const baseHost = (h) => h.toLowerCase().replace(/^www\./, '');
const UA = 'GiveSpin link check (+a manual check of the roster websites)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(url, method) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try { return await fetch(url, { method, redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } }); }
  finally { clearTimeout(timer); }
}

async function check(c) {
  const start = scheme + '://' + c.url;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let res = await ask(start, 'HEAD');
      if (res.status === 405 || res.status === 501 || res.status === 403) { res = await ask(start, 'GET'); }
      const finalHost = new URL(res.url).host;
      if (res.status === 401 || res.status === 403 || res.status === 429) { return { id: c.id, kind: 'BLOCKED', detail: res.status + ' at ' + res.url }; }
      if (res.status >= 400) { if (attempt === 0 && res.status >= 500) { await sleep(1500); continue; } return { id: c.id, kind: 'DEAD', detail: res.status + ' at ' + res.url }; }
      const rosterHost = baseHost(c.url.split('/')[0]);
      if (baseHost(finalHost) !== rosterHost) { return { id: c.id, kind: 'MOVED', detail: c.url + ' -> ' + res.url }; }
      return { id: c.id, kind: 'OK', detail: res.status + '' };
    } catch (e) {
      if (attempt === 0) { await sleep(1500); continue; }
      return { id: c.id, kind: 'DEAD', detail: (e && e.cause && (e.cause.code || e.cause.message)) || (e && e.message) || 'no answer' };
    }
  }
  return { id: c.id, kind: 'DEAD', detail: 'no answer' };
}

const results = [];
let next = 0;
async function worker() {
  while (next < charities.length) {
    const c = charities[next++];
    const r = await check(c);
    results.push(r);
    if (r.kind !== 'OK') { console.log(r.kind.padEnd(8) + r.id.padEnd(48) + r.detail); }
  }
}
await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
const count = (k) => results.filter((r) => r.kind === k).length;
console.log('\nchecked ' + results.length + ': ' + count('OK') + ' ok, ' + count('MOVED') + ' moved, ' + count('BLOCKED') + ' blocked, ' + count('DEAD') + ' dead');
process.exit(count('DEAD') + count('MOVED') ? 1 : 0);
