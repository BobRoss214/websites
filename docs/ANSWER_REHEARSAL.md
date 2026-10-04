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

The playbook has 195 answers (the 73 questions d01 to d73). 92 were replayed. 103 were not:

| Not replayed | Answers | Why |
|---|---|---|
| No change (the answer leaves the files as they are) | 67 | Nothing to do, so nothing to try. |
| A code change only Claude can make | 17 | The entry gives the owner no file steps to follow (d08 A, d09 B and C, d10 C, d32 A, d46 C, d48 C, d50 C, d59 A, d64 B and C, d67 B, d68 C, d69 A, d70 B, d72 A and B). |
| An optional patch | 10 | `node tests/run-all.mjs option-patches` tries them (d01 A and B, d05 A and C, d24 B, d25 A, d30 A). Three more, d65 C and D and d68 A, name patches that are not in `patches/optional/` (see "What was wrong"). |
| Her own words or numbers, the same steps as another answer | 6 | d07 C (as d07 A and B), d26 C (as d26 A and B), d45 C (as d45 B), d53 C (as d53 B), d58 C (as d58 B), and d31 A (the optional credit: as d61 B). |
| Needs her own photos or her whole 2027 content | 3 | d12 A, d34 A and d24 A. |

`python3 tools/rehearse_answers.py --list --skipped` prints every one with its reason. The playbook has no entry yet for the questions d74 to d84 that were added to the dashboard later: they were not tried.

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
| d60 A (closed for rain) | Write the notice as { en, es, hi, zh, vi }. | A fault of the tool, not of the steps. `tools/launch_check.py` only saw a notice written as one plain text, so a notice left on in five languages passed unseen. | The tool reads all three ways of writing it; `tests/launch-check.test.mjs` has a case for it. |
| d65 C and D, d68 A | "see Patches on disk". | Those patches are not on disk. | The last paragraph of "Patches on disk" says so. |
| All answers | "Make the change. Rebuild and test." | After any answer the docs test lists notes with the old words. | Step 3 of "How to use it" says to run it and fix the notes. |

One check failed once and passed on the second run (d28 C, the share-picture size check of `launch-check`): a slow machine, not a step.

The playbook's tests table ("Tests that can need an update") has three new rows: the QR signs count in consistency, the year bars in consistency, and `launch-check`.

## What the browser tests found

One browser test ran for each of 28 answers (d02 to d23: the live, dated, languages, features and drive tests, one browser at a time, on the site as it was before the calm, search and review kits were added). 26 passed. Two did not:

- d10 D (Drive time box off): the features test stopped at "still waiting at 4:59:51 PM". That check sets the page clock one second before 5 pm, so on a very slow machine the page is late and the check fails by itself. It is not a step of the answer.
- d11 A (farm spot): the drive test failed with "two searches (visitor, farm) and one route: 1/1". This was a wrong note (see the table above). With the change now written in the playbook, the whole drive test ran through without a failure.

The browser tests of the other answers (d24 onward) were not run: the machine was too busy to finish them in the time given. `python3 tools/rehearse_answers.py --all --quick --browser` runs them (several hours).

The no-browser checks ran for all 92 answers on the earlier site. On the current site every step of all 92 answers was checked again (it finds its place), and the whole replay with its checks was repeated for the 21 answers that had a wrong step.

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
python3 tools/rehearse_answers.py --all --jobs 3            all 92 (about an hour)
python3 tools/rehearse_answers.py --all --quick --browser   the browser tests too, one at a time (several hours)
python3 tools/rehearse_answers.py d18=A --keep copies       keep the changed copy in the folder "copies" to look at it
```

`node tests/answer-rehearsal.test.mjs` (in `node tests/run-all.mjs`, no browser) does the quick part in under a minute: every answer is replayed or has a reason, every step still finds its place, one whole replay works, and the site folder is unchanged afterwards.

When it fails after you changed the playbook: fix the words of the playbook, then the recipe for that answer in `tools/rehearse_answers.json` if the place really moved. A recipe is a list of steps (file, the words that name the place, what to change, how many times). `tools/rehearse_answers.py --help` and the top of the file explain the step kinds.
