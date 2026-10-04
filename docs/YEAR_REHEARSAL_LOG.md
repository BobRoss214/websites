# The owner's year, rehearsed with a pretend clock

Date: 3 October 2026. Site files: the merged site (commit `f176745`, plus the folder of optional patches and the owner's calendar). What was rehearsed: every dated step of `docs/OWNER_YEAR_CALENDAR.md`, from 3 October 2026 to 1 January 2028, plus the entries that say "nothing to do".

**How.** A helper played the farm owner. For each step it did exactly what the calendar says, on the day the calendar says:

1. It put the browser clock (Playwright) at that day and hour, farm time (Eastern).
2. It typed the owner's change into the file the calendar names, using the calendar's own search words (`closures: [],`, `notice: '',`, `noticeUntil: '',`, `week: {},`, the pizza row and the sentence under it in `index.html`, `farm:` in `hours`, the two `data-until` dates in `pages/pumpkin-patch.html`), and ran the commands the calendar names (`python3 tools/make_deploy_folder.py`, `tools/check_facts.py`, `tools/pages.py`, `tools/i18n.py`).
3. It opened the real pages at the farm's address (answered from a copy of the site, so nobody sees the "Site check" box unless `?check` is added) and compared what a visitor sees with what the calendar promises: the three open-now badges, the notice bar, the top bar, the first-screen words and buttons, the "This week" box, the pizza chip and countdown, the schedule box, the "Remind me" calendar link, the footer year, the lines that hide themselves.
4. English was looked at on a computer screen, and another language (Spanish, Hindi or Chinese) on a phone.

Pictures and fonts were not loaded (they do not change what is being checked). Nothing was sent anywhere and no real site was touched.

**The same tool is in the repository.** `node tools/year_rehearsal.mjs` plays all of it (10 to 40 minutes; `--list` shows the steps, `--only R04,N2` runs some, `--verbose` shows what was seen). `node tests/year-rehearsal.test.mjs` is the short version (9 steps; about one to two minutes on a quiet computer, up to four when the computer is very busy).

## The result in one line

31 steps, 156 checks, all green on the final files. On the way, **11 faults in the calendar** were found and corrected (in English and in the Spanish copy). **No fault in the site** was found. One thing is worth knowing about how the site is used (the translations, below).

## Step by step

"Worked" means the calendar and the site agreed. "Calendar wrong" means the site was right and the words were not: fixed.

| Step | The calendar entry | Result |
|---|---|---|
| R01 | Sat Oct 3, 2026: close Sunday for rain | Worked. The three badges close together on Sunday (English computer, Spanish phone), the bar shows at once, it goes at midnight, also on a page left open. A Spanish visitor reads the owner's English words in English (the calendar's own Dec 25 step says how to write all five languages). |
| R02 | Tue Oct 6, 2026: the first pizza weekend opens | **Calendar wrong, fixed.** The chip and countdown, the 6 hours of "just opened", the Reserve button, the Remind me link (5:00 PM Eastern) all worked. But the step says "change the sentence under the table" and nothing else. Publishing then stops with "Translations missing", four lines, and writes nothing. And the first publish gives the sentence a new `data-t` code, so the calendar's search words stopped matching from then on. The calendar now says both, and searches the words of the sentence. |
| R03 | Oct 7 to Nov 4: lines hide one by one | Worked. Each line is there at 23:59 on its last day and gone at 00:00 (phone). The special-days box hides when its last line goes. |
| R04 | Tue Oct 27: the last pizza row; countdown and chip vanish | **Calendar wrong, fixed.** They vanish at 11:00 PM on Tuesday Oct 27 (six hours after the opening), not on Wednesday Oct 28. A new row brings the chip back. |
| R05 | Mon Nov 9: fall is over | Worked. Farm badge goes, top bar, hero line, rows, the "Fall schedule" button, fall look until Nov 18, Reserve buttons stay. The top bar is not shown on phones: the calendar now says so. |
| R06 | Wed Nov 18: winter look | Worked. Changing the closing time in `hours` alone makes `python3 tools/check_facts.py hours` say the words disagree (20 places), as the calendar wants. |
| R07 | Fri Nov 27: trees | Worked. Thanksgiving Thursday needs no closure. The owner's note shows in the "This week" box. |
| R08 | Tue Dec 1: the schedule box hides | Worked (the box and the sentence with the link to it hide together, at midnight). |
| R09 | Wed Dec 9: tree season over | Worked. `crops: { trees: 'peak' }` keeps trees in the box, `'off'` takes them out. |
| R10 | Fri Dec 25: Christmas | Worked. A closure range and a notice in five languages. Spanish, Hindi in their own words, gone at midnight. |
| R11 | Fri Jan 1, 2027: the new year | Worked. Footer year and ribbon at midnight, also for a page left open and for a visitor in Los Angeles (still Dec 31 there). No date in the search-engine data or the sitemap runs out. 41 places say 2026. |
| R12 | Wed Feb 10: spring look | Worked. |
| R13 | Thu Mar 25: strawberries in the box | Worked (not on Mar 24, there on Mar 25). |
| R14 | Sun Mar 28: Easter | Worked. |
| R15 | Thu Apr 15: strawberry season | Worked. The calendar did not say what to type for spring farm days: it now gives the line. |
| R16 | Jun 8 to Jun 15 | Worked. Same for summer farm days (now given). |
| R17 | Jun 20 and Jul 4 | Worked. |
| R18 | Sun Jul 11: summer over | Worked. |
| R19 | Thu Aug 12: fall look | Worked, with the README's steps (`pages.py`, then `i18n.py extract` and `build`) after the edit in `pages/`. |
| R20 | Aug 23 to Sep 25: the box counts down | Worked (pumpkins Sep 13, cut flowers Sep 1, tomatoes Sep 25). |
| R21 | Mon Sep 13, 2027: fall season | **Calendar wrong, fixed.** The box does not always stay hidden: it shows its "No pizza" lines if their last day was renewed in August. No countdown and no chip without rows, as the calendar says. |
| R22 | Nov 8 to Nov 9, 2027 | Worked. |
| R23 | Nov 18 to Nov 26, 2027 | Worked. |
| R24 | Dec 9 and Dec 24 to Dec 31, 2027 | **Calendar wrong, fixed.** "Sat Dec 25 too, if you open Saturdays": the badges already treat Saturday as open (Friday to Sunday). |
| R25 | Sat Jan 1, 2028 | Worked. |
| A1 | Any day: closing for rain | **Calendar wrong, fixed.** When `noticeUntil` has passed `?check` says so in its **green** box ("nothing is broken"), not the yellow one. Everything else worked (a run of days, a bar with no last day). |
| L1 | Lines that never switch off | Worked ("Prices coming soon", "Now booking", the 2026 labels are still there on Dec 31, 2027). |
| W1 | Every Monday | **Calendar wrong, fixed.** The "This week" note stays 14 days and is gone from the 15th day (the calendar said "disappears 14 days after"). The yellow and green `?check` messages are as described. "Out of season the box fills itself" is also "or hides". |
| N1 | Nothing to do: midnight | Worked. 16 season days and tree days change at 00:00 farm time, not at 23:59 the night before, and for visitors in Sydney and London the day is the farm's. |
| N2 | Nothing to do: clock changes | Worked. See "Clock changes" below. |
| C1 | The cheap checks | Green. See below. |

## What was wrong in the calendar (all fixed, English and Spanish)

1. **The pizza sentence and the rows need translations.** Every new or changed English sentence and every new pizza row stops the publish command with "Translations missing" (one line for each of Spanish, Hindi, Chinese, Vietnamese). The calendar's Monday and Tuesday steps said nothing. "How to read it" now says it once, and the steps point to it. Afterwards the site itself was changed: the dates of a pizza row and the "Open now" sentence now translate themselves (`tools/date_phrases.py`), so only other words stop the publish command. The steps R02, R04, R21 and N2 check that.
2. **Search words that stop working.** `closures: [],` is true only until the first time you use it, and the pizza sentence's `data-t` code changes at the first publish. "How to read it" now says to search the name and a colon and take the line that starts with two spaces, and the sentence is found by its words.
3. **Oct 27: the chip and the countdown vanish on Tuesday at 11:00 PM**, not on Wednesday.
4. **Dec 25, 2027 is an open day** (Saturday): the badges already count Saturday.
5. **`?check` for an old notice speaks in the green box**, not the yellow one.
6. **The "This week" box lasts to the 14th day** and is gone from the 15th. "Out of season the box fills itself" is also "or hides".
7. **`python3 tools/check_facts.py --short` does not end with "all agree".** It says `0 disagree` and ends with `Nothing disagrees.`
8. **The top bar is for computers only.**
9. **A page left open over midnight** catches up in the badges, the top bar, the bar, the year and the hiding lines; the season look and the first-screen words wait for the next visit.
10. **Sep 13, 2027:** the schedule box may show its "No pizza" lines (renewed in August) instead of staying hidden.
11. **Spring and summer farm days:** the calendar did not say what to type (`spring: [4, 5, 6, 0]`, `summer: [4, 5, 6, 0]` inside `farm:`).

## What was wrong in the site

Nothing that a visitor would see or that the owner would have to work around. Two facts about the site, written into the calendar rather than changed:

- A page left open over a change of season keeps its look and its first-screen words until it is opened again (the top bar, badges, bar, footer year and hiding lines do catch up).
- The "Remind me" link starts at 5:00 PM Eastern on every row, also after the clock change (22:00 UTC on Nov 3, 21:00 UTC on Oct 6).

## Clock changes

The farm's clocks change on **Sun 1 Nov 2026** (back), **Sun 14 Mar 2027** (forward) and **Sun 7 Nov 2027** (back). **8 Nov 2026 is not a clock change** (the request listed it; the autumn change in 2026 is a week earlier). Around all of them, at 00:00 and 23:59, the day before and the day after: the "days to go" number falls by exactly one a day, the season and the badges do not move an hour, a pizza row after the change opens at 5:00 PM winter time, the hour that happens twice (1:30 AM on Nov 1) is one day, and a page left open while the clock jumps from 1:59 to 3:00 AM keeps working with no error.

## The cheap checks

On the owner's copy after the whole year: `python3 tools/pages.py`, `i18n.py extract` and `build` ran without error and changed no built page; `i18n.py missing` said 0 missing in all four languages; `check_facts.py --short` agreed; `make_deploy_folder.py --check` said ready; the `validity` and `public-site` tests passed. The site doctor (the tool from the launch rehearsal work, which not every copy of the site has yet), run on that copy, found the whole site fine and said RED only for the upload folder made earlier in the year ("out of date: run `python3 tools/make_deploy_folder.py`"); after that command it said READY TO UPLOAD. On the repository files: `docs`, `owner-calendar` (also the Spanish copy), `plain-lint`, `validity`, `consistency`, `public-site`, `launch-check`, `files-audit`, `pipeline` and the new `year-rehearsal` all pass.

## Left for the owner, or for whoever builds next

- **The weekly pizza sentence and each pizza row needed four translations before every publish.** That was a Claude errand each week in October. It is gone: `python3 tools/i18n.py extract` (which the publish command runs) translates them. Any other words in that sentence still need a translator.
- The helper's stand-in translations (the English words again) cannot pass the `consistency` test, so that test was run on the repository files, not on the owner's copy.
- `python3 tools/launch_check.py` looks at the live address with `https`: it was not part of this rehearsal. Bookeo days, the Business Profile, Mailchimp, a real phone and the real host are things only the real thing can show.
