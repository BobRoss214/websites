# Optional patches: the table

The farm's open decisions that change files are ready as patches in `patches/optional/`. The owner's answers (the dashboard, `docs/DECISION_PLAYBOOK.md`) choose which ones to apply. This page is the one table of them: file, order, which hosts, what to run after, and what was checked when they are combined.

Nothing here decides anything. A patch changes nothing until it is applied, and every patch file can be applied or left alone on its own.

## The table

Apply in the order of the first column (the same order the checks used). "After" is what to run once the patches are applied; `REBUILD` means this whole line, then `missing` for each language (0 missing each):

```
python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py jsstrings && python3 tools/i18n.py build
python3 tools/i18n.py missing es   (and hi, zh, vi)
```

| Order | File | What it does | Answers | Hosts | Cannot be combined with | After |
|---|---|---|---|---|---|---|
| 5 | `patches/optional/season-picker-off.patch` | `seasonPicker: false` in `js/content.js`: visitors see the season of the calendar and no "See the farm in..." buttons. The three tests that click that switcher (`dated`, `analytics`, `i18n-early`) turn it on for themselves, so they pass with either setting. | D6 (checklist 3.8) | any | none | nothing to rebuild; upload again |
| 10 | `patches/optional/winter-A-hide-fall-booking.patch` | Out of fall the home page hides the fall Reserve button, packages, add-ons, "See prices" and the "At the farm" shop block, and shows one line with a "Tell me when it opens" button. One new sentence, translated in the patch. | d01 A, d24 B | any | winter-B | REBUILD |
| 10 | `patches/optional/winter-B-fall-prices-note.patch` | Keeps every fall price visible all year and adds one line before them: "These are the fall 2026 prices and times. New ones come later." One new sentence, translated in the patch. The sentence says 2026. | d01 B | any | winter-A | REBUILD |
| 20 | `patches/optional/reserve-window.patch` | The spring Reserve buttons show only from 3 weeks before strawberry season until it ends. Summer and fall buttons are never hidden by it. No new text. | d25 A | any | none | `python3 tools/pages.py` (REBUILD is also fine) |
| 30 | `patches/optional/redirects-A-redirects-file.patch` | Adds `_redirects`: 22 lines, all 301, from the old wiseacresorganic.com addresses to the matching page or section (list below). | d30 A | cloudflare, netlify | redirects-B | nothing to rebuild; upload again |
| 30 | `patches/optional/redirects-B-redirect-pages.patch` | 13 small "this page has moved" pages in folders (`faq/`, `food/` ...), for hosts that ignore `_redirects`. Also lets `tools/make_deploy_folder.py` upload those folders. Not a true 301. | d30 A | any (the only choice on GitHub Pages) | redirects-A | nothing to rebuild; upload again |
| 40 | `patches/optional/clean-addresses-C-cloudflare.patch` | Pages name themselves to Google without `.html` (`/wise-pie`), which is the address Cloudflare Pages shows. Sets `PAGE_EXT = ''` in `tools/pages.py`; edits the public-site test and the README and checklist wording. | d05 (Cloudflare), d38 | cloudflare | none | `python3 tools/pages.py` (rewrites the 5 extra pages and `sitemap.xml`) |
| 50 | `patches/optional/code-cache-D-5-minutes.patch` | css, js and lang files are cached 5 minutes instead of 1 hour (`_headers`), so a change reaches visitors within minutes. | d05 | any that reads `_headers` (no effect on GitHub Pages) | none | nothing to rebuild; upload again |
| 60 | `patches/optional/phone-number-shown.patch` | Shows 704-628-6232 (a `tel:` link) in the footer of every page and in the home page's Google data. Updates the consistency test to allow the two known numbers. The "Questions?" fact and the contact cards stay as they are. | d04 A | any | none | REBUILD |

The patches used to be called OPT-A (`redirects-A`), OPT-B (`redirects-B`), OPT-C (`clean-addresses-C`) and OPT-D (`code-cache-D`); a few messages still use the old names.

Every patch file starts with a header (`Option:`, `Name:`, `Does:`, `Answers:`, `Group:` for alternatives, `Profile:` for a patch the matrix only tries in the settings-filled run, `Conflicts:`, `Requires:`, `Host:`, `Order:`, `After:`, `Strings:`). `git apply` ignores it. `tests/option-patches.test.mjs` checks the headers and that every patch applies.

How to apply one (from the site folder, with no unsaved changes you would miss):

```
git apply patches/optional/winter-A-hide-fall-booking.patch
python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py jsstrings && python3 tools/i18n.py build
python3 tools/i18n.py missing es    # then hi, zh, vi: 0 missing each
node tests/run-all.mjs public-site consistency
```

Apply several in the order of the table. `git apply` is strict (no fuzz): if it says a patch does not apply, the files changed since the patch was made; do not force it, ask for it to be redone.

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
| d24 fall 2027 | B hide fall content between seasons | `winter-A-hide-fall-booking.patch` (the same patch as d01 A) |
| d24 fall 2027 | A the 2027 details, C keep | none (a data change, or nothing) |
| d25 Reserve buttons | A hide them out of season | `reserve-window.patch` |
| d04 phone | A show it | `phone-number-shown.patch` (footer and Google data; the contact cards are a later step) |
| d05 host | Cloudflare Pages | `clean-addresses-C-cloudflare.patch` (without it the launch check FAILs: Cloudflare redirects `/wise-pie.html`, the pages name that address) |
| d05 host | Netlify or GitHub Pages | none for the page addresses (they show both) |
| d05 any host | shorter cache | `code-cache-D-5-minutes.patch` |
| d30 old addresses | A, host reads `_redirects` (Cloudflare, Netlify) | `redirects-A-redirects-file.patch` |
| d30 old addresses | A, host does not (GitHub Pages) | `redirects-B-redirect-pages.patch` |
| d30 old addresses | leave them | none (the launch check only warns) |
| D6 seasonPicker (launch decision) | false | `season-picker-off.patch` (it also keeps three tests working: if you only type `false` into `js/content.js`, `dated`, `analytics` and `i18n-early` fail) |

Settings, not patches (type them into `js/content.js`; no rebuild): `reviewUrl` (d06; then `python3 tools/make_qr.py` makes the review sign), `farmPoint` (d11), the Mailchimp `signup.action` and `languageField`. `python3 tools/option_matrix.py --settings filled` tries them filled in (made-up values) together with `season-picker-off.patch`, on the 3 most different sets of patches.

## Hosts

| Host | Reads `_headers` and `_redirects` | `/x.html` | Allowed patches |
|---|---|---|---|
| Cloudflare Pages | yes | answers 308 to `/x` | all; take `clean-addresses-C` too |
| Netlify | yes | shows both `/x.html` and `/x` | all except `clean-addresses-C` |
| GitHub Pages | no | shows both | all except `redirects-A` (it needs `_redirects`), `clean-addresses-C`; `code-cache-D` does nothing |

## Trying them together

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
- `--settings filled` runs the 3 most different sets again. The review link, the farm spot, the Mailchimp form and language field are filled in (made-up values), with `season-picker-off.patch`. `print-qr` and `messages` are added.

The output is one PASS or FAIL line per combination, with the first failing check. The full results and logs go in a results folder it names.

The pretend hosts are written in the tool, from each host's own documentation. Cloudflare Pages answers `/x.html` with a 308 to `/x` and `/dir` with a 308 to `/dir/`. Netlify and GitHub Pages show both. GitHub Pages ignores `_headers` and `_redirects`. The Cloudflare one was compared with `wrangler pages dev` (Cloudflare's own test server) on 28 addresses for 4 upload folders (plain, with redirects-A, with redirects-B, with clean-addresses-C): the same status and `Location` every time. Netlify and GitHub Pages are not compared with the real hosts.

## What combining them found (and where it is fixed)

Every fix is inside the optional patch it belongs to. The base files are untouched.

- **Translations collided.** The old winter patches added their new sentence at the end of `lang/src/*.json`, where the phone patch adds its own: any two of them touched the same lines. Each patch now puts its new key at its alphabetical place.
- **Notes in README and the checklist collided.** `redirects-A`/`redirects-B` and `clean-addresses-C` edit lines next to each other in "Putting it online". Hunks in README, the checklist and the translation files carry one line of context instead of three, so every set applies with plain `git apply`.
- **`clean-addresses-C` carried 5 generated pages and the sitemap.** Those stopped applying whenever a page changed. It is now only the source files (`tools/pages.py`, the public-site test, README, checklist); `python3 tools/pages.py` writes the pages and the sitemap.
- **`redirects-B`: the folders were never uploaded.** `tools/make_deploy_folder.py` leaves out every top folder it does not know ("not part of the website"), so the 13 redirect pages would not have reached the host. The patch adds the folders to its list.
- **`redirects-B`: the launch check saw nothing forwarded.** It counted a real redirect only. For `/faq` it saw a 308 to `/faq/` and called that forwarded; for `/parties/` it saw a page that answers 200. The patch teaches tools/launch_check.py to follow the small page's jump and to check the destination answers 200.
- **`phone-number-shown`: the consistency test allows exactly one number.** The patch changes it to allow the two known numbers (`704-207-6347` for the day of the visit, `704-628-6232`). Without that edit `consistency` fails.
- **`winter-A` broke two notes in the docs.** The docs name places in `index.html` by words and count them (`node tests/docs.test.mjs`). The new "Tell me when it opens" button adds an eepurl link (7 places became 8) and a second `class="btn btn-sm btn-red"`. The patch updates both lines of `docs/QUESTIONS_FOR_THE_FARM.md`.
- **`reserve-window` fails one `hero` check.** The test previews spring with the season switcher while its pinned date is in October, outside the booking window. So the spring Reserve button is hidden on purpose, and the check "the card buttons are Reserve the farm and Directions" saw only Directions. The patch makes that one check expect no Reserve button when the card's button carries `data-book`. `hero` then passes with `winter-A` and `reserve-window` together (80 checks).
- **`seasonPicker: false` and the tests.** `dated`, `analytics` and `i18n-early` click the season switcher, which the farm will hide. Each turns it on for itself (the test adds `WISE_ACRES.seasonPicker = true` to its own copy of the page), so they pass with either setting, and `season-picker-off.patch` only flips the setting.
- **Filled-in settings and the docs test.** The docs name `reviewUrl`, `farmPoint` and the Mailchimp `signup` action by the setting's name, not by today's empty value. For example they say `reviewUrl:` (2 places), not `reviewUrl: ''`. So `node tests/docs.test.mjs` stays green when the owner types her values (tried with made-up values for all three). `--settings filled` runs the docs test too.
- **Cloudflare Pages without `clean-addresses-C` fails the launch check** (`page-redirect`): Cloudflare answers `/wise-pie.html` with a 308 to `/wise-pie`, and the pages name the `.html` address. That is the reason the patch exists; on Cloudflare take it.

## What was run (3 October 2026) and what was not

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
- **After the rebase on 05b0b72:** all patches apply, and `option-patches` and `docs` pass. A sample of 7 combinations (no options on each host, and the all-on sets) gives 6 PASS and 1 FAIL (Cloudflare without `clean-addresses-C`).
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

## Not in `patches/optional/`

- The old copies in the scratchpad (winter A and B for b54427b, `winter-C`, the clock patches, `seo-audit .../2-OPTIONAL-cloudflare-no-html-addresses.patch`) are stale or replaced. The seo-audit one only changed `tools/pages.py`; `clean-addresses-C` does the same and also the public-site test and the wording, so it replaces it.
- The tree wording for winter (option C of d01) is already in the code.
