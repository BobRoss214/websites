# Optional patches: the table

The farm's open decisions that change files are ready as patches in `patches/optional/`. The owner's answers (the dashboard, `docs/DECISION_PLAYBOOK.md`) choose which ones to apply. This page is the one table of them: file, order, which hosts, what to run after, and what was checked when they are combined.

Nothing here decides anything. A patch changes nothing until it is applied, and every patch file can be applied or left alone on its own.

## The table

Apply in the order of the first column (the same order the checks used). "After" is what to run once the patches are applied; `REBUILD` means the first four lines, one after the other, then `missing` for each language (0 missing each):

```
python3 tools/pages.py
python3 tools/i18n.py extract
python3 tools/i18n.py jsstrings
python3 tools/i18n.py build
python3 tools/i18n.py missing es   (and hi, zh, vi)
```

| Order | File | What it does | Answers | Hosts | Cannot be combined with | After | Tested |
|---|---|---|---|---|---|---|---|
| 5 | `patches/optional/season-picker-off.patch` | `seasonPicker: false` in `js/content.js`: visitors see the season of the calendar and no "See the farm in..." buttons. Many tests look at or click that switcher, so the patch also changes `tests/lib.mjs`: every page a test opens has the switcher on, unless a test writes `js/content.js` itself. | D6 (checklist 3.8) | any | none | nothing to rebuild; upload again | yes: with it applied (in the set of 11 patches, settings filled in) `hero` (80), `games` (92), `dated` (28), `keyboard` (164), `calm` (39), `no-js` (302), `auto-dark` (7) and `forced-colors` (17) pass; `hero` and `games` failed without the `tests/lib.mjs` change |
| 10 | `patches/optional/winter-A-hide-fall-booking.patch` | Out of fall the home page hides the fall Reserve button, packages, add-ons, "See prices" and the "At the farm" shop block, and shows one line with a "Tell me when it opens" button. One new sentence, translated in the patch. | d01 A, d24 B | any | winter-B | REBUILD | yes: every combination (the matrix), `hero`, `features`, the page clock on 11 dates |
| 10 | `patches/optional/winter-B-fall-prices-note.patch` | Keeps every fall price visible all year and adds one line before them: "These are the fall 2026 prices and times. New ones come later." One new sentence, translated in the patch. The sentence says 2026. | d01 B | any | winter-A | REBUILD | yes: every combination (the matrix), the page clock on 11 dates |
| 20 | `patches/optional/reserve-window.patch` | The spring Reserve buttons show only from 3 weeks before strawberry season until it ends. Summer and fall buttons are never hidden by it. No new text. | d25 A | any | none | `python3 tools/pages.py` (REBUILD is also fine) | yes: every combination (the matrix), `hero` (80 checks), the page clock on 11 dates; with the rebuild, `dated`, `deploy` and `messages` see no page error on the extra pages |
| 30 | `patches/optional/redirects-A-redirects-file.patch` | Adds `_redirects`: 22 lines, all 301, from the old wiseacresorganic.com addresses to the matching page or section (list below). | d30 A | cloudflare, netlify | redirects-B | nothing to rebuild; upload again | yes: every combination (the matrix), also with Cloudflare's own test server |
| 30 | `patches/optional/redirects-B-redirect-pages.patch` | 13 small "this page has moved" pages in folders (`faq/`, `food/` ...), for hosts that ignore `_redirects`. Their two lines are shown in the visitor's language: 10 new texts, translated in the patch, which a native reader should check. The script js/moved.js shows them. Also lets `tools/make_deploy_folder.py` upload those folders and `tools/i18n.py` read them. Not a true 301. | d30 A | any (the only choice on GitHub Pages) | redirects-A | REBUILD; upload again | yes: every combination (the matrix) |
| 40 | `patches/optional/clean-addresses-C-cloudflare.patch` | Pages name themselves to Google without `.html` (`/wise-pie`), which is the address Cloudflare Pages shows. Sets `PAGE_EXT = ''` in `tools/pages.py`; edits the public-site and validity tests and the README and checklist wording. | d05 (Cloudflare), d38 | cloudflare | none | `python3 tools/pages.py` (rewrites the 5 extra pages and `sitemap.xml`) | yes: every combination (the matrix), also with Cloudflare's own test server; `validity` passes with it |
| 50 | `patches/optional/code-cache-D-5-minutes.patch` | css, js and lang files are cached 5 minutes instead of 1 hour (`_headers`), so a change reaches visitors within minutes. | d05 | any that reads `_headers` (no effect on GitHub Pages) | none | nothing to rebuild; upload again | yes: every combination (the matrix); it does nothing on GitHub Pages |
| 60 | `patches/optional/phone-number-shown.patch` | Shows 704-628-6232 (a `tel:` link) in the footer of every page and in the home page's Google data. Updates the consistency test to allow the two known numbers. The "Questions?" fact and the contact cards stay as they are. | d04 A | any | none | REBUILD | yes: every combination (the matrix); `pipeline` (with `tools/test_check_facts.py`) passes with it |
| 70 | `patches/optional/qr-one-address-line.patch` | The directions sign prints the address once instead of twice. `tools/make_qr.py` leaves out a Spanish line that equals the English one. The consistency test accepts that. The one changed line of `print/qr-signs.html` is in the patch. Other signs keep both lines. | d65 C (d65 D with qr-stronger-codes) | any | none | nothing to rebuild (it is in the patch); `python3 tools/make_qr.py` after a later change to the sign list | yes: `consistency` (67 checks) and `print-qr` (105) pass with it, `docs` and `public-site` pass, and `python3 tools/make_qr.py` run afterwards changes nothing |
| 70 | `patches/optional/map-without-traced-land.patch` | Takes the roads, neighbours' houses, mown lawns, plowed field and dirt lanes (drawn from the farm's aerial picture, which is Google's) out of the farm map in `js/map-art.js`. Every mark the farm made, the legend, the names, the drive-time chips and the First-visit map stay; the ground around them is the forest and the clearings the file draws by itself. Also `tools/farm_map.py` (a note on how to draw the land again from a picture the farm owns; what it writes does not change), the map paragraph of `README.md` and row L8 of `docs/CREDITS_AND_LICENCES.md` (done). No new text. | d86 (where the map outline of the land came from, option 2) | any | none | nothing to rebuild; upload again | option-patches: applies to the files as they are, alone and in every set that makes sense (checked at the join; the map drawing itself was not looked at again there) |
| 70 | `patches/optional/faster-below-the-fold.patch` | The home page's 15 sections below the first screen are drawn only when they come near the screen (`content-visibility: auto`, each with a measured starting height), so an old phone is ready about a third sooner. Only on a first visit by a link or the address bar; a reload, Back and a link with `#` are worked out in full as today. Print draws everything. Text and rounded edges inside those sections can sit up to one pixel differently; nothing moves. | d88 | any | none | nothing to rebuild; upload again | yes: with it applied, `layout-sweep`, `visual-check`, `keyboard`, `no-js`, `print-qr`, `axe`, `link-names`, `hero`, `features`, `touch`, `gallery`, `languages`, `i18n-a11y`, `big-font`, `forced-colors`, `pause`, `calm`, `games`, `sitecheck` and `sitecheck-values` pass. Two of those switch the skipping off for their own pictures. Not the same to the pixel as without it, and scrolling back up after a menu link can jump a little (see the question d88). |
| 72 | `patches/optional/qr-stronger-codes.patch` | The codes are made at error correction level Q (a sign still scans with about 25 percent of it damaged, not about 15). Each square prints 10 to 15 percent smaller. The patch carries the 8 changed code pictures in `assets/qr/` and the five sign pages in `print/`, all made by `tools/make_qr.py`. | d65 B (d65 D with qr-one-address-line) | any | none | nothing to rebuild (it is in the patch); `python3 tools/make_qr.py` after a later change to the sign list | yes: `print-qr` (105 checks: every code scans back, every square is above the minimum size) and `consistency` pass with it, and `python3 tools/make_qr.py` run afterwards changes nothing |
| 80 | `patches/optional/games-B-pick-snips-sunflowers.patch` | In summer every fourth press of the "Pick a blueberry" button snips a sunflower, and a snipped sunflower grows back in 3 to 5 seconds (7 to 11 before). A phone or a keyboard can then earn the Sunflower Whisperer badge. Adds one part to `tests/games.test.mjs`. No text changes. | d68 A | any | none | nothing to rebuild; upload again | yes: `games` (92 checks, with the new part: a snipped sunflower is back after 5 seconds, the button alone earns the badge in about 400 presses), `hero` (80), `touch` (95), `calm` (39), `keyboard` (164), `privacy` (39) |
| 80 | `patches/optional/privacy-page.patch` | Adds a privacy page for visitors in plain words (privacy.html, in five languages). It says what the website keeps in the browser and which other sites it contacts (only after a button press). It also says what the website does not do, how to clear the data and who to ask, and when it was written. The footer of every page links to it, and the sitemap lists it. It switches itself between two sets of visit-counter sentences when analytics is turned on. Every sentence has its proof in docs/PRIVACY_PAGE_EVIDENCE.md. It is not legal advice. It has 68 new texts per language, translated inside the patch (a native reader should check them). | d89 | any | none | REBUILD |

The patches used to be called OPT-A (`redirects-A`), OPT-B (`redirects-B`), OPT-C (`clean-addresses-C`) and OPT-D (`code-cache-D`); a few messages still use the old names.

Every patch file starts with a header (`Option:`, `Name:`, `Does:`, `Answers:`, `Group:` for alternatives, `Profile:` for a patch the matrix only tries in the settings-filled run, `Conflicts:`, `Requires:`, `Host:`, `Order:`, `After:`, `Strings:`). `git apply` ignores it. `tests/option-patches.test.mjs` checks the headers and that every patch applies.

How to apply one (from the site folder, with no unsaved changes you would miss):

```
git apply patches/optional/winter-A-hide-fall-booking.patch
python3 tools/pages.py
python3 tools/i18n.py extract
python3 tools/i18n.py jsstrings
python3 tools/i18n.py build
python3 tools/i18n.py missing es    # then hi, zh, vi: 0 missing each
node tests/run-all.mjs public-site consistency
```

Apply several in the order of the table. `git apply` is strict (no fuzz): if it says a patch does not apply, the files changed since the patch was made. Do not force it. Run `node tests/run-all.mjs option-patches` to see which patches still apply, and send Claude the file name and the first line of the message. The two QR patches carry files that `tools/make_qr.py` makes (the codes and the sign pages). If only a `print/` or `assets/` part does not fit, apply the rest and let the tool make those files: `git apply --exclude="print/*" --exclude="assets/*" patches/optional/qr-stronger-codes.patch`, then `python3 tools/make_qr.py` (checked: the result is identical to applying the whole patch).

When a patch is applied for good, move it out of the open list so nobody applies it twice, and move the alternatives that were not chosen too:

```
mkdir -p patches/applied patches/declined
git mv patches/optional/winter-A-hide-fall-booking.patch patches/applied/
git mv patches/optional/winter-B-fall-prices-note.patch patches/declined/
```

## Which answer picks which patch

| Question | Answer | Patch |
|---|---|---|
| d01 winter | A hide fall booking and prices | `winter-A-hide-fall-booking.patch` |
| d01 winter | B keep them with a note | `winter-B-fall-prices-note.patch` |
| d01 winter | C only the tree wording | none (already in the code, version e081393) |
| d24 fall 2027 | B hide fall content between seasons | `winter-A-hide-fall-booking.patch` (the same patch as d01 A). It hides the fall block only while the page is not in its fall look. The page is in its fall look again from August 12, 2027, so the 2026 prices show again from then, until the 2027 details are in (d24 A). |
| d24 fall 2027 | A the 2027 details, C keep | none (a data change, or nothing) |
| d25 Reserve buttons | A hide them out of season | `reserve-window.patch` |
| d04 phone | A show it | `phone-number-shown.patch` (footer and Google data; the contact cards are a later step) |
| d05 host | Cloudflare Pages | `clean-addresses-C-cloudflare.patch` (without it the launch check FAILs: Cloudflare redirects `/wise-pie.html`, the pages name that address) |
| d05 host | Netlify or GitHub Pages | none for the page addresses (they show both) |
| d05 any host | shorter cache | `code-cache-D-5-minutes.patch` |
| d30 old addresses | A, host reads `_redirects` (Cloudflare, Netlify) | `redirects-A-redirects-file.patch` |
| d30 old addresses | A, host does not (GitHub Pages) | `redirects-B-redirect-pages.patch` |
| d30 old addresses | leave them | none (the launch check only warns) |
| d65 QR signs | B stronger codes | `qr-stronger-codes.patch` |
| d65 QR signs | C one address line | `qr-one-address-line.patch` |
| d65 QR signs | D both | both patches, in either order (running `python3 tools/make_qr.py` afterwards changes nothing) |
| d68 sunflower badge | A the Pick button snips sunflowers too | `games-B-pick-snips-sunflowers.patch` |
| d68 sunflower badge | B a lower number, C sunflowers in the middle, D leave it | none (B and C are small code changes made when she chooses; the number or the places are hers) |
| d86 map outline of the land | Keep the map as it is | none |
| d86 map outline of the land | Take the traced land out and keep every mark the farm made | `map-without-traced-land.patch` (the marks, legend, names and drive-time chips stay; to go back, `git apply --reverse` it) |
| d86 map outline of the land | Redraw the land from OpenStreetMap or a picture the farm owns | none yet (a later job; the note in `tools/farm_map.py` that the patch adds says how, and the patch is the first step) |
| d86 map outline of the land | Ask your adviser first | none until the adviser has answered |
| d88 faster below the fold | Leave it as it is | none |
| d88 faster below the fold | Turn it on now and accept the two small costs | `faster-below-the-fold.patch` (to go back, `git apply --reverse` it) |
| d88 faster below the fold | Ask Claude to try to fix the jump when scrolling back up first | none yet (a later job) |
| d89 privacy page for visitors | Add the privacy page | `privacy-page.patch` (then ask a native reader to check the four translations, and an adviser to read the page if the farm wants that) |
| d89 privacy page for visitors | Leave it for now | none (the site keeps only the short note under the Drive time box) |
| d89 privacy page for visitors | Ask your adviser first | none until the adviser has answered |
| d66 "new this year" | A stop saying new from January 1 | none (see "Choices that have no patch" below) |
| d37 clock words (translations) | any | none: the code already writes the times that way (see "Choices that have no patch" below) |
| D6 seasonPicker (launch decision) | false | `season-picker-off.patch` (it also keeps the tests working: if you only type `false` into `js/content.js`, `hero`, `games` and other tests that look at the switcher fail) |

Settings, not patches (type them into `js/content.js`; no rebuild): `reviewUrl` (d06; then `python3 tools/make_qr.py` makes the review sign), `farmPoint` (d11), the Mailchimp `signup.action` and `languageField`. `python3 tools/option_matrix.py --settings filled` tries them filled in (made-up values) together with `season-picker-off.patch`, on the 3 most different sets of patches.

## The words an option adds: sheets for a native reader

Some options add or change words in Spanish, Hindi, Chinese and Vietnamese. The privacy page adds dozens. The reader sheets of the site (`python3 tools/review_sheet.py export es`) do not hold these words, because they are not on the site until the option is applied. One command makes a sheet for each option that has words:

```
python3 tools/review_option_texts.py
```

It tries each patch alone on a copy of the site, so your files are never touched. It takes a few minutes. It writes the folder `review/options` (not uploaded). In it, the file "INDEX.txt" says which sheet to hand out for which owner answer. Each option that adds words has a folder with an `.html` file (to read or print) and a `.csv` file (opens in Excel) for each language. A sheet shows the English, the translation, the older English that a new text replaces, and the answer that turns the option on.

Hand the sheet of a language to the friend who reads that language. They write their corrections in the "correction" column. Send the corrections to Claude. The words live inside the patch file until the option is applied, so Claude changes them there and runs `node tests/run-all.mjs option-patches`. The reader sheets of the site itself do not take these corrections back.

An option that adds no words has no sheet, and the index says so. The index also says if a translation is missing after a patch, or if the facts check of the translations (`node tools/i18n_facts.mjs`) finds a different number, price or time. For a patch file that is not in `patches/optional/` yet, add `--patch FILE`. To try one option, add `--only NAME`.

## Hosts

| Host | Reads `_headers` and `_redirects` | `/x.html` | Allowed patches |
|---|---|---|---|
| Cloudflare Pages | yes | answers 308 to `/x` | all; take `clean-addresses-C` too |
| Netlify | yes | shows both `/x.html` and `/x` | all except `clean-addresses-C` |
| GitHub Pages | no | shows both | all except `redirects-A` (it needs `_redirects`), `clean-addresses-C`; `code-cache-D` does nothing |

## Trying them together

This is for Claude or a helper on a Mac or Linux computer: the first line below does not work in Windows cmd or PowerShell.

```
D=$(mktemp -d) && git archive HEAD | tar -x -C "$D" && cd "$D"
python3 tools/option_matrix.py . --list
python3 tools/option_matrix.py . --only cloudflare,winter-A
python3 tools/option_matrix.py .
python3 tools/option_matrix.py . --settings filled
```

`tools/option_matrix.py` refuses to run unless it starts in a temporary copy with no unsaved changes, and it only reads the base folder. It reads each patch header, builds every combination the headers allow for each host, and for each set of patches:

1. applies them to a fresh copy (strict `git apply`), runs the REBUILD commands (twice: the second run must change nothing), `missing` for 4 languages and `orphans` (no text without a translation id), then the `public-site` and `consistency` tests;
2. for each host that allows the set: makes the upload folder (`tools/make_deploy_folder.py`) and runs tools/launch_check.py against a pretend copy of that host (`--wrangler PATH` uses Cloudflare's own test server for Cloudflare). With a redirects patch it also requires the old addresses to be seen as forwarded; with `clean-addresses-C`, the pages to answer 200 without a redirect.

What runs on which sets:

- The slower tests (`pipeline`, `deploy`, `farm-seasons`, `live`, `dated`) run on a set of combinations that puts every pair of options side by side at least once. (`--heavy all` runs them on every different set of files: many hours.)
- `hero` and `features` run on the 3 most different sets: nothing; the first choice of every group plus every single patch; the last choice of every group plus every single patch.
- `--settings filled` runs the 3 most different sets again. The review link, the farm spot, the Mailchimp form and language field are filled in (made-up values), with every patch whose header says `Profile: filled`: `season-picker-off.patch`, the two QR patches and `games-B-pick-snips-sunflowers.patch`. `hero`, `print-qr`, `messages` and `games` are added (not `features`: it checks the site with the signup form not set up), and the rebuild includes `python3 tools/make_qr.py`.

The output is one PASS or FAIL line per combination, with the first failing check. The full results and logs go in a results folder it names.

The pretend hosts are written in the tool, from each host's own documentation. Cloudflare Pages answers `/x.html` with a 308 to `/x` and `/dir` with a 308 to `/dir/`. Netlify and GitHub Pages show both. GitHub Pages ignores `_headers` and `_redirects`. The Cloudflare one was compared with `wrangler pages dev` (Cloudflare's own test server) on 28 addresses for 4 upload folders (plain, with redirects-A, with redirects-B, with clean-addresses-C): the same status and `Location` every time. Netlify and GitHub Pages are not compared with the real hosts.

## What combining them found (and where it is fixed)

Every fix is inside the optional patch it belongs to. The base files are untouched.

- **Translations collided.** The old winter patches added their new sentence at the end of `lang/src/*.json`, where the phone patch adds its own: any two of them touched the same lines. Each patch now puts its new key at its alphabetical place.
- **Notes in README and the checklist collided.** `redirects-A`/`redirects-B` and `clean-addresses-C` edit lines next to each other in "Putting it online". Hunks in README, the checklist and the translation files carry one line of context instead of three, so every set applies with plain `git apply`.
- **`clean-addresses-C` carried 5 generated pages and the sitemap.** Those stopped applying whenever a page changed. It is now only the source files (`tools/pages.py`, the public-site test, README, checklist); `python3 tools/pages.py` writes the pages and the sitemap.
- **`redirects-B`: the folders were never uploaded.** `tools/make_deploy_folder.py` leaves out every top folder it does not know ("not part of the website"), so the 13 redirect pages would not have reached the host. The patch adds the folders to its list.
- **`redirects-B`: the 13 pages spoke English only.** A visitor on an old link in Spanish, Hindi, Chinese or Vietnamese could see English for a moment. The two lines now carry `data-t` ids like every page, and `tools/i18n.py` reads the folders. Then the script js/moved.js shows the words in the visitor's language before the first line is drawn. It uses `?lang=`, else the language saved with the language button, else the browser's list. The English stays when the words do not arrive and when JavaScript is off. The jump is unchanged. `node tests/moved-pages.test.mjs` opens all 13 pages in the 5 languages, with and without JavaScript.
- **`redirects-B`: the launch check saw nothing forwarded.** It counted a real redirect only. For `/faq` it saw a 308 to `/faq/` and called that forwarded; for `/parties/` it saw a page that answers 200. The patch teaches tools/launch_check.py to follow the small page's jump and to check the destination answers 200.
- **`phone-number-shown`: the consistency test allows exactly one number.** The patch changes it to allow the two known numbers (`704-207-6347` for the day of the visit, `704-628-6232`). Without that edit `consistency` fails.
- **`winter-A` broke two notes in the docs.** The docs name places in `index.html` by words and count them (`node tests/docs.test.mjs`). The new "Tell me when it opens" button adds an eepurl link (7 places became 8) and a second `class="btn btn-sm btn-red"`. The patch updates both lines of `docs/QUESTIONS_FOR_THE_FARM.md`. The playbook later got a third note with the same count (the Mailchimp button, 7 places), which the patch now updates too (found on 3 October 2026 by the settings-filled run).
- **`reserve-window` fails one `hero` check.** The test previews spring with the season switcher while its pinned date is in October, outside the booking window. So the spring Reserve button is hidden on purpose, and the check "the card buttons are Reserve the farm and Directions" saw only Directions. The patch makes that one check expect no Reserve button when the card's button carries `data-book`. `hero` then passes with `winter-A` and `reserve-window` together (80 checks).
- **`seasonPicker: false` and the tests.** `dated`, `analytics` and `i18n-early` already turned the season switcher on for themselves (the test adds `WISE_ACRES.seasonPicker = true` to its own copy of the page). `hero`, `games` and the other tests that look at or click it did not, and failed when the setting was false (found by the settings-filled run). The patch now carries one change to `tests/lib.mjs`: every page a test opens has the switcher on, unless the test writes `js/content.js` itself (the `seasonPicker: false` part of `hero` does).
- **`reserve-window`: the extra pages threw an error after the rebuild.** `tools/pages.py` copies `applyOnly` from `js/hero.js` into `js/footer-art.js` for the pages without the hero picture. The patch had put its helper `bookable` next to `applyOnly`, so the copy called a function it did not have ("bookable is not defined" on every extra page). The helper now lives inside `applyOnly`. Found by the settings-filled run (`dated`, `deploy`, `print-qr` and `messages` all saw the error).
- **`clean-addresses-C`: the validity test.** It asks that every address in `sitemap.xml` is a real page. Without `.html` (`/wise-pie`) nothing matched, so `validity` failed. It now also accepts the page file with `.html`. Found with the other checks of the settings-filled set.
- **`phone-number-shown`: one unit test failed.** `tools/test_check_facts.py` (run by the `pipeline` test) puts the phone number into the footer itself and failed when the patch had done it already. It now leaves the footer alone when the number is there.
- **Filled-in settings and the docs test.** The docs name `reviewUrl`, `farmPoint` and the Mailchimp `signup` action by the setting's name, not by today's empty value. For example they say `reviewUrl:` (2 places), not `reviewUrl: ''`. So `node tests/docs.test.mjs` stays green when the owner types her values (tried with made-up values for all three). `--settings filled` runs the docs test too.
- **Cloudflare Pages without `clean-addresses-C` fails the launch check** (`page-redirect`): Cloudflare answers `/wise-pie.html` with a 308 to `/wise-pie`, and the pages name the `.html` address. That is the reason the patch exists; on Cloudflare take it.

## What was run (3 October 2026) and what was not

- **The three patches added last** (`qr-one-address-line`, `qr-stronger-codes`, `games-B-pick-snips-sunflowers`, on 3396be7), 3 October 2026:
  - Each applies alone with `git apply --check`; all 51 sets of `option-patches` apply (every set inside each group of patches that touch the same files, plus everything at once); running `python3 tools/make_qr.py` after either QR patch, or after both, changes nothing.
  - With all three applied, these tests pass. Files and rebuild: `consistency` (67 checks), `docs` (10), `public-site` (13), `plain-lint`, `pipeline` (31, the rebuild is identical), `validity` (43), `launch-check` (70), `files-audit` (12) and `review-sheet` (157).
  - Also with all three applied, in a browser: `i18n` with `i18n-early` and `i18n-a11y` (119), `languages` (18), `hero` (80), `touch` (95), `calm` (39), `keyboard` (164), `privacy` (39) and `print-qr` (105).
  - `games` (92 checks) ran with `games-B` alone.
  - `print-qr` has one check that depends on the fonts of the computer it runs on (the language names in the "also in" line must not be empty boxes). On the computer used here it failed once on the plain site (before any patch) and once with the patches, and passed on every other run. It is not about the patches.
  - The settings-filled matrix run (`python3 tools/option_matrix.py . --settings filled`) was tried on the set with every patch that fits together, on Cloudflare Pages. That set has 11 patches: `winter-A`, `reserve-window`, `redirects-A`, `clean-addresses-C`, `code-cache-D`, `phone-number-shown`, `season-picker-off` and the three new ones.
  - Its cheap steps pass: apply, rebuild twice with the same result, `missing`, `orphans`, `public-site`, `docs`, `consistency` and the launch check.
  - Its slower tests found four problems. All four are fixed inside the patches (see "What combining them found"). They were the Mailchimp count in the playbook (`winter-A`), "bookable is not defined" on the extra pages (`reserve-window`), `tools/test_check_facts.py` (`phone-number-shown`) and the tests that need the season switcher (`season-picker-off`).
  - Running the `validity` test by hand found a fifth problem, with `clean-addresses-C`. It is fixed in that patch.
  - After the fixes, the same set was built by hand. It was rebuilt, `python3 tools/make_qr.py` was run, and the review link, farm spot and Mailchimp form were filled with made-up values.
  - These tests were run on it: `pipeline` 31, `dated` 28, `deploy` 28, `hero` 80, `games` 92, `messages` 173, `keyboard` 164, `calm` 39, `no-js` 302, `auto-dark` 7, `forced-colors` 17 and `privacy` 38 of 39.
  - The one `privacy` failure is the made-up Mailchimp address, which is not on the list of allowed addresses. It is the filled-in value, not a patch.
  - `print-qr` gave 104 of 105 (the font check described above). Before the fixes, `farm-seasons` (24 checks) and `live` (20) passed on the same set.
- **After the second batch of site fixes, 3 October 2026.** The three new patches and the changes to the docs apply on top of it with `git apply --check`. `option-patches` passes (68 checks; 53 before the three patches were added), and so do `docs`, `public-site`, `consistency` and `plain-lint`. The cheap steps of the settings-filled run pass on the set with 11 patches (see above).
- **Clock wording (d37), checked in a browser** on 3396be7 with the page clock at Friday October 9, 2026, 2:30 pm in New York, for a visitor in New York and one in Los Angeles. English: "Open now, until 8 pm". Spanish: "Abierto ahora, hasta las 8 p. m." and "...a las 5:00 p. m., hora del Este". Vietnamese: "Đang mở cửa, đến 8 giờ tối" and "5 giờ chiều (giờ miền Đông)". Hindi and Chinese use their own clock words. This is why the two old clock patches are not needed.
- **All 264 combinations, cheap checks, on af1e572** (apply, rebuild twice, `missing`, `orphans`, `public-site`, `docs`, `consistency`, launch check on the pretend host):
  - Cloudflare Pages: 144 combinations, 72 PASS (every one with `clean-addresses-C`) and 72 FAIL (every one without it: `page-redirect`).
  - Netlify: 72 of 72 PASS.
  - GitHub Pages: 48 of 48 PASS.
  - The same on 42fd196 plus the launch-check patch, before the `winter-A` docs fix. Then again for every `winter-A` combination after it: 64 PASS, 24 FAIL (the same Cloudflare rule).
- **Cloudflare with Cloudflare's own test server** (`--wrangler`): 13 Cloudflare combinations (no options, and every set with `clean-addresses-C` plus redirects-A or redirects-B). The result was the same as with the pretend host: 12 PASS and 1 FAIL (no options).
- **Slower tests** (`pipeline`, `deploy`, `farm-seasons`, `live`, `dated`, on 42fd196 plus the launch-check patch): 7 of the 11 combinations in the pair-cover set finished, all PASS.
  - Finished: no options (also `hero` 80 and `features` 59), `redirects-B`, `winter-A+redirects-A+clean`, `winter-A+redirects-B+D+phone`, `winter-A+reserve-window+clean+phone`, `reserve-window+redirects-A+clean+D+phone`, and the all-on A side (`features` 59; `hero` failed one check, fixed in `reserve-window.patch`, see above).
  - Not run: the other 4 combinations of the set (`winter-B` ones), the `hero` and `features` run on the all-on B side, and the heavy part of `--settings filled` (its cheap part ran; the docs test is skipped there).
- **Behaviour with a page clock.** The test used 6 sets (nothing, winter-A, winter-B, reserve-window, winter-A+reserve-window, winter-B+reserve-window), 11 dates from September 2026 to August 2027, the home page, the strawberry page, the First-visit page, and every `data-only` and `data-book` element. Each combined set shows exactly what its two patches show alone (0 differences).
- **After the rebase on f176745:** all patches apply, and `option-patches` and `docs` pass. A sample of 7 combinations (no options on each host, and the all-on sets) gives 6 PASS and 1 FAIL (Cloudflare without `clean-addresses-C`).
- **`map-without-traced-land.patch` (added after the list above).** With it applied, these tests pass: `map`, `farm-seasons`, `features`, `i18n-a11y`, `layout-sweep`, `keyboard`, `sprite`, `public-site`, `docs`, `consistency`, `validity`, `files-audit`, `licences`, `plain-lint`, `pipeline` and `option-patches`. The map was looked at in English, Spanish, Hindi, Chinese and Vietnamese at 390 and 1280 pixels wide; the map is not printed (the print rule hides it). Six combinations were tried with the cheap checks: the patch alone on each host and three sets with other patches. 3 PASS. The other 3 FAIL for reasons that are not this patch: Cloudflare without `clean-addresses-C` (the rule above), and two sets with `winter-A`, where the `docs` check finds `eepurl.com/hZehgr` 8 times and `docs/DECISION_PLAYBOOK.md` says 7 (`winter-A` alone fails the same way). The other combinations with it were not run.
- **`privacy-page.patch` (added after the list above).** With it applied and the rebuild line run, these tests pass: `privacy-page` (new), `privacy`, `analytics`, `axe`, `layout-sweep`, `keyboard`, `sprite`, `no-js`, `i18n`, `i18n-early`, `i18n-a11y`, `languages`, `auto-dark`, `deploy`, `pipeline`, `review-sheet`, `public-site`, `seo`, `docs`, `consistency`, `validity`, `files-audit`, `licences`, `launch-check`, `plain-lint` and `option-patches`. The patch applies alone and with every set of the other patches that does not conflict. Eight combinations were tried with the cheap checks: 7 PASS and 1 FAIL (Cloudflare without `clean-addresses-C`, the rule above). The page was looked at in English, Spanish and Chinese at 390 and 1280 pixels wide, and with the visit counter switched on. The Spanish, Hindi, Chinese and Vietnamese texts were written by Claude and were not read by a native speaker.
- **Not covered:**
  - Real Netlify and GitHub Pages (their pretend hosts follow the documentation).
  - A real browser on a phone.
  - The slower tests on every combination (`--heavy all` would take many hours).
  - `drive`, `messages` and the other tests on the combinations.
  - The Spanish, Hindi, Chinese and Vietnamese wording of the winter notes. It was written in the earlier patches and not rechecked by a native speaker.

## Old addresses and where they go (redirects A and B)

| Old address | Goes to | Why |
|---|---|---|
| /wiseacres, /wiseacres/ | home page, #visit | the farm and where to find us |
| /faq, /faq/ | home page, #faq | frequently asked questions |
| /food, /food/ | /wise-pie | the pizza page |
| /the-greenhouse, /the-greenhouse/ | home page, #greenhouse | The GreenHouse |
| /about, /about/ | home page, #about | "It started with our kids" |
| /contact, /contact/, /contact-us/ | home page, #contact | directions and contact |
| /flowers, /flowers/, /flowers-photographers/ | home page, #flowers | u-cut flowers and photography |
| /schooltours, /schooltours/, /school-tours/ | /school-field-trips | school field trips |
| /parties, /parties/, /parties-school-tours/ | home page, #groups | school tours, parties and events |

Left out on purpose: `/summer/` and `/posts/` (the owner decides, launch decision D3). They show the "page not found" page, and the launch check lists them as a warning.

## Choices that have no patch, and old copies

Nothing in this list is waiting to be redone. Each entry says what to do, or why there is nothing to apply.

- **d37 clock words** (the old `es-OPTIONAL-clock-12h.patch` and `vi-OPTIONAL-clock-words.patch`). Not needed. They wanted Spanish times written "5:00 p. m." and Vietnamese times written "5 giờ chiều". The code already writes them that way: `js/features.js` at `const fmtClock = (date, tz) => {` (Spanish in the 12-hour form; Hindi, Chinese and Vietnamese through `W.clock`), `js/live.js` at `function timeLabel(mins)` and `js/i18n.js` at `W.clock = (h, m, code) => {`. It was checked in a browser on 3 October 2026 (see "What was run"). The old patches edit the same lines: applying them would undo this work. If the native speaker (d37) wants other wording, the fixed texts are in `lang/src/<code>.json` and the clock words are in `W.clock`.
- **d66 stop saying "new this year" from January 1.** No patch. The word is in eight sentences (seven in `index.html`, one in `pages/pumpkin-patch.html`; the places are listed in DECISION_PLAYBOOK, d66 A). Changing a sentence gives it a new id, and four translations have to follow. About 40 places in 4 documents (the playbook, the questions page and the owner calendar in both languages) name those ids and would all change with it. Hiding single words by date (`data-until`) is possible, but from January 1 the Site check box would list every hidden word as a warning, eight lines the owner has to ignore. So the safe way is to make the change by hand, with her wording, when she answers. The ribbon, the chip and the NEW line already hide themselves after their last day.
- **d24 the 2026 fall prices in 2027.** No patch beyond `winter-A-hide-fall-booking.patch` (see the answer table above). Its limit: from August 12, 2027 the page is in its fall look, so the 2026 prices show again. Hiding them then would leave the fall page with no prices, so the real answer is d24 A, the 2027 details (a data change by the owner).
- **d68 B, C, D.** A lower number, sunflowers drawn in the middle, or leaving it. The first two need her number or a drawing change; there is nothing to prepare before she answers.
- **Old copies of earlier patches, never part of the site** (winter A and B for b54427b, `winter-C`, `2-OPTIONAL-cloudflare-no-html-addresses.patch`) are replaced. That last one only changed `tools/pages.py`; `clean-addresses-C` does the same and also the public-site test and the wording. The patches `games-B.patch` and `OPTIONAL-qr-no-duplicate-line-66c8272.patch` were remade as `games-B-pick-snips-sunflowers.patch` and `qr-one-address-line.patch`, and the stronger-codes change that was only a one-letter note is now `qr-stronger-codes.patch`.
- The tree wording for winter (option C of d01) is already in the code.
