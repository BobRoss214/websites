// order: 205
// browser: no
// quick: yes
// covers: js/*.js, css/*.css, *.html, _headers, docs/WHAT_THE_SITE_STORES.md
/* The privacy checks that need no browser, on their own (a second): every web address in the shipped files is on the allow-list, nothing is loaded from another
 * site, no iframe / video / upload, only the two allowed text boxes, storage / cookies / beacons only in the two files that may use localStorage, only the allowed
 * keys, the fact sheet lists them, and _headers keeps the referrer and permission policies. These are the first checks of tests/privacy.test.mjs (it runs them
 * too, then the browser part); this file runs only them, by asking that test to stop after them (WA_STATIC_ONLY=1), so the lists exist once. A new tracker, a
 * cookie or a request to an outside site written into a script is found here in a second instead of after minutes in a browser. */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const privacy = path.join(path.dirname(fileURLToPath(import.meta.url)), 'privacy.test.mjs');
const r = spawnSync(process.execPath, [privacy], { env: { ...process.env, WA_STATIC_ONLY: '1' }, encoding: 'utf8', timeout: 120000 });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
if (r.status === null) { console.log('FAIL privacy.test.mjs did not finish: ' + (r.error ? r.error.message : 'stopped')); console.log('\n0 passed, 1 failed'); }
process.exitCode = r.status === 0 ? 0 : 1;
