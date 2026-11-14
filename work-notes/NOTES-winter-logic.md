# Notes: the dates and the logic of the Christmas tree weekends (helper winter-logic, 10 Nov 2026)

The builder's rule (not yet written down by the farm): the Christmas trees are only on the last weekend in November and the first weekend in December, Saturday and Sunday only
(2026: Nov 28-29 and Dec 5-6). The farm is open only those weekends (no reservation, no rides). The GreenHouse is open and serves pizza those weekends, 11 am-8 pm, with the label
"Not official yet". The words are the winter-text helper's; the drawings are the winter-trees helper's. This file is the dates and the logic.

## The functions (what main and the independent checker call)

`js/season.js` (all on `WISE_ACRES.seasons`; no year is written in the file, every date is worked out from the calendar):

| name | what it gives |
| --- | --- |
| `treeWeekends(year)` | the two weekends of that year: `[{ start: Sat, end: Sun }, { start: Sat, end: Sun }]` (local Dates at 00:00). Weekend 1 = the LAST Saturday of November and the Sunday after it (that Sunday can be Dec 1); weekend 2 = the FIRST Saturday of December and the Sunday after it. Always 7 days apart. |
| `treeDatesText(year, lang)` | "Nov 28–29 and Dec 5–6" (en dash U+2013; "Nov 30–Dec 1 and Dec 7–8" across a month end); es "28–29 nov y 5–6 dic", hi "28–29 नवंबर और 5–6 दिसंबर", zh "11月28–29日和12月5–6日", vi "28–29 thg 11 và 5–6 thg 12" (the shapes of `tools/date_phrases.py`) |
| `treeYear(now)` | the year whose weekends are shown: this year until the second Sunday has passed, next year after it |
| `live(now)`, `upcoming(now)`, `current(now)`, `inWindow(...)`, `daysUntilStart(...)` | as before. `live` = seasons in progress; `upcoming` = the season that starts next and is not on; `current` = the live season, else `upcoming` (the page opens on the season that starts next) |
| `tags(now)` | `{ now: id or '', next: id }` (`now` is '' between seasons): what `js/hero.js` `markTags` puts on the season buttons |
| `paintTree(root)` | fills `[data-tree-dates]` and sets `--s` / `--e` on `[data-tree-bar="1"]` and `"2"` |

Inside the file (not on the object): `lastSaturdayOfNovember(year)`, `firstSaturdayOfDecember(year)`, `treeSeasonStart(year)` (= weekend 1's Saturday), `treeSeasonEnd(year)` (= weekend 2's Sunday), `treeRange`, `monthPos`.
The winter season is `{ id: 'winter', start: treeSeasonStart, end: treeSeasonEnd, next: 'the last weekend in November' }`: in progress from the first Saturday 00:00 to the last Sunday (2026: Nov 28 to Dec 6;
2027: Nov 27 to Dec 5; 2028: Nov 25 to Dec 3; 2029: Nov 24 to Dec 2; 2030: Nov 30 to Dec 8). The five weekdays between the weekends are in the season but are not tree days.

`js/live.js`: `scheduleOn(name, ymd)` (the hours of one day: the `winter` line inside the season window, the usual hours outside it), `scheduleStatus`, `farmStatus`, `renderBadge`. `W.live.status(name, now)` gives `notOfficial: true` when the time shown comes from winter hours.
`js/features.js`: `trees.wins` = `treeWeekends(year)` (the "This week" box: trees "In season" on the four tree days only, no Friday, no tomatoes in winter). `js/hero.js`: `markTags` uses `W.seasons.tags()`.

Checked with `node /tmp/helpers/winter-oracle/check.mjs <clone>`: 0 hard mismatches, 2026-2060, 1575 moment checks (live, current, upcoming, tags, data-season, the tree phrase).

## What changed

- `js/season.js`: the rule above (the Thanksgiving rule and `daysSinceEnd` are gone); `current()` = the season that starts next when none is on, so Nov 9-27 opens on winter, Dec 7 to Apr 14 on spring, Jun 8-14 on summer, Jul 11 to Sep 12 on fall
  (the old "closest season" rule kept fall until Nov 17 and winter until Feb 10); the tree dates and bars are painted on load, on `wa:lang` and on `wa:day`. After the second Sunday the page shows next year's weekends.
- `js/content.js`: `greenhouse.winter = { days: [6, 0], open: '11:00', close: '20:00' }`, `pizza.winter = 'greenhouse'` (the same hours as The GreenHouse), `farm.winter = [6, 0]`, and a comment for the owner.
- `js/live.js`: the badges use the winter line only inside the winter season window and the usual Friday-Sunday hours on every other day; the farm badge in winter says "Open today. No reservation needed" or "Closed today. Next open day: {day}";
  a badge made from winter hours carries `<span class="not-official">Not official yet</span>` after the zone text (the CSS `.not-official` is the text helper's, css/extras.css). `data-live-not="winter"` on a badge leaves it out while that season is in progress
  (set on the farm badge of `pages/pumpkin-patch.html` and `pages/first-visit.html`, which are written for reservations; the root pages are generated).
- `js/main.js`: "This season" (`.fs-this`) only on a season in progress. `js/features.js`: the Site check reads the `winter` lines (`checkSchedule`).
- Tour: only the existing cards were reworded (strip, Now/Next, badges, countdown, tabs, trees) in `js/tour-steps.js`, `js/tour-steps-b.js`. No card was added (the builder's rule).
- Translations (`lang/src/{es,hi,vi,zh}.json`, "js"): new "Not official yet", "Open today. No reservation needed", "Closed today. Next open day: {day}"; the key "the Friday after Thanksgiving" became "the last weekend in November"
  (es el último fin de semana de noviembre, hi नवंबर महीने के आख़िरी वीकेंड में, vi vào cuối tuần cuối cùng của tháng 11, zh 11 月最后一个周末). `lang/js-strings.json` and `lang/*.js` rebuilt with the pipeline; 0 missing in es, hi, vi, zh.
- Tools: `tools/upcoming_dates.py` (tree weekends, season start and end read from the new names), `tools/season_calendar.mjs` (wording and reasons: the page opens on the season that starts next; the "no season" rule is gone),
  `tools/check_facts.py` (reads the GreenHouse winter hours as their own fact; its test `tools/test_check_facts.py` and `tools/test_change_fact.py` know the line with both hours, and `change_fact.py hours` changes the usual hours and the tree weekend hours each on its own), `tools/year_rehearsal.mjs` (R05 R06 R07 R09 R12 R15 R16 R19 R23 R24 and the seam days), `tools/rehearse_answers.json`, `tools/apply_answers_rules.json`, `tools/review_notes.json`.
- Docs: `docs/OWNER_YEAR_CALENDAR.md` and `.es.md` (11 season days: 2026-11-09, 11-28, 12-07, 2027-04-15, 06-08, 06-15, 07-11, 09-13, 11-09, 11-27, 12-06; the old Nov 18, Feb 10 and Aug 12 entries are merged into Nov 9, Dec 7 and Jul 11),
  `docs/DECISION_PLAYBOOK.md`, `docs/OPTION_PATCHES.md`, `docs/QUESTIONS_FOR_THE_FARM.md`. In the owner calendar question d25 (Reserve buttons) is asked for Dec 7 only (Fri Dec 4): on Nov 9 the page opens on winter and those buttons do not change. Patches: `winter-A-hide-fall-booking.patch` (questions hunk re-made), `reserve-window.patch` (header; the hero hunk keeps one line of context).
- Tests that now state the new truth (never loosened): `logic` (the rule 2026-2032 by an independent calendar walk, window ends, the season shown between seasons, the hours on tree days against other days, the label, the dates in five languages, the bars,
  host time zones UTC / Tokyo / Los Angeles), `upcoming-dates` (2026-2033), `consistency`, `owner-calendar`, `live`, `hero`, `features`, `dated`, `time-bombs`, `code-read`, `calendar-doc`.

## Text for README.md and tests/README.md (main applies; these files are main's). The list, 3 README places and 9 tests/README rows

README.md (the other README places, lines 509 and 523 and the new "Not official yet label" row, are in NOTES-wintertext.md)
- R1. Line 142, row "Change opening hours": replace "**The GreenHouse and Wise Pie each have one set of days and hours for the whole year**; only `farm` can be set per season. For different winter hours, change them when winter starts and again when it ends."
  with "**The GreenHouse and Wise Pie each have one set of days and hours for the usual year, and a `winter` line for the Christmas tree weekends** (the last weekend in November and the first weekend in December, Saturday and Sunday only;
  the site works the dates out each year). `farm` has a line for each season (`fall`, `winter`). On the tree weekends the `winter` line is used, on every other day the usual hours. The green badges that use the `winter` hours say "Not official yet"."
- R2. Line 205: replace "winter from the Friday after Thanksgiving." with "winter from the last Saturday of November to the Sunday after the first Saturday of December (the Christmas tree weekends: the last weekend in November and the first weekend in December,
  Saturday and Sunday only; the site works the dates out every year in `js/season.js`, so nobody types them). When no season is in progress the page opens on the season that starts next (on November 9 it opens on winter, on December 7 on spring)."
- R3. Line 504, row "Season dates & switcher": replace "Between seasons the site shows whichever is closest." with "Between seasons the site shows the season that starts next (its picture and tabs; the top bar, the Now tag and the "In season" lines still say what is really on)."

tests/README.md (add the words to the end of what the row says; each row is named by its test)
- T1. `logic` (line 155): "the tree weekends of 2026-2032 (worked out in the test by walking the calendar), the first and last day of the winter season, which season the page opens on between seasons, the GreenHouse, pizza and farm hours on a tree day and on other days, the label "Not official yet", the tree dates in five languages and the two bars of the farm-year picture, on host clocks in UTC, Tokyo and Los Angeles".
- T2. `upcoming-dates` (line 151, the one the scanner lists): replace "the Friday after Thanksgiving in six years" with "the Christmas tree weekends in eight years (2026-2033, worked out by walking the calendar)".
- T3. `consistency`: "the two tree bars are the two weekends of the rule and the rule sentence is on the home page at least five times".
- T4. `live`: "the winter hours on the tree weekends with "Not official yet" (English and Spanish), the farm's "Open today. No reservation needed", and `data-live-not` on the pumpkin patch and first-visit pages".
- T5. `hero`: "the Now and Next tags on the days of the winter weekends" (the tag table has the days Nov 8, 9, 26, 27, 28, Dec 2, 6, 7 and the days between seasons); `farm-seasons`: ""This season" only for a season in progress".
- T6. `features`: in the "This week" part "winter" becomes "winter: the trees on the four tree days, no tomatoes".
- T7. `dated`: "the hero line between seasons" becomes "the hero lines between seasons (the page opens on the season that starts next)".
- T8. `owner-calendar`: "the tree weekends are the ones the rule gives".
- T9. `code-read`: "the "Now" and "This season" marks" gets "("This season" only for a season in progress)".
- (`year-rehearsal`: nothing to add in the row; the replays R03 R05 R06 R07 R09 R12 R15 R16 R19 R22 R23 R24 and the seam days of N1 changed. `tools-safety` and `pipeline` run the two Python tool tests that now know the line with both hours.)

tests/browser-support.table.json: nothing from this helper (the code uses only features already in the table).
tools/mutants.json: main's. The mutants that named `thanksgivingFriday` or the old end date must be re-made (nothing here was changed in that file).

## After the merge (the winterfix pass, 10 Nov 2026: a fresh clone of integ, branch `winterfix`)

main merged this branch and winter-text; the pass made these things again on the merged tree:
- `patches/optional/winter-A-hide-fall-booking.patch`: the Question 37 hunk of `docs/QUESTIONS_FOR_THE_FARM.md` made again against the merged document; it and `reserve-window.patch` apply (`git apply --check`).
- The README.md and tests/README.md texts below (R1-R3, T1-T9) and winter-text's README lines (Christmas trees row, the new "Not official yet" label row, the winter wording row) are applied. Two README sentences were split for plain-lint (40 words).
- A new README row for the hours of the tree weekends (`hours.greenhouse.winter`, `change_fact.py hours "Sat-Sun, 11 am-8 pm" ...`).
- The merge had left two copies of some bullets (beerwine's words with winter-text's old ids, and the older words with the new ids): `docs/DECISION_PLAYBOOK.md` (d54 "Depends on", d19 A and B) and `docs/QUESTIONS_FOR_THE_FARM.md` (question 53). They are one bullet again: beerwine's words, winter-text's ids (`t8dcdef56`, `t59d83261`).
- `pages/first-visit.html` had two farm badges (the merge kept both): one is left, with `data-live-not="winter"`.
- `tests/live.test.mjs`: at 9 pm on the last tree day the farm badge still says "Open today. No reservation needed" (it has no hours), as `tests/logic.test.mjs` says.
- `docs/WHAT_VISITORS_SEE_WHEN.md` made again with `node tools/season_calendar.mjs --jobs 2` (the data block lists the 11 season days); `owner-calendar` and `calendar-doc` read it.
- No stale "the Friday after Thanksgiving" line is left in `lang/src` (the key was renamed here). `winter-scan.sh` says 0 for every place of this branch; its Part B shows one empty row (tomato 0, Friday 0): a scanner artefact.

## After the merge with winter-text (a resolved trial merge exists)

`python3 /tmp/wl-scratch/make_trial.py /tmp/some-new-folder` clones this branch, merges the `wintertext` branch of /tmp/wintertext-clone, resolves the 16 conflicting files as below, runs the pipeline (0 missing in es hi vi zh), checks both patches apply
and commits it on a branch `trial-merge` (scratch only; nothing is pushed). On the part-14 words of winter-text it passed the no-browser tests (766 of 767: only `owner-calendar` waits for the regenerated document).
By hand, resolve like this, then run the pipeline once (`python3 tools/pages.py`, `python3 tools/i18n.py extract`, `jsstrings`, `build`, then `missing es hi zh vi`):
- generated, never merge by hand: `first-visit.html`, `lang/es.js`, `lang/hi.js`, `lang/vi.js`, `lang/zh.js` (take either side, then run the pipeline).
- `pages/first-visit.html`: keep BOTH: the winter lead line (winter-text) and `data-live-not="winter"` on `<p class="live" data-no-i18n data-live="farm" ...>` (mine).
- `tests/consistency.test.mjs` (2 blocks): take MINE for both. The first block of winter-text (the tree row bars) can never run: the file already checks the row by `data-tree-bar` and `continue`s before it.
- `tools/apply_answers_rules.json` d23=A: take MINE ("Fall now ends November 30 ... for three days both seasons are on": that is what option A does). `tools/rehearse_answers.json`: identical apart from the reason of `_skipped.d50=B`: either. `tools/review_notes.json`: winter-text's.
- `docs/OWNER_YEAR_CALENDAR.md` and `.es.md`: take MINE and change the Shop tree id to `data-t="t59d83261"` (winter-text's id).
- `docs/QUESTIONS_FOR_THE_FARM.md`: block 1 (the Q12 ids) winter-text's plus my anchors of the rule (`js/season.js` at `function lastSaturdayOfNovember(`); block 2: my hours bullet (the `winter` lines in `js/content.js`) and one trees bullet that names both the rule and winter-text's ids.
- `docs/DECISION_PLAYBOOK.md` (7 blocks): blocks 1, 2 and 7 (anchors into `tests/consistency.test.mjs`) mine; blocks 3, 4, 5 (words) winter-text's; block 6 (d50 B) winter-text's words with my rule anchors and my test anchors.
- patches: `winter-A-hide-fall-booking.patch` and `reserve-window.patch` were re-made by both. After the merge take winter-text's index.html hunks and make my questions hunk again against the merged document (winter-A), my header line and my one-line context at the hero buttons (reserve-window), then `git apply --check` each.

Regenerate after the merge, with the tool (never by hand): `node tools/season_calendar.mjs --jobs 2` (docs/WHAT_VISITORS_SEE_WHEN.md, 10 to 40 minutes; its data block must list the 11 season days above). It depends on the final words, so it is not done here.
`docs/YEAR_REHEARSAL_LOG.md` is a dated record of what the first full replay found (the tool prints, it writes nothing): left as it is. Run `node tools/year_rehearsal.mjs` once after the merge (all steps, PASS or FAIL for each).
`owner-calendar` and `calendar-doc` are red until the document is regenerated; `consistency` (2 checks: the tree row of the farm-year picture and the season words) is red here only because the words are the winter-text helper's; both pass on the merged files.

## Decisions taken (the builder can overrule)

- After the winter window the page shows the NEXT year's tree dates (`treeYear`); the weekends of this year are over.
- The site opens on the season that starts next, but "In season", the Now tag, the hero all-year line and "This week" still follow what is really in progress.
- The winter hours (Saturday and Sunday, 11 am-8 pm) apply only inside the window, Sat Nov 28 to Sun Dec 6 in 2026. On the five weekdays inside it The GreenHouse, Wise Pie and the farm are closed ("Opens Saturday at 11 am").
  On every other day (Fri Nov 27 and Fri Dec 11 too) the usual Friday-Sunday 10 am-8 pm hours are used, as before. The builder said nothing about those days.
- "Not official yet" is drawn only when the time shown comes from the winter hours (on a normal Friday in October, or on Fri Nov 27, it is not there). The farm badge has no hours, so it has no label.
- Fall dates (Sep 13 to Nov 8), spring (Apr 15 to Jun 7) and summer (Jun 15 to Jul 10) are unchanged. Tomato words in all-year places were not touched (the builder is asked).
