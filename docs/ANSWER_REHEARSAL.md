# Trying the owner's answers on a copy of the site

For whoever edits the site (not for the farm owner).

When the farm owner answers a question on the dashboard, `docs/DECISION_PLAYBOOK.md` says what to change. Those notes were written by reading the files. This page says what happened when the steps were tried for real, one answer at a time, on a throw-away copy of the site. It also says how to try them again.

Nothing here decides a question. The real site folder was never changed.

## What was done

For every answer that is a plain edit of the files (not an optional patch), `tools/rehearse_answers.py` did this:

1. It made a copy of the site in a temporary folder.
2. It followed the playbook's steps for that answer the way a person would: open the named file, find the place named by its words, change the words, run the command the entry names. A step that cannot find its place, or finds it a different number of times than the entry says, is reported as a wrong step.
3. It ran "The standard steps" of the playbook: `python3 tools/pages.py`, `python3 tools/i18n.py extract`, `jsstrings` and `build`, and `missing` for es, hi, zh and vi.
4. It wrote stand-in translations (the English words, or a short example where a test needs one) so that "missing" says 0. The replay does not translate anything: the real translations are the job of whoever does the answer.
5. It ran the checks that need no browser: `docs`, `consistency`, `files-audit`, `plain-lint`, `public-site`, `validity` (when a page file changed) and `launch-check` (when the answer touches what that check reads: links, address, headers, settings, placeholders).
6. When the answer changes live text or dates, it ran ONE targeted browser test on its own ports (live, dated, languages, features, hero, drive, print-qr or gallery, whichever the entry names first), one browser at a time.
7. It threw the copy away.

The answer used in each replay is an example (for example a price of $35, a closing day of November 30, the address written "Hartis Rd"). `python3 tools/rehearse_answers.py --list` prints what each replay does.

## What the result words mean

- **pass**: every step found its place, the rebuild is clean, "missing" is 0, and every check passed.
- **follow-up**: the same, except that `node tests/docs.test.mjs` lists notes that still name the old words. That is expected after any answer. The notes (this playbook, the README rows, the other docs) name places by the words the answer just changed, so the docs test tells you which notes to update. It is not a broken step. Step 3 of "How to use it" in the playbook says so.
- **FAIL**: a step was wrong, or a check other than the docs check failed. Every FAIL found was fixed (see below) and replayed.

## What was tried, and what was not

The playbook has 234 answers (the 87 questions d01 to d87). 110 were replayed. 124 were not:

| Not replayed | Answers | Why |
|---|---|---|
| No change (the answer leaves the files as they are) | 81 | Nothing to do, so nothing to try. |
| A code change only Claude can make | 21 | The entry gives the owner no file steps to follow (d08 A, d09 B and C, d10 C, d32 A, d46 C, d48 C, d50 C, d59 A, d64 B and C, d67 B, d68 C, d69 A, d70 B, d72 A and B, d78 B, d81 A, d82 A, d86 C). |
| An optional patch | 7 | `node tests/run-all.mjs option-patches` tries them (d01 A and B, d05 A and C, d24 B, d25 A, d30 A). Four more, d65 C and D, d68 A and d86 B, are replayed (see "Optional patches"). |
| Her own words or numbers, the same steps as another answer | 10 | d07 C, d26 C, d45 C, d53 C, d58 C, d74 C, d75 C, d76 C, d78 C, and d31 A (the optional credit: as d61 B). |
| The same kind of edit as another answer, in many sentences | 2 | d79 B and d80 B: about eight and about twenty sentences, found by the consistency test, like d51 B. |
| Needs her own photos or her whole 2027 content | 3 | d12 A, d34 A and d24 A. |

`python3 tools/rehearse_answers.py --list --skipped` prints every one with its reason.

### Optional patches

The patches in `patches/optional/` that answer a question are replayed too: the tool applies the patch the way the playbook says (`patch -p1`; a hunk that does not fit is a wrong step), runs the checks, and one browser test.

| Answer | Patch | What was checked | Result |
|---|---|---|---|
| d65 C | qr-one-address-line.patch | It applies; `python3 tools/make_qr.py` afterwards changes nothing in `print/` or `assets/qr/` (the patch header says so); consistency; print-qr | pass |
| d65 D | qr-stronger-codes.patch and qr-one-address-line.patch | Both apply in that order; make_qr changes nothing; consistency; print-qr | pass |
| d68 A | games-B-pick-snips-sunflowers.patch | It applies; consistency; the games test (the patch adds a part to it) | pass |
| d86 B | map-without-traced-land.patch | It applies; docs (it edits the README and the licence list); the map test | pass |

The entries of d65, d68 and d86 name these patches and say what each one changes. The words match the patch headers.

### Questions d74 to d87, and d04 with four options

These were added to the playbook after the first rehearsal. Every answer that is a file edit was replayed the same way (13 replays: d04 B and D, d74 A, d76 A, d79 A and C, d80 A and C, d83 A, d84 A, d85 A, d87 A and B). All 13 pass, or are follow-ups only. The other 91 answers ran their no-browser checks on the earlier site (all of them), and every step of all 110 was checked again on the current site; the answers that had a wrong step ran the whole replay again. The notes of the entries have the same words as the dashboard (the export of 3 October 2026, d01 to d87). What the replays showed:

- d76 A (the new file `.gitattributes`) needs no other change: the file audit and the upload folder accept it.
- d83 A (Hindi months) changes only the Hindi values, so no id changes and "missing" stays 0.
- d85 A needs its four translations: the numbers of a translation must match the English ("101").
- d84 A: the new red (#7a0f20) has a contrast of 5.4 against the darkest sky colour. The first idea (#8f1226) gave 4.53, too close to the 4.5 limit.
- d04 now has four options (A the main number, B the day-of number for everyone, C no phone, D some pages only). The old B (keep it hidden) is now C; the old C is now D.

## What was wrong, and what was fixed

The first full pass found these. Each one is now fixed in the words of `docs/DECISION_PLAYBOOK.md`, and the replay of the answer passes. The site files were not changed. One tool was: see d60 A.

| Answer | What the playbook said | What really happens | Now it says |
|---|---|---|---|
| d10 D (Drive time box off) | Take "drive" out of the run order. | `tests/run-all.mjs` runs every file in `tests/`; the order list only sorts. The drive test still ran and failed. | Delete `tests/drive.test.mjs` and its README row. |
| d11 A (farm spot) | Tests: none (the drive test sets farmPoint itself). | Two tests fail. `tests/launch-check.test.mjs` has a test that swaps the numbers of `farmPoint: null`; with real numbers there is nothing to swap. `tests/drive.test.mjs` expects the farm to be searched for in every case but one, so "two searches and one route" fails. | Both changes, with the words to type. |
| d16 A (any 2 pizzas) | The patterns "must still match". | Three patterns in `tests/consistency.test.mjs` read "Includes 2 Wise Pie pizzas, plus" and found nothing once "any" was added. The strings count was 2, it is 3. | The three patterns by name, and the small change for each. 3 ids. |
| d16 B (only some pizzas) | Put the list in the same three places. | In two of them the sentence ends "(ages 3+). Friday-Sunday." A list placed before the days broke the days check. | The list goes at the very end. 3 ids. |
| d18 A and B (oven) | Change both patterns (A); delete the oven fact and the ALLOWED_EXTRA entry (B). | The old translations (with the Celsius 370) stay in `lang/src/*.json` and are still checked, so A must keep the old wording in ALLOWED_EXTRA. In B, deleting that line stops the whole consistency test with an error. | A: both wordings. B: delete only the oven fact. |
| d20 B (ready time) | Keep the phrase or change the pattern. | The pattern says "hour" and does not find "2 hours". | The pattern is given: `hours?`. |
| d23 A (fall ends Nov 30) | Write "end of November". Nothing about the year bar. | The year-bar check and the season-words check read early, mid or late, not "end of". The bar ended too early. | "late November" in the 7 places, the bar's end number, and the test pattern. |
| d26 B (flowers) | Tests: none (not pinned). | The year-bar check reads "April to July and September" on its own line of the test. | Two numbers and a word to change, and the wording to use. |
| d29 B (skip the hashtag sign) | Lower the count in print-qr. Delete the block. | The consistency test counts 9 printed signs as well. The Hindi, Chinese and Vietnamese lines of the sign were left behind. | Both counts, and the three lines. |
| d38 B (new address) | Fix 3 lines in `tools/test_pages.py`. | `tests/launch-check.test.mjs` holds the address too (`const SITE`). | Named. |
| d39 A (Rd) | Tests: none. | The QR signs check wants the directions sign to say "Road" while the structured data says "Rd". The sign also has its words in the Hindi, Chinese and Vietnamese lines. | The test change, and all five languages of the sign. |
| d39 B (Road) | "Keep the map links equal to the Business Profile." | 17 places in four files carry "Hartis+Rd" or "Hartis%20Rd". The consistency check "directions links" fails on them. The JS strings are 1, not 2. | Every place, with its count. |
| d45 B (infants only) | Give the free-age fact a new pattern. | The wagon ride line ("Ages 2 and younger") is read by the same fact: two answers. The pizza package pattern reads "(ages 3+)". | The wagon ride gets its own fact; the second pattern is named. |
| d50 B (tree dates) | Change the words and the dates. | The test has the word "early December" and the bar's range written in; the bar was not mentioned. Which word goes with which day was nowhere. | Early is day 1 to 10, mid 11 to 20, late 21 on; the bar number and the two test lines. |
| d51 B (hours) | About 25 sentences, for example these. | Two table rows ("4 pm - 8 pm" in the pizza ways table) are not on the list. The consistency test names them, which is the way the entry says to find the rest. | The two are listed. |
| d52 B (other e-mail) | 9 ids. | Only 6 contain the address. Three say "Cathy" in words. | 6 ids, and what the other three are. |
| d07 A, d61 B (strings) | 5 ids; 0 strings. | Two ids end as the same words (4 new sentences). A new photo caption is 1 JS string. | Corrected. |
| d51 B (hours) | Tests: live (open-now badges). | `tests/live.test.mjs` says in two places that the pizza closes at 8 pm; with 9 pm the test fails ("Pizza at 6 pm: open until 8 pm"). | The two places are named. |
| d23 A (fall ends Nov 30) | The dated test must be redone. | It passes without a change (tried). It pins the pizza rows and the "No pizza" box. | Says so. |
| d47 C (other pre-order page) | Replace the Square address in 6 places. | The print style names the store address too: `css/extras.css` has it in 3 places (without them the pre-order button is missing from a printed page), and two tests list it (print-qr: "wise-pie (en) prints an address for booking or sign-up"; privacy: "every web address in the shipped files is on the allow-list"). | The three places are given. |
| d58 B (concessions in fall only) | Delete the spring and summer cards (`tbf415391` and `t7528af5c`). | There is one card for spring and summer; `t7528af5c` is the fall card, which must stay. Deleting only the lines inside the card leaves an empty card and the farm-seasons test stops with an error. | The one card is named, with its start and end. |
| d75 B (remove the double-click file) | Delete the four checks in windows-reality. | The test also reads the file first, and a list of words the README must contain has `tools/serve.bat` in it. | The whole block and the list entry are named. Replayed now that the file is in the tree. |
| d77 A (GitHub checks) | (not replayed: the files were not in the tree) | Now replayed: copy the two files to `.github/workflows/`; the upload folder check still passes. | The note says where the files are. |
| d60 A (closed for rain) | Write the notice as { en, es, hi, zh, vi }. | A fault of the tool, not of the steps. `tools/launch_check.py` only saw a notice written as one plain text, so a notice left on in five languages passed unseen. | The tool reads all three ways of writing it; `tests/launch-check.test.mjs` has a case for it. |
| d65 C and D, d68 A | "see Patches on disk". | At the time those patches were not on disk. | They are now, and are replayed (see "Optional patches"). |
| d63 A (connect the sign-up form) | Tests: features, messages, privacy "already test the sign-up with a stand-in". | `tests/features.test.mjs` opens the page as it is served and expects the form hidden ("signup: not set up -> form hidden, old button shows"). With the address filled in that fails. | The one line to change is given. |
| All answers | "Make the change. Rebuild and test." | After any answer the docs test lists notes with the old words. | Step 3 of "How to use it" says to run it and fix the notes. |

One check failed once and passed on the second run (d28 C, the share-picture size check of `launch-check`): a slow machine, not a step.

The playbook's tests table ("Tests that can need an update") has three new rows: the QR signs count in consistency, the year bars in consistency, and `launch-check`.

## What the browser tests found

One browser test for each answer that changes live text or a date (the first test the recipe names), one browser at a time, on its own port. Four rounds: the first (d02 to d23) on the earliest tree, the second (d23 to d85, the new answers) on the tree before the optional patches arrived, the third (the four optional patches and many of the rest) on the real stack with the load-aware limits of the tests (`ms()` in tests/lib.mjs), the fourth (the last 32 answers, at low priority on a busy computer) on a later version of the site, after the second set of helper changes was joined. Each table row is the last result of the answer. A failing browser test is run once more (`--no-retry` turns that off); a pass the second time is shown as flaky.

100 answers have a result: 100 pass.

| Answer | Test | Result |
|---|---|---|
| d02 A | languages | pass |
| d02 B | languages | pass |
| d02 C | languages | pass |
| d03 A | languages | pass |
| d03 B | languages | pass |
| d04 A | languages | pass |
| d04 B | languages | pass |
| d04 D | languages | pass |
| d06 A | print-qr | pass |
| d07 A | farm-seasons | pass |
| d07 B | map | pass |
| d10 D | features | pass (flaky: failed once with 'still waiting at 4:59:51 PM' (the page clock ran on during a slow load); passed on the next run) |
| d11 A | drive | pass (flaky: failed on the old playbook words (a wrong note, since fixed); with the drive-test change the whole drive test passed on the answer's copy (136 checks)) |
| d13 B | gallery | pass |
| d13 C | gallery | pass |
| d15 A | - | pass |
| d16 A | languages | pass |
| d16 B | languages | pass |
| d16 C | languages | pass |
| d17 A | languages | pass |
| d18 A | languages | pass |
| d18 B | languages | pass |
| d18 C | languages | pass |
| d19 A | languages | pass |
| d19 B | languages | pass |
| d20 B | languages | pass |
| d21 B | languages | pass |
| d22 B | languages | pass |
| d23 A | dated | pass |
| d23 B | dated | pass |
| d26 A | features | pass |
| d26 B | languages | pass |
| d27 A | hero | pass |
| d28 B | languages | pass |
| d28 C | languages | pass |
| d29 B | print-qr | pass (flaky: failed once on the vi sheet font check (missing: one letter); run alone on the answer's copy it passes (105 checks), and so does the unchanged site) |
| d31 B | gallery | pass |
| d32 C | gallery | pass |
| d33 A | languages | pass |
| d33 B | gallery | pass |
| d33 C | gallery | pass |
| d35 A | languages | pass |
| d36 A | languages | pass |
| d37 A | languages | pass |
| d39 A | languages | pass |
| d39 B | drive | pass |
| d40 A | languages | pass |
| d41 A | languages | pass |
| d42 A | languages | pass |
| d42 B | languages | pass |
| d43 A | languages | pass |
| d44 A | languages | pass |
| d44 B | languages | pass |
| d44 C | languages | pass |
| d45 B | languages | pass |
| d46 B | features | pass |
| d47 B | languages | pass |
| d47 C | print-qr | pass |
| d48 B | farm-seasons | pass |
| d48 D | languages | pass |
| d49 A | languages | pass |
| d50 B | dated | pass |
| d51 B | live | pass |
| d52 B | messages | pass |
| d53 B | languages | pass |
| d54 A | languages | pass |
| d54 B | languages | pass |
| d55 A | languages | pass |
| d55 B | languages | pass |
| d55 C | languages | pass |
| d56 B | features | pass |
| d56 C | features | pass |
| d57 A | languages | pass |
| d57 B | languages | pass |
| d57 C | languages | pass (flaky: languages: failed once (FAIL languages: the test ran to the end  page.waitForEvent: Timeout 60000ms exceeded while waiting for event "download" ) and passed on the second ru) |
| d58 B | farm-seasons | pass |
| d60 A | dated | pass |
| d60 B | languages | pass |
| d61 B | languages | pass |
| d62 B | drive | pass |
| d63 A | features | pass (flaky: failed on the old playbook words (a wrong note, fixed); with the two features-test changes now written in the playbook (and a change to the test's clock, see "Checks that depend on the computer") the whole features test passed on the answer's copy (59 checks)) |
| d65 B | print-qr | pass |
| d65 C | print-qr | pass |
| d65 D | print-qr | pass |
| d66 A | hero | pass |
| d66 B | languages | pass (flaky: languages: failed once (FAIL languages: the test ran to the end  Error: Could not start the test server on port 48804: listen EADDRINUSE: addres) and passed on the second ru) |
| d68 A | games | pass |
| d68 B | hero | pass |
| d69 B | hero | pass (flaky: failed in the queue (ReferenceError: WISE_ACRES is not defined: the page's scripts did not load on a busy computer); run alone on the answer's copy it passes (80 checks)) |
| d71 B | languages | pass |
| d73 B | auto-dark | pass |
| d74 A | languages | pass |
| d79 A | languages | pass |
| d79 C | languages | pass |
| d80 A | languages | pass |
| d80 C | languages | pass |
| d83 A | languages | pass |
| d84 A | hero | pass |
| d85 A | languages | pass |
| d86 B | map | pass |

## Checks that depend on the computer, not on the answer

Three of the browser failures were not the answers' fault. Anyone who sees them should run the test again on its own before looking for a cause.

- **features: "still waiting at 4:59:51 PM"** (tests/features.test.mjs, the first check of "exact switch to open at 5:00 PM ET"; it failed for d10 D and d63 A). The page is opened with the page clock set to 4:59:50 PM and the check expects the countdown to be still waiting a moment later, but the clock keeps running while the page loads. On a busy computer (a load of 30 to 100 on 4 cores here) the load takes longer than the 10 seconds, the clock passes 5 PM and the page says "open". The load-aware limits (`ms()`) do not touch this check, because it is not a time limit but a clock position. The features test now opens the page at 4:59 PM and moves the clock past 5 PM by hand, so a slow load no longer reaches 5 PM before the first check.
- **print-qr: "every letter on the sheet is drawn by a font of this computer (no empty boxes)", the vi sheet, "missing: ह"** (d29 B, once). Only the first Hindi letter was reported, not the other Hindi letters on the sheet, and the same test passes on the unchanged site and on the d29 B copy (105 checks) when run alone. The test asks the browser which font drew each probe letter right after adding the letters; on a busy computer the first one is asked before the page has laid it out. The fonts of this computer are fine: FreeSerif and Unifont have Devanagari, WenQuanYi Zen Hei has the Chinese letters. A copy of the test that waits for the page to settle before asking was tried; that change is not in the test yet.
- **A test server on a port that another job uses.** Every browser test starts its own server on `WA_PORT`. When another job on the same computer uses that port, the test says "Could not start the test server ... EADDRINUSE", or it talks to the other job's pages ("WISE_ACRES is not defined" in the hero test for d69 B). The tool now picks a free port for each run.

Four failures were wrong notes in the playbook, now fixed: d11 A (the drive test), d63 A (the features test), d47 C (the print style and two tests name the old store address) and d58 B (one card, not two), see "What was wrong". One more run was flaky: d57 C (the languages test waited 60 seconds for a download on a busy computer and passed on the second run).

## Limits

- The replays used example answers. Another answer (another price, another day) can touch other places. The entries say "Strings" and "Tests" for the usual case.
- The translations are stand-ins. A check that reads translations (weekdays, months, numbers) can fail on a stand-in only. The tool tells those apart and marks the check as passed, with a note.
- Only one browser test ran per answer. An entry may name more (the playbook's "Tests:" line); run them when you do the answer.
- The tool follows the steps literally. It cannot judge whether the new words read well. That is the owner's choice and the translator's work.

## Run it again

```
python3 tools/rehearse_answers.py --list                    what each replay does
python3 tools/rehearse_answers.py --coverage                every answer of the playbook is replayed or has a reason
python3 tools/rehearse_answers.py --steps-only --all        only: does every step still find its place (a few seconds)
python3 tools/rehearse_answers.py d18=A d20=B               a few answers, with the rebuild and the no-browser checks
python3 tools/rehearse_answers.py --all --jobs 3            all 110 (about an hour)
python3 tools/rehearse_answers.py --all --quick --browser   the browser tests too, one at a time (several hours)
python3 tools/rehearse_answers.py d18=A --keep copies       keep the changed copy in the folder "copies" to look at it
```

`node tests/answer-rehearsal.test.mjs` (in `node tests/run-all.mjs`, no browser) does the quick part in under a minute: every answer is replayed or has a reason, every step still finds its place, one whole replay works, and the site folder is unchanged afterwards.

When it fails after you changed the playbook: fix the words of the playbook, then the recipe for that answer in `tools/rehearse_answers.json` if the place really moved. A recipe is a list of steps (file, the words that name the place, what to change, how many times). `tools/rehearse_answers.py --help` and the top of the file explain the step kinds.
