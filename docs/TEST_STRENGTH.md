# How strong is the safety net?

This note answers one question: **if something on the site breaks, do the tests notice?**
It was measured on 4 October 2026 (74 breaks) and again on 6 October 2026 on the final tree (77 breaks), by breaking the site on purpose, in small ways a future edit could break it, and running the tests.

## What was done

* 77 small deliberate breaks ("mutants") are listed in `tools/mutants.json`. Each one is a file, the text to find and the text to put there.
  Five groups: **content** (22: hours, closures, dates, prices, translations), **structure** (26: links, pictures, headings, ids, tags in the head, sitemap, manifest;
  three of them, b04r b07r b08r, run the build commands after the break, as the owner would),
  **behaviour** (17: language, seasons, the photo viewer, signup, the Drive time box, storage, cookies, an outside request, a console error),
  **look** (9: a rule that hides the Reserve button, text the colour of its background, a section too wide for a small phone, no focus ring, a 5 MB picture, a 4-second freeze)
  and **tools** (3: the deploy folder, the launch check).
* Every break is made in its own throw-away copy of the site. Nothing in the real folder is touched.
* Then the tests run, in this order: (1) the quick tests that the `// covers:` lines name for the changed file (this is what `node tests/run-all.mjs --files=FILE` prints),
  (2) if nothing failed, the other tests that need no browser, (3) if still nothing, one browser test that should notice.
  Each group stops at its first red test: a break is noticed once, and the slow tests after it are not waited for.
  The result is "caught by TEST" or "survived". A break that survives is a hole.
* Run it again with `python3 tools/mutate.py --base . --browser` (add `--only a01,b05` for some; `python3 tools/mutate.py --help`). A full run takes about an hour on a busy computer.
  To add a break, add one entry to `tools/mutants.json`; `"rebuild": true` in it runs the three build commands (`pages.py`, `i18n.py extract`, `i18n.py build`) after the break.
  A break whose text is no longer in the file says `NOT APPLIED` instead of passing quietly (this found one that had gone stale, e01, and one that was written wrong, e03).

## The result

Measured on 6 October 2026, with the tests as they were that day, before the checks named below were added. Of the 77 breaks, **73 are noticed**, **1 is not a real break** (e01: the deploy tool
has two rules that keep `tests/` out, so removing one changes nothing; the folder it makes is the same, file for file), and **3 went through** (c16, d07, d08: real holes, closed since, see the second table).
Before the tests added on 4 October, at least 4 more breaks went through (b18, c03, c17, d06).

| group | breaks | noticed | went through |
| --- | --- | --- | --- |
| content (a) | 22 | 22 | 0 |
| structure (b) | 26 (23, and 3 that run the build commands after the break) | 26 | 0 |
| behaviour (c) | 17 | 16 | 1 (c16: the signup is sent to another host) |
| look (d) | 9 | 7 | 2 (d07: the text size is 8 px on a small screen; d08: every picture is squeezed to 100 px high) |
| tools (e) | 3 | 2 | 1 equal break (e01) |

With the checks in the second table every one of the 76 real breaks is noticed; the 77th (e01) changes nothing.

"Noticed" is not always "noticed for the right reason". The tool counts a break as caught when any test turns red, and some catches were by chance:
a04 and a07 only because `docs` quotes the line that was edited (for a04 also `owner-cheat-sheet`; a06 was noticed by `docs` and `owner-calendar`, which happens to read that date); b04, b07 and b08 only because the break leaves a built file out of date;
c13 only by `doctor`; d04 only by `browser-support` (the rule that was broken is a `:focus-visible` one), while `smoke`, the test meant for it, was not reached.
The second table says which of these now have a test of their own. When you read a result, look at the name of the test: a data edit "caught by docs" is luck.

## Where the net is strong

* **Facts and words.** A price, hour, phone number, address, weekday or date that disagrees between two places is found at once, in seconds, by `consistency`, `owner-calendar` and `pipeline`
  (the pipeline also finds a translation that is missing, left in English, lost a `{placeholder}`, or a built file somebody edited by hand). All 22 content breaks were noticed.
* **Plain mistakes in the pages.** A broken link or `#anchor`, a picture without `alt`, a skipped heading, a doubled id, a wrong `lang`, a missing sitemap line, a broken manifest or
  JSON-LD, a wrong canonical address, a robots.txt that blocks the site: all noticed by `validity`, `seo`, `public-site`, `files-audit` and `launch-check`, without a browser.
* **The `covers:` lines work.** Nearly every break that was noticed by a test that needs no browser was noticed by a test that the `// covers:` line of the changed file names.
  The exceptions are c02, c03 and c04, which `doctor` noticed first (the covers lines of those files do not name it). So `node tests/run-all.mjs --changed` is a good guide.

## Holes that were found, and what closes them now

| hole | what went through | closed by |
| --- | --- | --- |
| a style that hides the FAQ answers, the Reserve button, the focus ring, or makes a section wider than a 320 px phone | the old tests looked at these only in detail, minutes into a long test, or not at all | new `smoke` (a visitor's first minute, about 20 seconds) |
| the menu button loses its name (`aria-label`) | nothing without a browser | `smoke` |
| the viewport tag lost from the head (a phone then shows a tiny desktop) | **nothing at all**: every test runs as a desktop | new `code-rules` (head tags of every page, a second) |
| the "only light" colour-scheme tag lost | only the browser test `auto-dark` | `code-rules` |
| a script that blocks the page for 4 seconds at start | nothing: all the tests wait | `code-rules` (no loop that waits by reading the clock) |
| the open-now badges on Chicago time, the calendar file with bare LF, the hours or season dates changed in a script | only slow browser tests (live, messages), or only the words that describe them | new `logic` (the real scripts run without a browser, a second) |
| a storage key renamed, a cookie, an outside request or a new web address written into a script | only `privacy`, after 2 to 3 minutes in a browser | new `privacy-static` (the first half of `privacy`, a second) |
| the signup form accepts an address on any site | nothing | one new check in `sitecheck-values` |
| a closure day typed in `js/content.js` that is not a real day, e.g. `2026-11-31` (a04) | only `docs` and `owner-cheat-sheet` by chance (they quote the line); `sitecheck-values` in a browser | `logic`: every closure is a real day, or a range of real days |
| a `data-until` or `data-release` date in a page that is not a real day (month 13) or is written `2026-10-3` (a06, a07) | only `docs` by chance (a06 also `owner-calendar`, which happens to read the date); the browser test `dated`; for a07 no test without a browser | `validity`: every `data-until` and `data-release` is a real day written YYYY-MM-DD |
| a script tag lost from the home page, scripts in the wrong order, a button with no name, after the build commands were run (b04, b07, b08) | nothing: they were noticed only because the break left a built file out of date | `code-rules`, part 3 (and the new breaks b04r b07r b08r, which run the build commands, are all noticed by it) |
| the signup sent to another host (c16); the pizza reservations opening at 4 PM when the table gives no time (c13) | c16 nothing; c13 only `doctor` | `features`: the host of the signup, and a missing opening time still waits for 5 PM |
| the text size set to 8 px on small screens (d07); every picture squeezed to 100 px high (d08) | d07: `layout-sweep`, but with a Chromium crash that is not a catch (see "Holes that remain"); d08: nothing | `smoke`: the first paragraph is at least 14 px at 390 and 320 px; `layout-sweep`: a new kind of fault, a picture drawn less than 0.55 as high as wide |

## Holes that remain

* **e01** is an equal break, not a hole: `tools/make_deploy_folder.py` skips `tests/` in two places, and the upload folder is the same without the first one (88 files and `FILES.txt`, the same checksum for each).
* **A test that crashes is not a test that notices.** `layout-sweep` looks at four pages at the same time (`PARALLEL = 4` at the top of the test). On the computer used on 6 October 2026,
  from about 03:23, this made Chromium crash on the real, unbroken site ("Target crashed", "N of 24 page views were looked at"); with the number set to 1 it passes, 21 checks in 75 seconds.
  A result "caught by layout-sweep" with that message is a crash, not a catch: d07 went through its first run in exactly that way.
* **Colours.** Text that is hard to read is noticed only when it is the body text on a yellow button (`auto-dark`) or by `smoke` (headline 3:1, paragraph 4.5:1). `axe` would find more but
  `axe-core` was not installed on the computer used. Colours of other parts (a tab, a chip, a footer) are not looked at by any test on every page.
* **How it feels.** Nothing measures speed on a phone. `code-rules` stops the one obvious freeze (waiting by reading the clock); a slow loop of another kind goes through.
* **Real phones.** The tests drive Chromium. A rule that a real iPhone or Samsung browser reads differently is not noticed.
* **The 77 breaks are guesses.** They are the edits that seemed likely. A mistake nobody thought of is not in the list; add it to `tools/mutants.json` when you meet it.

## Read this when you add a test

Run `python3 tools/mutate.py --base . --only IDS` for the breaks that your test should notice. A test that notices none of them is worth a second look.
Keep each new check about a plain fact (shown / not shown, a number, a colour), and never about a time that depends on how busy the computer is.
