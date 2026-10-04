# Decision playbook

What to change when the farm owner answers one of the open questions on the dashboard: d01 to d59 and 14 more, d60 to d73, d74 to d87 (see "Dashboard ids and doc question numbers").
Written on 3 October 2026 for commit b54427b, extended for e02b95e and (d60 to d73) f176745. Nothing here decides anything for the owner, and no optional patch has been applied.
Entries d74 to d87 (added to the dashboard on 3 October 2026, with no number in the doc) were written for commit 9416cba. Each answer that is a file edit was tried on a copy of the site (docs/ANSWER_REHEARSAL.md); the answers that need files from later sets of changes say so.
Entries d43 to d45 (added later on the dashboard, with no number in the doc) were written on 3 October 2026 for commit af1e572. On the same day the dashboard texts of d01, d10, d15, d22, d41 and d44 were reworded; this page says the same as the dashboard now.

## How to use it

1. Find the question by its number (d01 to d87) or in the topic list below.
2. Read the option she chose. It lists the files and the exact setting or text, how many strings must be written in the four translations, and which tests may need an update.
3. Make the change. Rebuild and test as in "The standard steps". Then run `node tests/docs.test.mjs`: it lists every note (this page, the README rows, the other docs) that still names the old words or a place that moved; give those notes the new words. The steps and "Tests:" lines of the entries below were tried one by one on a copy of the site (docs/ANSWER_REHEARSAL.md says which ones, and how to try them again with `python3 tools/rehearse_answers.py --list`).
4. If the entry names a patch, apply it only after her answer. Patches are listed in "Patches on disk".
5. Delete the matching row in the README table "Content status" when a question is closed.

Entries d01 to d42 were written for commit b54427b, entries d46 to d59 for e02b95e, entries d43 to d45 for af1e572, entries d60 to d73 for f176745, entries d74 to d87 for 9416cba. Places in files are named by words you can search for, not by line numbers (see "How the docs point into files").

Commit e02b95e also holds the messages feature (f45d6d9) and the plain-English rewrite (7d917e6), which changed the wording and the ids of 77 sentences.

If an id is not in lang/en.json (the plain-English rewrite renamed some), search for the quoted text instead.
"Strings" counts English sentences or words whose id changes. Each needs 4 translations (es, hi, zh, vi) in lang/src/<code>.json.
The optional patches named here are in the repository, in patches/optional/ (see "Patches on disk" and docs/OPTION_PATCHES.md).

## How the docs point into files

A place in a file is named by the file and words from that place, in backticks: index.html at `data-t="t60509a07"` means: open index.html and search (Ctrl+F) for data-t="t60509a07".
The words are an element id, a translation id (data-t), a setting or function name, a test's name, or a few words of the line. Each occurs once in its file, unless the doc says how often: "(2 places)".
- FILE from `A` to `B`: the lines from the one with A to the one with B.
- A test's short name stands for its file: consistency means tests/consistency.test.mjs.
- README row "Farm map": the row of a README table that starts with those words.

Line numbers are not used: they move every time a line is added above them. `node tests/docs.test.mjs` checks that every place named this way is still in its file, as often as the doc says.

## The standard steps

After a change to index.html, pages/*.html, js/*.js, lang/src/*.json or tools/qr_links.json:

```
python3 tools/pages.py
python3 tools/i18n.py extract
python3 tools/i18n.py jsstrings
python3 tools/i18n.py build
python3 tools/i18n.py missing es     # also hi, zh, vi: each must say 0 missing
python3 tools/make_qr.py             # only after tools/qr_links.json changed
python3 tools/farm_map.py tools/saved-map.json   # only after a new saved map
python3 tools/check_facts.py         # after a price, hour, phone, e-mail, address, age or year changed: every place must agree (no Node needed)
```

Changing an English sentence changes its id (data-t). The old translations no longer match and show as missing.
Add the 4 new translations, rebuild, and the check above must say 0 missing.
How to find the texts to translate (`python3 tools/i18n.py missing es --list`) and where to put them is in the README, "Change one sentence and its translations, step by step".
Exception: the dates in the pizza table and the "Open now" sentence under it, in the shape the README row "Open a new pizza weekend" shows, translate themselves when `extract` runs (tools/date_phrases.py). They count as 0 strings.

Tests (needs Playwright; see tests/README.md). One word picks every test whose name contains it:

```
node tests/run-all.mjs consistency dated farm-seasons hero live
node tests/run-all.mjs --list        # all test names
```

Test names: public-site, docs, owner-calendar, pipeline, consistency, live, dated, messages, drive, pause, gallery, analytics, print-qr, deploy, farm-seasons, npc, i18n, i18n-early, i18n-a11y, languages, axe, keyboard, contrast-pixels, map, features, hero, option-patches.
Always run consistency after a change to a price, time, day, age, size, phone number or address. It reads every page in all five languages.

Apply a patch from the repo root, then rebuild (docs/OPTION_PATCHES.md has the table: file, apply order, host, what to run after):

```
git apply --check patches/optional/<file>.patch    # no output = it applies
git apply patches/optional/<file>.patch
```

## The 11 topics, most urgent first

| # | Topic | Urgency | Questions |
|---|---|---|---|
| 1 | Put the site online | blocks launch | d05, d30, d38, d15, d63, d72 |
| 2 | Wrong links and placeholder content | blocks launch | d02, d03, d46, d47, d04, d54, d06 |
| 3 | People and photos (permission) | blocks launch | d13, d31, d32, d33, d12, d34, d61, d86, d87 |
| 4 | Pizza and food facts | wrong or risky information | d17, d16, d18, d19, d20, d21, d22, d49, d53, d08, d57, d79, d80 |
| 5 | Dates, seasons and winter | wrong or risky information | d01, d09, d23, d50, d51, d24, d25, d26, d27, d60, d66, d68, d69, d70 |
| 6 | Rules and promises to visitors | wrong or risky information | d41, d42, d52, d55, d44, d45, d35, d36, d43, d81, d85 |
| 7 | Names, address and listings | wrong or risky information | d07, d28, d29, d39, d40, d65, d78 |
| 10 | What the site says the farm offers | wrong or risky information | d48, d56, d58, d59, d67, d73, d74, d84 |
| 8 | Drive time box and map tools | nice to have | d10, d11, d14, d62, d64 |
| 9 | Translations | nice to have | d37, d71, d82, d83 |
| 11 | How you update the site yourself | nice to have | d75, d76, d77 |

Urgency: "blocks launch" = answer before the site goes public. "wrong or risky information" = the site says something that may be false or unsafe. "nice to have" = can follow launch.
Inside a topic every question has its own urgency (1, 2 or 3 in the heading). The line "Checklist says" in each entry repeats what docs/LAUNCH_CHECKLIST.md section 4 says about the matching old question.

## Which answers change other answers

| Answer | Changes | Why |
|---|---|---|
| d05 host | d30, d15, page-address style, cache time, d10 option C | Cloudflare Pages and Netlify read _headers and _redirects. GitHub Pages reads neither. Only Cloudflare redirects /x.html to /x, which is the reason for the clean-URL patch clean-addresses-C. A header line (d15) needs a host that sets headers. |
| d38 web address | share cards, QR signs, sitemap, structured data, d10 option C, d30 | One setting (tools/pages.py SITE) plus the home page tags and tools/qr_links.json "site". A new address after launch means new link previews: a changed picture needs a new file name (checklist 3.11). Old-address redirects only make sense if the new site takes over the old address. |
| d30 redirects | d05 (which patch), d38 | redirects-A needs _redirects (Cloudflare, Netlify). redirects-B (13 small redirect pages) is for hosts without it. |
| d15 header | d10, d05, analytics, Mailchimp | The line names the two map services (connect-src). Switch it on last, after d10 is final. |
| d01 winter, d24, d25, d27, d23, d09 | each other | d24 option B is the same patch as d01 option A. d25 (Reserve window) and d27 (school banner) use the same data-only switch. d23 (fall end date) decides the November gap and overlaps winter if fall ends Nov 30. d09 (GreenHouse hours) is the same code change as d08 (Thursday). Christmas trees are sold at The GreenHouse. |
| d16 $31 package | tests/consistency.test.mjs, d17, d20, d21, d19 | The price and the sentence "Includes 2 Wise Pie pizzas, plus $3 per person" are pinned in 3 places and 5 languages. Extras (+$9, +$3) and the pizza card (index.html from `data-t="t661d94cd"` to `data-t="td4abc72c"`) are shared with d17, d20 and d21. |
| d18 oven | share picture og-wise-pie.png, tests, d37 | The heading is drawn into assets/og-wise-pie.png. consistency pins "N-degree oven" (consistency at `pizza: oven temperature`) and the Celsius figure in Chinese (consistency at `const ALLOWED_EXTRA`). |
| d17 allergen, d41, d42, d19 | d37 | Sentences about allergies, refunds and drinks should be read by a native speaker in each language. |
| d39 Rd or Road | d40, d11, tests | The listing (d40) shows which spelling is "right". consistency and drive pin "Rd". The QR directions sign carries the address. |
| d04 phone | tests/consistency.test.mjs | The phone test accepts the day-of emergency number plus ONE main number, each written the same everywhere (text, tel: link, structured data). A typo or a second main number fails it. |
| d06, d28, d29 | tests/print-qr.test.mjs | The QR sign test needs at least 9 signs: 9 now (no review sign), 10 with a review link, 8 without the hashtag sign. |
| d31, d13, d32, d12, d33 | each other | Removing a photo removes it from d12 (do not ask for the original), d33 and d34. d13 and d32 name the same four photos. |
| d10, d11, d15 | each other | farmPoint (d11) halves the requests to the free service. A Mapbox switch (d10 C) changes the header line (d15) and 5 docs. |
| d46 booking page, d47 pre-order page | tests/consistency.test.mjs, QR signs, calendar files | One booking page and one pre-order page are pinned on every page (consistency at `one booking page, one pre-order page and one e-mail signup address`) and in the QR signs (consistency at `['reserve', /bookeo\.com/]`). A new address changes 29 and 6 places. |
| d48 haunted trail and tomatoes | d13, d32, d14, tests | A removal also removes the map mark, the tomato price-sign photo and the tests that look for "Haunted" in fall (farm-seasons at `haunted trail and the maze only in fall`) and the tomato prices (consistency at `price: tomatoes, per pound` and `price: basil, per stem`). |
| d50 tree dates, d51 hours | d01, d09, tests | Tree season words and hours are read from js/season.js and js/content.js by the facts test (consistency from `const MONTHS = '(january` to `winterEnd.month === 'December'`, and from `time: The GreenHouse open hours` to `CONTENT.hours.greenhouse.days`). |
| d52 Cathy's email | d55, d03, messages tests | The accessibility card and the waitlist/messages feature name this address. |
| d53 pre-order timing, d57 eat there | each other | They share the sentence index.html at `data-t="t60509a07"`. |
| d02, d36, d03 | each other | Groups prices, school tour rules and the sign-up form are all on the School tours and Groups tabs. |
| d60 closure | the top bar, the pizza note, Bookeo | A closure date (js/content.js, `closures`) closes the farm, The GreenHouse and Wise Pie together. The top bar and the pizza note (index.html at `data-t="t58da3033"`) are separate lines that must say the same. Bookeo is closed by hand. |
| d61 photo credits | d13, d31, d32, d33, d12, d34 | An answer that says a picture is not hers removes it, as those cards do. One list holds all 32 photos (js/content.js, `photos`). |
| d62 privacy note, d63 Mailchimp script | d10, d15, old Q26, old Q43 | The note and the fact sheet (docs/WHAT_THE_SITE_STORES.md) must say what the code does. Switching the Drive time box off (d10 option D) ends d62. Connecting the sign-up form (old Q26) makes d63 live and keeps Mailchimp's address in the header (d15). |
| d65 QR strength and address line | d38, d39, d06, d28, d29 | One tool (`tools/make_qr.py`) rebuilds every sign. A new web address (d38) or a review link (d06) needs a rebuild anyway, so make the change once. |
| d66 "new" wording | d48, d24 | If the tomatoes are removed (d48) it ends. The eight sentences go with the fall 2027 content (d24): do both in December. |
| d67 backgrounds, d73 yellow | each other | Both change colours in css/styles.css and need new visual-check baselines. |
| d68, d69, d70 the games | each other, d01 | All three change js/hero.js (d70 also css/extras.css). The game test is tests/games.test.mjs; the optional patch games-B-pick-snips-sunflowers.patch (d68 A) adds one part to it. |
| d71 tone of the translations | d37 | Same translation files: one native speaker can answer both. |
| d72 owner page | d60, d05 | Closed days and the notice are the first thing the form would write. The page is never uploaded: the deploy folder must leave it out. |
| d43 farm words, d44 corn pit offer, d45 free ages | each other, d07, d16, d02, d36, tests | The corn pit line in d43 must agree with the Thursday offer in d44. The maze line in d43 uses the name chosen in d07. The age at which children are free (d45) is written next to the $3 field fee (d16, "ages 3 and up"), the party guest count (d02), the school tour admission for family members (d36) and the wagon ride line; consistency pins every one of these age sentences (see the test table below). |
| d79 Thursday pizza, d80 GreenHouse pizza times | d16, d51, d08, d20, d44 | The Fall line (d79) and the package cards (d16) must agree on the days of pizza. The GreenHouse pizza times (d80) are the hours of d51 and of the "Open now" badge. |
| d74, d81, d82, d83, d85 new words | d37, d71 | New sentences in four languages: a native reader should read them (d37), in the tone chosen in d71. |

## Tests that can need an update

| Test and where | Pins | Touched by |
|---|---|---|
| consistency at `phone: at most ONE main number` | the day-of number plus at most one main number | d04 |
| consistency at `address: 4701 goes with Hartis` | streetAddress is "4701 Hartis Rd"; 4701 goes with Hartis, 5503 with Poplin | d39, d40 |
| consistency from `price: farm fun with pizza, base` to `price: wagon ride, per person` | base price $31, per-person prices, regex "Includes N Wise Pie pizzas, plus $N per person" (consistency at `price: extra per person in the pizza package` and `days: farm visits with pizza`) | d16 |
| consistency at `price: refund fee` | refund fee 3% (at least 3 places) | d41 |
| consistency from `time: The GreenHouse open hours` to `days: The GreenHouse and Wise Pie there` | GreenHouse hours and days (text and js/content.js) | d08, d09, d51 |
| consistency at `size: most guests` and `size: smallest school group` | Up to N guests (2 places), minimum N students (4 places) | d02, d36 |
| consistency from `pizza: size in inches` to `pizza: oven temperature` | pizza size, serves, ready time, pre-order days, oven degrees | d18, d20, d21, d53, d57 |
| consistency at `year of the fall prices` | the year of the fall prices (9 places) | d24 |
| consistency at `pets stay home, service animals are welcome` | pets stay home, service animals welcome (8 places) | d42 |
| consistency at `Mid-September through early November` | season words from js/season.js ("Mid-September through early November") | d23 |
| consistency at `const ALLOWED_EXTRA` | ALLOWED_EXTRA: Celsius 370 beside "700-degree" | d18, d37 |
| consistency at `farm year bars match the dates written beside them` | the year bars start and end where the words beside them say (early, mid or late + month; the April to July bar is read at `/^april.*`) | d23, d26, d50 |
| dated (whole file) | the 2026 pizza rows, special days, "No pizza" block until Nov 30, Nov 8/9, Dec 1 | d23, d24 |
| farm-seasons at `haunted trail and the maze only in fall` | /Maze/ in fall text only | d07 |
| print-qr at `there are signs, each with a QR code` | at least 9 signs | d06, d28, d29 |
| consistency at `printedCount >= 9 && bad.length === 0` | the QR signs check: at least 9 signs are printed in print/qr-signs.html | d06, d28, d29 |
| public-site | one address everywhere, sitemap, robots, clean-URL checks, extra pages | d05, d30, d38 |
| launch-check at `const SITE = '` and at `the farm spot is set with the numbers swapped` | the address the test treats as the live site; the farmPoint line it swaps the numbers of | d11, d38 |
| drive (whole file) | the two map services are mocked by host name; "Rd" in labels (drive at `The farm (4701 Hartis Rd)`, `farm answer names the farm`, `and pressing the button again answers for the farm` and `La granja (4701 Hartis Rd)`), and the farm spot: the test expects `farmPoint: null` (drive at `if (opts.extra) await page.route('**/js/content.js'`) | d10, d11, d39 |
| features at `auto: pumpkins, tomatoes, flowers in season` | flowers in season in the auto "This week" box | d26 |
| gallery | photo count (at least 5) and tags | d13, d31, d32 |
| consistency at `price: tomatoes, per pound` and `price: basil, per stem` | tomato price per pound and basil per stem (5 places each) | d48 |
| consistency at `pizza menu: the price range says the cheapest` | the pizza price range is the cheapest and dearest of the nine menu prices | d47 |
| consistency from `const MONTHS = '(january` to `if (/thanksgiving/.test(words))`, and `winterEnd.month === 'December'` | tree season words ("Friday after Thanksgiving to early December") against js/season.js | d50 |
| consistency at `one booking page, one pre-order page and one e-mail signup address` and `['reserve', /bookeo\.com/]` | one booking page, one pre-order page, one signup address; the three QR signs use them | d46, d47 |
| farm-seasons at `haunted trail and the maze only in fall` and `Christmas trees only in winter` | "Haunted" and /Maze/ only in fall; "Christmas" only in winter | d07, d48, d50 |
| features at `press: two Axios Charlotte links` | exactly two Axios links in the press list | d56 |
| messages at `the waitlist link is a mailto: to the farm` and `an address the owner typed with a + in it` | the waitlist mailto goes to cathy@wiseacresorganic.com | d52 |
| consistency at `age: free (infants, wagon ride, party children)` and `age: from this age people pay the field fee / school admission` | the age up to which children are free (every place must give the same number) and the age from which people pay the field fee, the pizza package extra and the school admission for family members | d45 |
| consistency at `days: farm visits without pizza (fall)` and tools/check_facts.py at `Ages 3 and up` | both read the words "Ages 3 and up" (and "Field fee, ages 3 and up") next to the farm days and the $3 price; reword those and these two checks need the new words | d45 |
| dated, live | closed badges on a closure date | d60 |
| drive at `those services may keep a record of the request` | the Drive time note sentence | d62 |
| print-qr (whole file) | QR codes: error correction level M or better, every code scans back, the signs and the six pages on paper | d64, d65 |
| hero at `fall: the "New tomatoes" chip shows` | the "New" tomato chip (it hides itself after 2026-12-31) | d66 |
| validity (whole file) | page style lines that browsers ignore (the two backgrounds of d67 must stay valid) | d67 |
| hero, touch, games (whole files) | the badges and the reach of the game, a badge on a 320 pixel screen, the winter messages | d68, d69, d70 |
| auto-dark (whole file) | every yellow part keeps dark text when Chromium's auto dark mode is on | d73 |
| i18n, languages | every id has 4 translations; plain checks of each language | any change of English text |

## Patches on disk

The optional patches are in the repository, in patches/optional/, each with a header (what it does, which question it answers, what it cannot be combined with, hosts, what to run after). docs/OPTION_PATCHES.md is the table with the apply order. `node tests/run-all.mjs option-patches` checks that every patch applies to the files as they are and that every set that makes sense applies together; `python3 tools/option_matrix.py` rebuilds and tests every combination for each host (README, section "Optional patches (open decisions)"). Nothing is applied until someone decides.

Every row names the file, the question, what it changes and whether it was tested. "Tested: yes" says what ran after the patch was applied. "The matrix" is tools/option_matrix.py: the patch in every combination its header allows, rebuilt twice with the same result, no missing translation, and the public-site, docs and consistency tests and the launch check on a pretend host.

| Patch (in patches/optional/) | For | What it changes | Tested |
|---|---|---|---|
| season-picker-off.patch | launch decision D6 | seasonPicker false. It also changes tests/lib.mjs so that every page a test opens has the season switcher on (the tests that look at or click it keep passing). | yes: with it applied (in the set of 11 patches, settings filled in) hero, games, dated, keyboard and calm pass; hero and games failed without the tests/lib.mjs change |
| winter-A-hide-fall-booking.patch | d01 A, d24 B | Hides the fall booking and prices out of season; one new sentence in 4 languages. | yes: the matrix, hero, features, the page clock on 11 dates |
| winter-B-fall-prices-note.patch | d01 B | Keeps the fall prices all year with the note "These are the fall 2026 prices and times"; one new sentence in 4 languages. | yes: the matrix, the page clock on 11 dates |
| reserve-window.patch | d25 A | Hides the spring Reserve buttons outside the booking window. | yes: the matrix, hero (80 checks), the page clock on 11 dates; with the rebuild, dated, deploy and messages see no page error on the extra pages |
| redirects-A-redirects-file.patch | d30 A (Cloudflare Pages, Netlify) | Adds _redirects (22 lines, all 301). | yes: the matrix, also with Cloudflare's own test server |
| redirects-B-redirect-pages.patch | d30 A (any host, the only one for GitHub Pages) | 13 small redirect pages, their two lines in the visitor's language (10 new texts in 4 languages); the deploy tool uploads them; the launch check follows them. | yes: the matrix, the 13 pages in 5 languages with and without JavaScript |
| clean-addresses-C-cloudflare.patch | d05 (Cloudflare Pages), d38 | Page addresses without .html; run python3 tools/pages.py after. The validity test accepts the sitemap addresses without .html. | yes: the matrix, also with Cloudflare's own test server; validity passes with it |
| code-cache-D-5-minutes.patch | d05 (any host that reads _headers) | css, js and lang cached 5 minutes instead of 1 hour. | yes: the matrix (no effect on GitHub Pages) |
| phone-number-shown.patch | d04 A | The main phone number in the footer and the Google data; the consistency test allows the two known numbers; tools/test_check_facts.py leaves the footer alone when the number is there. | yes: the matrix; pipeline passes with it |
| qr-one-address-line.patch | d65 C (d65 D with the next row) | The directions sign prints the address once, not twice. tools/make_qr.py leaves out a Spanish line that equals the English; the consistency test accepts that; the one changed line of print/qr-signs.html is in the patch. | yes: consistency and print-qr pass with it; running python3 tools/make_qr.py afterwards changes nothing |
| qr-stronger-codes.patch | d65 B (d65 D with the row above) | Codes at error correction Q (about 25 percent damage still scans, not about 15); each square prints 10 to 15 percent smaller. The 8 changed pictures in assets/qr/ and the five sign pages in print/ are in the patch. | yes: print-qr (every code scans back, every square above the minimum size) and consistency pass with it; running python3 tools/make_qr.py afterwards changes nothing |
| games-B-pick-snips-sunflowers.patch | d68 A | In summer every fourth press of the "Pick a blueberry" button snips a sunflower; sunflowers grow back in 3 to 5 seconds. One part is added to tests/games.test.mjs. | yes: games (with its new part), hero, touch, calm, keyboard and privacy pass with it |
| map-without-traced-land.patch | d86 option 2 | Removes the roads, neighbours' houses, lawns and dirt lanes drawn from the aerial picture (Google's) from the farm map; every mark the farm made, the legend, names and drive-time chips stay. Also the farm_map.py note, the README map paragraph and CREDITS row L8. No new text. | option-patches: applies to the files as they are, alone and in every set that makes sense (checked at the join; the map drawing itself was not looked at again there) |
| faster-below-the-fold.patch | d88 | The 15 big home page sections below the first screen are drawn only when they come near the screen (about a third less work on an old phone before the page is ready). Only on a first visit by a link or the address bar: a reload, Back and a link with # in it are worked out in full, as today; print draws everything. It edits css/extras.css, js/guard.js and adds the class cv-sec to 15 sections in index.html. Letters and rounded edges inside those sections can sit up to one pixel differently, and scrolling back up after a menu link can make the page jump a little (shift score 0.16 to 0.18, today 0). | yes: option-patches (alone and in every set); with it applied layout-sweep, visual-check, keyboard, no-js, print-qr, axe, link-names, hero, features, touch, gallery, languages, i18n-a11y, big-font, forced-colors, pause, calm, games and sitecheck pass; 34 of 34 menu links land within 2 px of today; scrolling down the whole page shifts nothing (0.000) |
| privacy-page.patch | d89 option 1 | A privacy page for visitors in plain words (privacy.html, five languages): what is kept in the browser, which other sites are contacted and only after a button, who to ask. Every sentence has its proof in docs/PRIVACY_PAGE_EVIDENCE.md. 68 new texts per language in 4 translations (a native reader is needed). Run the rebuild line after. Not legal advice. |

The old address table (where each old address goes) is in docs/OPTION_PATCHES.md.

Choices with no patch file (docs/OPTION_PATCHES.md, "Choices that have no patch, and old copies", says why):

| Choice | For | What to do | Tested |
|---|---|---|---|
| d37 clock words (the old es-OPTIONAL-clock-12h.patch and vi-OPTIONAL-clock-words.patch) | d37 A | Nothing to apply: the code already writes Spanish times as "5:00 p. m." and Vietnamese times as "5 giờ chiều" (js/features.js at `const fmtClock = (date, tz) => {`, js/live.js at `function timeLabel(mins)`, js/i18n.js at `W.clock = (h, m, code) => {`). | yes: checked in a browser on 3 October 2026 (es, vi, hi, zh) |
| Stop saying "new this year" from January 1 | d66 A | By hand when she answers: the places are listed in d66 A below. A patch would change about 40 notes that name those ids. | no (no patch) |
| The 2026 fall prices in 2027 | d24 | winter-A-hide-fall-booking.patch covers the months when the page is not in its fall look; from August 12, 2027 only the 2027 details (d24 A) help. | no (no patch) |

Not in the repository and not to be applied (replaced): the old winter patches for b54427b, winter-A.patch and winter-C.patch (the tree wording is already in-season-only in the code, commit e081393), and 2-OPTIONAL-cloudflare-no-html-addresses.patch (clean-addresses-C does the same and more). The patches zh-C, es-C, vi-C and hi-C (translation decisions) and the photo, share-image and checklist patches are already merged.

## Dashboard ids and doc question numbers

The doc is docs/QUESTIONS_FOR_THE_FARM.md (and .es.md, same 68 numbers). Each question there now has a "Dashboard id" line under the question.
Rule used to close the gap between the two lists: a doc question becomes a dashboard question only if it is an owner decision or a fact only she has, and nothing in the repo or on the live pages answers it already. Otherwise it is dropped (with the reason) or put on a later list. The public sites of the farm could not be opened from the test computer.

### Every doc question, and where it went

| Doc | Dashboard | What happened |
|---|---|---|
| Q1 | d02 | asked |
| Q2 | d03 | asked |
| Q3 | d04 | asked |
| Q4 | d08 | asked |
| Q5 | d48 | asked |
| Q6 | d48 | asked |
| Q7 | d48, d32 (the tomato price-sign photo) | asked |
| Q8 | none | dropped: The site already says "more than a dozen tomato varieties" (README row "Tomatoes & basil"). A safe default; ask only if she wants a number. |
| Q9 | none | later (ask with d48): The sentence is part of the tomato text she asked for (index.html at `data-t="t1cb33277"`). Ask only if the farm manager objects. |
| Q10 | none | dropped: The scavenger hunt was taken off the site on 1 October (commit 2b09373). If she wants it back, the doc notes say where it was. |
| Q11 | d07 | asked |
| Q12 | d50, d01 | asked |
| Q13 | none | dropped: The site says "mid- to late June through early July", her own old page says "June - early July" and js/season.js uses June 15 to July 10. Same meaning. |
| Q14 | d59 | asked |
| Q15 | d58 | asked |
| Q16 | none | later (ask with d14): A task in the Farm Map Marker, not a choice. Until then the wagon route bends along the edge of the map. |
| Q17 | d51, d09 | asked |
| Q18 | none | dropped: The nine pizzas and their prices were copied from her printed menu and match it in all five languages (README row "Wise Pie facts", checked 3 October). Only the Square page can differ: that is d47. |
| Q19 | d54, d19 | asked |
| Q20 | none | dropped: It is the farm's own FAQ wording, added from her pasted content on 30 September (commit ccd629c, "the full FAQ"; index.html at `data-t="t2a615e98"`). She published that claim herself. |
| Q21 | none | dropped: The waitlist button only shows when she marks a day "full" in js/content.js, and the "Spots left" box is hidden until the week is filled in. The README already says not to use "full" unless someone answers. Ask when she starts the weekly box. |
| Q22 | d46 | asked |
| Q23 | d47 | asked |
| Q24 | d28 | asked |
| Q25 | none | later (ask with d29): The hashtag lines are index.html at `data-t="t559ec077"` (2 places) and `data-t="t18683452"`. Ask with the hashtag sign. |
| Q26 | none | later: The plain "Join the email list" button works today. The form needs her Mailchimp account. The checklist says it can follow launch. Its safety question (Mailchimp's script) is Q58, d63. |
| Q27 | d06 | asked |
| Q28 | d56 | asked |
| Q29 | d55 | asked |
| Q30 | d52 | asked |
| Q31 | d55 | asked |
| Q32 | none | later (ask with d10, d11): The page already says "Rough times with light traffic" and the Drive time box shows the real time from the visitor's address. |
| Q33 | none | later: The quote cards stay hidden until she sends real quotes. The Google, Tripadvisor and Yelp buttons are there. |
| Q34 | none | later (ask with d35): Same page and same place as d35: suggest adding "a photo of the gate" to its answer. |
| Q35 | d11 | asked |
| Q36 | d10 | asked |
| Q37 | d01, d09 | asked |
| Q38 | d12 | asked |
| Q39 | d31, d33 | asked |
| Q40 | d13, d32 | asked |
| Q41 | none | later: Depends on the sign-up form (old Q26). Ask after it. |
| Q42 | d35 | asked |
| Q43 | none | later (ask with d10): Part of d10. The page already shows a notice about the address and docs/WHAT_THE_SITE_STORES.md lists what is sent. The wording of the notice is asked in Q57, d62. |
| Q44 | d16 | asked |
| Q45 | d17 | asked |
| Q46 | d49, d17 | asked |
| Q47 | d18 | asked |
| Q48 | d47 | asked |
| Q49 | d53 | asked |
| Q50 | d20 | asked |
| Q51 | d21 | asked |
| Q52 | d22 | asked |
| Q53 | d19 | asked |
| Q54 | d57 | asked |
| Q55 | d60 | asked |
| Q56 | d61 | asked |
| Q57 | d62 | asked |
| Q58 | d63 | asked |
| Q59 | d64 | asked |
| Q60 | d65 | asked |
| Q61 | d66 | asked |
| Q62 | d67 | asked |
| Q63 | d68 | asked |
| Q64 | d69 | asked |
| Q65 | d70 | asked |
| Q66 | d71 | asked |
| Q67 | d72 | asked |
| Q68 | d73 | asked |

Doc questions that are on the dashboard in more than one card: Q37 (d01, d09, d50), Q39 (d31, d33, d13), Q40 (d13, d32). Merged into one card: Q5, Q6 and Q7 (d48); Q23 and Q48 (d47); Q29 and Q31 (d55).

### Every dashboard question, and its doc number

| Dashboard | Title | Doc |
|---|---|---|
| d01 | What visitors see in winter | Q37 (also Q12) |
| d02 | Prices for company events | Q1 |
| d03 | School tour form link | Q2 |
| d04 | Main phone number | Q3 |
| d05 | Where to put the website online | none |
| d06 | Google review link | Q27 |
| d07 | Name of the maze | Q11 |
| d08 | Thai night | Q4 |
| d09 | The GreenHouse winter hours | Q37 (also Q17) |
| d10 | Free driving-directions service behind the Drive time box | Q36 (also Q43) |
| d11 | The farm's exact spot on the map | Q35 |
| d12 | Photo originals | Q38 |
| d13 | Photos with words or people | Q40 (also Q39) |
| d14 | Try the Farm Map Marker swipe on a real phone | none |
| d15 | Browser safety rule for the new host | none |
| d16 | The $31 pizza package | Q44 |
| d17 | Allergen note on the pizza page | Q45 (also Q46) |
| d18 | Oven temperature on the site | Q47 |
| d19 | Drinks and ice cream at The GreenHouse | Q53 (also Q19) |
| d20 | Pizza ready time | Q50 |
| d21 | Pizza size | Q51 |
| d22 | Mozzarella wording | Q52 |
| d23 | Is the farm open after November 8? | none |
| d24 | Fall 2027 prices, schedule and menu | none |
| d25 | Reserve buttons when nothing can be booked | none |
| d26 | When are cut flowers available? | none |
| d27 | School tours banner | none |
| d28 | Which Facebook page is the real one | Q24 |
| d29 | Instagram hashtag sign | related: Q25 |
| d30 | Keep the old farm web addresses working | none |
| d31 | People's faces in three photos | Q39 |
| d32 | Photos that have dated words on them | Q40 (also Q7/7) |
| d33 | What animal is wearing the frog hat | Q39 |
| d34 | Sunflower photos in the Fall section | none |
| d35 | Parking and entrance | Q42 (also Q34) |
| d36 | School tours for smaller classes | none |
| d37 | Native speakers for the translations | none |
| d38 | Which web address will the site live on | none |
| d39 | How your address is written | none |
| d40 | Does The GreenHouse have its own Google listing | none |
| d41 | Cancel fee on the strawberry page | none |
| d42 | Service animals | none |
| d43 | What do your farm words mean | none |
| d44 | Corn pit: buy one get one free on Thursdays | none |
| d45 | Who is free: ages 2 and under | none |
| d46 | Is this the right booking page? | Q22 |
| d47 | Is the pizza pre-order page right? | Q23, Q48 |
| d48 | Haunted trail and u-pick tomatoes this fall | Q5, Q6, Q7 |
| d49 | Does The Dill Pickle pizza have cheese? | Q46 |
| d50 | Christmas tree dates at The GreenHouse | Q12 (also Q37) |
| d51 | Are the fall opening hours right? | Q17 |
| d52 | Does Cathy's email get answered? | Q30 |
| d53 | When and where is the pre-order link posted? | Q49 |
| d54 | Prices for pumpkins, berries, flowers and trees | Q19 |
| d55 | Strollers, wheelchairs and farm paths | Q29, Q31 |
| d56 | Two Axios news links | Q28 |
| d57 | Can people sit and eat at The GreenHouse? | Q54 |
| d58 | Snacks and drinks in spring and summer? | Q15 |
| d59 | Do you still run summer programs? | Q14 |
| d60 | Closed Sunday, October 4 for rain? | Q55 |
| d61 | Who owns the photos on the site? | Q56 |
| d62 | Is the Drive time privacy note enough? | Q57 |
| d63 | Email sign-up form: is Mailchimp's script OK? | Q58 |
| d64 | What should the printed home page include? | Q59 |
| d65 | QR signs: stronger codes, one address line | Q60 |
| d66 | Stop saying "new this year" from January? | Q61 |
| d67 | Keep two backgrounds that never showed? | Q62 |
| d68 | Sunflower badge only works on big screens | Q63 |
| d69 | "Every tree is lit!" appears too early | Q64 |
| d70 | Badge pop-up covers a note on small phones | Q65 |
| d71 | Friendly or formal in the translations? | Q66 |
| d72 | Do you want a form to change settings? | Q67 |
| d73 | Make the brand yellow a little paler? | Q68 |
| d74 | Say that all farm times are Eastern Time? | none |
| d75 | Keep the double-click file that starts the site on your computer? | none |
| d76 | Force one kind of line ending in the project files? | none |
| d77 | Switch on automatic checks on GitHub? | none |
| d78 | Show photos on very old Macs too? | none |
| d79 | Is pizza sold with a Thursday visit? | none |
| d80 | Is Wise Pie pizza at The GreenHouse only 4 to 8 pm? | none |
| d81 | Add skip links over the photo gallery and the map? | none |
| d82 | Should the page not found page speak all five languages? | none |
| d83 | Hindi month names: Hindi words or Jan, Feb, Mar? | none |
| d84 | Make the red See the farm in label a little darker? | none |
| d85 | Group sizes: is 100 guests in 51 to 100 or in 100 plus? | none |
| d86 | Where did the map outline of the land come from? | none |
| d87 | Who drew the Wise Acres logo and the farm drawings, and does the farm own them? | none |

### Dashboard questions with no number in the doc

| Question | Title |
|---|---|
| d05 | Where to put the website online |
| d14 | Try the Farm Map Marker swipe on a real phone |
| d15 | Browser safety rule for the new host |
| d23 | Is the farm open after November 8? |
| d24 | Fall 2027 prices, schedule and menu |
| d25 | Reserve buttons when nothing can be booked |
| d26 | When are cut flowers available? |
| d27 | School tours banner |
| d29 | Instagram hashtag sign |
| d30 | Keep the old farm web addresses working |
| d34 | Sunflower photos in the Fall section |
| d36 | School tours for smaller classes |
| d37 | Native speakers for the translations |
| d38 | Which web address will the site live on |
| d39 | How your address is written |
| d40 | Does The GreenHouse have its own Google listing |
| d41 | Cancel fee on the strawberry page |
| d42 | Service animals |
| d43 | What do your farm words mean |
| d44 | Corn pit: buy one get one free on Thursdays |
| d45 | Who is free: ages 2 and under |
| d74 | Say that all farm times are Eastern Time? |
| d75 | Keep the double-click file that starts the site on your computer? |
| d76 | Force one kind of line ending in the project files? |
| d77 | Switch on automatic checks on GitHub? |
| d78 | Show photos on very old Macs too? |
| d79 | Is pizza sold with a Thursday visit? |
| d80 | Is Wise Pie pizza at The GreenHouse only 4 to 8 pm? |
| d81 | Add skip links over the photo gallery and the map? |
| d82 | Should the page not found page speak all five languages? |
| d83 | Hindi month names: Hindi words or Jan, Feb, Mar? |
| d84 | Make the red See the farm in label a little darker? |
| d85 | Group sizes: is 100 guests in 51 to 100 or in 100 plus? |
| d86 | Where did the map outline of the land come from? |
| d87 | Who drew the Wise Acres logo and the farm drawings, and does the farm own them? |

Only a note exists for d37 (the doc has a "Translation notes" section, but no question). d29 is the printed sign for the hashtag asked in Q25. d43 to d45 (farm words, the corn pit offer, free entry for ages 2 and under) were added to the dashboard after the doc was written: they have no doc number and no "Dashboard id" line there, and their entries are in Topic 6.

## Topic 1. Put the site online

Urgency: blocks launch.
Nothing can go live until the host and the web address are chosen. The files already assume Cloudflare Pages and https://www.wiseacresorganic.com/.

### d05. Where to put the website online

- In plain words: Which company keeps the site files and serves them to visitors.
- Doc question: none (not in the doc; launch checklist section 1, steps 3.1 to 3.7, D1 and D10)
- Urgency: 1 (blocks launch). Checklist says: launch decisions D1, D10.
- Owner fact (no sensible default): no
- Default: A. Free, static traffic unlimited, headers and redirects tested on its own test server (checklist section 1).
- Depends on: d30 (which redirect patch), d15 (headers need a host that sets them), d38 (domain and DNS), page-address style (clean-addresses-C only on Cloudflare), cache time (code-cache-D).

**A. Cloudflare Pages**

- No site file changes to host it: upload the folder without docs/, tests/, tools/, pages/, README.md (checklist section 2).
- Clean page addresses (no .html): apply patches/optional/clean-addresses-C-cloudflare.patch (tools/pages.py PAGE_EXT = '', 5 generated pages, sitemap.xml, tests/public-site.test.mjs, README and checklist wording). Do this before submitting the sitemap (checklist 3.7).
- Old addresses: d30 option A with patches/optional/redirects-A-redirects-file.patch (a _redirects file).
- _headers already works there (4 security notes and the cache rules). Content-Security-Policy: see d15.
- Optional, any host: patches/optional/code-cache-D-5-minutes.patch (css/js/lang cached 5 minutes instead of 1 hour: _headers, js/content.js text, README, checklist).
- Strings: 0
- Tests: public-site (after clean-addresses-C)
- Patch: patches/optional/clean-addresses-C-cloudflare.patch

**B. Netlify**

- No site file changes to host it. Keep page addresses with .html (the current state): do NOT apply clean-addresses-C. Leave Netlify "Pretty URLs" off.
- Old addresses: d30 option A with patches/optional/redirects-A-redirects-file.patch (Netlify reads _redirects).
- _headers works if it is in the published folder. Content-Security-Policy: see d15.
- Free plan stops the site when its monthly credits run out (checklist section 1: roughly 5,000 first visits a month, an estimate from unopened pages).
- Strings: 0
- Tests: none

**C. Another host**

- Ask the host two things: does it read a _headers file, and does it read a _redirects file?
- Reads both: same as Cloudflare or Netlify (above).
- Reads no _headers: copy the four notes and the cache rules of _headers into the host settings; no Content-Security-Policy possible if it cannot set headers (d15 then = skip).
- Reads no _redirects (GitHub Pages is one): old addresses (d30 option A) use patches/optional/redirects-B-redirect-pages.patch (13 small redirect pages: about/, contact/, faq/ ...). GitHub Pages also has a business-use rule (checklist section 1, last row).
- Keep .html page addresses unless the host redirects them like Cloudflare does.
- Strings: 0
- Tests: public-site (redirects-B adds plain pages)
- Patch: patches/optional/redirects-B-redirect-pages.patch

### d30. Keep the old farm web addresses working

- In plain words: Google lists old pages such as /wiseacres, /faq, /food. After launch they would show "page not found".
- Doc question: none (launch checklist 3.6 and D3; the doc has no question for it)
- Urgency: 1 (blocks launch). Checklist says: launch decision D3 (3.6).
- Owner fact (no sensible default): no
- Default: A, only if the new site takes over the address of the current wiseacresorganic.com; use redirects-A on Cloudflare or Netlify.
- Depends on: d05 decides which patch (redirects-A or redirects-B). d38: if the site lives on another address, redirects on the old one are done at the old host, not in these files.

**A. Yes, send old addresses to the new pages**

- Cloudflare Pages or Netlify: apply patches/optional/redirects-A-redirects-file.patch. It adds _redirects (22 lines, all 301) and notes in README and the checklist.
- Host with no _redirects (GitHub Pages): apply patches/optional/redirects-B-redirect-pages.patch instead (13 folders with a small redirect page).
- Where each old address goes: docs/OPTION_PATCHES.md, section "Old addresses and where they go". /summer/ and /posts/ are left out on purpose (checklist D3: the owner decides what happens to them; today they show 404.html).
- Test after upload: open all 13 old addresses (checklist section 5).
- Strings: 0 with redirects-A; 10 with redirects-B (the line "This page has moved." and 9 "Go to ..." link lines, translated into es, hi, zh and vi inside the patch; a native reader should check them: docs/OPTION_PATCHES.md)
- Tests: public-site (redirects-B only: it scans the extra pages), moved-pages (redirects-B: the 13 pages in 5 languages, with and without JavaScript)
- Patch: patches/optional/redirects-A-redirects-file.patch

**B. No, start fresh**

- No change. Old addresses show 404.html (the friendly page) and Google drops them over time.
- Strings: 0
- Tests: none

### d38. Which web address will the site live on

- In plain words: The address that goes into Google, share previews and the printed QR signs.
- Doc question: none (launch checklist D2, README "Putting it online" item 2)
- Urgency: 1 (blocks launch). Checklist says: launch decision D2.
- Owner fact (no sensible default): yes
- Default: A. Everything is written for it, and the www name is what Cloudflare and Netlify recommend.
- Depends on: d05 (DNS and host), d30 (redirects only make sense if the new site takes over the OLD address), d15 (Content-Security-Policy does not name the site), d10 option C (a Mapbox token is limited to this address), share cards and QR signs carry it.

**A. Use www.wiseacresorganic.com**

- No change. Every file already uses https://www.wiseacresorganic.com/.
- Outside the files: DNS record for www (checklist 3.3), Search Console property, Business Profile website field (3.10, 3.12).
- Strings: 0
- Tests: public-site already checks that one address is used everywhere

**B. Use a different address**

- tools/pages.py at `SITE = '`: SITE = 'https://NEW/' (ends with a slash), then rebuild (writes the 5 pages, sitemap.xml, robots.txt).
- index.html: the home page tags (index.html at `<link rel="canonical"`, `<meta property="og:url"`, `<meta property="og:image"` and `<meta name="twitter:image"`) and the structured data (index.html at `"@id": "https://`, `"url": "https://` and `"image": "https://`). Search and replace the old address.
- tools/qr_links.json at `"site":`, then python3 tools/make_qr.py (rewrites print/qr-signs.html and assets/qr/*.svg; reprint the signs).
- README "Putting it online" item 2 and docs/LAUNCH_CHECKLIST.md mention the old address; js/analytics.js at `site: 'wiseacresorganic.com'` is only an example comment (change it only if analytics is switched on).
- Share pictures: after launch a new address means new link previews; a changed picture needs a new file name (checklist 3.11).
- Outside the files: DNS, Search Console, Business Profile, Facebook and Instagram profile links.
- Strings: 0
- Tests: public-site (reads SITE, canonical tags, sitemap, robots.txt, QR file); python3 tools/test_pages.py has 3 fixture lines with the old address (tools/test_pages.py at `https://www.wiseacresorganic.com/assets/og-` (3 places)); launch-check: tests/launch-check.test.mjs at `const SITE = '` is the address the test treats as the live site, put the new one there (or "same folder treated as the live site" fails)

### d15. Browser safety rule for the new host

- In plain words: A safety rule that tells browsers where scripts may load from. Written, tested only on a test computer, not switched on.
- Doc question: none (launch checklist 3.5 and section 6)
- Urgency: 3 (nice to have). Checklist says: launch step 3.5.
- Owner fact (no sensible default): no
- Default: A, a few weeks after launch, in Report-Only first (checklist 3.5).
- Depends on: d05 (needs a host that sets headers: not GitHub Pages), d10 (if the Drive time services change, connect-src changes: Mapbox = https://api.mapbox.com), d38 (none: the policy names no site). Analytics or a Mailchimp form change the line.

**A. Turn on after the launch test**

- _headers: under the line "  Permissions-Policy: camera=(), microphone=(), geolocation=()" add the one line given in docs/LAUNCH_CHECKLIST.md 3.5 (374 characters). First as Content-Security-Policy-Report-Only for a trial, then delete "-Report-Only" and upload again.
- Trial: open the 6 pages with F12 console open; any "[Report Only] Refused to ..." goes to Claude. Press Print on /print/qr-signs once.
- Switch on only after the answers that change the policy are final: analytics (not on the dashboard; off by default), Mailchimp form, the Drive time services (d10).
- Strings: 0
- Tests: none (a header test is not in tests/; public-site only checks the files exist)

**B. Skip it**

- No change. The other four security notes stay on. Checklist 3.5 says skipping this at launch is fine.
- Strings: 0
- Tests: none

### d63. Email sign-up form: is Mailchimp's script OK?

- In plain words: If the email sign-up form is connected, Mailchimp's reply is a small script that the page runs. That makes Mailchimp the only outside address allowed to run code in the page, and only after a visitor presses the button.
- Doc question: Q58
- Urgency: 3 (nice to have). Checklist says: can follow launch (old Q26, the Mailchimp form).
- Owner fact (no sensible default): no
- Default: none.
- Depends on: old Q26 (does she want the form at all; it is not on the dashboard), d15 (the ready security header lists Mailchimp's address for scripts), d05.
- Note: The form is not connected today: the setting in js/content.js at `signup: { action:` (2 places: the instructions, then the setting) is still empty, so visitors see the plain "Join the email list" link to Mailchimp's own page. The fact sheet says "the only outside address that can run code in the page" (docs/WHAT_THE_SITE_STORES.md, section "3. What each optional feature adds"). Old Q26 is the "do you want the form" question; this one is the safety question that goes with it.

**A. Yes, connect the form when I send the code**

- The steps of old Q26 "If Yes": the form address in `signup.action` (js/content.js at `signup: { action:` (2 places: the instructions, then the setting)) and the interest names from the embed code (README, section "Planning features" has the part on the email signup; README row "Email signup"). Then sign up once with a real email address. Mailchimp's address is already in the ready security header (docs/LAUNCH_CHECKLIST.md, section "The Content-Security-Policy").
- Strings: 0
- Tests: features MUST be updated: the first case of its sign-up part (tests/features.test.mjs at `signup: not set up -> form hidden, old button shows`) opens the page as it is served and expects the form hidden, so with the address filled in it fails. Give the `open(` line just above it the extra `extra: "WISE_ACRES.signup.action = '';"`, and do the same for the demo case below it (tests/features.test.mjs at `WISE_ACRES.signup.demo = true;`): write `WISE_ACRES.signup.action = ''; ` in front of it, or the demo form really tries to send and says "did not go through". messages and privacy set the sign-up themselves and need no change.

**B. No, keep the plain "Join the email list" button**

- No change: leave `signup.action` empty. The plain button (index.html at `eepurl.com/hZehgr` (7 places)) stays. If the form is never wanted, ask Claude whether Mailchimp's address can then be left out of the script part of the ready header.
- Strings: 0
- Tests: none

**C. I will ask someone I trust first**

- No change until she answers.
- Strings: 0
- Tests: none

### d72. Do you want a form to change settings?

- In plain words: To close for rain or change an hour she edits text files by hand. A written proposal describes a form on her computer that writes the settings, and a facts table so a price is typed once. Nothing is built.
- Doc question: Q67
- Urgency: 3 (nice to have). Checklist says: launch decision D9 (who updates the site; docs/LAUNCH_CHECKLIST.md, section "4. Before you go live").
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d60 (closing days is the first thing the form would write), d05 (the form is never uploaded: the deploy folder must leave it out).
- Note: The proposal is the page PROPOSAL_owner_page in the docs folder (it is not in this repository yet; the helpers wrote it on 3 October 2026). Costs from it: the form 2 to 3 days (one day for the notice and closed days alone); the facts table about 3 days, touching about 100 sentences in five languages; the form must use the same rules as the "Site check" box and writes only js/content.js between two marker lines. Its four decisions: which settings first, whether a Chrome or Edge only "Save" is acceptable (other browsers get a download), whether to build the facts table and for which facts, and who tries each part.

**A. Yes, start small: the notice and closed days**

- Ask Claude: Part 1 of the proposal, smallest version (about one day): a page called owner.html in the site folder, never uploaded, that writes `notice`, `noticeUntil` and `closures` in js/content.js between two marker lines it adds once, with the same rules as the "Site check" box (the box is built in js/features.js; the rules would move to one shared file). It keeps content.js.bak and shows old and new lines before saving.
- Strings: 0 for visitors (a visitor never sees the page)
- Tests: a new test that fills every box with good and bad values; sitecheck; deploy (the deploy folder must leave the page out)

**B. Yes, the form and the facts table**

- Parts 1 and 2 of the proposal. Part 2: one facts file holds each fact once (fees, the $31 package, hours, phone, e-mails); sentences carry a placeholder such as {price_person} that tools/pages.py fills in. The sentence ids change, so the translations are re-keyed by a script, and a check proves the built pages are word for word what they are today before anything else changes.
- Strings: about 100 sentences x 5 languages are touched (ids change, wording does not)
- Tests: consistency (it reads every page in five languages), i18n, languages, pipeline, public-site, deploy

**C. No, leave it as it is now**

- No change. Hand editing stays; the "Site check" box keeps naming mistakes.
- Strings: 0
- Tests: none

## Topic 2. Wrong links and placeholder content

Urgency: blocks launch.
A visitor can hit these on day one: a form that asks for a sign-in, made-up prices, a missing phone number, a review button that only opens a map.

### d02. Prices for company events

- In plain words: The $750 and $1,400 on the Groups page are placeholders. The tab carries a "Draft pricing" tag.
- Doc question: Q1
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. The real prices are an owner fact. If they cannot come before launch, B (Custom quote) removes the made-up numbers.
- Depends on: none

**A. Send me the real prices**

- Type the real prices over the two tier-price spans: index.html at `$750</span>` (up to 50 guests) and `$1,400</span>` (51-100 guests). They carry no translation id, so no strings change.
- Delete the draft comment (index.html at `<!-- DRAFT CONTENT:`), the tag line "Draft pricing - confirm before publishing" (index.html at `data-t="t10886e34"`) and class price-card-draft on the price card (index.html at `class="price-card price-card-draft"`).
- If the 3-hour block or guest counts change: tier-guests (index.html at `data-t="tad11b443"`, `data-t="tf2832845"` and `data-t="te184c66a"`), price-note (index.html at `data-t="t4048b101"`).
- README: delete the row "Corporate events prices".
- Strings: 0 for prices; 1 per sentence if the 3-hour rule or guest counts change
- Tests: consistency (fact "Up to N guests" needs 2 places; keep the wording)

**B. Say Custom quote instead**

- Replace the two prices with "Custom quote" (the words already exist, id t1a9346f9, so no new translation). Delete the tag line (index.html at `data-t="t10886e34"`), the draft comment, the price-note sentence (index.html at `data-t="t4048b101"`) and class price-card-draft.
- Guest-count lines can stay or go (index.html at `data-t="tad11b443"`, `data-t="tf2832845"` and `data-t="te184c66a"`).
- README: delete the row "Corporate events prices".
- Strings: 0 new (orphan ids t4048b101, t10886e34 can be cleaned: python3 tools/i18n.py orphans)
- Tests: consistency: fact "size: most guests at a private party and at the first corporate package" needs min 2 places; if "Up to 50 guests" goes, lower min to 1 in tests/consistency.test.mjs at `size: most guests`

**C. Remove the Corporate events tab**

- Delete the tab button (index.html at `id="gtab-corporate"`), the panel with its comment (index.html from `<!-- Corporate events -->` to the end of the div with id="corporate"), and the sentence "Planning a company event? See corporate events." in the Parties side note (index.html at `data-t="t4a984489"`; the id changes).
- pages/school-field-trips.html at `<h3>Parties &amp; corporate events</h3>`: the fact card "Parties & corporate events ... a team day or a picnic?" loses the word corporate (id changes), then rebuild.
- README: delete the row "Corporate events prices". Old translations of the removed block become unused (orphans).
- Strings: about 2 changed sentences x 4 translations (about 18 ids become unused)
- Tests: consistency (lower min of "Up to N guests" to 1: consistency at `size: most guests`); hero/farm-seasons not affected

### d03. School tour form link

- In plain words: The sign-up link ends in /edit, the form editor. Teachers may be asked to sign in.
- Doc question: Q2
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A. Try /viewform in a private window first; it needs no owner.
- Depends on: none

**A. Send me the form's viewform link**

- Replace the address ending /edit with the /viewform one (Google Forms: Send, link icon) in 4 places: index.html at `data-t="t8297603b"` and pages/school-field-trips.html at `docs.google.com/forms` (3 places). Then rebuild (the generated school-field-trips.html follows).
- Quick self-test first: the same form id with /viewform instead of /edit, opened in a private window. If it opens with no sign-in, use it.
- Check afterwards in a private window (checklist section 5). Delete the README row "School tour form link".
- Strings: 0 (an address, not words)
- Tests: none

**B. Use a different way to book**

- Another way to book (for example an email to vanessa@wiseacresorganic.com, already used in index.html at `data-t="t3bad8e6f"`): change the button href at the same 4 places and the labels "School tour sign-up form" (index.html at `data-t="t8297603b"`), "Sign up for a tour" and "Fill out the sign-up form" (pages/school-field-trips.html at `docs.google.com/forms` (3 places), the 3 buttons).
- css/extras.css at `.btn[href^="https://docs.google.com/forms"]` (3 places) prints the link under Google Forms buttons; harmless when the link is not a form.
- Strings: about 3 changed labels x 4 translations
- Tests: none

**C. Leave it**

- No change. Visitors may be asked to sign in or request access.
- Strings: 0
- Tests: none

### d46. Is this the right booking page?

- In plain words: Every Reserve button opens one Bookeo page, and we could not open it. If it is the wrong page, or does not cover visits with and without pizza, visitors cannot book.
- Doc question: Q22
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only she can see what the Bookeo page books. The address came with the farm's own wording (commit ccd629c, "real booking, pizza pre-order and email-signup links").
- Depends on: d47 (the same check for the pizza page), d02 (parties and company events are booked by email, not here), d25 (Reserve buttons in the gaps between seasons).
- Note: Old Q22.

**A. Yes, it is the right page**

- No change. The same address sits behind every Reserve button, the Reserve QR sign and the calendar files.
- After launch press each Reserve button once (docs/LAUNCH_CHECKLIST.md section 5).
- Strings: 0
- Tests: none

**B. It is the wrong page (I will send the right one)**

- Replace https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356 in all 29 places (7 source files): index.html at `bookeo.com/wiseacres` (19 places); pages/first-visit.html at `bookeo.com/wiseacres` (3 places); pages/pumpkin-patch.html at `bookeo.com/wiseacres` (2 places); pages/strawberry-picking.html at `bookeo.com/wiseacres` (2 places); pages/wise-pie.html at `bookeo.com/wiseacres`; js/features.js at `const BOOK` (BOOK, used by the calendar files and the messages); tools/qr_links.json at `bookeo.com/wiseacres`.
- Then python3 tools/pages.py (the 5 generated pages follow) and python3 tools/make_qr.py (print/qr-signs.html, assets/qr/reserve.svg; reprint the Reserve sign). README.md also names the address.
- Strings: 0 (an address, not words)
- Tests: consistency passes if every place is replaced (tests/consistency.test.mjs at `one booking page, one pre-order page` (one booking page) and `['reserve', /bookeo\.com/]` (the Reserve sign)). features at `ICS description unfolds to the booking link` and `open day offers Reserve (Bookeo)` and messages at `the description keeps the booking address whole` and `its text keeps the booking address` look for "bookeo.com/wiseacres?category=4...": change them if the new address is not on bookeo.com/wiseacres

**C. Pizza visits or parties need a different page**

- A second address is a small code change (ask Claude, no patch on disk): the pizza-visit or party buttons point to the second page; js/features.js at `const BOOK` stays the one used in calendar files and messages.
- tests/consistency.test.mjs at `one booking page, one pre-order page` allows only one booking page, and consistency at `['reserve', /bookeo\.com/]` checks the Reserve QR sign: both need to allow two.
- Strings: 0 to 2 labels x 4 (if a button must say which visit it books)
- Tests: consistency at `one booking page, one pre-order page` and `['reserve', /bookeo\.com/]`; features at `ICS description unfolds to the booking link` and `open day offers Reserve (Bookeo)`; messages at `the description keeps the booking address whole` and `its text keeps the booking address`

### d47. Is the pizza pre-order page right?

- In plain words: The Pre-order pizza buttons open one Square page. We could not open it, so we do not know if it is yours or if it shows the same nine pizzas and prices as your printed menu.
- Doc question: Q23, Q48
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only she can open the Square page and compare it with the menu. (Old Q18, "are the nine pizzas and their prices right", is dropped: they were copied from her printed menu and checked in all five languages on 3 October.)
- Depends on: d46 (same kind of check), d53 (when the link is posted), d16 (the $31 package), d17 and d49 (menu facts), d19 (drinks and ice cream prices on the same page).
- Note: Old Q23 and Q48.

**A. Right page, same prices as the menu**

- No change. README.md: delete the Square part of the row "Pre-order page, drinks and ice cream" (and "Wise Pie facts" if d53 is also answered).
- Strings: 0
- Tests: none

**B. Right page, but some prices differ (I will say which)**

- First decide which is right. If the printed menu is out of date: change the nine pizzas (index.html from `data-t="td48b3939"` to `data-t="te5f7594f"`, one name and one description each), the extras (index.html at `data-t="t82b84514"`: "+$9"; index.html at `data-t="t74c1332b"`: "Also available ... (+$3) ... (+$9)") and the price range (index.html at `data-t="tc955ad55"`: "$15-$17 ..."), and replace the printed menu picture assets/photos/wise-pie-fall-menu-2026.webp (opened from index.html at `data-t="tf8e1e093"`). The numbers are also in the translations.
- If the Square page is out of date: she fixes it in Square. No file changes.
- Strings: 0 if only Square changes; otherwise 1 id per changed line x 4 translations
- Tests: consistency: tests/consistency.test.mjs at `pizza menu: the price range says the cheapest` checks that the price range on the page is the cheapest and dearest of the nine menu prices

**C. Wrong page (I will send the right link)**

- Replace https://wise-pie-wood-fired-at-wise-acres.square.site/?location=CVJNFDQTZCA3B in 6 places: index.html at `square.site` (2 places); pages/wise-pie.html at `square.site` (3 places); tools/qr_links.json at `square.site` (the pizza sign: then python3 tools/make_qr.py and reprint). Rebuild the pages (python3 tools/pages.py).
- The print style and two tests name the same store address: css/extras.css at `wise-pie-wood-fired-at-wise-acres.square.site` (3 places: the print rules that keep the pre-order button and print its address under it; with the old address left there the button is missing from a printed page), tests/print-qr.test.mjs at `wise-pie-wood-fired-at-wise-acres\.square\.site` (the list of addresses a printed page must show; the dots have a backslash there) and tests/privacy.test.mjs at `'wise-pie-wood-fired-at-wise-acres.square.site'` (the sites the pages may link to). Write the new address where it says the old one (host name only, without the https:// and the path).
- README.md names the address in the Wise Pie facts row.
- Strings: 0
- Tests: consistency: tests/consistency.test.mjs at `one booking page, one pre-order page` (one pre-order page on every page) and `['pizza', /square\.site/]` (the pizza QR sign); print-qr and privacy MUST follow (the two lines above)

### d04. Main phone number

- In plain words: (704) 628-6232 is listed in public directories but not on the site. Only the day-of number for photographers is shown.
- Doc question: Q3
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner choice. The number is already public in directories (BBB, YellowPages, Yelp), so showing it adds little risk; only do it if someone answers.
- Depends on: consistency test (phone check). Business Profile hours and phone should match the site (checklist 3.12).

**A. Show the main number to everyone**

- index.html footer contact block (index.html at `class="footer-contact"`, id t37c5399a): add the number as <a href="tel:+17046286232">. The 5 other pages copy the footer after rebuild.
- Contact cards: farm card (index.html at `data-t="t183fef9f"`) and the "Questions?" fact (index.html at `data-t="t1ec7041a"`). Structured data: add "telephone": "+1-704-628-6232", after the "email" line (index.html at `"email": "cathy@wiseacresorganic.com"`).
- Keep the photographers' number (index.html at `data-t="teae7efc9"`, 704-207-6347) as it is.
- README: delete the row "Phone number". Rebuild.
- Strings: about 3 changed strings x 4 translations (footer id t37c5399a, plus any label you add)
- Tests: nothing to change. tests/consistency.test.mjs at `phone: at most ONE main number` accepts the day-of emergency number plus ONE main number (written the same in the text, the tel: links and the structured data "telephone"); a typo or a second main number fails it, and the failing line names the files. `python3 tools/check_facts.py phone` shows the same without Node.

**B. Show the day-of number to everyone, with "Running late or lost? Call or text"**

- index.html footer contact block (index.html at `class="footer-contact"`, id t37c5399a): add one line under the e-mail address: Running late or lost? Call or text <a href="tel:+17042076347">704-207-6347</a>. The 5 other pages copy the footer after rebuild. The photographers' line (index.html at `data-t="teae7efc9"`) stays as it is.
- The main number stays hidden. README: delete the row "Phone number" only if she also decides there is no main number to show.
- Strings: 1 changed string x 4 translations (the footer block, id t37c5399a)
- Tests: nothing to change: the day-of number is the one the phone check already knows. `python3 tools/check_facts.py phone` shows the same without Node.

**C. No phone: email only**

- No change. The site shows no main number; the day-of number stays only in the photographers' line.
- Strings: 0
- Tests: none

**D. Show the main number on some pages only**

- Add it only where she names (for example Contact card and footer): same edits as option A in those places only; leave structured data out if unsure.
- Strings: 1 to 3 x 4 translations
- Tests: consistency phone check, as in A

### d54. Prices for pumpkins, berries, flowers and trees

- In plain words: The Shop section shows a red "Prices coming soon" tag next to pumpkins, strawberries, blueberries, flowers, snacks, drinks, local goods, ice cream and Christmas trees. Visitors cannot see what these cost.
- Doc question: Q19
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. The prices are owner facts. If they cannot come before launch, B removes the empty tags.
- Depends on: d19 (drinks and ice cream: the rows index.html at `data-t="t3699e70a"` and `data-t="t02fc833c"` are in both), d16 (the $31 package), d50 (tree dates share the row index.html at `data-t="t53cf41e8"`), d02 (draft prices).
- Note: Old Q19 asked the same list in one question; d19 already covers the two drinks rows.

**A. I will send the price list**

- Type the prices over the tag "Prices coming soon" and remove class="soon" (the red pill goes too): index.html at `class="soon"` (12 places: pumpkins twice, strawberries, blueberries, flowers, concessions, beer, hard cider and wine, local goods, ice cream, beer, wine and cider, local goods, Christmas trees). Prices carry no translation id.
- Then change the note index.html at `data-t="teeb109de"` ("We're adding every product and price ... Anything marked Prices coming soon is on the way") x 4, and README.md: delete the row "Shop section".
- Strings: 0 for prices; 1 id x 4 for the note (and the row labels if she renames a product)
- Tests: none pinned (these prices are in no facts test); consistency passes unless a number appears twice

**B. Remove the lines with no price**

- Delete the rows with no price (the <div><dt>..</dt><dd class="soon">..</dd></div> lines above) and rewrite the note index.html at `data-t="teeb109de"` so it no longer promises prices. Ask Claude if a whole price card ends up empty (pumpkins: index.html at `data-t="t7a752a57"`, the "Pumpkin prices" card).
- Strings: 1 id x 4 translations (the note); the row labels become unused
- Tests: none

**C. Keep "coming soon" for now**

- No change. The red "coming soon" tags stay.
- Strings: 0
- Tests: none

### d06. Google review link

- In plain words: The "Leave a Google review" buttons only open Google Maps until the real review link is pasted in.
- Doc question: Q27
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A when she has it (can follow launch, checklist 3.12).
- Depends on: d40 (if The GreenHouse has its own listing it has its own review link).

**A. I will send the link**

- js/content.js at `reviewUrl:` (2 places: the instructions, then the setting): reviewUrl: '' -> reviewUrl: 'https://g.page/r/.../review', (steps in the comment in js/content.js from `is where every "Leave a Google review" button goes` to `tap "Leave a Google review"`).
- Then python3 tools/make_qr.py: the review QR sign (tools/qr_links.json at `"{reviewUrl}"`) appears in print/qr-signs.html and assets/qr/review.svg (until now it is skipped).
- Check on a phone: the button opens a box with stars. README: delete the row "Google review link".
- Strings: 0
- Tests: print-qr (counts signs: 9 now, 10 after)

**B. Leave as is**

- No change. Buttons open the farm on Google Maps (index.html at `data-t="t16e2c151"` and the Reviews section).
- Strings: 0
- Tests: none

## Topic 3. People and photos (permission)

Urgency: blocks launch.
Faces and organisation names need a yes before launch. Words printed inside pictures cannot be translated and go out of date.

### d13. Photos with words or people

- In plain words: Easter, Father's Day, "waiting all summer" have words printed on them (a fourth says strawberries and blueberries are available now); one photo shows four people at a Foster Village table. All are in the gallery.
- Doc question: Q40 (words) and Q39 (the people photo)
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: B for the four word photos (cannot be translated, go stale); the people photo follows d31.
- Depends on: d32 is the same question for the dated words; d31 for the faces; d12 if she sends new versions; the Easter and Father's Day photos only make sense in their season.
- Note: B and C are not exclusive: apply both if both answers are "remove".

**A. Keep them all**

- No change. They are the last 5 entries of photos, marked "// words on the picture" (js/content.js from `goats-on-platform-waiting-all-summer.webp` to `foster-village-table.webp`). The words are not translated; the alt text repeats them.
- Strings: 0
- Tests: none

**B. Remove the ones with words**

- Delete the four entries in js/content.js: goats-on-platform-waiting-all-summer, baby-goat-bunny-hoodie-happy-easter, sunflowers-with-strawberry-and-blueberry-baskets and blueberries-sunflowers-happy-fathers-day (search for each name), each 4 lines.
- Delete their 4 files in assets/photos/ (about 0.07 MB) or replace with versions without words under the same names (then change each alt so it no longer talks about words).
- css/extras.css at `img[src$="goats-on-platform-waiting-all-summer.webp"]` object-position rule for two of them can go.
- Same as d32 option C.
- Strings: 0 (alt text of gallery entries is JS text: 4 JS strings x 4 translations become unused)
- Tests: gallery (counts photos: still above 5)

**C. Remove the people photo**

- Delete the entry js/content.js at `src: "assets/photos/foster-village-table.webp"`, the file assets/photos/foster-village-table.webp and css/extras.css at `img[src$="foster-village-table.webp"]`. Same as d31 option B for that photo.
- Strings: 0
- Tests: gallery

### d31. People's faces in three photos

- In plain words: Clear faces in the spring top picture (3 girls and 2 adults), on the About section (5 adults) and the Foster Village table (4 adults).
- Doc question: Q39
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Consent is an owner fact. Until a yes, treat as B (remove).
- Depends on: d13 (Foster Village is in both), d12 (originals), d33 (frog-hat photo is separate).
- Note: Related older question: Q39 also asks who took the Foster Village photo and whether Foster Village agrees to its name.

**A. They agreed, keep the photos**

- No change. Optional credit: the Foster Village entry caption (js/content.js at `src: "assets/photos/foster-village-table.webp"`) -> "Photo: <name>" (the gallery shows the caption); one JS string x 4 translations if you translate it.
- Strings: 0 to 1
- Tests: none

**B. Remove those photos**

- Spring top picture: delete the <li> that holds assets/photos/family-strawberry-field-red-barn.webp (index.html at `data-ta-alt="t4f6c5f3e"`) and the gallery entry js/content.js at `src: "assets/photos/family-strawberry-field-red-barn.webp"`.
- About section: index.html at `class="about-photo reveal"` (family-sunflower-field.webp, alt id t1db4d8e4); decide a replacement picture or remove the <figure>; gallery entry js/content.js at `src: "assets/photos/family-sunflower-field.webp"`.
- Foster Village table: delete the entry js/content.js at `src: "assets/photos/foster-village-table.webp"`, the file assets/photos/foster-village-table.webp and the rule css/extras.css at `img[src$="foster-village-table.webp"]`. Details: option C of d13.
- Delete each unused file in assets/photos/. Rebuild; the alt ids become orphans.
- Strings: 0 new (orphans: 2 alt ids per removed photo)
- Tests: gallery (counts photos: fine), i18n

**C. I will ask them first**

- Until she hears back, the safe state is option B. Reversible: the files stay in git.
- Strings: 0
- Tests: none

### d32. Photos that have dated words on them

- In plain words: Happy Easter, Happy Father's Day, "waiting all summer", and a sign saying berries are available now are visible all year. The tomato price sign is cut off after 4.50.
- Doc question: Q40 (and Q7 for the tomato prices)
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: C (remove the four) for launch; A later if she wants them back each season.
- Depends on: d13 (same photos), d34 (fall photos), d12 (new versions without words).

**A. Show them only in their season**

- Needs a small code change (ask Claude), none exists today: add an optional months field to entries of photos (js/content.js) and skip entries outside their months in the gallery builder (js/main.js at `const items = photos.map(`). Document it in the PHOTOS comment at the top of js/content.js.
- Easter: March-April; Father's Day: May-June; "waiting all summer": June-August; "berries available now": May-July (ask for the real months).
- Alternative with no code: delete the entries now and put them back each year (js/content.js from `goats-on-platform-waiting-all-summer.webp` to `foster-village-table.webp`).
- Strings: 0
- Tests: gallery (add a case for the month filter); i18n unaffected

**B. Keep them all year**

- No change. (tomato sign: leave index.html at `data-ta-alt="tf8f8a118"` and js/content.js at `src: "assets/photos/organic-tomatoes-and-basil-u-pick-signs.webp"` as they are.)
- Strings: 0
- Tests: none

**C. Remove them**

- Delete the four word photos: same changes as d13 option B.
- Tomato price sign (organic-tomatoes-and-basil-u-pick-signs.webp): keep it only if the prices are right and the farm grows u-pick tomatoes this year (doc Q6, Q7 are not on the dashboard). To remove: the tile (index.html at `data-ta-alt="tf8f8a118"`) and the entry (js/content.js at `src: "assets/photos/organic-tomatoes-and-basil-u-pick-signs.webp"`) and the file.
- Strings: 0
- Tests: gallery

### d33. What animal is wearing the frog hat

- In plain words: The file name says goat; it could be a guinea pig. The caption says "small animal" for now.
- Doc question: Q39 (second half)
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The wording today ("a small animal") is safe; leave it until known.
- Depends on: d13 and d31 (other people photos), d12 (original).

**A. A baby goat**

- js/content.js at `src: "assets/photos/goat-in-green-frog-hat.webp"`: alt -> "A baby goat wearing a green knitted frog hat" (and caption if wanted) and the same alt in index.html at `data-ta-alt="ted43ffcd"` (goat strip tile).
- Add the translations: the alt text is 1 UI string (id ted43ffcd after extract gets a new id) and 1 JS string (the English text is the key under "js" in lang/src/<code>.json).
- Strings: 2 x 4 (alt as UI string + as JS string); caption "Frog hat" stays
- Tests: i18n, languages (rebuild first)

**B. A guinea pig**

- Keep the picture out of "Meet the goats": delete its <li> (index.html at `data-ta-alt="ted43ffcd"`, the goat strip). Gallery entry js/content.js at `src: "assets/photos/goat-in-green-frog-hat.webp"` stays; change its alt to "A guinea pig wearing a green knitted frog hat" and add the JS string x 4. Rename the file if you like (both places).
- Strings: 1 JS string x 4 (alt); the strip tile string becomes unused
- Tests: gallery

**C. Something else**

- Same as B with the real animal name: take it out of the goat strip, rewrite the alt, add the JS string x 4.
- Strings: 1 JS string x 4
- Tests: gallery

### d12. Photo originals

- In plain words: Photos sent in chat are 206 px wide and look soft. Originals would look sharp.
- Doc question: Q38
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A (free to ask, nothing to decide).
- Depends on: d13, d31, d32 (do not ask for files that will be removed), d33, d34.

**A. I will send the originals**

- She sends 13 originals with the same names: baby-goat-bunny-hoodie-happy-easter, blueberries-in-bowl-in-sunflower-field-dusk, blueberries-sunflowers-happy-fathers-day, foster-village-table, goat-in-green-frog-hat, goats-on-platform-waiting-all-summer, mums-field-with-red-shed-and-palm, organic-tomatoes-and-basil-u-pick-signs, pink-clouds-sky-over-field, school-bus-on-farm-path, strawberries-and-blueberries-in-white-bowl, sunflower-field-golden-light, sunflowers-with-strawberry-and-blueberry-baskets (.webp in assets/photos/).
- Resize and convert to WebP with python3 tools/add_photo.py (README "Adding a photo"; it removes camera and location data). Then change width="206" height="206" on the tiles: index.html at `width="206" height="206"` (7 places), pages/school-field-trips.html at `width="206" height="206"`, pages/strawberry-picking.html at `width="206" height="206"`, and rebuild. The viewer rule css/extras.css at `.lightbox img{` can stay.
- Do not send originals of photos that d13/d31/d32 remove.
- README: the row "13 new photos" shrinks.
- Strings: 0
- Tests: gallery, axe (image sizes)

**B. Keep them small**

- No change. They stay small tiles.
- Strings: 0
- Tests: none

### d34. Sunflower photos in the Fall section

- In plain words: The Fall panel and the pumpkin page lead with a sunflower photo, but the farm's own dates put sunflowers in summer.
- Doc question: none (doc Q34 is a different question: the gate photo)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: B until she sends fall photos (the photo shows pumpkins too).
- Depends on: d12 (originals), d32.

**A. Swap in fall photos, I will send some**

- Fall panel lead photo: index.html at `data-ta-alt="taf7baeae"` (sunflowers-and-pumpkins-by-the-fire.webp) and its caption. Pumpkin page: pages/pumpkin-patch.html at `src="assets/photos/sunflowers-and-pumpkins-by-the-fire.webp"`, first figure. Gallery entry js/content.js at `src: "assets/photos/sunflowers-and-pumpkins-by-the-fire.webp"`.
- Send fall photos, add them with python3 tools/add_photo.py, swap the <img> src, alt and caption in those two places; add the alt and caption translations x 4. Rebuild.
- Strings: 2 to 4 per photo x 4 translations (alt and caption)
- Tests: gallery, i18n

**B. Keep them as they are**

- No change.
- Strings: 0
- Tests: none

### d61. Who owns the photos on the site?

- In plain words: None of the 32 photos has a photographer, a source or a permission written down. Only she knows whether all of them are hers.
- Doc question: Q56
- Urgency: 2 (wrong or risky information). Checklist says: not listed (the permission questions for faces, words and dated pictures are d13, d31, d32 and d33).
- Owner fact (no sensible default): yes
- Default: none. Owner fact.
- Depends on: d13, d31, d32, d33 (the same pictures can also be removed for another reason), d12 (originals), d34 (the sunflower pictures).
- Note: A check of all 32 picture files on 3 October 2026 found no visitor, review or press picture that needs a credit (the community and reviews lists are empty) and no credit field for photos. The pictures that most need an answer: the Foster Village table, the family in the strawberry field (two adults, three children), the family in the sunflower field, the four with words printed on them, and the two Wise Pie pictures (another business's menu and food). The rest show nothing that points to a third party.

**A. All of them are ours, no credit needed**

- No change.
- Strings: 0
- Tests: none

**B. Some belong to others (I will send a list)**

- Put the credit in that photo's caption: js/content.js at `assets/photos/foster-village-table.webp` is one of the 32 entries (each has `src`, `alt`, `caption` and `tags`). A caption shows under the picture in the gallery and in the viewer, and can be written { en, es, hi, zh, vi }. Names and organisations are not translated.
- A picture shown outside the gallery has no caption line, so a credit there needs a small code change (ask Claude). Or remove the picture the way d13 and d31 describe.
- Strings: 1 JS string x 4 translations (a caption is read as a JS string, so a new caption is listed by python3 tools/i18n.py missing es; the name in it stays the same in every language)
- Tests: gallery (photo count of at least 5, tags) if a picture is removed

**C. I need to check first**

- No change until she answers.
- Strings: 0
- Tests: none

### d86. Where did the map outline of the land come from?

- In plain words: The Farm map shows the roads around the farm, the neighbours' houses, the lawns and the dirt lanes. Someone traced them by hand from a satellite picture. The notes in the tools say the picture came from Google. Google's terms usually do not allow copying or tracing from its pictures. The farm's own marks (parking, strawberries, restrooms) are not in question.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes (only she can ask her adviser)
- Default: none. Keeping the map is a small risk, not zero.
- Depends on: d14 (the Farm Map Marker makes the marks), d12 and d13 (the same question for photos).
- Note: The land drawing lives in js/farm-map-data.js (written from tools/saved-map.json) and is drawn by js/map-art.js. The farm's own marks are separate items of the same map and stay in every option except a full redraw.

**A. Keep the map as it is: the risk is small but not zero**

- No change.
- Strings: 0
- Tests: none

**B. Take the traced land out and keep every mark the farm made: a ready fix is in patches/optional/**

- The optional patch map-without-traced-land.patch (see "Patches on disk"): it takes out of js/map-art.js everything the map drew from the aerial picture (the two roads, the neighbours' houses, the mown lawns, the plowed field and the dirt lanes), keeps every mark the farm made, the legend, the names and the drive-time chips, and changes the farm_map.py note, the README map paragraph and the licence list (docs/CREDITS_AND_LICENCES.md, row L8). Nothing to rebuild; upload again. The patch needs docs/CREDITS_AND_LICENCES.md.
- Strings: 0 (no new text)
- Tests: map, licences, docs (what the patch's own header says to run: node tests/run-all.mjs map licences docs)

**C. Redraw the land from OpenStreetMap or a picture the farm owns, such as a drone photo**

- A drawing job: new land shapes from OpenStreetMap (free to use with the credit "© OpenStreetMap contributors") or from a drone photo the farm owns, then the same files as B. Ask Claude.
- Strings: 0
- Tests: map

**D. Ask your adviser first**

- No change until she answers; then it becomes A, B or C.
- Strings: 0
- Tests: none

### d87. Who drew the Wise Acres logo and the farm drawings, and does the farm own them?

- In plain words: The strawberry logo, the tab icon, the share pictures and the farm scene on the home page (barn, tractor, scarecrow, pumpkins, animals) are drawings inside the website files. Nothing in the files says who made them.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only she knows who drew what.
- Depends on: d61 (the same question for photos), d13 (photos that carry words).
- Note: The text about who owns what goes in README.md, section "Photos" (nothing on a public page). The written agreement itself is outside the repository.

**A. The website builder drew them for the farm: write one sentence saying the farm owns them**

- Add one sentence to README.md, section "Photos", after its first paragraph (README.md at `The farm photos are in`): "The logo, the tab icon, the share pictures and the farm drawings on the pages were made for the farm by its website builder. The farm owns them." Ask the builder for the same sentence in writing.
- Strings: 0
- Tests: docs

**B. A designer drew the logo: tell us who and when, and whether there are terms**

- She tells who drew it, when, and whether there are terms (for example no printing on shirts). Write that in the same place of README.md, section "Photos". If the terms limit anything the site does, change that thing (the share pictures and the printed signs carry the logo).
- Strings: 0
- Tests: docs

**C. Not sure: leave it for now and decide later**

- No change.
- Strings: 0
- Tests: none

## Topic 4. Pizza and food facts

Urgency: wrong or risky information.
Claims about food, allergies and prices that nothing from the farm backs up yet. Allergen and oven wording are the risky ones.

### d17. Allergen note on the pizza page

- In plain words: Neither the menu nor the site says anything about allergens or cross-contact. "Gluten-free crust available" can be read as safe for celiac guests.
- Doc question: Q45 (and Q46: does The Dill Pickle have cheese, which pizzas can be vegan; Q46 is not on the dashboard)
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A (a short line she writes herself); it is the one food item that can hurt a guest.
- Depends on: d16 (same card and extras), d37 (a person should read the allergen sentence in each language), d18/d22 (same pizza section, rebuilt together).

**A. Add an allergen line (I will give the facts)**

- She gives the words. Put them under the cheese note (index.html at `data-t="t92529550"`), in the "Ingredients & sources" box (index.html from `data-t="t2b1b2046"` to `data-t="t74c1332b"`) and in the answer "Is there a vegan or gluten-free option?" (pages/wise-pie.html at `Yes. Follow Your Heart vegan cheese`; the rebuild copies the answer into the page data).
- Point to them from "Vegan cheese and gluten-free crust available" (index.html at `data-t="td4e061c6"` and pages/wise-pie.html at `Vegan cheese and gluten-free crust available`).
- Write nothing she has not said. A new printed menu picture is her choice (assets/photos/wise-pie-fall-menu-2026.webp, opened from index.html at `data-t="tf8e1e093"`).
- README: delete the row "Fall pizza package and allergens" once d16 is answered too.
- Strings: 2 to 4 new or changed sentences x 4 translations. Ask a native speaker to check an allergen sentence (d37)
- Tests: none (the facts test does not pin allergens); i18n and languages after the rebuild

**B. Leave it as is**

- No change. Risk stays: the site says "gluten-free crust available" and nothing about cross-contact.
- Only with her OK: one neutral sentence ("Please tell us about any allergy before you order") in the same places as option A.
- Strings: 0
- Tests: none

### d16. The $31 pizza package

- In plain words: Which pizzas can a family pick in the "Yes pizza" package ($31 base, 2 pizzas, plus $3 per person)? Two menu pizzas cost $30 to $34 together.
- Doc question: Q44
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. The rule and the price are owner facts. If A ("any two") is true, no file change is needed.
- Depends on: d17 (allergen wording sits next to the extras), d19 (prices), d20/d21 (same card, index.html at `data-t="td4abc72c"`), d36 is not related.

**A. Any two pizzas**

- The site already says "Includes 2 Wise Pie pizzas". If "any two" is what she means, no change is needed.
- To say it in words ("any 2 pizzas"): index.html at `data-t="tf7203efa"` and index.html at `data-t="te9a8e62d"` (same sentence on pages/pumpkin-patch.html at `<dt>Farm fun with pizza</dt>`). Gluten-free crust (+$9) and vegan cheese (+$3): say if they cost extra on top of the $31 (same three places).
- Check the booking page (Bookeo) says the same. README: delete the row "Fall pizza package and allergens" once d17 is answered too.
- Strings: 0 if the wording stays; 3 ids x 4 translations if "any" or "extras cost more" is added (the two sentences in index.html and the line on the pumpkin page)
- Tests: consistency MUST be updated when "any" is added: three patterns read "Includes 2 Wise Pie pizzas, plus" and no longer find it: tests/consistency.test.mjs at `pizza package: number of pizzas included` (the pattern `/Includes (\d+) Wise Pie`), at `price: extra per person in the pizza package` (its first pattern, `'Includes \\d+ Wise Pie`) and at `days: farm visits with pizza` (its second pattern, `'Includes 2 Wise Pie`). In each one write `Includes (?:any )?` where it says `Includes `. "Extras cost more" needs no test change

**B. Only some pizzas (I will say which)**

- Add the list of allowed pizzas to the same three places: index.html at `data-t="tf7203efa"` (after "(ages 3+)."), index.html at `data-t="te9a8e62d"` and pages/pumpkin-patch.html at `<dt>Farm fun with pizza</dt>` (same id; in these two put the list at the very end, after "Friday&ndash;Sunday.", not between "(ages 3+)." and the days: the consistency test reads "(ages 3+). Friday&ndash;Sunday." as one piece). Names must match the menu list (index.html at `class="menu-list"`).
- Extras (gluten-free +$9, vegan cheese +$3): say if they cost extra on top.
- Check the booking page says the same.
- Strings: 3 ids x 4 translations (a longer sentence: the two in index.html and the line on the pumpkin page)
- Tests: consistency: with the list at the very end, nothing changes (the patterns of A read the sentence up to "Friday&ndash;Sunday." as it is now). If the list goes anywhere else, the pattern in consistency at `days: farm visits with pizza` stops finding the days: change it with the sentence

**C. Change the package price**

- Change "$31" in index.html at `data-t="t661d94cd"`, index.html at `data-t="te0ae7737"` and pages/pumpkin-patch.html at `<dt>Farm fun with pizza</dt>` (id t041b0712 holds the whole line). The number is inside the translations, so the ids change: 3 ids x 4.
- Also change the booking page and the Bookeo price, outside the repo.
- Strings: 3 ids x 4 translations
- Tests: consistency: fact "price: farm fun with pizza, base" (tests/consistency.test.mjs at `price: farm fun with pizza, base`) needs the new number to be the same in all 3 places (it reads the pages, no edit if all places agree); the $3 farm fee facts (consistency at `price: extra per person in the pizza package`) only if $3 changes

### d18. Oven temperature on the site

- In plain words: The heading says "700-degree oven" with no unit. In other languages that reads as Celsius. The pizza share picture says it too.
- Doc question: Q47
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A if the oven really is 700 degrees F (the figure everyone quotes for wood-fired ovens); the unit matters more than the number.
- Depends on: Share picture (docs/LAUNCH_CHECKLIST.md 3.11, d38 for the address on it), d37 (zh adds the Celsius figure).

**A. It is Fahrenheit: add the F**

- Change "700-degree" to "700°F" at: index.html at `id="pizza-h"` and pages/wise-pie.html at `id="pg-h"` (one id, t52ee3965); the description pages/wise-pie.html at `description:` (a JS string, shown in search and shares); pages/wise-pie.html at `image_alt:` (share picture description, English only).
- The share picture assets/og-wise-pie.png has the heading drawn in it: a new picture is needed (drawn artwork, ask Claude). Before launch the same file name is fine; after launch use a new file name (docs/LAUNCH_CHECKLIST.md 3.11, and the table row "Wise Pie").
- Translations: Chinese adds a Celsius figure (about 370); keep it.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency MUST be updated: tests/consistency.test.mjs at `pizza: oven temperature` and `const ALLOWED_EXTRA`: the fact "oven temperature" (regex (\d+)-degree oven, min 4) and ALLOWED_EXTRA (/700-degree/ -> 370). Change them like this: the fact becomes `(\d+)(?:-degree|°F) oven`, and ALLOWED_EXTRA becomes `[[/700-degree|700°F/, '370']]`. Keep the old wording in ALLOWED_EXTRA: the old translations (they carry the Celsius figure 370) stay in lang/src/*.json and are still checked. Chinese then needs its Celsius figure again in the new translations

**B. Remove the number**

- Take the number out: heading id t52ee3965 (index.html at `id="pizza-h"`, pages/wise-pie.html at `id="pg-h"`), description (pages/wise-pie.html at `description:`), image description (pages/wise-pie.html at `image_alt:`), for example "Real pizza from a wood-fired oven".
- New share picture without the number (assets/og-wise-pie.png), as in A.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency MUST be updated: delete the fact tests/consistency.test.mjs at `pizza: oven temperature` (one line). Leave consistency at `const ALLOWED_EXTRA` as it is: the old translations (they carry the Celsius figure 370) stay in lang/src/*.json and are still checked, and deleting that line stops the whole consistency test with an error

**C. A different number**

- Same places as A with her number and unit. Chinese adds the Celsius figure for the new number.
- New share picture, as in A.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency: if the wording stays "N-degree oven" the fact (consistency at `pizza: oven temperature`) still works; update ALLOWED_EXTRA (consistency at `const ALLOWED_EXTRA`) to the new Celsius figure

### d19. Drinks and ice cream at The GreenHouse

- In plain words: The site names beer, wine, cider and Waxhaw Creamery ice cream, but prices say "coming soon". Names and prices are not confirmed.
- Doc question: Q53 (prices also in Q19; Q19 is not on the dashboard)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Names and prices are owner facts. Alcohol claims are the risky ones: remove a name she does not confirm.
- Depends on: d40 (does The GreenHouse have its own listing), d37 (translation of "cider").

**A. I will send names and prices**

- Type the prices over "Prices coming soon": index.html at `data-t="t3699e70a"` (Waxhaw Creamery ice cream) and `data-t="t02fc833c"` (Beer, wine & cider). Remove class="soon" from those dd tags. Prices carry no translation id.
- Names that change (if she corrects them): index.html at `data-t="t3517c259"`, `data-t="t8aa1a25f"`, `data-t="t1d93180c"`, `data-t="t7b10f100"` and `data-t="ta38e4092"`, pages/pumpkin-patch.html at `<h3>No reservation?</h3>` and pages/wise-pie.html at `src="assets/photos/wise-pie-pizza-and-drinks.webp"`. The GreenHouse side says "cider", the farm side says "hard cider" (index.html at `data-t="te7f1d0c8"`, `data-t="tbf415391"`, `data-t="t7528af5c"`, `data-t="t8e063e7b"`, `data-t="t5cc2b160"`, `data-t="t60cc5e24"` and `data-t="t6536e198"`): make the wording agree.
- README: delete the part about drinks in the row "Pre-order page, drinks and ice cream".
- Strings: 0 for prices only; up to 23 ids x 4 if names change (ids containing ice cream, drinks or cider)
- Tests: none (prices of drinks are not in the facts test); consistency "price:" facts only if you add a pinned price

**B. Remove the drinks line**

- Delete the drinks mentions on The GreenHouse side: index.html at `data-t="t7b10f100"` (list item "Beer, wine & cider") and `data-t="t02fc833c"` (price line), the sentences index.html at `data-t="t3517c259"` and `data-t="t8aa1a25f"`, and index.html at `data-t="ta38e4092"` if it names drinks.
- The farm side (hard cider, beer and wine at the farm: index.html at `data-t="te7f1d0c8"`, `data-t="tbf415391"`, `data-t="t7528af5c"`, `data-t="t8e063e7b"`, `data-t="t5cc2b160"`, `data-t="t60cc5e24"` and `data-t="t6536e198"`) is a separate claim: not asked on the dashboard (doc Q15 covers spring and summer snacks); leave or ask.
- Strings: 2 to 6 changed sentences x 4 translations
- Tests: none

### d20. Pizza ready time

- In plain words: The site says pizzas are ready 1 hour after the reservation time. A late reservation would be after the farm closes at 4.
- Doc question: Q50
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A only if she says "always 1 hour". A late slot that promises pizza after closing is a wrong promise.
- Depends on: d21 (same sentence index.html at `data-t="td4abc72c"`), d23 (farm closing dates).

**A. Correct**

- No change.
- Strings: 0
- Tests: none

**B. Not correct (I will give the rule)**

- Change the sentence index.html at `data-t="td4abc72c"` (shared with the "serves" sentence of d21) and pages/wise-pie.html at `Pizzas are ready for pick-up` (id tb150c178).
- Rewrite for late reservations (for example a time cap) in her words.
- Strings: 2 ids x 4 translations
- Tests: consistency: fact "pizza: ready for pick-up after (hours)" (tests/consistency.test.mjs at `pizza: ready for pick-up after`, regex (\d+) hour after your reservation time, min 2): the regex says "hour" (one hour), so "2 hours after your reservation time" is not found. Write `(\d+) hours? after your reservation time` (or keep the phrase "N hour after")

### d21. Pizza size

- In plain words: The site says every pizza is 12 inches, whole pie only, and serves 2 to 3 adults or 3 to 4 children. The menu picture has no sizes.
- Doc question: Q51
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A only if she confirms. These numbers appear in 6 sentences; one wrong number is a complaint at the oven.
- Depends on: d20 (same sentence index.html at `data-t="td4abc72c"`), d16.

**A. Correct**

- No change.
- Strings: 0
- Tests: none

**B. Not correct (I will give the facts)**

- Change: index.html at `data-t="td4abc72c"`, `data-t="td97bf746"` ("12 inches") and `data-t="t2f74e9c3"` ("serves"), pages/wise-pie.html at `12 inches each, sold whole only`, `<li>One pizza serves about` and the FAQ answer `Each pizza is 12 inches and sold whole only` (ids tc3127d1f, t202bb680, t5cc8a292). The rebuild copies the answer into the page data.
- Strings: 6 ids x 4 translations
- Tests: consistency: facts tests/consistency.test.mjs from `pizza: size in inches` to `pizza: feeds children` (size in inches, feeds adults, feeds children, regexes need "N inches", "about N-N adults", "or N-N children")

### d22. Mozzarella wording

- In plain words: The home page says local mozzarella and the pumpkin page says locally sourced mozzarella. The menu only says Uno Alla Volta in Charlotte, with milk from an Amish farm northeast of Charlotte.
- Doc question: Q52
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: B if she does not confirm "local"; the exact menu words cannot be wrong.
- Depends on: None. Share picture and descriptions do not use the word.

**A. Keep locally sourced**

- No change.
- Strings: 0
- Tests: none

**B. Use the menu's exact words**

- Replace "local mozzarella" in index.html at `data-t="t6daebcdd"` and pages/wise-pie.html at `<p class="lead">Homemade dough` (id t063c32e4), and "locally sourced mozzarella" in pages/pumpkin-patch.html at `Wood-fired pizza with homemade dough` (id t26f2daf9), with the menu words, for example "fresh mozzarella from Uno Alla Volta in Charlotte". The detailed note already uses them (index.html at `data-t="t92529550"` and `data-t="t1e907c1b"`; pages/wise-pie.html at `Fresh mozzarella from Uno Alla Volta`).
- Strings: 3 ids x 4 translations
- Tests: none

### d49. Does The Dill Pickle pizza have cheese?

- In plain words: The printed menu lists no cheese on The Dill Pickle. A guest who avoids dairy, or wants a vegan pizza, would read it as cheese-free, and the site says nothing either way.
- Doc question: Q46
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only the kitchen knows. Do not guess about cheese.
- Depends on: d17 (the allergen line sits next to this), d16 (extras), d47 (the menu picture must match the Square page).
- Note: Old Q46.

**A. Yes, it has cheese**

- Put "cheese" in the description of The Dill Pickle: index.html at `data-t="t9e44b097"` x 4 translations, and replace the printed menu picture (assets/photos/wise-pie-fall-menu-2026.webp, opened from index.html at `data-t="tf8e1e093"`) so both agree.
- If she also lists which pizzas can be made vegan: one sentence next to "Vegan cheese and gluten-free crust available" (index.html at `data-t="td4e061c6"`, pages/wise-pie.html at `Vegan cheese and gluten-free crust available`) and in the answer pages/wise-pie.html at `Yes. Follow Your Heart vegan cheese`.
- Strings: 1 id x 4 (+ 1 to 2 for a vegan sentence)
- Tests: none

**B. No, it has no cheese**

- No change. Do not add "dairy-free" or "vegan" to the pizza unless she says so.
- Strings: 0
- Tests: none

**C. Not sure, I will check**

- No change until she answers.
- Strings: 0
- Tests: none

### d53. When and where is the pre-order link posted?

- In plain words: The site says the pizza pre-order link is posted 5 days ahead. It does not say 5 days before what, or where people will find it.
- Doc question: Q49
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Only the kitchen knows its posting routine.
- Depends on: d57 (shares the sentence index.html at `data-t="t60509a07"`), d47 (the link itself), d16 and d20 (other pizza promises).
- Note: Old Q49.

**A. 5 days before each pizza day**

- No change.
- Strings: 0
- Tests: none

**B. 5 days before the weekend**

- Change "the link we post 5 days ahead" to say the weekend: index.html at `data-t="t60509a07"` and pages/wise-pie.html at `<p>First come, first served` (one id, t60509a07, shared with the "eat there" sentence of d57); index.html at `data-t="t86f09bf0"`; tools/qr_links.json at `"id": "pizza"` (its text_en and text_es: the pizza sign in English and Spanish; then python3 tools/make_qr.py and reprint).
- Strings: 2 UI ids x 4 translations + the Spanish sign text in tools/qr_links.json by hand
- Tests: consistency: "pizza: pre-order link posted (days ahead), also on the QR sign" (tests/consistency.test.mjs at `pizza: pre-order link posted`, at least 3 places): keep the phrase "we post the pre-order link N days ahead/before" or change the regex

**C. Different: I will explain when and where**

- Same places as B with her rule and, if she says, where the link is posted (the Wise Pie Instagram page, the website, a message). The pre-order button itself already goes to the Square page (index.html at `data-t="tf8b54143"` (2 places)).
- Strings: 2 UI ids x 4 translations + the sign text
- Tests: consistency at `pizza: pre-order link posted`, as in B

### d08. Thai night

- In plain words: Is there a Thursday-evening Thai dinner at The GreenHouse? It could not be confirmed and it is not on the site.
- Doc question: Q4
- Urgency: 3 (nice to have). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. B and C are the same: leave it off.
- Depends on: d09 (GreenHouse hours; a Thursday window is the same code change).
- Note: Nothing wrong is on the site today, so urgency 3, although the checklist lists Q4 before launch.

**A. It is real: I will send details**

- The GreenHouse is one Friday to Sunday window today (js/content.js at `greenhouse: {` and `// Wise Pie at The GreenHouse`). A Thursday evening needs a small code change (ask Claude; no patch on disk): hours with a Thursday window, and the "Closed today. Opens Friday at 10 am" line.
- New text on the GreenHouse card (index.html at `data-t="t8aa1a25f"`, `data-t="tfb71e468"` and `data-t="tb4c1e6ac"`) and the First-visit and Wise Pie pages: days, hours, what is served.
- Strings: 2 to 4 new sentences x 4 translations
- Tests: consistency: GreenHouse days and hours facts (tests/consistency.test.mjs from `time: The GreenHouse open hours` to `days: The GreenHouse and Wise Pie there`) add Thursday; live/dated if the hours code changes

**B. It is not real**

- No change (it is not on the site).
- Strings: 0
- Tests: none

**C. Not sure yet**

- No change. Do not add it until she says yes.
- Strings: 0
- Tests: none

### d57. Can people sit and eat at The GreenHouse?

- In plain words: The Wise Pie page says "eat there or take your pizza with you". We do not know if there are tables, so a family may arrive expecting a seat.
- Doc question: Q54
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The current words promise "eat there".
- Depends on: d53 (same sentence), d19 (what The GreenHouse sells), d55 (comfort and shade).
- Note: Old Q54.

**A. Yes, there are tables**

- Say where, in the same sentence or in the GreenHouse section (index.html from `data-t="t8aa1a25f"` to `class="live live-lg"`). The sentence "eat there or take your pizza with you" is index.html at `data-t="t60509a07"` and pages/wise-pie.html at `<p>First come, first served`.
- Strings: 0 to 1 new sentence x 4
- Tests: consistency at `pizza: pre-order link posted` only if the "we post the pre-order link 5 days ahead" words change (d53 shares the sentence)

**B. No, take-away only**

- Change the sentence to "First come, first served: take your pizza with you. Or pre-order with the link we post 5 days ahead." (id t60509a07 changes) in index.html at `data-t="t60509a07"` and pages/wise-pie.html at `<p>First come, first served`. Check pages/first-visit.html at `<li>No reservation?` ("welcomes drop-ins": fine) and the GreenHouse intro (index.html at `id="gh-h"`) for "eat" or "dine".
- Strings: 1 id x 4 translations
- Tests: consistency at `pizza: pre-order link posted` (keep the "pre-order link N days ahead" words)

**C. Some seating (I will say where)**

- Same sentence as A with the real seating (for example "a few picnic tables") and where they are.
- Strings: 1 id x 4 translations
- Tests: consistency at `pizza: pre-order link posted`, as above

### d79. Is pizza sold with a Thursday visit?

- In plain words: One line in the Fall tab says "Thursday-Sunday reservations, with or without pizza". The package cards and the pumpkin page say pizza is Friday to Sunday only. A visitor cannot tell which is true.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only she knows. A is the cheap one if the cards are right (they came from the farm's own words).
- Depends on: d16 (the package), d08 (Thursday night), d80 (pizza at The GreenHouse), d44 (the Thursday corn pit offer).
- Note: The line is index.html at `data-t="t26e5052f"`. The cards that say Friday-Sunday are index.html at `data-t="te9a8e62d"` and pages/pumpkin-patch.html at `<dt>Farm fun with pizza</dt>`.

**A. Pizza is Friday to Sunday only: I will fix the Fall line**

- index.html at `data-t="t26e5052f"`: change "Thursday-Sunday reservations, with or without pizza" to, for example, "Thursday-Sunday reservations (pizza is Friday-Sunday only)". Keep the dash as &ndash; in the file.
- Strings: 1 UI id x 4 translations
- Tests: consistency (it compares the weekdays of every translation with the English)

**B. Pizza is also on Thursday: the package cards are wrong**

- Change "Friday-Sunday" to "Thursday-Sunday" wherever pizza with a farm visit is named: index.html at `data-t="te9a8e62d"`, pages/pumpkin-patch.html at `<dt>Farm fun with pizza</dt>`, and every other place the consistency test lists. Check js/content.js at `hours: {` (the days of the farm pizza) and the Bookeo page.
- Not replayed: about eight sentences, found by the test. Run consistency after each batch: it names every place that still says Friday-Sunday (the fact "days: farm visits with pizza, and pizza at the farm", tests/consistency.test.mjs at `days: farm visits with pizza`, 7 places today).
- Strings: about 8 UI ids x 4 translations
- Tests: consistency MUST follow (the fact above, its text and js/content.js); dated, live

**C. Sometimes on Thursday: say check the booking page**

- index.html at `data-t="t26e5052f"`: "Thursday-Sunday reservations (pizza is some Thursdays: check the booking page)". The cards stay.
- Strings: 1 UI id x 4 translations
- Tests: consistency (weekdays in the translations)

### d80. Is Wise Pie pizza at The GreenHouse only 4 to 8 pm?

- In plain words: The GreenHouse cards say "Fri-Sun, 10 am-8 pm" and "Drop in any time" right next to Wise Pie pizza. The Contact card says the same. The pizza section says GreenHouse pizza is first come, first served from 4 to 8 pm. A family that arrives at noon for pizza finds none.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. A is right if the pizza section is right (it matches js/content.js, which drives the "Open now" badge).
- Depends on: d51 (the opening hours), d09 (The GreenHouse winter hours), d79 (pizza days).
- Note: The two cards are index.html at `data-t="t93fcfff0"` (the GreenHouse card list) and index.html at `data-t="ta38e4092"` (the Contact card).

**A. Pizza at The GreenHouse is 4 to 8 pm only: add the time next to Wise Pie pizza**

- index.html at `data-t="t93fcfff0"`: "Wise Pie pizza (4 to 8 pm), ice cream, drinks, playground and goats". index.html at `data-t="ta38e4092"`: "Pizza (4 to 8 pm), ice cream and drinks. No reservation needed. Fri-Sun, 10 am-8 pm." Rebuild.
- Strings: 2 UI ids x 4 translations
- Tests: consistency (the hours facts and the weekdays of the translations)

**B. Pizza at The GreenHouse is all day when open: change the pizza section**

- The same places as d51 B, with 10 am to 8 pm: js/content.js at `hours: {` (hours.pizza) and about twenty sentences, found by the consistency test (the fact "time: Wise Pie at The GreenHouse (no reservation)", 11 places say 16:00-21:00 today). Not replayed: it is the same kind of edit as d51 B.
- Strings: up to 20 UI ids x 4 translations
- Tests: consistency MUST follow; live (open-now badges); dated

**C. Hours change week by week: say check Instagram on the cards**

- The same two sentences as A, with "(times change: check Instagram)" instead of "(4 to 8 pm)".
- Strings: 2 UI ids x 4 translations
- Tests: consistency (weekdays in the translations)

## Topic 5. Dates, seasons and winter

Urgency: wrong or risky information.
The site shows fall wording all year. The two winter patches (A and B), the fall end date, new-year content and the Reserve buttons belong together.

### d01. What visitors see in winter

- In plain words: From January to March the site still shows fall booking buttons and fall 2026 prices. Two ready-made fixes exist (A and B). C means leave it: the Christmas tree wording is already fixed.
- Doc question: Q37 (and Q12 for the Christmas tree dates; Q12 is not on the dashboard)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A, if the u-pick farm is really closed in winter (its own dates say it is). Needs her yes on Q37 first. C is what you already have.
- Depends on: d24 (hide fall content = the same patch as A), d25 (Reserve buttons), d27 (school tours banner), d09 (GreenHouse winter hours), d23 (fall end date); the Christmas tree dates (doc Q12) are not on the dashboard.
- Note: A and B are alternatives. C is the current state.

**A. Hide fall booking and prices out of season**

- Apply patches/optional/winter-A-hide-fall-booking.patch (source files only; then rebuild).
- What it does: the "Reserve now" button in the Visit area, the "Choose your package" header, packages, included, add-ons, the "See prices" and "See packages" buttons, the "At the farm" shop block with its jump link and the "Fall:" paragraph get data-only="fall" (or "spring summer fall"). A new off-season line ("Fall at the farm usually starts again in mid-September...") with the existing "Tell me when it opens" button shows in winter, spring and summer. First-visit page: "See packages & add-ons" button hidden out of fall. css/sections.css +2 lines.
- Then rebuild (python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py jsstrings && python3 tools/i18n.py build) and python3 tools/i18n.py missing es hi zh vi (0 each).
- The pumpkin page (pages/pumpkin-patch.html from `<h3>Fall 2026 prices</h3>` to `Prices are for fall 2026 and can change.`, and `For fall 2026, farm fun without pizza`) keeps "fall 2026" prices all year: not covered.
- The fall blocks come back about August 12 (the site then treats fall as the nearest season): answer d24 before that.
- Strings: 1 new UI sentence (id t48ba72e7) x 4 translations, already written in the patch
- Tests: Run on the patched e02b95e tree: consistency 66, live 20, dated 24, farm-seasons 24, hero 74, messages 173: all pass. Page-clock check: packages, shop block and Reserve now show on 2026-10-10 only; the off-season line shows from 2026-11-20 to 2027-03-01; the tree headline shows on 2026-12-01 only (same as unpatched). No test needs a change
- Patch: patches/optional/winter-A-hide-fall-booking.patch

**B. Keep them with a note: these are fall prices**

- Apply patches/optional/winter-B-fall-prices-note.patch (source files only; then rebuild).
- What it does: one note line before "Reservation packages" (shown in winter, spring and summer): "These are the fall 2026 prices and times. New ones come later." Nothing is hidden.
- Rebuild and check translations as in A.
- The sentence says "2026": it must change when d24 gets the 2027 details.
- Strings: 1 new UI sentence (id t8e365ded) x 4 translations, already written in the patch
- Tests: Run on the patched e02b95e tree: consistency 66, live 20, dated 24, farm-seasons 24, hero 74, messages 173: all pass. Page-clock check: the note shows from 2026-11-20 to 2027-03-01, not on 2026-10-10. No test needs a change
- Patch: patches/optional/winter-B-fall-prices-note.patch

**C. Leave it as it is now**

- Nothing to apply: this answer means "change nothing more". The Christmas tree wording is already fixed: it is in-season-only since b54427b (commit e081393): the headline "Wise Acres Christmas trees", the "Trees" chip and "Christmas trees are here." show only from the Friday after Thanksgiving to December 8 (data-in-season; js/hero.js at `function applyOnly(` and `$$('#hero-h > [data-only]')`). Checked with a page clock on the unpatched tree: tree headline on 2026-12-01 only; 2026-11-20, 2026-12-20, 2027-01-20 and 2027-03-01 show "Organic u-pick fun for the whole family".
- Do NOT apply the patch winter-C.patch (it is stale and does not apply any more). A naive rebase (tree headline first in the h1) is wrong: js/hero.js at `$$('#hero-h > [data-only]')` shows the FIRST title between seasons, so the tree headline would show all winter. Tested and rejected.
- What stays wrong with C alone: from the Nov 9 gap to March the Visit and Shop areas still show "Fall 2026" prices and "Reserve now" (see A and B).
- Strings: 0
- Tests: none to run: no file changes

### d09. The GreenHouse winter hours

- In plain words: The site shows Friday to Sunday, 10 to 8, all year.
- Doc question: Q37 (second part) and Q17 (hours)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. A until she says otherwise.
- Depends on: d01 (C: trees are sold at The GreenHouse in winter), d08 (Thursday window is the same code), d23.

**A. Same all year**

- No change.
- Strings: 0
- Tests: none

**B. Different hours: I will send them**

- Code change (ask Claude, no patch on disk): js/content.js at `greenhouse: {` and `// Wise Pie at The GreenHouse` has one Friday-Sunday window all year; separate winter hours need a second window and the "Closed today. Opens Friday at 10 am" line.
- Text: index.html at `data-t="tb55a6fd9"`, `data-t="tfb71e468"`, `data-t="tb4c1e6ac"` and `data-t="ta38e4092"`, "Fall hours:" index.html at `data-t="t17246313"`, pages/wise-pie.html at `Fall hours are Friday through Sunday` and the description (pages/wise-pie.html at `description:`, a JS string).
- Strings: 4 to 6 ids + 1 JS string x 4 translations
- Tests: consistency MUST follow: "time: The GreenHouse open hours" and "days: The GreenHouse and Wise Pie there" (tests/consistency.test.mjs from `time: The GreenHouse open hours` to `days: The GreenHouse and Wise Pie there` read the text and js/content.js); live

**C. Closed some months: I will say which**

- Same code and text changes as B, with a "closed from ... to ..." window and wording. Christmas trees are sold at The GreenHouse from the Friday after Thanksgiving to December 8 (js/season.js at `{ id: 'winter'`): say what shows when it is closed.
- Strings: 4 to 8 ids x 4 translations
- Tests: consistency (as B), live, dated

### d23. Is the farm open after November 8?

- In plain words: The "No pizza" box says open all of October and November, but the rest of the site says fall ends November 8. One of them is wrong.
- Doc question: none (doc Q17 is about weekly hours, not the fall end date)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. If she cannot say by Nov 1, B (it promises less).
- Depends on: d01/d25 (the gap after fall: November 9 onward), d24 (2027 dates), d27 (school tours banner). The Reserve window and "Tell me when it opens" follow js/season.js.

**A. Open until Nov 30: I will change the end date**

- js/season.js at `{ id: 'fall'`, fall end: new Date(y, 10, 8) -> new Date(y, 10, 30). Warning: winter starts the Friday after Thanksgiving (Nov 27, 2026, js/season.js at `{ id: 'winter'`), so the two seasons overlap for 4 days. Decide what shows then (ask Claude).
- Words "early November" become "late November" (say early, mid or late: the year-bar check and the season-words check of consistency read those words, and "end of November" is not one of them): index.html at `data-t="t9f9dedc8"`, `data-t="t7ad569b7"`, `data-t="t21bf1cf8"`, `data-t="t38bfb02d"` and `data-t="t6fa474da"`, and pages/pumpkin-patch.html at `class="hand hero-kicker"` and `Pumpkin picking usually runs` (7 ids: t21bf1cf8, t38bfb02d, t6fa474da, t7ad569b7, t86e21495, t9f9dedc8, tebb43b26).
- Last pizza weekend row "Oct 30-Nov 8" (index.html at `data-release="2026-10-27"`, data-until="2026-11-08") if more weekends follow; the "No pizza" block (index.html at `<div data-until="2026-11-30">`) already says November.
- The year bar next to that sentence ends too early for "late November": in index.html at `--s:8.45;--e:10.25` change `--e:10.25` to `--e:10.9` (months count from 0 = January 1, so 10 is November 1; "late November" must end between 10.62 and 11.05). The README rows follow the same text.
- Strings: about 7 to 9 ids x 4 translations
- Tests: consistency: tests/consistency.test.mjs at `Mid-September through early November` builds the fall words from js/season.js, so it expects the new text: in that line change the regex `/(Mid-September through early November)/i` to `late November`; dated: tests/dated.test.mjs pins the pizza rows and the "No pizza" box (dated from `const ROW =` to `const ECD =`, and from `at('2026-11-02T12:00:00-05:00')` to `is gone as well`); it passes without a change when only the end date and the words change (tried), so redo those dates only if you also change the rows or the box; farm-seasons and hero may react to the new end date, run them

**B. Fall ends Nov 8: fix the pizza box**

- Fix the "No pizza" box: index.html at `<div data-until="2026-11-30">`: data-until="2026-11-30" -> "2026-11-08", and the sentence index.html at `data-t="tb848cce7"` ("Open for all of October and November.") -> for example "Open through November 8".
- js/season.js stays as is.
- Strings: 1 id x 4 translations
- Tests: dated: tests/dated.test.mjs at `const NOPIZZA =` (selector data-until="2026-11-30"), `Nov 9: "No pizza` (Nov 9 line) and `Dec 1: "No pizza` (Dec 1 line) must follow the new date

### d50. Christmas tree dates at The GreenHouse

- In plain words: The site says trees are sold at The GreenHouse from the Friday after Thanksgiving (November 27) to early December, and the page switches the tree wording off on December 8. We have not heard the end date from you.
- Doc question: Q12
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. The tree wording is already in-season-only (commit e081393). The end date ("early December", December 8 in the code) is the one part nobody confirmed in writing.
- Depends on: d01 (what winter shows), d09 (GreenHouse hours in winter), d54 (tree price), d51 (hours).
- Note: Old Q37 asked this as its third part ("when do you stop selling Christmas trees?"); the dashboard had no question for it.

**A. Those dates are right**

- No change.
- Strings: 0
- Tests: none

**B. Different dates (I will send them)**

- js/season.js at `{ id: 'winter'`: the start (thanksgivingFriday) and the end (new Date(y, 11, 8)).
- The words "Friday after Thanksgiving to early December" in 8 sentences: index.html at `data-t="t0e76cb0a"`, `data-t="t28844e2e"`, `data-t="t4503c39b"`, `data-t="t493369ae"`, `data-t="t53cf41e8"`, `data-t="t5ecd6fe5"`, `data-t="t8f55ff30"` and `data-t="tf0d0193a"` x 4 translations. README.md row "Christmas trees". Use the word that fits the end day: early is day 1 to 10, mid 11 to 20, late 21 and later (Dec 8 is early, Dec 22 is late). The year bar beside the first sentence ends where the words say: in index.html at `--s:10.85;--e:11.3` the end `--e:11.3` is early December; for mid-December use `--e:11.5`, for late December `--e:11.9` (months count from 0 = January 1).
- Strings: 8 UI ids x 4 translations
- Tests: consistency MUST follow, in two places that read "early December" against js/season.js. The words check: tests/consistency.test.mjs at `winterEnd.month === ` holds "Friday after Thanksgiving to early December" and `half(winterEnd) === 'early'`: write your word and its half there (they must fit the end day in js/season.js, as above). The year bar check: tests/consistency.test.mjs at `(december)/.exec(words)` reads `/early (december)/` and lets the bar end between 11.0 and 11.34: write `/late (december)/` and `[11.6, 12.1]` for late December (`/mid (december)/` and `[11.3, 11.7]` for mid-December); hero at `Dec 1 and Dec 20 are winter` (the switch to winter); dated

**C. No trees this year**

- Remove the tree wording: 19 UI ids mention Christmas trees (x 4), the winter hero headline "Wise Acres Christmas trees" (index.html at `id="hero-h"`), the "Trees" chip (index.html at `data-t="t01cba258"`), the winter season panel, the calendar bar (index.html at `data-t="t0e76cb0a"`), the Shop row (index.html at `data-t="t53cf41e8"`), the crop "trees" in js/features.js, and the tree FAQ (index.html at `data-t="t5ecd6fe5"`). Ask Claude. Check d01 (what winter shows then).
- Strings: about 19 UI ids (unused after removal)
- Tests: farm-seasons MUST change: tests/farm-seasons.test.mjs at `Christmas trees only in winter`; consistency from `const MONTHS = '(january` to `winterEnd.month === 'December'`; hero (winter checks); dated

### d51. Are the fall opening hours right?

- In plain words: The open-now badges and many lines say: farm visits Thursday to Sunday, Wise Pie at The GreenHouse 4 to 8 pm, and pizza at the farm 10 am to 4 pm. If one is wrong, visitors arrive at a closed door.
- Doc question: Q17
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. The hours came with the farm's wording; the README only asks her to check them against real life.
- Depends on: d09 (the GreenHouse's own hours, all year), d08 (Thursday night), d23 (fall end date), d50 (tree season).
- Note: Old Q17 had four hours in one question: three are here, the GreenHouse's 10 am to 8 pm is d09.

**A. All of these are right**

- No change. README.md: delete the row "Open-now badges".
- Strings: 0
- Tests: none

**B. Some are wrong (I will send the right hours)**

- Hours and days are set in js/content.js at `hours: {` (greenhouse, pizza, farm). The text follows: about 25 sentences, for example index.html at `data-t="tb55a6fd9"`, `data-t="t1c41eab2"`, `data-t="tfb71e468"`, `data-t="t86f09bf0"`, `data-t="tb4c1e6ac"`, `data-t="t4ffa359f"` (the hours in the "ways to get pizza" table) and `data-t="ta38e4092"`; pages/pumpkin-patch.html at `Wood-fired pizza with homemade dough`; pages/wise-pie.html at `description:`, `<span class="way-time">10 am`, `<span class="way-time">4 pm` and `At The GreenHouse, no.`, and the week strips (data-days: index.html at `data-ta-aria-label="t230f8c2d"` and `data-ta-aria-label="t97f22abe"`). The regexes in tests/consistency.test.mjs from `time: The GreenHouse open hours` to `CONTENT.hours.greenhouse.days` find every place.
- Same code change as d09 if the hours differ by season.
- Strings: up to 25 UI ids x 4 translations
- Tests: consistency MUST follow: the hours and days facts (tests/consistency.test.mjs from `time: The GreenHouse open hours` to `CONTENT.hours.greenhouse.days`) read the text and js/content.js; live MUST follow: tests/live.test.mjs at `Pizza at 6 pm: open until 8 pm` says the pizza closes at 8 pm (change the time in its name and in the expected words) and tests/live.test.mjs at `Fri 11:30 ET: The GreenHouse is open until 8 pm` says the same for The GreenHouse; dated

### d24. Fall 2027 prices, schedule and menu

- In plain words: The Fall 2026 prices, schedule and menu stay on the site all year. From August 2027 they would look like this year's.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: B now (it is d01 A), but A before about August 12, 2027: that is when the site switches back to fall and the 2026 prices show again.
- Depends on: d01 (B = winter A), d23 (end date), d02 (corporate prices have no year), d16 (package price).

**A. I will send the 2027 details**

- When she sends the 2027 details, replace the 2026 data. Places: header "Fall 2026" index.html at `Reservation packages (Fall 2026)`, `data-t="t14925fb1"`, `data-t="t65d35823"`, `data-t="t5e315551"`, `data-t="t9cc44765"` and `data-t="t7f10df40"`; the packages and add-ons (index.html from `Reservation packages (Fall 2026)` to `data-t="te7f1d0c8"`); the schedule and pizza table index.html from `id="schedule"` to `data-t="t58da3033"` (data-release and data-until dates); special days index.html at `<div class="side-note" data-until-empty>`; the Shop index.html from `data-t="t5e315551"` to `data-t="t9cc44765"`; pumpkin page pages/pumpkin-patch.html from `<h3>Fall 2026 prices</h3>` to `Prices are for fall 2026 and can change.`, and `For fall 2026, farm fun without pizza`; the printed menu picture assets/photos/wise-pie-fall-menu-2026.webp (index.html at `data-t="tf8e1e093"`).
- README: update the content rows and the "year of the fall prices" wording.
- Strings: about 7 ids with "Fall 2026" + every changed price/date line, x 4 translations
- Tests: consistency: the fact "year of the fall prices, menu and schedule" (tests/consistency.test.mjs at `year of the fall prices`, min 9) and the price facts; dated: tests/dated.test.mjs hard-codes the 2026 rows and special days: rewrite for 2027

**B. Hide fall content between seasons**

- Same as d01 option A: apply patches/optional/winter-A-hide-fall-booking.patch. Fall blocks are hidden while another season is on screen: the 2026 prices stop showing from Nov 9 until the site switches back to fall, about August 12 (checked with a page clock: hidden on 2027-08-11, shown on 2027-08-13). Then the 2026 prices show again, so send the 2027 details (option A) before that date.
- Not covered: the pumpkin page (pages/pumpkin-patch.html from `<h3>Fall 2026 prices</h3>` to `Prices are for fall 2026 and can change.`, and `For fall 2026, farm fun without pizza`).
- Strings: 1 new sentence x 4 (see d01)
- Tests: as d01 A
- Patch: patches/optional/winter-A-hide-fall-booking.patch

**C. Keep as is**

- No change. The site keeps showing Fall 2026 until August 2027.
- Strings: 0
- Tests: none

### d25. Reserve buttons when nothing can be booked

- In plain words: Reserve buttons show in the gaps between seasons (for example November 9 to 17 and February 10 to April 14).
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A, but it only fixes the spring gap. With d01 A the winter buttons are hidden anyway.
- Depends on: d01 (A hides the Visit-area button in winter), d23 (the fall end date decides the November gap).

**A. Hide them out of season**

- Apply patches/optional/reserve-window.patch (optional patch). Files: css/styles.css, index.html, js/hero.js, pages/strawberry-picking.html (then python3 tools/pages.py).
- What it does: the buttons marked data-book show only inside the booking window the site's own words give: strawberry (spring) buttons from 3 weeks before the season starts (about March 25) to its end. Summer and fall state no window, so their buttons are never hidden by it (the November 9 to 17 gap stays).
- Phone bar keeps its buttons evenly spaced (data-count).
- Strings: 0
- Tests: hero, farm-seasons (run them)
- Patch: patches/optional/reserve-window.patch

**B. Keep them**

- No change.
- Strings: 0
- Tests: none

### d26. When are cut flowers available?

- In plain words: The text says April to July and September to first frost. The "This week" box drops flowers June 8 to 14 and July 11 to August 31.
- Doc question: none (doc Q19 asks flower prices and Q13 the blueberry and sunflower season, not the flower months)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. A is the cheap one (no words change) if April to July is right.
- Depends on: d23 (fall end 11/8 is the end of the September window), d24.

**A. The text is right**

- js/features.js at `{ id: 'flowers'` (crop "flowers", wins): make it one window April to July: [[new Date(y, 3, 15), new Date(y, 6, 31)], [new Date(y, 8, 1), new Date(y, 10, 8)]]. Today it follows spring (4/15-6/7) and summer (6/15-7/10), so there are holes.
- The text stays: index.html at `data-t="tb15f8314"`, `data-t="tad408a60"`, `data-t="ta7a386b9"` and `data-t="t4c712247"`, and pages/pumpkin-patch.html at `Cut your own bouquet in the flower field` (ids t4c712247, ta7a386b9, tad408a60, tb15f8314, tc5aa3586).
- Strings: 0
- Tests: features (the auto in-season case: tests/features.test.mjs at `auto: pumpkins, tomatoes, flowers in season`), farm-seasons

**B. The This week box is right**

- Change the 5 sentences (same lines as A) to what the box shows (flowers only during spring and summer picking and from September).
- Strings: 5 ids x 4 translations
- Tests: consistency MUST follow: the year bar (index.html at `--s:3;--e:7`, April to July) is read by tests/consistency.test.mjs at `/^april.*`: the words `july and september` and the end `[7 - 0.1, 7 + 0.1]` on that one line name the last month (months count from 0 = January 1, so June is 6). Write the new month in both, and in the bar change `--e:7` to the new number. Say it the way the bar says it, "April to June and September through first frost", or the check cannot read the words

**C. Neither: I will say the months**

- Both: she gives the months; js/features.js at `{ id: 'flowers'` and the 5 sentences change to them.
- Strings: 5 ids x 4 translations
- Tests: features (auto case), farm-seasons

### d27. School tours banner

- In plain words: "Traditional Fall School Tours - Now booking" shows all year.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A (the banner says "now booking" in the months when nobody can).
- Depends on: d23/d24 (the real fall dates), d36 (school tour rules).

**A. Hide it out of season**

- index.html at `data-t="td727517c"` (tab text "Now booking") and index.html at `data-t="t61e401ae"` (badge "Traditional Fall School Tours - NOW BOOKING"): add data-only="fall" (add data-in-season to hide it also before September 13 and after November 8). The mechanism is js/hero.js from `// data-only="fall winter"` to `$$('[data-only]')`.
- pages/school-field-trips.html at `class="hand hero-kicker"` says "Traditional fall school tours" (no booking word): leave it.
- Strings: 0
- Tests: none (no test names the banner)

**B. Keep it all year**

- No change.
- Strings: 0
- Tests: none

### d60. Closed Sunday, October 4 for rain?

- In plain words: The home page pizza note says the farm will probably be closed on Sunday, October 4 for rain, but the "Open now" badges would still say open that day until a closure is entered.
- Doc question: Q55
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only she knows. The answer is needed before Sunday morning.
- Depends on: none.
- Note: Asked on 3 October 2026, the day before. Checked in a browser on 3 October 2026: on Sunday, October 4 at 11 am the badges say "Open now". After October 4 the question is over (the pizza note hides itself after that day) and the same steps serve any later rain day.

**A. Yes, closed (put it on the site)**

- js/content.js at `closures: [],`: write `closures: ['2026-10-04'],`. The farm, The GreenHouse and Wise Pie then show as closed that day (README row "Close for rain or a holiday").
- The bar at the top of every page: js/content.js at `notice: '',` and `noticeUntil: '',`: write the notice as { en, es, hi, zh, vi } (English: "Closed Sunday, Oct 4, for rain.") and `noticeUntil: '2026-10-05',`. The bar has no start date, so the date goes in the words. Ask Claude for the four other languages.
- The pizza note: index.html at `data-t="t58da3033"`: change "Unless the forecast changes a lot, we'll be closed that day for rain." to a plain "We are closed that day for rain." It hides itself after October 4 (its data-until).
- Bookeo: close the Sunday times there too. The site cannot stop people booking.
- Strings: 1 id (t58da3033) x 4 translations (the notice words are in js/content.js, not in the translation files)
- Tests: dated, live (the closed badges); the "Site check" box names a closure date it cannot read

**B. No, we are open**

- No change to js/content.js. If the sentence about rain in the pizza note should go: index.html at `data-t="t58da3033"`. The note hides itself after October 4 anyway.
- Strings: 0 (the shorter sentence, "Open now: pizza reservations for Oct 2 & 3.", translates itself; 1 id x 4 translations if the rain sentence is reworded in another way)
- Tests: none

**C. Not decided yet (I will tell you later)**

- No change. She can write the date herself when she knows: README row "Close for rain or a holiday" has the one line. Until then nothing hides the badge.
- Strings: 0
- Tests: none

### d66. Stop saying "new this year" from January?

- In plain words: The "New this year" ribbon hides itself after December 31, 2026 (the "New" chip and badge already hide on October 31). Eight other places still call the tomatoes and basil new, and the red dot on the Tomatoes link comes back every fall.
- Doc question: Q61
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d48 (u-pick tomatoes this fall: if they are removed this question is gone), d24 (fall 2027 content).
- Note: Due before 1 January 2027. The eight places: the fall hero line, the "New:" line in the Fall panel list, the add-on note, the pumpkin text, the calendar row, the season list, the FAQ answer and the pumpkin page. The ribbon, the chip and the "New" badge carry a last day, so they need no edit. The red dot is a fall-only rule in css/sections.css.

**A. Stop calling them new from January 1 (words and red dot)**

- Change the words in index.html at `data-t="td6ecd1d8"` (fall hero line, "plus new u-pick ..."), `data-t="t1c989256"` (the "New:" line in the Fall panel list), `data-t="tedce5b9f"` (add-on note), `data-t="tbc119a85"` (pumpkin text), `data-t="t4eb3e326"` (calendar row), `data-t="t247dcbc5"` (season list) and `data-t="t398007b0"` (FAQ answer "Yes, and it's new this year!"), and in pages/pumpkin-patch.html at `New this year. Certified organic cherry tomatoes` (the rebuild copies it to the generated pumpkin-patch page).
- The red dot: delete the rule css/sections.css at `html[data-season="fall"] .nav-tomato a::after` (and the class on index.html at `class="nav-tomato"` can stay).
- The ribbon (index.html at `data-t="tbaeea389"`) hides itself after its last day, index.html at `data-until="2026-12-31"`; the chip (index.html at `data-t="t30661b0e"`) and the "New" badge (index.html at `data-t="tddae9ce2"`) hide themselves after index.html at `data-until="2026-10-31"` (2 places).
- Strings: 8 ids x 4 translations (7 in index.html, 1 for the pumpkin page)
- Tests: farm-seasons, consistency, languages, i18n; hero looks for the "New" tomatoes chip (hero at `fall: the "New tomatoes" chip shows`), which hides itself after the last day

**B. Keep saying new (I will say until when)**

- Change the last day in index.html at `data-until="2026-12-31"` (the ribbon) and `data-until="2026-10-31"` (2 places: the chip and the "New" badge) to her date. The eight sentences and the red dot stay as they are.
- Strings: 0
- Tests: none

**C. I will decide in December**

- No change now. Everything in A is due before 1 January 2027.
- Strings: 0
- Tests: none

### d68. Sunflower badge only works on big screens

- In plain words: The Sunflower Whisperer badge needs 100 snipped sunflowers, but only 5 are drawn, at the far edges of the picture. In a browser at 1440 pixels wide 4 of them are fully in view; at 390 pixels none is.
- Doc question: Q63
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d69 and d70 (the same game code, js/hero.js); d34 (the sunflower photos are a separate question).
- Note: Checked in a browser on 3 October 2026 (summer picture). The game fixes and the game test (tests/games.test.mjs) are already in the tree; the optional patch games-B-pick-snips-sunflowers.patch goes on top of them.

**A. Let the Pick button snip sunflowers too**

- The optional patch games-B-pick-snips-sunflowers.patch (see "Patches on disk"): in summer every fourth press of the "Pick a blueberry" button snips a sunflower (js/hero.js at `btnEl.addEventListener('click'`), and a snipped sunflower grows back in 3 to 5 seconds instead of 7 to 11 (js/hero.js at `7000 + Math.random() * 4000`). Phones and keyboards can then earn the badge.
- Strings: 0
- Tests: hero, touch; games (the patch adds one part to it)

**B. Lower the 100 for sunflowers (I will say the number)**

- js/hero.js at `sunflower: { icon: 'sunflower', at: 100`: her number. The badge text says the number too: js/hero.js at `100 sunflowers snipped!`.
- Strings: 1 JS string x 4 translations (the English text is the key in lang/src/<code>.json; python3 tools/i18n.py jsstrings first)
- Tests: hero; games (it counts 99 and 100 for every badge, so it needs the new number)

**C. Draw 2 or 3 sunflowers in the middle**

- Ask Claude: js/hero.js at `sunflower(24, 205, 128, '')` is the first of the five (two on the left edge, three on the right); add two or three in the middle of the picture, away from the berry rows. A drawing change; they must also be tappable on a phone.
- Strings: 0
- Tests: hero, touch, visual-check; games

**D. Leave it as it is now: big screens only**

- No change.
- Strings: 0
- Tests: none

### d69. "Every tree is lit!" appears too early

- In plain words: In winter each tap lights one of 22 trees (or sparks a fire). At the 12th light the message says "Every tree is lit!" while at least 10 trees are still dark.
- Doc question: Q64
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d68 and d70 (the same game code, js/hero.js), d01 (what visitors see in winter).
- Note: Checked in a browser on 3 October 2026 (winter picture, 22 trees and 2 fires). The messages are by count: at 1 "Ooh, twinkly!", at 3 "You're a natural decorator.", at 6 "The whole farm is glowing! Real trees are at The GreenHouse.", at 12 "Every tree is lit! Bring the family to The GreenHouse.". A fire spark counts like a lit tree, so a count of 22 does not always mean 22 lit trees.

**A. Say it only when all 22 trees are lit**

- Ask Claude: in js/hero.js at `Every tree is lit!` the message list is chosen by the count of taps; make this last message depend on the number of lit trees instead (the 22 trees are the winter picture's trees).
- Strings: 0
- Tests: hero (winter part); games

**B. Change the words so they are true at 12**

- Change the English in js/hero.js at `Every tree is lit!` (the whole sentence is "Every tree is lit! Bring the family to {gh}."; keep {gh}, it becomes The GreenHouse). Then python3 tools/i18n.py jsstrings, the four translations in lang/src/<code>.json, python3 tools/i18n.py build.
- Strings: 1 JS string x 4 translations
- Tests: hero, i18n, languages; games

**C. Leave it as it is now**

- No change.
- Strings: 0
- Tests: none

### d70. Badge pop-up covers a note on small phones

- In plain words: On a very small phone (320 pixels wide) the "Achievement unlocked" badge sits over the "No reservation? Visit The GreenHouse" note for 6 seconds. It has a close button.
- Doc question: Q65
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d68 and d69 (the same game code).
- Note: Checked in a browser on 3 October 2026 at 320 x 568: the badge overlaps the note and the status line under it (for example "Closed today"); it was gone after 6 seconds. The badge for 1,000 picks stays about 11 seconds.

**A. Leave it as it is now**

- No change.
- Strings: 0
- Tests: none

**B. Move the badge so it never covers the note**

- Ask Claude: css/extras.css at `.ach-stack{position:absolute;left:0;bottom:calc(100% + 14px)` puts the badge just above the picker, and `@media (max-width:47.5em){.ach-stack{bottom:calc(100% + 10px)}` is the phone version. The note is index.html at `data-t="t854933db"`. A layout change for phones only.
- Strings: 0
- Tests: hero, touch, visual-check; games (a badge fits a 320 px screen in the longest language)

## Topic 6. Rules and promises to visitors

Urgency: wrong or risky information.
Cancel fee, service animals, school-tour minimum, parking: what visitors will hold the farm to.

### d41. Cancel fee on the strawberry page

- In plain words: The home and first-visit pages say a 3 percent card fee is kept when you cancel. The strawberry page rain policy does not mention it.
- Doc question: none
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A (same booking system, same fee; two pages promise it and the third is silent).
- Depends on: d42 is a similar policy sentence. The text exists in index.html at `data-t="t40668596"` and pages/first-visit.html at `<li>If you cancel by then` (2 places: the "Changes and rain" card and the FAQ).

**A. Add the 3 percent fee line**

- pages/strawberry-picking.html at `<summary>What is your rain policy?</summary>` (the FAQ and its answer): add the sentence "If you cancel by then, we refund the cost of your reservation, minus the 3% credit card processing fee" (the wording of index.html at `data-t="t40668596"`). The answer is id t0e3c1f6e. The rebuild copies the answer into the page data.
- Strings: 1 changed answer x 4 translations (the 3% stays in each)
- Tests: consistency: "price: refund fee" (tests/consistency.test.mjs at `price: refund fee`, min 3) stays satisfied; its translation check pins the 3%

**B. Leave it out there**

- No change.
- Strings: 0
- Tests: none

### d42. Service animals

- In plain words: The FAQ says service animals are welcome. The photography section says animals are not permitted but registered service dogs should contact you in advance. The Chinese and Vietnamese say "service dogs", which is narrower.
- Doc question: none
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. In the US a business may not require advance notice for a service dog (ADA); confirm with her or a lawyer.
- Depends on: d10 (the lawyer question in the doc, Q43, could cover this), d37 (zh and vi wording).

**A. Service animals welcome, no notice needed**

- Photography line: index.html at `data-t="te75a4809"` ("Animals are not permitted on the farm. If you have a registered service dog, please contact us in advance") -> same wording as the FAQ without the notice. 1 English sentence x 4 translations.
- Chinese and Vietnamese: all 8 ids that mention service animals or dogs say "service dog" (zh 服务犬, vi chó phục vụ): t02ff16ba, t168a0beb, t29a8b135, t775b3737, ta2d4eb0f, tbb0c8591, tf13be67c (index.html at `data-t="t02ff16ba"` and `data-t="ta2d4eb0f"`; pages/first-visit.html at `Leave pets at home`, `Unfortunately, pets must stay home`, `<h3>Service animals</h3>`, `Pets stay home because` and `Unfortunately, no. We love dogs`; pages/pumpkin-patch.html at `Unfortunately, no. Because of liability`) and te75a4809 (the photography line). Change the zh and vi values to "service animal" in lang/src/zh.json and lang/src/vi.json (English unchanged), then python3 tools/i18n.py build.
- Strings: 1 English sentence (id te75a4809) x 4, plus 14 zh and vi values reworded in the 7 other ids (no new English)
- Tests: consistency: policy fact "pets stay home, service animals are welcome" (tests/consistency.test.mjs at `pets stay home, service animals are welcome`) still holds

**B. Ask for notice in advance**

- Keep "ask for notice" and say it everywhere: add "please contact us in advance" to the 5 "welcome" sentences: index.html at `data-t="ta2d4eb0f"` and pages/first-visit.html at `Unfortunately, no. We love dogs` (one id, ta2d4eb0f), pages/first-visit.html at `Leave pets at home` (tbb0c8591), `Unfortunately, pets must stay home` (tf13be67c) and `Pets stay home because` (t775b3737), pages/pumpkin-patch.html at `Unfortunately, no. Because of liability` (t168a0beb). The short labels "No dogs / Service animals only" (index.html at `data-t="t02ff16ba"`) and "Service animals" (pages/first-visit.html at `<h3>Service animals</h3>`) can stay. Make the photography line (te75a4809) say "service animal" not "registered service dog".
- The zh and vi wording fix of option A applies here too.
- Strings: 5 to 6 English ids x 4 translations
- Tests: consistency at `pets stay home, service animals are welcome` (keep the phrases "pets stay home" / "No dogs"; the regex looks for them)

### d52. Does Cathy's email get answered?

- In plain words: The site tells visitors to email cathy@wiseacresorganic.com with questions, for waitlists and for help with strollers or wheelchairs, in more than a dozen places. If nobody reads it, visitors wait for an answer that never comes.
- Doc question: Q30
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Only she knows who reads that mailbox.
- Depends on: d55 (accessibility text says "email Cathy"), d03 (the school tour email is vanessa@), d04 (a phone number could be the other way to ask).
- Note: Old Q21 (waitlist) is dropped: the "Spots left" box is hidden until she fills in the week, and the README already says not to mark a day full unless someone answers.

**A. Yes, it is read and answered**

- No change.
- Strings: 0
- Tests: none

**B. Use a different email (I will send it)**

- Replace cathy@wiseacresorganic.com: index.html at `cathy@wiseacresorganic.com` (19 places, one of them in the structured data); pages/first-visit.html at `cathy@wiseacresorganic.com` (2 places); js/features.js at `const WAITLIST =` (waitlistEmail default, also used by the messages feature); js/content.js at `waitlistEmail: 'cathy@` (comment); README.md. Rebuild (python3 tools/pages.py).
- 6 UI ids contain the address itself (t37c5399a, t4a984489, t716fd5fb, t9777fabc, td6a5d444, teeb109de) x 4 translations. Three more say "Cathy" in words only (t7c90f595, td03021c9, tf8daf32f): change them only if someone else answers the mail.
- Other addresses are separate: vanessa@ (school tours, index.html at `data-t="t3bad8e6f"`) and ava@ (pizza questions, index.html at `data-t="t44148f05"`).
- Strings: 6 UI ids x 4 translations
- Tests: messages: tests/messages.test.mjs at `the waitlist link is a mailto: to the farm` and `an address the owner typed with a + in it` name cathy@; features at `full day offers the waitlist` (waitlist mailto); consistency (emails in the translation check)

### d55. Strollers, wheelchairs and farm paths

- In plain words: The First visit page only says the fields may have irrigation lines, stakes and equipment, and asks people to email. A visitor with a stroller or wheelchair gets no real answer about the paths, quiet times or baby changing.
- Doc question: Q29, Q31
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner facts, and accessibility facts must not be guessed.
- Depends on: d52 (the card says "email Cathy"), d35 (parking and entrance are in the same planning cards), d42 (service animals are on the same page).
- Note: Old Q29 and Q31 are merged into this one.

**A. Strollers and wheelchairs are fine in the fields**

- pages/first-visit.html at `id="strollers"` (the "Strollers & wheelchairs" card, id t7af61a2b): add the sentence in her words, for example that strollers and wheelchairs can use the fields, then rebuild (python3 tools/pages.py). The intro (pages/first-visit.html at `Here is what we can tell you today`, id td03021c9, "Email Cathy") can stay.
- Strings: 1 id x 4 translations
- Tests: none pinned; i18n and languages after the rebuild

**B. Not suitable in the fields (I will explain)**

- Same card (pages/first-visit.html at `id="strollers"`): say what is not suitable and what visitors can do instead (for example the shaded picnic patch and the accessible toilet, pages/first-visit.html from `<h3>Porta-johns` to `<h3>Service animals</h3>`).
- Strings: 1 to 2 ids x 4 translations
- Tests: none pinned

**C. I will describe the paths and facilities**

- Add a card "Paths and quiet times" next to it (after the card pages/first-visit.html at `id="strollers"`): path surface and slope, when the farm is quieter, baby changing. Update the README row "Accessibility & comfort".
- Strings: 3 to 5 new ids x 4 translations (title and sentences)
- Tests: none pinned; i18n and languages

### d44. Corn pit: buy one get one free on Thursdays

- In plain words: The site says buy one, get one free on Thursdays with a reservation. It does not say who gets the free one.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only she knows who gets the free one. Until she answers, the words stay as they are.
- Depends on: d45 (who counts as a child), d43 (the corn pit is one of the farm words that need a plain line).
- Note: "With a reservation" is already on the site, so that part is settled (the first version of this question had an option for it; it was removed). The $4 per person price is not part of this question. The offer is written in three places: index.html at `data-t="t810fb0e4"` (the note under the add-ons), index.html at `data-t="t4937889a"` (the corn pit line in the price list) and pages/pumpkin-patch.html at `Buy one, get one free on Thursdays with reservations.` (the corn pit line in the pumpkin page price list; its id is tbbe8a55a).

**A. Free for every child with a paying adult**

- Say it in all three places. The wording is hers to approve; for example: "On Thursdays, every child with a paying adult gets into the corn pit free, if you have a reservation." (index.html at `data-t="t810fb0e4"`) and "Every child with a paying adult is free on Thursdays with reservations." (index.html at `data-t="t4937889a"` and the small line in pages/pumpkin-patch.html at `Buy one, get one free on Thursdays with reservations.`). Then rebuild (python3 tools/pages.py and the translation steps in "The standard steps").
- Strings: 3 English sentences (t810fb0e4, t4937889a, tbbe8a55a) x 4 translations. The word for "child" must be right in each language.
- Tests: none pinned on these sentences. consistency at `price: corn pit, per person` still reads the $4 sentences, which do not change. i18n and languages after the rebuild.

**B. Free for any second person, child or adult**

- Same three places, saying that the second person is free whether child or adult; for example: "On Thursdays, the corn pit is buy one, get one free for any two people, child or adult, if you have a reservation." (index.html at `data-t="t810fb0e4"`) and "Buy one, get one free on Thursdays with reservations. The second person is free, child or adult." (index.html at `data-t="t4937889a"` and pages/pumpkin-patch.html at `Buy one, get one free on Thursdays with reservations.`). The words now on the site can already be read this way; this option makes it explicit.
- Strings: 3 English sentences x 4 translations
- Tests: as in A

**C. I will explain**

- She sends the rule in her own words (for example one free child per paying adult, or only on certain Thursdays). Put it in the same three places and keep them identical in meaning.
- Strings: 3 English sentences x 4 translations
- Tests: as in A

### d45. Who is free: ages 2 and under

- In plain words: The site says children 2 and under are free. Does that mean until the 3rd birthday? The wagon ride line already says ages 2 and younger ride free.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only she knows the rule. If she does not answer, nothing changes, which is the same as A.
- Depends on: d16 (the $3 field fee and the pizza package extra start at "ages 3 and up"), d02 (party guests: "Children age 2 and younger are free and do not count toward the total"), d36 (school tours: parents and siblings "ages 3 and older" pay the admission), d44 (what counts as a child on Thursdays).
- Note: Where the site says it now: "Children age 2 and younger are free" in index.html at `data-t="td4abc72c"` (the pizza package), `data-t="tf355075d"` (the field fee card), `data-t="t6d7bc03d"` (the price list) and `data-t="tc38820e6"` (party guests); pages/first-visit.html at `Children age 2 and younger are free` (1 place); pages/pumpkin-patch.html at `Children age 2 and younger are free` (2 places: the price list and the FAQ answer). "Ages 2 and younger ride free" (the wagon ride) is a separate line: index.html at `data-t="tb65a930a"` (2 places), pages/pumpkin-patch.html at `Ages 2 and younger ride free.` and the sentence in pages/first-visit.html at `ages 2 and younger ride free`.

**A. Free until their 3rd birthday**

- No change is needed: "age 2 and younger" next to "ages 3 and up" already means exactly this (a child is free until the day they turn 3).
- Optional, only if she wants it plainer for parents: write "Children under 3 are free" in the places listed in the Note. Then consistency MUST follow (see Tests): its age check reads the words "Children age 2 and younger are free".
- Strings: 0 if nothing changes; if the plainer words are used, 7 English sentences x 4 translations (ids t2531639c, t3a5391d6, t6d7bc03d, tc38820e6, td4abc72c, tf355075d, tfdad55ee)
- Tests: none if nothing changes. For the plainer words: consistency at `age: free (infants, wagon ride, party children)` (its minimum is 10; it reads "Children age N and younger are free", "Children N and under are free", "Infants N and under are free" and "Ages N and younger ride free", so it needs a new pattern for the new words).

**B. Free for infants under 12 months only**

- Children aged 1 and 2 then pay. Replace "Children age 2 and younger are free" with her words (for example "Infants under 12 months are free") in all the places in the Note, and change the age from which people pay to match (for example "ages 1 and up"): index.html at `data-t="t10ffb744"` (Field fee, ages 3 and up), `data-t="tf7203efa"` and `data-t="te9a8e62d"` (pizza package, "ages 3+"), `data-t="t6d7bc03d"` (the price list), `data-t="t6c80dbc4"` (school tours: parents and siblings ages 3 and older); pages/pumpkin-patch.html at `Ages 3 and up.`, `(ages 3+)` and `ages 3 and up`; pages/school-field-trips.html at `ages 3 and older` (2 places). Then rebuild.
- The wagon ride line ("Ages 2 and younger ride free") is a different rule: she must say whether it changes too (2 more English sentences: ids tb65a930a and tb77e4ad7).
- Strings: about 14 English sentences x 4 translations (ids t2531639c, t3a5391d6, t6d7bc03d, tc38820e6, td4abc72c, tf355075d, tfdad55ee, t041b0712, t10ffb744, t4d23e4b7, t6c80dbc4, t8763a833, te9a8e62d, tf7203efa); 2 more if the wagon ride changes
- Tests: consistency MUST follow: consistency at `age: free (infants, wagon ride, party children)` (give it a pattern for the new words; lower its minimum of 10 if fewer places say it; it also reads "Ages N and younger ride free", so if the wagon ride stays at 2 while the rest says 12 months it finds two answers: take `/[Aa]ges (\d+) and younger ride free/` out of that fact and give it a line of its own right under it, `{ id: 'age: free on the wagon ride', norm: num, min: 2, find: [/[Aa]ges (\d+) and younger ride free/] },`), `age: from this age people pay the field fee / school admission` (minimum 11: every place must say the same new number) and `days: farm visits without pizza (fall)` (it reads "Ages 3 and up" and "Field fee, ages 3 and up" before the days) and `days: farm visits with pizza` (its second pattern reads "(ages 3+)." after the price: change `\\(ages 3\\+\\)` to the new age). tools/check_facts.py at `Ages 3 and up` reads the same words for the $3 field fee.

**C. I will explain**

- She sends the rule in her words (for example free under 12 months, half price at 1 and 2). Change the same places as in B; the test notes of B apply.
- Strings: about 14 English sentences x 4 translations
- Tests: as in B

### d35. Parking and entrance

- In plain words: The site only says limited parking and shows the map. Visitors ask where to park and which entrance to use.
- Doc question: Q42 (the photo is Q34, not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A (one sentence from her; the most common visitor question).
- Depends on: d11 (the farm's exact spot should be where cars turn in), d39 (address wording in the same sentences), d12.

**A. I will send the parking and entrance details**

- She describes it. Add it to the Parking card (pages/first-visit.html at `id="parking"`), the lead sentence (pages/first-visit.html at `<strong>4701 Hartis Road</strong>`) and step 2 on the home page (index.html at `data-t="tf1ab0489"`). Photo and caption: js/content.js at `entrancePhoto: null,   // example` (steps in the comment: js/content.js from `is the picture on the First-visit page` to `entrancePhoto: { src:`).
- Farm map marks (parking, entrance): re-mark in the Farm Map Marker, then python3 tools/farm_map.py tools/saved-map.json (never edit js/farm-map-data.js by hand).
- README: delete the row "Entrance and parking".
- Strings: 3 changed sentences x 4 translations (+ caption x 4 if a photo is added)
- Tests: none pinned; gallery/i18n after the rebuild

**B. Keep it as is**

- No change.
- Strings: 0
- Tests: none

### d36. School tours for smaller classes

- In plain words: The page says minimum 100 students and nothing about one class of 25. A teacher with one class has no answer.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (price and rule). If no answer, B.
- Depends on: d02 (groups pricing), d27 (school tours banner), d03 (sign-up form).

**A. Smaller classes are welcome, send the price**

- Replace "Minimum group size: 100 students" in index.html at `data-t="t1b505e0c"`, pages/school-field-trips.html at `Minimum 100 students` and `The minimum group size for a traditional fall school tour` (FAQ answer, copied into the page data on rebuild). 4 ids contain "minimum": t1a6c99a0, t1b505e0c, t53653138, ta6c9295e.
- Add the price for a small class next to "$11 per student" (index.html at `data-t="tbf413318"`; pages/school-field-trips.html at `description:`, `<dd>$11 per student</dd>` and `School tours are $11 per student`).
- Strings: 4 to 8 ids x 4 translations
- Tests: consistency MUST follow: fact "size: smallest school group (students)" (tests/consistency.test.mjs at `size: smallest school group`, min 4, regexes "Minimum group size: N students", "Minimum N students", "minimum group size ... is N students"), and the school tour price fact "$N per student" (consistency at `price: school tour, per student`, min 7)

**B. Minimum stays 100 students**

- No change.
- Strings: 0
- Tests: none

### d43. What do your farm words mean

- In plain words: A first-time visitor cannot guess these: corn pit, barrel train, sunn hemp maze, Halfzies, Party Patch, u-cut, farm fun. One plain line from you for each, and the site can explain them.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes (only she knows what each word means on her farm)
- Default: none. If she does not answer, B: nothing breaks.
- Depends on: d07 (the maze line must use the name she picks), d44 (the corn pit line must agree with the Thursday offer), d02 (the Party Patch is the private party area in the group prices), d16 (farm fun is what both package prices include), d45 (ages).
- Note: All seven words are on the site today. A few sit next to a short line (the maze card says "Wander through our little maze on fall visits."; Halfzies says "pepperoni on half"), but none has a plain line of its own that says what it is. This question asks for one in her words. Where each word first appears: corn pit, index.html at `data-t="t447b4ee9"` (price $4 per person); barrel train, index.html at `data-t="tea6897bf"` (ages 12 and under, $3 per child); small sunn hemp maze, index.html at `data-t="t447b4ee9"`; Halfzies, index.html at `data-t="te2b6ab0c"` (next to it: "homemade dough, tomato sauce, cheese, pepperoni on half"); Party Patch, index.html at `data-t="t756d2aeb"` (the tab calls it "Private party patch", index.html at `data-t="t91aeca4c"`); u-cut, index.html at `data-t="t0e96fa27"`; farm fun, index.html at `data-t="t9c63bc47"`.

**A. I will send one line for each**

- She sends seven short lines, one for each word. Nothing else is asked.
- Where they go is not decided by her answer. The usual place (a suggestion for whoever makes the change): one new question in the First-timer questions list of pages/first-visit.html, after the question pages/first-visit.html at `<summary>What are your bathroom facilities?</summary>`, with the question "What do the farm words mean?" and the seven lines as the answer. The rebuild (python3 tools/pages.py) copies the question and answer into that page's structured data. To show it on the home page too, add the same question to the FAQ of index.html at `id="faq"` and rebuild.
- Halfzies is one of the farm names that stay in English inside translated text (js/i18n.js at `const NAMES =`); the other six words are translated.
- Strings: 1 question and 1 answer (2 ids; 8 ids if the answer is a list of seven short items) x 4 translations
- Tests: i18n, languages and i18n-a11y after the rebuild. If a line repeats a price, a day or an age, consistency reads it too (for example consistency at `price: corn pit, per person` and `age: free (infants, wagon ride, party children)`).

**B. Leave them as they are**

- No change. The seven words stay as they are, and a first-time visitor has to guess them.
- Strings: 0
- Tests: none

### d81. Add skip links over the photo gallery and the map?

- In plain words: Someone who uses the Tab key passes 39 photo stops and 25 map stops on the way down the home page. The menu avoids this. A link that jumps over the long parts would help. It adds new words in five languages.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. Keyboard users gain; nobody else sees the links.
- Depends on: d37 (new words should be read by a native speaker).
- Note: The site already has one skip link, "Skip to content" (index.html at `data-t="t0a4470d6"`, styled by css/extras.css at `.skip-link{top:-6em}`).

**A. Add "Skip the photo gallery" and "Skip the map links", shown only to keyboard users**

- Two new links in the same style as the existing one: the first just inside the gallery section (index.html at `id="gallery"`), the second just inside the farm map section (index.html at `id="farm-map"`), each pointing at a small anchor placed after that section's long list. The new words are 2 UI ids. Not replayed: markup, style and the keyboard test change together; ask Claude.
- Strings: 2 UI ids x 4 translations
- Tests: keyboard, axe, languages, i18n

**B. Leave it: the menu is enough**

- No change.
- Strings: 0
- Tests: none

### d85. Group sizes: is 100 guests in 51 to 100 or in 100 plus?

- In plain words: Two lines in the Groups price list both include exactly 100 guests: "51-100 guests" and "100+ guests". The Spanish and Vietnamese say "more than 100". Chinese and Hindi say "100 and more". A group of exactly 100 cannot tell which price applies.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. "101+" is the one change that makes the two lines agree.
- Depends on: d02 (company event prices), d36 (school group sizes).
- Note: The two lines are index.html at `data-t="tf2832845"` ("51-100 guests") and index.html at `data-t="te184c66a"` ("100+ guests").

**A. Change 100+ guests to 101+ guests**

- index.html at `data-t="te184c66a"`: "100+ guests" becomes "101+ guests". Rebuild. The new id needs its four translations; Spanish and Vietnamese must say "101 or more" (a number that differs from the English fails the consistency test), Chinese and Hindi the same.
- Strings: 1 UI id x 4 translations
- Tests: consistency (numbers in the translations)

**B. Leave it**

- No change.
- Strings: 0
- Tests: none

## Topic 7. Names, address and listings

Urgency: wrong or risky information.
One spelling and one name everywhere, matching Google and Facebook.

### d07. Name of the maze

- In plain words: The site says "Corn maze" in some places and "Small Sunn Hemp Maze" in others.
- Doc question: Q11
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (what the maze is made of this year).
- Depends on: d14 (the Farm Map Marker makes the map label), d13 and d32 are not related.

**A. Corn maze**

- Everywhere "Corn maze". The farm map already says "Corn maze" (js/farm-map-data.js at `"label": "Corn maze"`, written from tools/saved-map.json at `"label": "Corn maze"`). Change the text that says sunn hemp: index.html at `data-t="t447b4ee9"`, `<li data-t="t39573dd5">`, `data-t="t8c64d6c3"` (heading), `<th data-t="t39573dd5"` (table row) and `data-t="t0b5eaa9e"`, and pages/pumpkin-patch.html at `<li>A small sunn hemp maze</li>`. The line index.html at `data-t="tcc37b939"` ("Wander through our little maze") can stay.
- README rows "Farm map" and the maze mention (README.md, section "What's interactive", the item "What's on the farm").
- Strings: 5 ids change (t0b5eaa9e, t39573dd5, t447b4ee9, t8c64d6c3, tc2132019) but two of them end up as the same words, "Corn maze", so 4 new sentences x 4 translations; the JS strings "Corn maze" and "Corn maze sign" stay
- Tests: farm-seasons: tests/farm-seasons.test.mjs at `haunted trail and the maze only in fall` looks for /Maze/ (capital M) in the fall text: change it to /maze/i if the heading becomes "Corn maze"

**B. Small Sunn Hemp Maze**

- Everywhere "Small sunn hemp maze". The text already says it (5 ids). Change the map: in the Farm Map Marker (or by hand in tools/saved-map.json at `"label": "Corn maze"`) change the label "Corn maze" to "Small sunn hemp maze", then python3 tools/farm_map.py tools/saved-map.json (rewrites js/farm-map-data.js at `"label": "Corn maze"`). Check that the legend and the map sign (js/features.js at `T('Corn maze sign')`) say it too.
- The picture of the maze on the map (js/map-art.js cornMaze) is a drawing: no change.
- Strings: 1 to 2 JS strings x 4 translations (new "Small sunn hemp maze"; "Corn maze sign" if you rename it); the 5 UI ids stay
- Tests: map (legend text), i18n; farm-seasons unchanged

**C. A different name**

- Her name replaces both: the 5 ids of option A (7 places) and the map label of option B (tools/saved-map.json at `"label": "Corn maze"`, then python3 tools/farm_map.py tools/saved-map.json).
- Strings: 5 ids + 1 to 2 JS strings x 4 translations
- Tests: farm-seasons: /Maze/ in tests/farm-seasons.test.mjs at `haunted trail and the maze only in fall` if the new name has no capital M

### d28. Which Facebook page is the real one

- In plain words: Two pages show the same address: "Wise Acres" (wiseacresnc, about 20K followers) and "Wise Acres Organic Farm". The site links only wiseacresnc.
- Doc question: Q24
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (only she knows which page she runs). Do not print the Facebook sign until it is answered.
- Depends on: d29 (the QR signs are printed together).

**A. Link only wiseacresnc**

- No change. https://www.facebook.com/wiseacresnc/ stays in index.html at `facebook.com/wiseacresnc` (4 places: the structured data and three links) and tools/qr_links.json at `facebook.com/wiseacresnc` (the Facebook QR sign).
- Strings: 0
- Tests: none

**B. Link both pages**

- Add the second page next to the first: structured data sameAs and the three links (index.html at `facebook.com/wiseacresnc` (4 places)), the links with a label that tells them apart, and a second QR sign if wanted (tools/qr_links.json, then python3 tools/make_qr.py).
- Strings: 1 to 3 labels x 4 translations (new link text)
- Tests: print-qr only if a second sign is added (it counts signs, minimum 9); public-site allows any facebook.com link

**C. Link only Wise Acres Organic Farm**

- Replace the address in the same five places (index.html at `facebook.com/wiseacresnc` (4 places), tools/qr_links.json at `facebook.com/wiseacresnc`) and run python3 tools/make_qr.py (new assets/qr/facebook.svg; reprint the sign).
- Strings: 0
- Tests: public-site (accepts any facebook.com address)

### d29. Instagram hashtag sign

- In plain words: Instagram usually hides hashtag pages from people who are not logged in. The sign says "Scan to see photos other families shared".
- Doc question: Q25 (partly: Q25 asks about the hashtag on the site itself, index.html at `data-t="t559ec077"` (2 places) and `data-t="t18683452"`; that is not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: B until the Instagram hashtag page shows photos to a person who is not logged in (README says the same).
- Depends on: d06 (the review sign adds one sign: the count in the test), d28 (signs printed together).

**A. Print the hashtag sign**

- No change to the files. Print print/qr-signs.html as it is (README.md, section "Planning features", item 3 under "QR signs" says: print it only when the hashtag page shows photos).
- Strings: 0
- Tests: none

**B. Skip that sign**

- Delete the "hashtag" block from tools/qr_links.json (tools/qr_links.json at `"id": "hashtag"`: the whole block from its `{` to the `},` after its text_es line) and the three lines of the Hindi, Chinese and Vietnamese signs (tools/qr_links.json at `"hashtag": { "title"` (3 places)), run python3 tools/make_qr.py (rewrites print/qr-signs.html, deletes nothing: remove assets/qr/hashtag.svg by hand).
- README lines about the hashtag sign (README.md, section "Planning features", the "QR signs" paragraph and its item 3).
- Strings: 0
- Tests: print-qr MUST be updated: tests/print-qr.test.mjs at `there are signs, each with a QR code` needs at least 9 signs; there are 9 now (no review sign), so 8 fails. Lower the number to 8 (or 9 if d06 adds the review sign). Consistency counts the printed signs too: in tests/consistency.test.mjs at `printedCount >= 9 && bad.length === 0` change `printedCount >= 9` to 8 (and the "expected at least 9" in the message line below it)

### d39. How your address is written

- In plain words: The site writes "4701 Hartis Road" in some places and "4701 Hartis Rd" in others. It should match your Google Business Profile exactly.
- Doc question: none (the doc only uses "Hartis Rd" inside question 35)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: Whichever spelling her Google Business Profile shows. The files mostly use "Rd" (the structured data and the Drive time box do), so A touches fewer tests.
- Depends on: d40 (listing), d35 (same sentences), d11 (Drive time box address search).

**A. Rd**

- Change "Hartis Road" to "Hartis Rd": index.html at `data-t="tf1ab0489"` and `4701 Hartis Road<br>` (2 places); pages/first-visit.html at `<strong>4701 Hartis Road</strong>` and `a neighborhood on Hartis Road`; pages/school-field-trips.html at `is at 4701 Hartis Road`; tools/qr_links.json at `"id": "directions"` (the directions sign: its text_en and text_es lines, and the Hindi, Chinese and Vietnamese lines tools/qr_links.json at `"directions": { "title"` (3 places); then python3 tools/make_qr.py and reprint). 6 ids: t183fef9f, tf1ab0489, t37c5399a, t65ba07a6, tae0016c1, tb405649d.
- The GreenHouse has the same split: "5503 Poplin Road" in index.html at `5503 Poplin Road<br>` (2 places), "Poplin Rd" in 13 other places (and js/features.js at `5503 Poplin Rd, Indian Trail` and `To The GreenHouse at 5503 Poplin Rd`). Pick one with the farm's Google listing (d40).
- Strings: 6 ids x 4 translations (+ Poplin ids)
- Tests: consistency MUST be updated: the QR signs check expects the directions sign to say "Road" even when the structured data says "Rd": in tests/consistency.test.mjs at `.replace(/ Rd$/, ' Road')` delete that call, so the sign has to say what the structured data says. The rest already uses "Rd" (consistency at `address: 4701 goes with Hartis` reads 4701 Hartis Rd; drive at `The farm (4701 Hartis Rd)`, `farm answer names the farm`, `and pressing the button again answers for the farm` and `La granja (4701 Hartis Rd)` use "Rd")

**B. Road**

- Change "Hartis Rd" to "Hartis Road": index.html at `data-t="ta15d314e"`, `data-t="t19a4db7d"` and `data-t="t60ba1e75"`; pages/first-visit.html at `<span>The farm (4701 Hartis Rd)</span>`; pages/strawberry-picking.html at `<li>4701 Hartis Rd, Indian Trail, NC</li>` (4 ids: t19a4db7d, t60ba1e75, ta15d314e, tff7999ae); the structured data streetAddress (index.html at `"streetAddress": "4701 Hartis Rd"`, no translation); the Drive time notes and the address strings in js/features.js at `To the farm at 4701 Hartis Rd`, `To The GreenHouse at 5503 Poplin Rd`, `4701 Hartis Rd, Indian Trail, NC 28079` and `5503 Poplin Rd, Indian Trail` (1 + 1 JS strings x 4: "To the farm at 4701 Hartis Rd. ..." and the GreenHouse one).
- The structured data, the Google Maps link in the Drive time box and the address search use the address as typed: keep them equal to the Business Profile. Every map link (Google, Apple, Waze) carries the street as typed, so change "Hartis+Rd" to "Hartis+Road" and "Hartis%20Rd" to "Hartis%20Road": index.html at `Hartis+Rd` (9 places) and `Hartis%20Rd` (2 places); pages/first-visit.html at `Hartis+Rd` (3 places) and `Hartis%20Rd`; pages/pumpkin-patch.html at `Hartis+Rd`; tools/qr_links.json at `Hartis+Rd` (the directions sign: then python3 tools/make_qr.py and reprint). The consistency check "directions links" compares all of them with the structured data.
- Strings: 4 ids + 1 JS string x 4 translations (the farm one; the GreenHouse one only if you also change "Poplin Rd")
- Tests: consistency MUST be updated: tests/consistency.test.mjs at `address: 4701 goes with Hartis` (ld.streetAddress === '4701 Hartis Rd'); drive: tests/drive.test.mjs at `The farm (4701 Hartis Rd)`, `farm answer names the farm`, `and pressing the button again answers for the farm` and `La granja (4701 Hartis Rd)` (labels and the note text use Rd)

### d40. Does The GreenHouse have its own Google listing

- In plain words: If it does, the site can describe it separately with the same name and address wording.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact.
- Depends on: d39 (address wording), d06 (review links), d19 (what The GreenHouse sells).

**A. Yes, it has its own listing**

- Add a second business block to the structured data in index.html (the block index.html at `application/ld+json` holds the farm's LocalBusiness; add one for "The GreenHouse", 5503 Poplin Rd, Indian Trail, NC 28079, hours Fri-Sun 10 am-8 pm, sameAs the Instagram pages as in index.html at `"sameAs": [`). No translation.
- A review button for The GreenHouse needs a second link: js/content.js has one reviewUrl (d06); a second field is a small code change (ask Claude).
- Directions and map links for The GreenHouse already exist (Drive time list, index.html Contact section).
- Name and address wording must match that listing (d39).
- Strings: 0 (data only); 1 to 2 labels x 4 if a review button is added
- Tests: consistency (address test reads JSON-LD: tests/consistency.test.mjs at `address: 4701 goes with Hartis` also checks the farm block only); public-site

**B. No, one listing for both**

- No change. One listing for both: the farm's.
- Strings: 0
- Tests: none

### d65. QR signs: stronger codes, one address line

- In plain words: The QR codes are made at a middle strength (a sign still scans if about 15 percent of the code is damaged). A stronger one would take about 25 percent, but each square prints 10 to 15 percent smaller. The directions sign prints the same address twice (English and Spanish).
- Doc question: Q60
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d38 (a new web address means new codes), d06, d28 and d29 (which signs exist), d39 (how the address is written on the directions sign).
- Note: Tested on 3 October 2026 in a scratch copy: with the stronger setting every code still scans back and the print-qr test passes (105 checks). Squares across, now to stronger: Instagram 41 to 41, hashtag 41 to 45, Facebook 37 to 41, booking 41 to 45, pizza 45 to 53, menu 49 to 57, e-mail sign-up 33 to 37, map 49 to 57, directions 49 to 57. The strength is the letter in tools/make_qr.py at `segno.make(url, error=`.

**A. Leave the signs as they are now**

- No change.
- Strings: 0
- Tests: none

**B. Stronger codes only**

- The optional patch qr-stronger-codes.patch (see "Patches on disk"): the letter m in tools/make_qr.py at `segno.make(url, error=` becomes q, and the patch carries the rebuilt code pictures (assets/qr/) and the five sign pages (print/qr-signs.html and the three language sheets in print/). Without the patch: change that letter, then run python3 tools/make_qr.py, which rebuilds them and scans every code back. Print one sign and scan it with a phone before the signs go up.
- Strings: 0
- Tests: print-qr (passes; it asks for level M or better, so Q is accepted)

**C. One address line only**

- The optional patch qr-one-address-line.patch (see "Patches on disk"): tools/make_qr.py leaves out the Spanish line when it is the same as the English, the sign test in tests/consistency.test.mjs accepts that, and the patch carries the one changed line of print/qr-signs.html. Nothing else needs to run.
- Strings: 0
- Tests: consistency (at `one booking page, one pre-order page and one e-mail signup address` the QR signs are read), print-qr

**D. Both**

- Both patches, in either order. Running python3 tools/make_qr.py afterwards changes nothing (checked); run it only after a later change to tools/qr_links.json or reviewUrl.
- Strings: 0
- Tests: consistency, print-qr

### d78. Show photos on very old Macs too?

- In plain words: The photos use a modern picture format (WebP). Very old Macs (before late 2020 software) may show empty boxes instead of photos. It is a small group of visitors. Fixing it means a second copy of every photo, which makes the site heavier. This was read from the vendor notes, not tried on a real Mac.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. A small group, and a heavier site slows everyone.
- Depends on: d12 (photo originals), d13 (photos that carry words).
- Note: The photos are in assets/photos/ and listed in js/content.js.

**A. Leave photos as they are**

- No change.
- Strings: 0
- Tests: none

**B. Add a second copy of each photo for old Macs**

- A second file for every photo (JPEG, next to each WebP) and a picture tag with the old format as a fallback, in index.html, the extra pages and js/content.js. Not replayed: a code and file change only Claude can make. It makes the upload folder larger: check python3 tools/make_deploy_folder.py --check afterwards.
- Strings: 0
- Tests: gallery, files-audit, public-site

**C. I will explain**

- Her own idea; the same places as B.
- Strings: 0
- Tests: as in B

## Topic 10. What the site says the farm offers

Urgency: wrong or risky information.
Features, prices and claims the site states as fact. They came from the farm's own wording or requests, so these are quick checks, not new decisions.

### d48. Haunted trail and u-pick tomatoes this fall

- In plain words: The home page says visitors can walk a haunted trail and u-pick tomatoes and basil every weekend until the end of October ($4.50 a pound, $1 a stem). Your farm map shows both, but we could not find them on the farm's public pages.
- Doc question: Q5, Q6, Q7
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: A. As far as the commit history shows, both were added from the farm side's own instructions (30 September and 1 October), and both are on her own map. Only the two prices ($4.50, $1) have no second source. (Old Q8, the number of varieties, is dropped: the site already says "more than a dozen".)
- Depends on: d13 and d32 (the tomato price-sign photo), d07 (maze name, same fall panel), d14 (the map tool), d51 (fall hours).
- Note: Old Q5, Q6 and Q7 in one card. Old Q10 (scavenger hunt) is dropped: its mentions were removed on 1 October (commit 2b09373).

**A. Both are real and the prices are right**

- No change. Both were added from the farm side's instructions (commits be1a7e7 and 9da04ae) and are drawn on her own farm map (tools/saved-map.json at `"label": "Haunted trail"`, and the tomato field), saved on 1 October.
- Strings: 0
- Tests: none

**B. No haunted trail this fall**

- Take the haunted trail out: index.html at `data-t="td6ecd1d8"` (hero line), `data-t="tb2ff1037"` (farm card), `data-t="t4b6d3990"` (the "Haunted Trail" card in the fall panel), `data-t="t49c35609"` (row in the "Season by season" table) and `data-t="t0b5eaa9e"` (fall tab line); pages/first-visit.html at `<li>A haunted trail on fall visits</li>`; pages/pumpkin-patch.html at `<li>A haunted trail on fall visits</li>`. 7 UI ids x 4 translations (t0b5eaa9e, t46f6aa3b, t49c35609, t4b6d3990, tb2ff1037, tb89adc3c, td6ecd1d8).
- Map: delete the "Haunted trail" mark in the Farm Map Marker (tools/saved-map.json at `"label": "Haunted trail"`) and run python3 tools/farm_map.py tools/saved-map.json (rewrites js/farm-map-data.js at `"label": "Haunted trail"`). The legend label (js/features.js at `T('Haunted trail')`) can stay.
- Strings: 7 UI ids x 4 translations
- Tests: farm-seasons MUST change: tests/farm-seasons.test.mjs at `haunted trail and the maze only in fall` requires "Haunted" in the fall text (keep only /Maze/); map (legend and marks)

**C. No u-pick tomatoes and basil this fall**

- Remove the whole "Tomatoes & basil" section index.html from `id="tomatoes"` to `================= WISE PIE` and every link to it: hero line (index.html at `data-t="td6ecd1d8"`) and chip (index.html at `data-t="t30661b0e"`), the chooser card (index.html at `data-t="tddae9ce2"`), the add-on (index.html at `data-t="t48324abe"`), the calendar bar (index.html at `class="cal-bar bar-tomato"`), the Shop rows (index.html at `data-t="t1fccf389"` and `data-t="tbbaa09ab"`), the FAQ answer (index.html at `data-t="t398007b0"`), pages/pumpkin-patch.html at `New this year. Certified organic cherry tomatoes`, the "tomatoes" crop in js/features.js (This week box) and the farm map mark. Ask Claude: the largest removal on this list.
- 46 UI ids and 5 JS strings mention tomatoes or basil. The photo with the price signs goes too (d13, d32).
- Strings: about 46 UI ids + 5 JS strings (unused after removal)
- Tests: consistency: tests/consistency.test.mjs at `price: tomatoes, per pound` and `price: basil, per stem` (prices) and from `const tom =` to `season words match js/season.js and the tomato dates in js/features.js` (tomato dates); features at `auto: pumpkins, tomatoes, flowers in season`, `const WEEK =` and `override: tomatoes peak first`; hero at `fall: the "New tomatoes" chip shows` and `winter: the tomato chip and the bee are hidden`; farm-seasons

**D. The tomato or basil prices are different**

- Change the price in 7 sentences: index.html at `data-t="t48324abe"`, `data-t="t6b47c02f"`, `data-t="te71161d2"`, `data-t="t1fccf389"`, `data-t="tbbaa09ab"` and `data-t="t398007b0"`, and pages/pumpkin-patch.html at `New this year. Certified organic cherry tomatoes`. 7 UI ids x 4 translations (t1fccf389, t398007b0, t48324abe, t6b47c02f, tbbaa09ab, tcc1be24a, te71161d2).
- Strings: 7 UI ids x 4 translations
- Tests: consistency: facts "price: tomatoes, per pound" and "price: basil, per stem" (tests/consistency.test.mjs at `price: tomatoes, per pound` and `price: basil, per stem`, at least 5 places each): all places must agree, no edit if they do

### d56. Two Axios news links

- In plain words: "In the news" shows two Axios Charlotte articles, from 2018 and 2017. We found them by searching and could not open them, so the headlines or years may be wrong.
- Doc question: Q28
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): no
- Default: A, after she opens both links once; C (hide) if she cannot before launch, because a wrong headline attributed to a newspaper is hers to defend.
- Depends on: d06 (the review buttons sit in the same Reviews section).
- Note: Old Q28.

**A. Both links are right**

- No change. README.md: delete the row "In the news".
- Strings: 0
- Tests: none

**B. One is wrong (I will say which)**

- Fix the headline, year or address of the wrong one: index.html at `axios.com/local/charlotte/2018` (2018 article) or `axios.com/local/charlotte/2017` (2017 article). They carry no translation id.
- Strings: 0
- Tests: features: tests/features.test.mjs at `press: two Axios Charlotte links` expects exactly 2 Axios links in the press list

**C. Hide the news list**

- Delete the block index.html at `<div class="press reveal">` (heading "In the news", id t94fe8b18, then unused). The comment about award badges that follows (index.html at `<!-- AWARD BADGES:`) can stay.
- Strings: 0 (1 id unused)
- Tests: features MUST change: tests/features.test.mjs at `press: two Axios Charlotte links open in a new tab`

### d58. Snacks and drinks in spring and summer?

- In plain words: The Season by season table says concessions and local goods are sold at the farm in spring and summer too. We ticked that ourselves; it did not come from you.
- Doc question: Q15
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The ticks were our plan, not her words.
- Depends on: d19 (the farm side says "hard cider", the GreenHouse side "cider"), d09 and d51 (hours).
- Note: Old Q15.

**A. Yes, also in spring and summer**

- No change. README.md: delete "The ticks for Concessions & local goods ..." from the row "Season by season".
- Strings: 0
- Tests: none

**B. Fall only**

- index.html at `data-t="te71c4e07"` (row "Concessions & local goods"): change the spring and summer cells from the tick to a dash, like the other rows. Delete the spring and summer card (it is one card for both seasons: the whole `<li class="card c-orange reveal" data-seasons="spring summer">` that holds the sentence "Snacks, beer, hard cider and wine, and local goods.", index.html at `data-t="tbf415391"`, from its `<li` line to its `</li>`). The fall card (index.html at `data-t="t7528af5c"`, "... and NC pumpkins") and the winter card stay. Deleting only the lines inside the card leaves an empty card and the farm-seasons test stops with an error.
- Strings: 0 new; 1 id (tbf415391) becomes unused
- Tests: farm-seasons (run it: it checks which cards show in each season, and it needs every card to have its heading: a half-deleted card fails it)

**C. Only some (I will say which)**

- Change the card sentences (index.html at `data-t="tbf415391"` and `data-t="t7528af5c"`) and the table cells (index.html at `data-t="te71c4e07"`) to her list.
- Strings: 2 ids x 4 translations
- Tests: farm-seasons

### d59. Do you still run summer programs?

- In plain words: Your current website has a Summer Programs page. The new site says nothing about it, and the old address /summer/ will show "page not found".
- Doc question: Q14
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact.
- Depends on: d30 (the old address /summer/), d36 (school and group rules), d27 (banners), d05.
- Note: Old Q14. Launch decision D3 in docs/LAUNCH_CHECKLIST.md asks what happens to /summer/ and /posts/.

**A. Yes, I will send the details**

- Add a page or a card for summer programs (ask Claude): a new source pages/summer-programs.html built by tools/pages.py, a link in the menu and the footer, then a redirect from the old /summer/ address (the old address table in docs/OPTION_PATCHES.md leaves /summer/ out on purpose; add it to _redirects from redirects-A or to a redirect page from redirects-B).
- Page text, dates, ages, prices: from her.
- Strings: about 10 to 20 new ids x 4 translations
- Tests: public-site (the list of extra pages and the sitemap), consistency (new ages or prices), languages, axe

**B. No, we stopped them**

- No change. /summer/ stays "page not found" (launch decision D3, d30).
- Strings: 0
- Tests: none

**C. Not sure yet**

- No change until she answers.
- Strings: 0
- Tests: none

### d67. Keep two backgrounds that never showed?

- In plain words: Two background lines in the page style are written in a way browsers ignore, so the mint graph paper in The GreenHouse section and the brown road with white dashes under the tractor never showed. The fix is already in the files, so they show.
- Doc question: Q62
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: none.
- Note: Before and after pictures at 390 and 1280 pixels wide exist for both (kept in a helper's scratch folder; ask Claude). The fix and the validity test (tests/validity.test.mjs), which finds this kind of mistake, are already in the tree.

**A. Yes, show them**

- No change: the fix is already in css/sections.css at `.greenhouse{background:linear-gradient(` (the colour comes last in the shorthand) and css/styles.css at `.track-road{position:absolute` and `.track-road{left:26px`. The validity test keeps the mistake from coming back.
- Strings: 0
- Tests: none

**B. No, keep the plain look as it is today**

- Ask Claude: take the background out of those two rules (css/sections.css at `.greenhouse{background:linear-gradient(`, and the two `.track-road` rules in css/styles.css). The old wrong lines must not be put back: the validity test would fail on them.
- Strings: 0
- Tests: validity, visual-check (new baselines)

**C. I want to see them first**

- No change until she has seen the pictures (ask Claude) or a trial copy.
- Strings: 0
- Tests: none

### d73. Make the brand yellow a little paler?

- In plain words: Phones and browsers that darken pages by themselves no longer change the site (it tells them to stay light). One rare case is left, a developer setting on a computer, where dark text on the yellow buttons, tabs and chips turns too pale to read.
- Doc question: Q68
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: none.
- Note: The one-line fix is already in (every page head and css/styles.css say "only light"; README.md, section "What's interactive", the paragraph "Light only, on purpose"). The cure for the rare case was described by the helper who tested it as a slightly paler yellow, for example #ffd03d instead of #ffc928; that figure was not measured again for this list. The farm's yellow is used in about a dozen drawings and two style files too.

**A. Leave the yellow as it is now**

- No change.
- Strings: 0
- Tests: none

**B. Make the yellow slightly paler**

- css/styles.css at `--sun:#ffc928;` (the yellow of buttons, tabs and chips) and the browser colour in index.html at `<meta name="theme-color" content="#ffc928">` (python3 tools/pages.py copies it to the five other pages; 404.html has its own copy). Drawings and the map highlight carry their own #ffc928 (css/features.css, css/extras.css and index.html), so decide whether they change too.
- Test the new colour with the "auto dark" test, which switches Chromium's forced dark look on and checks every yellow part keeps readable dark text.
- Strings: 0
- Tests: auto-dark (the whole point), axe (contrast), visual-check (new baselines), forced-colors

**C. I will explain**

- No change until she answers.
- Strings: 0
- Tests: none

### d74. Say that all farm times are Eastern Time?

- In plain words: A visitor in another time zone now sees "(Eastern Time)" next to the live "Open now" badge and the pizza times. The fixed hours text, like "Fri-Sun 10 am-8 pm", still has no label. One short line near the hours would cover all of it. It is new wording in five languages.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes (her words)
- Default: A. It costs one line and nobody can misread the hours.
- Depends on: d37 (a native reader should look at new translated words).
- Note: The badge and the pizza times already say it: js/features.js at `const openingLabel`.

**A. Add one line: All times are Eastern Time**

- index.html at `id="contact-h"`: add a new line under that heading (the Contact section lists the hours of both places), for example `<p class="loc-note">All times are Eastern Time.</p>`. Then run the standard steps: python3 tools/pages.py, python3 tools/i18n.py extract (it gives the new sentence its id), python3 tools/i18n.py jsstrings.
- The four translations, as text to add through the pipeline (python3 tools/i18n.py missing es --list shows the id; add the line under "ui" in lang/src/<code>.json, then python3 tools/i18n.py build). Suggested words, in the words the site already uses for "Eastern Time" (a native reader should check them): Spanish "Todas las horas son hora del Este.", Hindi "सभी समय ईस्टर्न टाइम में हैं।", Chinese "所有时间均为美国东部时间。", Vietnamese "Tất cả giờ đều theo giờ miền Đông."
- Strings: 1 UI id x 4 translations
- Tests: consistency, i18n, languages

**B. Leave it as it is now**

- No change.
- Strings: 0
- Tests: none

**C. I will explain**

- Her words in the same place as A; the same steps and the same tests.
- Strings: 1 UI id x 4 translations
- Tests: as in A

### d84. Make the red See the farm in label a little darker?

- In plain words: The red handwriting label above the season buttons passes the contrast rule, but only just. In summer, against the blue sky, it is the hardest text to read on the page. A slightly darker red would help and would look almost the same.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A.
- Depends on: d73 (the brand yellow, the same kind of colour question).
- Note: The colour is in css/hero.css at `.ss-label{font:700 1.5rem`: today #a8182f. Against the darkest sky colour (#5fc1ee) it gives a contrast of 3.7; 4.5 is wanted for small text.

**A. Darken the red a little**

- css/hero.css at `.ss-label{font:700 1.5rem`: change `color:#a8182f` to `color:#7a0f20` (contrast 5.4 against #5fc1ee). No rebuild.
- Strings: 0
- Tests: axe (contrast), hero (season buttons), auto-dark

**B. Leave it as it is now**

- No change.
- Strings: 0
- Tests: none

## Topic 8. Drive time box and map tools

Urgency: nice to have.
Works today with free outside services. The decisions are about risk, not about launch.

### d10. Free driving-directions service behind the Drive time box

- In plain words: It asks for non-business use and may refuse one day. The box would then say "not working right now" and still offer the Google Maps button.
- Doc question: Q36 (and Q43, the lawyer question; Q43 is not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: can follow launch; launch decision D11 (3.13).
- Owner fact (no sensible default): no
- Default: A at launch (the box fails soft to Google Maps); B if she wants it in writing. Move on only if it breaks.
- Depends on: d11 (farmPoint halves requests), d15 (connect-src names the two hosts), d38 (Mapbox token is limited to the site address).

**A. Launch as is**

- No change. Keep the weekly test (docs/LAUNCH_CHECKLIST.md section 5). If the box fails two weeks running, choose again.
- Strings: 0
- Tests: none

**B. Email the operators to ask**

- No file change. She (or Claude drafts it) writes to fossgis-routing-server@openstreetmap.de: small farm website, a visitor presses a button, one routing request per press. Keep the reply and note it under decision D11 (docs/LAUNCH_CHECKLIST.md, section "4. Before you go live", the row D11).
- If they say no: option C or D.
- Strings: 0
- Tests: none

**C. Switch to Mapbox later**

- She makes a Mapbox account and a public token limited to the site address. Then (ask Claude, no patch on disk): js/features.js at `const GEO_URL =` and `const ROUTE_URL =`, the two request functions (js/features.js at `function geocode(` and `function driveBetween(`), the three credit links (js/features.js at `Routing: OSRM`), the notice "free OpenStreetMap services" (index.html at `data-t="t2ed7116c"`), _headers connect-src (only if d15 is on: https://api.mapbox.com instead of the two hosts), docs/LAUNCH_CHECKLIST.md, sections "The Content-Security-Policy" (the connect-src line) and "3.9 Analytics" (the table row "Drive time box"), docs/WHAT_THE_SITE_STORES.md, sections "2. Which other sites the website contacts", "3. What each optional feature adds", "5. Links out" and "8. Outside this website's code" (every Drive time line), README.md, sections "Planning features" (the "Drive time from a visitor's address" paragraph), "Check your changes" (farmPoint) and "Putting it online" (item 6), and README row "Drive time box".
- Strings: 1 UI id (t2ed7116c) x 4 translations; credits are English only
- Tests: drive MUST be updated: tests/drive.test.mjs mocks the two current hosts (nominatim.openstreetmap.org and router.project-osrm.org); features and languages mention the box

**D. Turn the Drive time box off**

- Remove initDriveForm from the list in js/features.js at `initEntrance, initDriveForm`. The form (index.html at `id="drive-form"`) carries hidden, so it stays hidden; the town list above the form stays.
- Update README.md, sections "Planning features" (the "Drive time from a visitor's address" paragraph), "Check your changes" (farmPoint) and "Putting it online" (item 6), and README row "Drive time box", and docs/WHAT_THE_SITE_STORES.md, sections "2. Which other sites the website contacts" and "3. What each optional feature adds"; _headers connect-src no longer needs the two hosts (d15).
- Strings: 0
- Tests: drive: delete `tests/drive.test.mjs` and its row in tests/README.md (the test runner takes the tests it finds in that folder, so nothing in `tests/run-all.mjs` needs to change) or it fails. The notes that name tests/drive.test.mjs need the same (`node tests/docs.test.mjs` lists them); features and languages tests that open the box need the same

### d11. The farm's exact spot on the map

- In plain words: With the exact spot the Drive time box is faster and more exact. Right-click the farm on Google Maps and copy the two numbers.
- Doc question: Q35
- Urgency: 3 (nice to have). Checklist says: before launch; also launch item 3.13.
- Owner fact (no sensible default): yes
- Default: A (two minutes for her; halves the requests and makes the answer a second faster).
- Depends on: d10 (fewer requests to the free service), d39 (the address search text), d35 (where cars turn in).

**A. I will send the two numbers**

- js/content.js at `// optional exact spot of the farm`: farmPoint: null, -> farmPoint: { lat: 00.0000, lon: -00.0000 }, with her two numbers (steps in the comment above it: js/content.js at `DRIVE TIME FROM A VISITOR'S ADDRESS`; the code that reads it is js/features.js at `spot: () => readFarmPoint().point`).
- No rebuild. Open the home page, press "Get drive time" with a nearby address and check the miles.
- README: delete "set farmPoint" from the Drive time row (README row "Drive time box") and the launch list (README.md, section "Putting it online", item 6); docs/LAUNCH_CHECKLIST.md, section "3.13 The Drive time box" (the item "Set farmPoint").
- If the spot is not where cars turn in, ask again (d35).
- Strings: 0
- Tests: launch-check MUST be updated: tests/launch-check.test.mjs at `the farm spot is set with the numbers swapped` makes a broken copy by swapping the numbers of `farmPoint: null`, so with real numbers in js/content.js it finds nothing to swap and fails. In that line change `farmPoint:\s*null` to `farmPoint:\s*(?:null|\{[^}]*\})`. And drive MUST be updated: tests/drive.test.mjs expects the farm to be searched for ("two searches (visitor, farm) and one route") and sets the spot only in its own case, so with numbers in js/content.js its other cases fail. In tests/drive.test.mjs at `if (opts.extra) await page.route('**/js/content.js'` change `if (opts.extra) await` to `await`, and `+ '\n' + opts.extra` to `+ '\nWISE_ACRES.farmPoint = null;\n' + (opts.extra || '')`, so every case starts with the spot empty.

**B. Keep using the address search**

- No change. The box searches for the address on the first press after each page load.
- Strings: 0
- Tests: none

### d14. Try the Farm Map Marker swipe on a real phone

- In plain words: Swiping and scrolling on phones is fixed and tested here, but only a real phone can confirm it.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only a real phone can answer it.
- Depends on: d07, d35 (the map marks come from the same tool).

**A. It works**

- No change.
- Strings: 0
- Tests: none

**B. There is a problem: I will describe it**

- No repo change. The Farm Map Marker is a private page outside the repo; the repo only receives its saved map (tools/saved-map.json, then python3 tools/farm_map.py tools/saved-map.json; README row "Update the farm map"). Send the description of the problem to Claude to fix the tool.
- Strings: 0
- Tests: map (only if the saved-map format changes)

### d62. Is the Drive time privacy note enough?

- In plain words: The note under the Drive time box says the website does not keep the address, but the two free map services "may keep a record of the request". We could not find how long they keep it, and we did not check children's privacy rules or other states' laws.
- Doc question: Q57
- Urgency: 2 (wrong or risky information). Checklist says: launch decision D11 covers the routing server (3.13); the wording of the note is not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d10 (the same box; the lawyer question, old Q43, is part of d10), d15 (the header names the two hosts), d37 (the note is translated).
- Note: Old Q43 asks an adviser; this question asks whether she is happy with the wording of the note itself. The same sentence is on the home page and on the First visit page (one translation id). docs/WHAT_THE_SITE_STORES.md lists what is sent.

**A. The note is fine as it is**

- No change.
- Strings: 0
- Tests: none

**B. Name the two map services in the note**

- Change the sentence in index.html at `data-t="t2ed7116c"` and in pages/first-visit.html at `class="fine drive-priv"` (the rebuild gives both the same id). Name OpenStreetMap's address search and the routing server run by FOSSGIS in Germany (names as in docs/WHAT_THE_SITE_STORES.md, section "2. Which other sites the website contacts").
- Strings: 1 id (t2ed7116c) x 4 translations
- Tests: drive MUST be updated: tests/drive.test.mjs at `those services may keep a record of the request` pins the sentence; languages, i18n

**C. I will ask my adviser first**

- No change now. Send the adviser the text of question 43 (docs/QUESTIONS_FOR_THE_FARM.md) and the fact sheet docs/WHAT_THE_SITE_STORES.md. Then A, B, or switch the box off as in d10 option D.
- Strings: 0
- Tests: none

### d64. What should the printed home page include?

- In plain words: The home page prints on 28 to 34 sheets (depending on language and paper size). The farm map is left out, and only the season tab and the group tab that are open on screen print.
- Doc question: Q59
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d65 (the QR signs are a separate printed set).
- Note: The print rules are css/extras.css at `/* Printing.` (commit 42fd196: every page prints without buttons, tabs or animations; the First visit page prints on one sheet). Measured in a browser on 3 October 2026 (print layout, English): Letter paper 32 sheets as it is, 32 with all four seasons shown, 34 with all four seasons and all three group tabs; A4 paper 30, 31 and 32. Other languages give 28 to 34 as it is.

**A. Leave printing as it is now**

- No change.
- Strings: 0
- Tests: none

**B. Print all four seasons**

- Ask Claude: a print-only rule in css/extras.css (inside the block that starts at `/* Printing.`) that shows the three hidden season panels (index.html at `id="panel-summer"`, `id="panel-fall"` and `id="panel-winter"`). The tab buttons do not print, so each panel needs to say which season it is: check whether it starts with its own heading.
- Strings: 0 if each panel carries its season name; otherwise up to 4 labels x 4 translations
- Tests: print-qr (the pages on paper), visual-check

**C. Print all four seasons and a plain farm map**

- As B, and the map: css/features.css at `@media print{#farm-map,#comfort{display:none!important}}` hides the interactive map on paper. A plain list of the places is easier to print than the drawing (ask Claude; the places come from js/farm-map-data.js).
- Strings: 0 to a few labels x 4 translations
- Tests: print-qr, map

## Topic 9. Translations

Urgency: nice to have.
Four AI-written translations that no native speaker has read.

### d37. Native speakers for the translations

- In plain words: All four translations are written by AI. A person should check word choices: Vietnamese uses Southern words, Spanish says "para recoger" and "botana", Chinese says 700 degrees Fahrenheit about 370 Celsius, Hindi and Vietnamese date and clock words.
- Doc question: none (only a note in the doc: "Translation notes", and the AI note at the top of docs/QUESTIONS_FOR_THE_FARM.es.md)
- Urgency: 3 (nice to have). Checklist says: launch decision D8.
- Owner fact (no sensible default): no
- Default: A for the sentences that carry a promise (allergens, refund, prices, hours); the rest can follow.
- Depends on: d17, d18, d41, d42 (zh and vi say "service dog"), d09, d19.

**A. A native speaker checks them**

- No change now. When a speaker answers, edit the value of each id in lang/src/<code>.json (key = id of the English text; JS strings are keyed by the English text), then python3 tools/i18n.py build and python3 tools/i18n.py missing <code> (0). English never changes.
- The two clock patches that were once kept in scratch folders (es-OPTIONAL-clock-12h.patch and vi-OPTIONAL-clock-words.patch) are not needed: the code already writes Spanish times as "5:00 p. m." and Vietnamese times as "5 giờ chiều" (js/features.js at `const fmtClock = (date, tz) => {`, js/live.js at `function timeLabel(mins)`, js/i18n.js at `W.clock = (h, m, code) => {`). If the speaker wants other clock words, change those three places and the fixed texts. The other translation patches (zh-C, es-C, vi-C, hi-C) are already merged.
- The speaker does not have to edit JSON: `python3 tools/review_sheet.py export <code>` makes a spreadsheet (the 150 texts that matter most first, the English next to the translation, our questions, the instructions in the speaker's language and in English), and `import` reads their corrections back, refusing a changed number, price, name or tag and saying why. The four steps, for the owner, are on one page: `docs/CHECK_A_LANGUAGE.md` (and README, section "Have a native speaker check a language").
- Send the speaker first: the allergen line (d17), refund and cancel lines (d41, 3% fee), prices, hours and days, "700 degrees" (d18).
- Strings: 0 English; only the translation values that the speaker changes
- Tests: i18n, languages; consistency if a number, price or day changes (it compares each translation to the English)

**B. Keep the wording as is**

- No change. The AI notes stay (README.md, section "Languages", and the top of docs/QUESTIONS_FOR_THE_FARM.es.md).
- Strings: 0
- Tests: none

### d71. Friendly or formal in the translations?

- In plain words: The translations speak to the visitor in a friendly way: Spanish "tú", Chinese "你", Vietnamese "bạn" (about 100 sentences each), Hindi the polite "आप". Hindi writes English words in Hindi letters, and Vietnamese uses Southern words.
- Doc question: Q66
- Urgency: 3 (nice to have). Checklist says: launch decision D8 (native speakers).
- Owner fact (no sensible default): no
- Default: none.
- Depends on: d37 (a native speaker; if she answers d37 A, the same reader can answer this), d17, d41, d42 (the promise sentences).
- Note: Counted in lang/src on 3 October 2026 (1,344 sentences per language): the visitor is addressed in about 129 Spanish sentences (tú, tu, puedes ...), 96 Chinese (你; 您 once), 83 Hindi (आप, none with तुम) and 129 Vietnamese (bạn; "quý khách" none). "रिज़र्वेशन" is in 106 Hindi sentences and "प्लेग्राउंड" in 27. A review sheet with the 108 sentences reviewed on 3 October 2026 (the four languages next to the English) is in a helper's scratch folder; ask Claude. The "who can read it for us" question is d37's: it already asks whether a native speaker checks, and a friend or a paid reader could be added to its options.

**A. Keep the friendly tone**

- No change. The AI notes stay (README.md, section "Languages").
- Strings: 0
- Tests: none

**B. Make Spanish and Chinese more formal (usted, 您)**

- Every sentence that speaks to the visitor in lang/src/es.json (about 129) and lang/src/zh.json (about 96) is rewritten by a native speaker or checked by one (d37), then python3 tools/i18n.py build and python3 tools/i18n.py missing es (also zh): 0 missing. English never changes.
- Strings: 0 English; about 129 Spanish and 96 Chinese values
- Tests: i18n, languages; consistency if a number, price or day changes (it compares each translation to the English)

**C. A reader of each language should decide**

- No change now. Send the reader the review sheet and the question; the answer then becomes A or B for that language (Hindi and Vietnamese too: their choices are in the same files).
- Strings: 0
- Tests: none

### d82. Should the page not found page speak all five languages?

- In plain words: If someone follows an old or mistyped link, the page that says "Oops, this row is empty" is in English for everyone. A visitor who reads Hindi, Chinese, Vietnamese or Spanish sees English only.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A when a native reader can check the words (d37).
- Depends on: d37 (native readers), d71 (friendly or formal).
- Note: 404.html is plain English with no scripts, and tools/i18n.py leaves it out on purpose (it must work when nothing else loads).

**A. Translate its four short texts into the other four languages**

- The heading, the sentence and the three buttons of 404.html in four languages, shown by a small script file that does not need the rest of the site, and the texts added to the translation files. Not replayed: new code and new strings; ask Claude.
- Strings: the heading, the sentence and the 3 buttons x 4 translations
- Tests: public-site (404.html must stay out of the sitemap), i18n, files-audit

**B. Leave it in English**

- No change.
- Strings: 0
- Tests: none

### d83. Hindi month names: Hindi words or Jan, Feb, Mar?

- In plain words: In Hindi, the "farm year at a glance" row shows the 12 months as Jan, Feb, Mar in Latin letters. Spanish, Chinese and Vietnamese show their own. Many Hindi readers know the Latin letters, but it is the only row still in English there.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes (a native reader writes the names)
- Default: A, once a native reader has written them.
- Depends on: d37.
- Note: The twelve labels are index.html at `class="cal-months"` (ids tefed3690 Jan, tdc8415cc Feb, tc4ba0822 Mar, tbefde54a Apr, tc94f4798 May, t6d90df3b Jun, tb7375584 Jul, t75629af5 Aug, tfdd289e3 Sep, t51327aef Oct, tbb9bfefd Nov, t997f59bc Dec).

**A. Use short Hindi month names: a native reader writes them**

- The English stays, so no id changes. In lang/src/hi.json, under "ui", change the value of each of the twelve ids above, for example "जन॰", "फ़र॰", "मार्च", "अप्रैल", "मई", "जून", "जुल॰", "अग॰", "सित॰", "अक्तू॰", "नव॰", "दिस॰" (a native reader decides the exact short forms). Then python3 tools/i18n.py build.
- Strings: 12 Hindi values changed (no new English sentence; "missing" stays 0)
- Tests: i18n, languages, consistency (it reads months in each language's own words)

**B. Keep Jan, Feb, Mar**

- No change.
- Strings: 0
- Tests: none

## Topic 11. How you update the site yourself

Urgency: nice to have.
Settings and helper files for whoever keeps the files, not for visitors.

### d75. Keep the double-click file that starts the site on your computer?

- In plain words: A file that starts the site on a Windows computer by double-clicking one file. It was checked by reading only, because the test machine cannot run Windows files. If she would rather not ship a file nobody has run, it can be removed together with the guide lines about it.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: A, if someone can run it once on a real Windows computer.
- Depends on: none.
- Note: The file is tools/serve.bat (it starts tools/serve.py). The guide names it in three places of README.md: README.md at `serve.bat (Windows: double-click it to start serve.py),`, README.md at `Preview locally:` and README.md at `**Double-click to look at the site (Windows).**`. tests/windows-reality.test.mjs checks the file.

**A. Keep the double-click start file for Windows**

- No change. Run it once on a real Windows computer: double-click it, a black window shows the address of the site, the browser opens it, closing the window stops it.
- Strings: 0
- Tests: none

**B. Remove it: it could not be tested here**

- Delete tools/serve.bat. In README.md remove the line in the tools list (README.md at `serve.bat (Windows: double-click it to start serve.py),`), the words " (on Windows you can double-click `tools/serve.bat` instead)" in the sentence at `Preview locally:`, and the paragraph that starts `**Double-click to look at the site (Windows).**` (with the blank line after it).
- In tests/windows-reality.test.mjs delete the block from `// tools/serve.bat: a double-click launcher` to the check `the script tools/serve.bat starts exists` (it reads the file and then makes four checks), and take 'tools/serve.bat' out of the list of words the README must contain (the list at `'Node.js is not needed', 'tools/serve.bat'`). Without that the docs part of the test still asks for the words. The notes that name tools/serve.bat need the same (node tests/docs.test.mjs lists them).
- Strings: 0
- Tests: windows-reality, docs

**C. I will explain**

- Her own choice; the same places as A or B.
- Strings: 0
- Tests: as in A or B

### d76. Force one kind of line ending in the project files?

- In plain words: Windows can save the project files with different line endings than a Mac. The tools now cope with both. A one-line project setting would make every copy identical, which also stops tiny false changes. It is a setting for whoever keeps the files on GitHub.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. It is one small file and changes no page.
- Depends on: d77 (the checks on GitHub run on a clean checkout).

**A. Make every checkout use the same line endings**

- Make a new file named .gitattributes in the top folder (next to README.md) with one line: `* text=auto eol=lf`. It tells git to write every text file with the same line endings on every computer and to leave pictures alone. Commit it. In a copy that already exists, run `git add --renormalize .` once; if git then shows changed files, commit them too.
- Strings: 0
- Tests: files-audit, pipeline

**B. Leave it as it is now**

- No change. The tools cope with both kinds of line ending.
- Strings: 0
- Tests: none

**C. I will explain**

- Her own choice; the same file as A.
- Strings: 0
- Tests: as in A

### d77. Switch on automatic checks on GitHub?

- In plain words: Two ready-made files run all the site checks each time the files change, and once a week list the dates about to run out. They are switched off. Switching on means copying two files and costs nothing on a public repository. The weekly one is red in most weeks of the season, because something always runs out soon.
- Doc question: none (added on the dashboard after the doc was written)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A for a public repository (free); ask first for a private one (it uses minutes of the monthly allowance).
- Depends on: d76 (a clean checkout), d05 (where the site is hosted is not related).
- Note: The two files are checks.yml and weekly-health.yml in the folder docs/optional-github-actions/ (its README.md has the same steps, in the section "Switch it on"). Nothing runs while they stay in that folder: GitHub reads only .github/workflows/.

**A. Yes: I will copy the two files to switch them on**

- Make the folder .github/workflows in the top folder and copy the two files from docs/optional-github-actions/ into it. Commit and push. Open the Actions tab of the repository on github.com; "Site checks" starts by itself, and "Weekly health" starts with "Run workflow". GitHub emails the person who last changed the cron line of the weekly file, so the owner should be the one who commits it.
- The weekly check is red whenever something runs out within a week. To keep it for real alarms, change FAIL_ON in the weekly file from 'expires,runs-out' to 'runs-out'.
- Strings: 0
- Tests: none (the files were checked with a workflow linter, not yet on GitHub itself)

**B. No: not now**

- No change.
- Strings: 0
- Tests: none

**C. I will ask whoever keeps the files on GitHub**

- No change until the answer comes; then A or B.
- Strings: 0
- Tests: none

## What this page does not cover

- The dropped and later doc questions (table "Every doc question"). Their notes are in QUESTIONS_FOR_THE_FARM.md, section "For whoever edits the site"; its line numbers are older than these.
- Decisions D4 to D7 and D9 of the launch checklist (DNS switch date, analytics, seasonPicker, share-image style, who updates the site).
- The dashboard itself.
