# Launch rehearsal: the whole launch, done only by following the docs, on a pretend host

Date: 3 October 2026. Base: commit `05b0b72` (the merged site), plus the site doctor (`tools/doctor.py`, written against an earlier commit and re-applied here; three small hunks needed a hand fix: the tools list in `README.md`, one row in `tests/README.md`, and the test order in `tests/run-all.mjs`).

**What this is.** A helper played the owner on launch day. It used only `README.md` and `docs/LAUNCH_CHECKLIST.md` (and the docs they point to), in the checklist's order, and wrote down at each step what the text said, what it did, what happened, whether a person who has never used a terminal would have got through, and the exact words that misled. Where the fix was plain, the docs or tools were changed (listed at the end). Nothing about the farm (a price, an hour, a name, a phone number) was changed.

**What the sample values were.** To get through the steps the helper typed invented values into `js/content.js` (a closed-Saturday notice and a closure date, a review link, Plausible as the analytics provider, a farm spot, `seasonPicker: false`) and a made-up Search Console code. These were typed into a throw-away copy only. They are not in the site files and not in the patch.

## What was real and what was pretend

| Real | Pretend |
|---|---|
| Python, the tools, the doctor, `make_deploy_folder.py`, `serve.py`, `make_qr.py`, `launch_check.py`: the exact commands the docs give, typed as written. | There was no Cloudflare account. The "upload" was copying the `deploy/` folder to a place Cloudflare's own free test program (`wrangler pages dev`, version 4.146.0) serves. It applies `_headers`, `_redirects`, the friendly "page not found" page and the redirect from `.html` addresses, as the real service does. |
| A real Chromium browser opened the pages, pressed the buttons, switched language, printed the sign sheets and read the browser console. | The address `www.wiseacresorganic.com` does not exist for the test computer. A small wrapper made the literal owner command `python3 tools/launch_check.py https://www.wiseacresorganic.com/` reach the test program instead, and played the host's `http` to `https` and bare-name to `www` forwards. |
| Netlify's own open-source header and redirect readers were run on the final `_headers` and `_redirects`. | Mailchimp, Plausible, OpenStreetMap search and the OSRM routing server were stand-ins that answer like the real ones. The browser still checked every address against the security policy first. |

**Machine time.** The test computer was very busy (load average 30 to 60), so every command took several times as long as on a normal computer. The times below are what the helper measured, plus a rough guess for a first-timer in brackets.

## Step by step

Each step says: the instruction as written, what was done, what happened, whether a non-programmer would have succeeded, the words that misled, and the fix.

### 1. One-time setup (README, "Commands on Windows, Mac and Linux")

- **Written:** install Python 3; open a terminal in the site folder; `python3 --version`; install the helper packages with `python3 -m pip install beautifulsoup4 pillow segno`.
- **Done:** checked Python 3.11 and `beautifulsoup4` (already there); did not run `pip` (nothing to install on this computer).
- **Happened:** fine. Under 1 minute (first-timer: 15 to 30 minutes, mostly the installer).
- **Non-programmer:** the Windows and Mac advice (PATH box, drag the folder into Terminal) is clear. Could not be proven here: on a new Mac or Linux computer `pip` may answer "externally-managed-environment", and the README has no word for that.
- **Misleading words:** none found. **Fixed afterwards (4 October 2026):** the README now has the plain steps for that `pip` answer (a `.venv` box, with the Mac and Linux and the Windows lines), and the doctor and `tools/make_deploy_folder.py` point to them when `beautifulsoup4` is missing. The wording could not be tried on a real Mac here.

### 2. Run the doctor (README "Check your changes"; checklist section 2)

- **Written:** `python3 tools/doctor.py` "checks the whole site and the upload folder in plain words, changes nothing, and ends with READY TO UPLOAD or NOT READY".
- **Done:** ran it on the untouched site.
- **Happened:** 15 seconds (first-timer: 1 minute). Setup OK; site files OK; five "look" lines (season buttons, farm point, review link, signup, analytics); one red line: no upload folder yet, with the exact command. Ended `NOT READY: 1 thing to fix. Next: python3 tools/make_deploy_folder.py`.
- **Non-programmer:** yes. One small snag: the "look" lines say "question 35" and "decision D11", which mean nothing until the owner has the question list. **Fixed afterwards:** the lines now say what to do in plain words and name the owner dashboard card ("The farm's exact spot on the map", "Google review link").

### 3. Fill in the settings in `js/content.js` (README "Day-to-day changes", "Planning features", checklist 3.8, 3.9, 3.12, 3.13)

- **Written:** change only what is between quote marks; for the review link `reviewUrl: 'https://g.page/r/…/review',`; for the farm spot "set `farmPoint` in `js/content.js`"; `seasonPicker: false`.
- **Done:** typed a notice with its end date, one closure, the review link, Plausible, the farm spot, `seasonPicker: false`.
- **Happened:** the first scripted edit stopped, because `farmPoint: null,` is in the file twice: once in the big explaining note near the top, once in the settings list near the end. The same is true for `reviewUrl`. Someone who presses Ctrl+F finds the note first, edits a line inside a comment and sees nothing change. About 2 minutes once found (first-timer: 10 to 20 minutes, and this is where they would stall).
- **Misleading words:** the README row says only "`js/content.js` → `reviewUrl: '…'`" and the checklist says "Set `farmPoint` in `js/content.js` (the steps are in the comment …)".
- **Fix (done):** the README ("Editing a file safely") and the checklist (3.13) said where the line is. **Fixed afterwards:** the notes inside `js/content.js` no longer spell out `farmPoint: null,` or `reviewUrl: ''` (nor `entrancePhoto: null,`), so a search for the whole line lands on the line to change. The README now tells the owner to search for the whole line, and a test keeps it true.
- After saving: `python3 tools/serve.py` showed the notice bar, the closure on the "Open now" badge, the review link, no season buttons, and no yellow "Site check" box.

### 4. Rebuild and make the upload folder (checklist section 2, "The easy way")

- **Written:** `python3 tools/make_deploy_folder.py`; "it does five things"; "At commit `66c8272` that is 77 files and `FILES.txt`, 5.8 MB"; "Upload what is inside `deploy/`".
- **Done:** ran it. No page text was changed, so nothing needed translating; the command said the pages and translations were up to date and the facts agree.
- **Happened:** under a minute. `deploy/` held 82 files and `FILES.txt`, 5.7 MB. One warning (the signup form is not connected yet), as the docs said.
- **Non-programmer:** yes. **Misleading:** "five things" but four are listed; the commit number and the 77 files and 5.8 MB were out of date, so the owner would think something was missing.
- **Fix (done):** "four things"; the numbers are now stated for this commit and "a few more or fewer is normal".

### 5. Run the doctor again

- **Done:** 13 seconds. `READY TO UPLOAD: upload what is inside deploy/ (docs/LAUNCH_CHECKLIST.md, step 3.2).` Matches the docs exactly.

### 6. Look at the upload folder on your own computer (checklist section 2)

- **Written:** "To look at the folder before you upload it, run `python3 tools/serve.py deploy`."
- **Done and happened:** it served the folder with the right file types; the site looked the same as from the working folder, with no yellow box. Fine.

### 7. Trial upload to a temporary address (checklist 3.1, 3.2)

- **Written:** open Workers & Pages, Create application, Drag and drop; check the home page and each language, that `/wise-pie.html` jumps to `/wise-pie`, that `/nonsense` shows the friendly page, that `?check` shows no yellow box.
- **Done:** the dashboard clicks cannot be done here (pretend). The folder was copied to the test program and every check in the list was run against it.
- **Happened:** all four checks matched the text: the pages and five languages load; `/wise-pie.html?lang=es` answers 308 to `/wise-pie?lang=es` and the page shows in Spanish; `/nonsense` shows the farm's page; no yellow box.
- **Non-programmer:** the browser checks are clear. Whether the dashboard buttons are named as the doc says only the real host can show.

### 8. DNS, padlock (checklist 3.3, 3.4)

- **Not possible offline.** The wrapper made the address answer so that the later steps could run. Nothing about a real `CNAME`, `CAA`, the certificate, or "does `http://` jump to `https://`" was tested (see the list at the end).

### 9. First launch check (checklist section 5 "The first hour"; README "Putting it online", item 7)

- **Written:** `python3 tools/launch_check.py https://www.wiseacresorganic.com/`; "On Cloudflare Pages the first run is expected to FAIL on the five `.html` pages until the clean-address change of 3.7 is done."
- **Done:** typed exactly that.
- **Happened:** 3 seconds. 32 passed, 5 warnings, 5 failures; ended NOT READY. The five failures were the `.html` pages redirecting (as the checklist warned). The warnings: the 13 old addresses show "page not found" (before step 10), prices still say "coming soon", the signup form is not connected.
- **Non-programmer:** the lines are clear and each names what to do. But step 3.7 of the checklist, where the owner is sent to fix this, does not say which patch it is, while the launch check says "apply the clean-address patch (`docs/DECISION_PLAYBOOK.md`, d05, OPT-C)". Two docs, two names for one thing.
- **Fix (done):** 3.7 now names OPT-C and the decision (d05), says it is the owner's decision, and says that until it is made the check shows five FAIL lines and ends NOT READY, which is expected.

### 10. Old-address redirects (checklist 3.6)

- **Written:** save the printed block as `_redirects` (no `.txt`) in the top folder; make the upload folder again; upload; open each old address.
- **Done:** extracted the block exactly as printed (22 lines), saved it, made the folder again, copied it to the test program.
- **Happened:** the test program said "Parsed 22 valid redirect rules". The folder had 83 files plus `FILES.txt`: `make_deploy_folder.py` did copy `_redirects` (as 3.6 says). All 22 old addresses answered 301 and landed on a page that opens. The second launch check: 33 passed, 5 warnings (now only `/summer/` and `/posts/`, the owner's decision D3), the same 5 failures.
- **Non-programmer:** yes, if the editor does not add `.txt` (the doc warns). Small gap, **fixed afterwards**: the command's screen output now says, in one plain line each, whether `_headers` and `_redirects` are in the folder and where (and names a file saved as "_redirects.txt"); the doctor says the same.

### 11. The headers (checklist 3.5, first half)

- **Written:** the home page shows four named security headers; a picture shows `cache-control: public, max-age=31536000, immutable`; `/print/qr-signs` shows `x-robots-tag: noindex`.
- **Done and happened:** all matched. Optional `.pages.dev` blocks: with the two blocks added to `_headers`, a `.pages.dev` address got `x-robots-tag: noindex` and the farm's domain did not.

### 12. The Content-Security-Policy line and the trial run (checklist 3.5, second half)

- **Written:** add the one line under `Permissions-Policy:` with the same two spaces; first as `Content-Security-Policy-Report-Only`, open each page with F12, look for `[Report Only] Refused to ...`; then delete `-Report-Only` and upload again; press Print once.
- **Done:** pasted the line exactly as printed; ran the trial in a real browser over 15 page loads (all pages in English; the home page and the first-visit page in the four other languages).
- **Happened:** because analytics was switched on in step 3, 14 of the 15 page loads printed `[Report Only] Refused to load the script 'https://plausible.io/…'`. The line in 3.5 does not contain that address. The doc did say, in point 3 above the line, that analytics needs its addresses, but the trial-run text said "with the real policy the helper saw none" and an owner would think the line was wrong. After adding `https://plausible.io` to `script-src` and `connect-src` (the table in 3.9): 0 messages, 0 violations. Switched on: the Print button works on all four sign sheets (the fingerprint in the line matches), a pretend "Get drive time" press went through.
- **Non-programmer:** the trial works, but this is the step most likely to make a first-timer give up, because the console text is long and the cause (a feature they turned on a step earlier) is not named.
- **Fix (done):** 3.5 and 3.9 now say: add the provider's addresses before pasting; if you did not, expect exactly this message on every page.

### 13. `robots.txt`, `sitemap.xml` and clean addresses (checklist 3.7)

- **Done:** both open as text. The clean-address change (OPT-C) was **skipped on purpose: it is an optional patch and the owner's decision**. Result: the five `.html` pages still answer a redirect, the canonical tags still name `.html` addresses, and the launch check keeps its five FAIL lines.
- **Not fixed, listed:** the owner needs to decide this before submitting the sitemap (step 3.10 already says so).

### 14. `seasonPicker: false`, analytics (checklist 3.8, 3.9)

- **Done and happened:** the season buttons are gone from the home page. With Plausible switched on, a page load calls only `plausible.io` (the stand-in). Each of the four providers in the table was tried through the real policy: with only the line from 3.5, the provider's script is blocked (one violation); with the table's addresses added: no violation and the requests go out.

### 15. Google Search Console tag (checklist 3.10; README "Analytics + Google Search Console")

- **Written:** "paste it in `index.html` where the comment in the `<head>` says GOOGLE SEARCH CONSOLE"; and the comment in `index.html` says "paste the verification tag it gives you right here".
- **Done:** first as written: put the tag at "right here", which is inside the comment. Then below the comment.
- **Happened:** inside the comment the tag is inactive: the page has no such tag and Google's "Verify" would fail, with no message anywhere. Below the comment it is active, on the home page only, as the doc says.
- **Non-programmer:** would have got this wrong. The words "right here" and "where the comment says" point inside the comment, and the tag line is an example inside the comment too.
- **Fix (done):** the README and 3.10 say "on a line of its own just below the comment, after its closing `-->`". `tools/doctor.py` has a new red check: a real tag found only inside the comment says exactly that and how to move it (and a test in `tests/doctor.test.mjs`). **Fixed afterwards:** the comment inside `index.html` holds no example tag and says not to paste the tag inside it; a test keeps it so.

### 16. Share pictures and the Business Profile (checklist 3.11, 3.12)

- **Done:** the launch check passes the share pictures (found, size, right address). A person still has to look at the six pictures; the helper did not judge them. The Google Business Profile needs the real Google account (pretend).
- **Gap found and fixed:** after setting `reviewUrl`, the checklist and README never say that the printable review sign is made only by running `python3 tools/make_qr.py` again. Until then the sheet has no review sign. **Fix (done):** README (the review-link row) and 3.12 say so, and the doctor says so (a "look" line, not red) when `reviewUrl` is set and the sheet does not carry the link.

### 17. The Drive time box (checklist 3.13)

- **Done:** with `farmPoint` set, pressed the button with an address. Without `farmPoint`, again. With both services refused, again.
- **Happened:** with the farm spot: one search and one route request per press, nothing stored, answer "12.4 miles, about 25 minutes by car" (the stand-in's numbers) with the three credit links. Without it: two searches 1.16 seconds apart, then the route. With the services down: "The lookup is not working right now. Try the Google Maps button instead." and a Google Maps button. Matches the doc in all three.

### 18. After launch (checklist section 5)

- **QR signs:** `python3 tools/make_qr.py` made 10 signs per sheet on four sheets; `--check` scanned every code back; each sheet prints 10 pages; the Print button works under the policy. The menu sign (`index.html#menu`) and the map sign (`first-visit.html#farm-map`) go through the `.html` redirect and still scroll to the right place.
- **Language switch:** picking Spanish in the menu stays on the other pages (also through the redirect). Opening `/?lang=es` does not store anything, as the docs say.
- **Cookies and storage:** no cookies, no IndexedDB, no stored caches, no service worker; the only entry after a normal visit was `wa.checklist`. The only outside address contacted was the analytics stand-in.
- **Old addresses:** all 22 lines (13 old addresses).
- **Skipped, because only the real thing can do it:** booking links, the Mailchimp test, the real phone on mobile data, the padlock, the Business Profile and Search Console screens, link previews.

### 19. Optional patches: skipped, on purpose

The patches in `docs/DECISION_PLAYBOOK.md` are the owner's decisions and were not applied: OPT-C (clean page addresses, so the five `.html` FAIL lines stay), OPT-D (shorter code cache), the Mailchimp form code, the real prices, and what to do with `/summer/` and `/posts/`.

## What was changed in the docs and tools

| Where | Change |
|---|---|
| `docs/LAUNCH_CHECKLIST.md`, section 2 | "five things" is now "four things"; the file counts and sizes now match this commit (82 files and 5.7 MB from the command; about 97 files and 6.3 MB by hand); "this site has about 100 files". |
| `docs/LAUNCH_CHECKLIST.md`, 3.5 and 3.9 | Analytics and the policy line go together: add the addresses before pasting; the first trial run complains about the analytics script until they are in. The line's length is stated as the policy (374) and with its name (399). |
| `docs/LAUNCH_CHECKLIST.md`, 3.7 | Names OPT-C and the decision; says what the launch check shows until it is made. |
| `docs/LAUNCH_CHECKLIST.md`, 3.10 and `README.md` | The Search Console tag goes below the comment, not inside it. |
| `docs/LAUNCH_CHECKLIST.md`, 3.12, 3.13 and `README.md` | Which line to change when searching `js/content.js` (search for the whole line); the review QR sign needs `make_qr.py` after `reviewUrl`. |
| `README.md`, "Change opening hours" row | The old sentence said the Site check box ignores `hours`. It does not: a misspelled name or `'8 pm'` is named. (Tried: `houers`, `opn` inside `hours`, `'8 pm'`: all named.) |
| `tools/doctor.py`, `tests/doctor.test.mjs` | New: a Search Console tag only inside the comment is red, with the fix; `reviewUrl` set but no review sign on the sheet is a "look" line. Tests added for both. |
| `docs/LAUNCH_CHECKLIST.md`, section 6 and this file | Re-run results are recorded below. |

## What is not fixed (an owner decision, or only the real thing can show it)

- OPT-C (clean addresses) and the other optional patches: the owner's decision.
- The `pip` wording for "externally-managed-environment" was written but could not be tried on a real new Mac or Linux computer.

Four things that were listed here on 3 October 2026 were fixed on 4 October 2026: the comments in `js/content.js` and `index.html` (words only, nothing they do), the two host files named on the screen of `tools/make_deploy_folder.py`, the plain "look" lines, and the `pip` steps in the README.

## The "[tested here]" claims, re-run

Everything that can be re-run offline was re-run on 3 October 2026 at commit `05b0b72` with the same program versions as the checklist (wrangler 4.146.0, `@netlify/headers-parser` 10.1.1, `@netlify/redirect-parser` 16.1.1).

| Claim in the checklist | Result |
|---|---|
| `_headers` applied by Cloudflare's test server (the four security notes, immutable cache on pictures, noindex on `/print`) | Holds. |
| All 22 `_redirects` lines: 301 and the target opens | Holds (22 of 22). |
| Netlify's parsers: no errors, policy returned unchanged, 22 redirects, all 301 | Holds (0 errors; the 416-character policy with the Plausible addresses came back identical). |
| `/wise-pie.html` goes to `/wise-pie` (308) and keeps `?lang=es`; friendly 404 | Holds. |
| `.pages.dev` addresses get `x-robots-tag: noindex`, the farm's domain does not | Holds. |
| The by-hand folder: 16 items (17), 92 files (93), about 6.4 MB; biggest file 0.44 MB | **No longer true:** now 97 files (98) and 6.3 MB; 16 items and 0.44 MB hold. Fixed. |
| "At commit `66c8272` ... 77 files, 5.8 MB" | **No longer true:** 82 files and 5.7 MB. Fixed. |
| Opened from a plain folder, Chrome cannot load the font files | Holds: two font files failed from the folder and none from a web server. |
| Policy fingerprint matches the Print button on the four sheets; Print works under the policy | Holds. |
| With the real policy no `[Report Only]` message | Holds only when the analytics addresses are added (see step 12); with analytics on and no addresses, 14 of 15 loads complained. Docs fixed. |
| Each analytics provider's script is blocked by the 3.5 line alone and passes with the 3.9 addresses | Holds for Plausible, GoatCounter, Umami and Cloudflare (stand-ins). |
| Drive time box: one search and one route per press with `farmPoint`; two searches 1.1 seconds apart without; fallback message; credit links; the site name sent as referrer; nothing stored | Holds. |
| Storage: only `wa.lang`, `wa.offer`, `wa.checklist`; no cookies, IndexedDB, caches or service worker | Holds (only `wa.checklist` appeared in a normal visit; `wa.lang` appears when a language is picked). |
| QR signs that end in `index.html#menu` and `first-visit.html#farm-map` keep their place through the redirect | Holds. |
| The home page first-visit weight (21 files, 0.9 MB on load; 46 to 52 files and 2.2 to 2.4 MB after scrolling, text compressed) | Holds within a tenth of a megabyte: 21 files and 0.38 MB compressed on load; 51 to 53 files and 2.4 to 2.5 MB after scrolling. |
| The 374 characters of the policy line | Holds (the policy alone; 399 with its name). |
| Drive time test suite: 42 of 42, later 45 of 45 | Now 136 checks, all pass. |
| The folder made by `make_deploy_folder.py`, served with no special rules: every page in all five languages loads, no error, no missing file | Holds (the upload-folder test passes, 27 checks). |

## The automatic tests on the final files

Run on 3 October 2026 on the files as changed here, a few at a time because the computer was busy: `docs` 10 of 10, `public-site` 13, `launch-check` 70, `validity` 43, `pipeline` 31, `consistency` 67, `files-audit` 12, `doctor` 39 (including three new checks), `deploy` 27, `serve` 29, `sitecheck-values` 37, `drive` 136, and `python3 tools/test_check_facts.py` OK. All passed. The rest of the browser tests do not touch anything that was changed (only docs, `tools/doctor.py` and its test).

## Checked against the other new tools (4 October 2026)

The doctor, the command that makes the upload folder and the upload-folder test were run on copies of the site that also held the language review kit (its `review/` folder of sheets, and a sheet round trip: export, one correction, import), the folder of optional patches (`patches/optional/`), a `.venv` folder, and a host file saved as "_redirects.txt". Results: none of those folders is part of the upload; each is left out and named with its own reason on the screen of the upload command; the doctor stays READY TO UPLOAD with them lying there, and says RED, in one line with the fix, for a "_redirects.txt" or a missing `_headers`. After a sheet is imported, the doctor says the built translation file is out of date and gives the one command that rebuilds it. The local server shows whatever folder it is given and was not affected. The optional patches still apply to the site as it is now (the test that applies each of them and every set of them passes), after one wording change in step 3.7 that had stopped the clean-addresses patch from applying.

## What only the real host can prove

- The real Cloudflare dashboard: the names of the buttons, the drag-and-drop upload, rolling back a deployment.
- DNS: the `CNAME` for `www`, any `CAA` records, how long the change takes, the forward of the bare name, email (`MX`, `TXT`) staying untouched.
- The real certificate and the `http://` to `https://` jump on the real name.
- The real OpenStreetMap search and OSRM routing servers (answers, limits, whether they refuse a business site).
- Mailchimp's real form code; the real analytics services and their own pages.
- Google Search Console (does Verify accept the tag; how Google treats the `.html` canonical addresses on Cloudflare) and the Business Profile.
- A real phone on mobile data; real printing and scanning of the signs; link previews in Facebook, WhatsApp and iMessage.
- `pip` on a real new Mac or Windows computer; the Windows `py` and `python` spellings.
