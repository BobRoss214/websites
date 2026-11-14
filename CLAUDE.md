# Wise Acres Organic Farm website (static HTML, CSS and plain JavaScript; 5 languages: en es hi vi zh)

You work for the site BUILDER. She is not the farm owner (the bosses are Mrs. Cathy and Rob) and she is not a programmer: answer her in plain, short words.

## Her standing rules
- Change only what she asked. Never invent a price, an hour, a name, a phone number or any fact; if you are not sure, ask her.
- Computer layout first; the phone layout after she says.
- Do NOT push to GitHub and do NOT publish anything unless she says so. The default branch `claude/wise-acres-redesign-w9m4bi` is the REAL website.
- Never loosen, skip or delete a test to make it pass. If a rule truly changed, change the test to the new truth and say which line and why.
- Plan and ask before building anything she did not ask for (four ideas are waiting for her yes: a search box, a "ready to pick this week" note, a closed-today/weather switch, a "text this to a friend" button).
- No phone notifications. Keep her e-mail address private (never put it in a file, a commit or a request to a web service).
- The tour (js/tour*.js, css/tour.css), the pretend ingredient lists (js/shop-sample.js) and the pretend demo are PREVIEW ONLY. They must not go on the real website (see work-notes/session-notes/PUSH_PLAN.md).

## Where we are
Read `work-notes/HANDOFF.md` (top block) and `work-notes/session-notes/OPEN_ITEMS.md` first. Her own words for each request: `work-notes/session-notes/REQUESTS_10NOV.md`.
Branch `integ` has everything finished. Unfinished work: branches `kitchenfix` and `storegaps3`.

## How the site is built
- `pages/*.html` are the sources; the root `*.html` files are GENERATED. Visitor text is marked `data-t="t<8 hex>"` (sha1 of the English text); translations live in `lang/src/<code>.json`.
- After ANY edit to `pages/`, `lang/src/`, `tools/pages.py` or text written by JavaScript, run the whole pipeline, in this order:
  `python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build`
  Then `git status` must show only what you meant to change, and `python3 tools/i18n.py missing es --list` (also `hi`, `vi`, `zh`) must say 0 missing. If it complains about strings written by JavaScript, also run `python3 tools/i18n.py jsstrings`.
- Repo rules (one IIFE per JS file, ES2017 only, no year number like 2026 in js/css, ...): `work-notes/session-notes/CONSTRAINTS.md`.
- Python helpers (once, in a venv): `python3 -m venv .venv && . .venv/bin/activate && python -m pip install beautifulsoup4 pillow segno`.
- Tests: `node tests/run-all.mjs --list`, `--quick`, or names (`node tests/run-all.mjs docs consistency`). Browser tests need Playwright (Chromium) and axe-core: read `tests/README.md` and `tests/lib.mjs` for how they find them (environment variables NODE_PATH, AXE_PATH, PLAYWRIGHT_BROWSERS_PATH). They fake the date; see `tests/lib.mjs` and `tests/dated.test.mjs`. Run browser tests one at a time.
- The private preview is built with `python3 work-notes/preview/build-artifact.py --out <dir>` (see work-notes/preview/README.md).
