# How strong is the safety net?

This note answers one question: **if something on the site breaks, do the tests notice?**
It was measured on 4 October 2026 by breaking the site on purpose, in small ways a future edit could break it, and running the tests.

## What was done

* 74 small deliberate breaks ("mutants") are listed in `tools/mutants.json`. Each one is a file, the text to find and the text to put there.
  Five groups: **content** (22: hours, closures, dates, prices, translations), **structure** (23: links, pictures, headings, ids, tags in the head, sitemap, manifest),
  **behaviour** (17: language, seasons, the photo viewer, signup, the Drive time box, storage, cookies, an outside request, a console error),
  **look** (9: a rule that hides the Reserve button, text the colour of its background, a section too wide for a small phone, no focus ring, a 5 MB picture, a 4-second freeze)
  and **tools** (3: the deploy folder, the launch check).
* Every break is made in its own throw-away copy of the site. Nothing in the real folder is touched.
* Then the tests run, in this order: (1) the quick tests that the `// covers:` lines name for the changed file (this is what `node tests/run-all.mjs --files=FILE` prints),
  (2) if nothing failed, the other tests that need no browser, (3) if still nothing, one browser test that should notice.
  The result is "caught by TEST" or "survived". A break that survives is a hole.
* Run it again with `python3 tools/mutate.py --base . --browser` (add `--only a01,b05` for some; `python3 tools/mutate.py --help`). A full run takes about an hour on a busy computer;
  without `--browser` about 20 minutes. To add a break, add one entry to `tools/mutants.json`. A break whose text is no longer in the file says `NOT APPLIED` instead of passing quietly.

## The result

Of the 74 breaks, **68 are noticed** by the tests (as the tests are after this change), **1 is not a real break** (the deploy tool has two rules that keep `tests/` out, so removing one changes nothing),
and **5 are not noticed, or the browser test that should notice was not run** (see "Holes that remain"). Before the tests added with this note, at least 4 more breaks went through (b18, c03, c17, d06).

| group | breaks | noticed | not noticed / not tried |
| --- | --- | --- | --- |
| content | 22 | 22 | 0 |
| structure | 23 | 23 | 0 |
| behaviour | 17 | 15 | 2 (c13 c16: the browser test that should notice, `features`, was not run) |
| look | 9 | 7 | 2 (d08 d09: `smoke` does not notice; `layout-sweep`, which should, was not run) |
| tools | 3 | 1 | 1 equal break (e01), 1 not noticed (e03) |

"Noticed" for a few breaks means: noticed by one test only, and only after minutes in a browser (see the list in the report that came with this note).

## Where the net is strong

* **Facts and words.** A price, hour, phone number, address, weekday or date that disagrees between two places is found at once, in seconds, by `consistency`, `owner-calendar` and `pipeline`
  (the pipeline also finds a translation that is missing, left in English, lost a `{placeholder}`, or a built file somebody edited by hand). All 22 content breaks were noticed.
* **Plain mistakes in the pages.** A broken link or `#anchor`, a picture without `alt`, a skipped heading, a doubled id, a wrong `lang`, a missing sitemap line, a broken manifest or
  JSON-LD, a wrong canonical address, a robots.txt that blocks the site: all noticed by `validity`, `seo`, `public-site`, `files-audit` and `launch-check`, without a browser.
* **The `covers:` lines work.** Every break that was noticed by a test that needs no browser was noticed by a test that the `// covers:` line of the changed file names. None was noticed only
  by a test the mapping missed. So `node tests/run-all.mjs --changed` is a good guide.

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

## Holes that remain

* **c13, c16** (the pizza reservations open at 4 PM when the table gives no time; the signup is sent to another host): the test that should notice, `features`, was not run on these
  breaks because of the time. It very likely does. Nothing without a browser looks at them.
* **d08, d09** (every picture stretched to 100 px high; the header covering the first screen): `smoke` does not notice. `layout-sweep` should (it looks for stretched pictures and bars that
  cover the page); it was not run on these breaks because of the time.
* **e03** (`tools/launch_check.py` stops looking for forbidden entries in the sitemap): the launch-check test has no broken sitemap in its list of broken sites. `public-site` and `seo`
  look at the sitemap too, so a real mistake is still noticed.
* **Colours.** Text that is hard to read is noticed only when it is the body text on a yellow button (`auto-dark`) or by `smoke` (headline 3:1, paragraph 4.5:1). `axe` would find more but
  `axe-core` was not installed on the computer used. Colours of other parts (a tab, a chip, a footer) are not looked at by any test on every page.
* **How it feels.** Nothing measures speed on a phone. `code-rules` stops the one obvious freeze (waiting by reading the clock); a slow loop of another kind goes through.
* **Real phones.** The tests drive Chromium. A rule that a real iPhone or Samsung browser reads differently is not noticed.
* **The 74 breaks are my guesses.** They are the edits that seemed likely. A mistake nobody thought of is not in the list; add it to `tools/mutants.json` when you meet it.

## Read this when you add a test

Run `python3 tools/mutate.py --base . --only IDS` for the breaks that your test should notice. A test that notices none of them is worth a second look.
Keep each new check about a plain fact (shown / not shown, a number, a colour), and never about a time that depends on how busy the computer is.
