# Tests for the Wise Acres site

These are checks for **developers** (or Claude): they open the site in a real browser and make sure the countdown, the languages,
the farm map, the signup and the rest still work after a change. You do not need them to edit the site, and **they are not part of the
website**: do not upload this folder (see "Keeping the tests off the public site" below).

## Install (once)

You need Node.js 18 or newer (22 is what the tests were written with). Install the two helpers **inside this folder**, so the big
`node_modules` folder stays here and never gets near the website:

```
cd tests
npm install                      # playwright and axe-core, listed in tests/package.json
npx playwright install chromium  # the browser the tests drive
```

(Without a `package.json` the same thing is `npm i -D playwright axe-core`.) Playwright and axe-core can also be installed globally
(`npm i -g playwright axe-core`); the tests look in this folder, in the main folder, and in the global npm folder.

The `pipeline` test also needs Python 3 with the packages the tools need: `pip install beautifulsoup4 segno` (it skips the QR part
without `segno`). A missing tool makes a test say `SKIP` with the command to fix it; it is never a silent pass.

## Run

```
node tests/run-all.mjs               # everything, one test at a time, with a short summary at the end
node tests/run-all.mjs map i18n      # only tests whose name contains one of these words
node tests/run-all.mjs --list        # what there is
node tests/map.test.mjs              # one test on its own (it starts its own web server)
```

A test prints `PASS` or `FAIL` for each check (a failing line says what it saw) and ends with `ALL PASSED` or `N FAILED`; the exit
code is 0 only when everything passed. A full run takes about ten minutes on a quiet computer and twenty to thirty when the computer is busy (`drive` and `hero` are the slow ones: `node tests/run-all.mjs --list`).

No setup is needed: every test starts a small web server of its own **on a free port** and serves this folder's parent (the site).
Nothing is written into the site folder (the `pipeline` test works in a temporary copy) and no pictures are saved.

| Setting | What it does |
| --- | --- |
| `WA_URL=https://example.com/` | test a site that is already running (a staging copy) instead of starting the built-in server |
| `WA_PORT=8000` | use this port for the built-in server (default: any free port) |
| `WA_CHROME=/path/to/chrome` | use this Chrome / Chromium instead of the one Playwright installed |
| `WA_SLOW=3` | multiply every time limit by 3: for a very busy or slow computer (default 1) |
| `WA_DATE=2026-12-15T12:00:00-05:00` | the moment every page believes it is "now" (default: Friday Oct 2 2026, noon in New York). Only for looking at the site on another day: some checks assume fall and then fail on purpose |
| `WA_PYTHON=python3` | the Python program the `pipeline` test calls |
| `AXE_PATH`, `PLAYWRIGHT_PATH` | where to find `axe.min.js`, or the `playwright` folder, if they are installed somewhere unusual |

## What each test covers

| Test | Covers |
| --- | --- |
| `features` | pizza countdown (exact switch at 5 PM Eastern, time zones, last row), calendar reminders (Google link, `.ics` file), "This week at the farm" (typical dates, your update, 14-day expiry, live feed, winter), the email signup (not set up, preview, Mailchimp with a pretend server, errors), reviews / press / visitor photos / entrance photo, drive times and map links |
| `languages` | the countdown, chip, week box and drive times in es, hi, zh and vi (nothing left in English, no `{placeholders}`), switching back to English, the Spanish calendar file |
| `i18n` | `?lang=`, the globe menu, remembering the choice, the "Would you like this in Spanish?" offer, `html lang` for every language, changing language keeps the reader's place on the page |
| `i18n-early` | a visitor who opens the site in Spanish, Hindi, Chinese or Vietnamese never sees English first: the page is already in that language when the big scripts start (measured at the top of `js/hero.js`), and the FAQ, the season buttons and the language menu still work afterwards |
| `dated` | lines that hide themselves after their `data-until` date (the "Open now" line, pizza weekends, the special days; Eastern Time, no reload needed, still shown without JavaScript, mistakes reported in the "Site check" box), and the hero line between seasons |
| `drive` | the "Drive time" box on the home page and the first-visit page: type an address, get miles and minutes to the farm or to The GreenHouse (the OpenStreetMap search and the OSRM route server are pretended, never contacted): nothing sent before the button, the answer, hours, the "Drive to:" choice and its default by season, not found / no route / service down, pressing twice, odd place names shown as plain text, all five languages, phone widths, the links to the box, no scripts, nothing kept, `farmPoint`, the analytics event |
| `gallery` | the photo gallery's topic buttons (Berries, Flowers, ...): only photos of the chosen topic, the count read aloud, untagged photos under All only, mistakes in `tags` reported in the "Site check" box, the five languages |
| `pause` | looping animations only run where someone can see them: far-away sections and drawings are paused, they wake up when scrolled near, a hidden browser tab pauses everything |
| `live` | "Open now" badges (hours, closures, Eastern Time, daylight saving), the next-season countdown, the notice bar (also per language), the hero's "open now" badges, the "First-visit guide" menu link |
| `hero` | which season it is on a date, the season switcher, picking things, the tractor, keyboard use, no sideways scrolling from 320 px to 1920 px, reduced motion, `seasonPicker: false`, the card buttons that follow the season (Reserve / Tell me when / See prices) |
| `farm-seasons` | "What's on the farm": the cards, note and table column for each season, and the hero switcher keeping them in step |
| `map` | the farm map on both pages: drawn from the data, legend, detail card, keyboard, "Show names", languages, phone width; hostile names stay plain text; no data hides it |
| `npc` | tapping the little people in the hero scene |
| `analytics` | nothing is sent until a provider is chosen; Do Not Track; the events the README lists |
| `print-qr` | the printable QR signs on phones, and exactly one letter page per sign when printed |
| `axe` | accessibility (axe-core, WCAG 2.1 AA and best practices) on the home and First-visit pages, phone and desktop, English / Chinese / Hindi, every season tab. Needs `axe-core` |
| `pipeline` | the Python tools: the rebuild commands change nothing on a finished site, no translation is missing, edited English is reported, unsafe translations and empty maps are refused, the farm map and QR signs rebuild as committed, the tools' own checks `tools/test_add_photo.py` and `tools/test_pages.py` pass |
| `public-site` | nothing links to `tests/`, the sitemap lists only real pages, `robots.txt` and `_headers` keep `tests/` and `print/` out of search results, and the site's own address (`SITE` in `tools/pages.py`) is the same in every canonical tag, share tag, structured-data address, the sitemap, `robots.txt` and the QR signs |

## When a test fails

* Read the failing line first: it says what was expected and what the page showed.
* Many checks contain **English wording** (for example `Next pizza reservations open in`). After you change wording on purpose, change the
  same words in the test. A test that fails because of an intended wording change is a test to update, not a bug.
* On a busy computer a failure that does not repeat is worth another run with `WA_SLOW=3`; tests wait for what they check (never a fixed
  number of seconds), so a real failure fails every time.
* Dates in the tests are fixed: every page starts at Friday Oct 2 2026, noon in New York (`TODAY` in `lib.mjs`), unless a test sets its own
  `time`. So a test does not start failing because the real date has moved on (lines that hide themselves, seasons that change).

## Writing a new test

Copy a short one (`live.test.mjs`) and keep to these rules:

* File name `something.test.mjs`; start with `import { run, open, ok, okSoon, until } from './lib.mjs'` and put the body in `await run('name', async ({ browser, base, errs }) => { ... })`.
* `open(browser, base, 'index.html', errs, { lang, time, extra, viewport, ... })` opens a page, waits until the site's scripts have started, and
  collects page errors (any error fails the test). `time` sets where the page clock starts (default: `TODAY`; `false` = the real clock), `extra` appends settings to `js/content.js`, `routes` adds mocks.
* **Wait for a condition, never for a fixed time.** After a click use `okSoon(name, () => value, (v) => isGood(v))` or `until(page, fn)`. Do
  not use `waitUntil: 'networkidle'`: on a busy computer the network can go quiet while the page is still being built (`document.readyState` is
  still "loading"), so a check made right after it can see a half-ready page.
* Check what a visitor sees (text, visibility, links), not how the code is written.

## Keeping the tests off the public site

* Nothing on the site links to `tests/` and `sitemap.xml` does not list it, nor `docs/` (the `public-site` test checks both).
* `robots.txt` has `Disallow: /tests/` and `Disallow: /docs/` (like `/print/`) and `_headers` marks `/tests/*` and `/docs/*` as `noindex`, so search engines leave them out
  even if the folder is uploaded by mistake. That is only a request to search engines: anyone who guesses the address can still read the files.
* **Do not upload `tests/` or `docs/` (or `tools/`, `pages/`, `lang/src/`) to the live site.** They are not needed there. If your host publishes a whole folder, publish a copy without them.
