# What to do, and when

*For the farm owner. Written on 3 October 2026 for the files in this folder. It runs from 3 October 2026 to 31 December 2027 (and the first morning of 2028). It stays on your computer: it lives in `docs/`, which is not uploaded. Spanish copy: [OWNER_YEAR_CALENDAR.es.md](OWNER_YEAR_CALENDAR.es.md).*

The site follows the calendar by itself in many ways: the season, the "Open now" badges, the footer year, and every line that has a last day. It cannot know the weather, a holiday, a new price or next year's menu. Those are yours. This page lists, date by date, **what the site does by itself**, **what you do before that date**, **where**, and **what a visitor sees if you forget**. (What a visitor sees on every day is in [WHAT_VISITORS_SEE_WHEN.md](WHAT_VISITORS_SEE_WHEN.md); this page is the to-do list that goes with it.)

**How to read it**

- Every date is the farm's day (Eastern Time). "By" is the last safe day: do the job that day or earlier.
- "Where" is a file and a few words to search for (Ctrl+F). `index.html` at `data-t="t58da3033"` means: open `index.html` and search for those words. README rows and sections are named in quotes.
- After every change, publish, then open the live site with `?check` on the end of the address. To publish, run `python3 tools/make_deploy_folder.py` and upload what is inside `deploy/` (`docs/LAUNCH_CHECKLIST.md`, section "2. What to upload, and what to leave out"). On Windows type `python` instead of `python3`.
- The words after "Where" describe the files as they are today. A setting you have already used reads differently afterwards (`closures: [],` becomes `closures: ['2026-10-04'],`). Then search for its name and a colon (`closures:`, `notice:`, `noticeUntil:`, `week:`) and use the line that starts with two spaces, near the end of `js/content.js`. The same words are also in the explaining notes at the top of that file. Those are comments, not the line to change. The sentence under the pizza table gets a new `data-t` code the first time you publish an edit, so search its words instead: `<strong>Open now:</strong> pizza reservations for`.
- A new or changed English sentence needs its four translations (Spanish, Hindi, Chinese, Vietnamese) before the publish command goes through. Until then it stops with "Translations missing", one line for each language, and writes nothing to `deploy/`. Send Claude the new words the same day (README, section "Change one sentence and its translations, step by step"; `python3 tools/i18n.py missing es --list` prints what is missing). Claude can also publish first and add the translations later: until then the other four languages show that one line in English. **Pizza weekends are the exception.** The dates in a pizza row, and the "Open now" sentence under the table in the shape the README row "Open a new pizza weekend" shows, are translated by the publish command itself. There is nothing to send. Other words in that sentence still need translations.
- The thin bar at the top of the page ("In season: ...", "Next up: ...") shows on computers only. Phones do not show it.
- "Question d23" is a question on your dashboard that still waits for your answer. The site does not decide it, and neither does this page.
- A test keeps this page true: its dates, its weekdays and the lines that hide themselves are compared with the files (the last section says how).

Contents: 1. Every Monday · 2. The first of every month · 3. The calendar, October to December 2026 · 4. The calendar, 2027 · 5. Any day: closing for rain and other surprises · 6. Lines that never switch off by themselves · 7. Once a year · 8. Questions that wait for a date · 9. The dates the site uses (checked by the test)

## 1. Every Monday: 10 minutes

In season (mid-September to early November, the tree weeks, mid-April to early July) every Monday. The rest of the year every second Monday is enough.

1. **Look at the live site on your phone.** The "Open now" badges should match real life, and the pizza countdown should name the right Tuesday.
2. **Add `?check` to the address** (`https://www.wiseacresorganic.com/?check`). No box at the bottom means nothing is wrong. A **yellow** box lists what to fix and where. A **green** box lists old dated lines that hid themselves: delete them when you like (README, section "Check your changes").
3. **Update "This week at the farm"** (`week` in `js/content.js`): change `updated` to today and the words and spots that changed. Everything in it stays for 14 days after `updated` and is gone from the 15th day, and the yellow box says so when it is old (README row "Say what is ripe / spots left this week"). Out of season the box fills itself or hides: skip this.
4. **Rain or a closed day in the next seven days?** Add the date to `closures`, write the notice and its last day, and close the same times in Bookeo (README rows "Close for rain or a holiday" and "Show a banner on every page"). On the day itself `python3 tools/close_today.py rain` does the file part (section 5).
5. **In the fall, is a pizza weekend opening this Tuesday?** Change the sentence under the pizza table (README row "Open a new pizza weekend"). Add rows for later weekends while you are there. The dates translate themselves when you publish (see "How to read it").
6. **Press Reserve.** Bookeo should show the days you expect. Read the farm inbox (waitlist and contact messages) and answer.
7. **If you changed a price, an hour, a phone number or an email address,** run `python3 tools/check_facts.py` before you publish. It must say that every fact agrees.
8. **Publish** (see "How to read it"), hard refresh (Ctrl+F5, or Cmd+Shift+R on a Mac), and look at `?check` once more.
9. **Open this page** and read the entries for the next 14 days.

## 2. The first of every month: 10 minutes

1. `python3 tools/launch_check.py https://www.wiseacresorganic.com/` (about a minute). A FAIL is broken: fix it and run it again. A WARN is a setting or decision that is yours: read it. An expired padlock certificate shows here as "The padlock (HTTPS) is not ready".
2. `python3 tools/check_facts.py --short`: it must say `0 disagree` and end with `Nothing disagrees.` (every fact is written the same way in every place).
3. `python3 tools/make_deploy_folder.py --check`: it writes nothing and says whether the pages and translations are up to date and ready to upload. If the tools folder also holds the site "doctor" tool, running it with python3 does steps 2 and 3 and more in one go and ends with READY TO UPLOAD or NOT READY.
4. Open the live site with `?check` once more, with nothing waiting to be published.
5. **Google.** Search Console: the Pages and Sitemaps reports show no errors. Business Profile: hours and holiday hours are right, and new reviews have an answer. Your host's usage page, if your plan has an allowance (`docs/LAUNCH_CHECKLIST.md`, section "Every week in season").
6. **Mailchimp.** Connected: sign up with your own email address, wait for the confirmation, then delete the test contact. Not connected: press "Join the email list" and check that Mailchimp's page opens (README row "Make the email signup work"; questions d63 and old Q26). **Analytics** is off today (`analytics` in `js/content.js` at `analytics: { provider: 'none' }`). If you turn it on, look at its numbers and at its bill or trial end once a month (README row "Turn on analytics").
7. **Drive time and reviews.** Press "Get drive time" once with your own address (two failures in a row: tell the helper, `docs/LAUNCH_CHECKLIST.md`, section "3.13"). Press "Leave a Google review" on your phone: it should open the stars (question d06). A new review you like: ask the reviewer first, then add it (README row "Add a review"). Its `date` is plain words ("May 2026") and never changes by itself.
8. **Put the month's dates in your phone calendar** from this page: the entries of the next five weeks, with a reminder five days before each "by" date.

## 3. The calendar, October to December 2026

Before the launch day (the date is not set): the decisions in `docs/LAUNCH_CHECKLIST.md`, section "4. Before you go live" and the first-hour list in section "5. After launch". Questions d05, d38, d30 and d15 are about the launch itself. Nothing below needs the launch to have happened, but a change only reaches visitors when you publish.

### Sat Oct 3, 2026: today

- **By itself:** nothing changes today. The fall season is in progress (Sep 13 to Nov 8): fall look, the farm badge "Reserved visits today" Thursday to Sunday, the pizza countdown counting down to Tuesday 5:00 PM.
- **You, by Sat Oct 3, 2026:** answer **d60** ("Closed Sunday, October 4 for rain?"). If yes: put the closure and a notice on the site, and close the Sunday times in Bookeo.
- **Where:** `js/content.js` at `closures: [],`, `notice: '',` and `noticeUntil: '',` (README rows "Close for rain or a holiday" and "Show a banner on every page").
- **If you forget:** on Sunday the "Open now" badges say open while the pizza note says you will probably be closed.

### Tue Oct 6, 2026: the first pizza weekend opens (and every Tuesday to Tue Oct 27, 2026)

- **By itself:** the table already holds the four weekends: rows with `data-release="2026-10-06"`, `data-release="2026-10-13"`, `data-release="2026-10-20"` and `data-release="2026-10-27"`, opening at 5:00 PM (`data-release-time="17:00"`). The countdown, the "Remind me" buttons and the chip in the fall hero follow the rows, and for six hours after 5:00 PM the countdown says "just opened" with a Reserve button. The note "Open now: pizza reservations for Oct 2 & 3" hides itself on Mon Oct 5, 2026. Each row hides the day after its last visit day (section 9).
- **You, by 5:00 PM each Tuesday:** look at the forecast, open that weekend's times in Bookeo, and change the sentence under the table so it says which weekend is open now, with its last day. Keep the shape the README row shows, and the publish command translates it (see "How to read it").
- **Where:** `index.html` at `<strong>Open now:</strong> pizza reservations for` (the sentence and its `data-until`); `index.html` at `data-release-time="17:00"` (the opening time). README row "Open a new pizza weekend".
- **If you forget:** the countdown still says "just opened" by itself, but the sentence under the table is old or missing, so visitors do not see which weekend is open.

### Wed Oct 7, 2026 to Wed Nov 4, 2026: lines hide one by one

- **By itself:** Wed Oct 7, 2026: the "Exceptional Children Day" line. Mon Oct 12, 2026, Mon Oct 19, 2026 and Mon Oct 26, 2026: the pizza rows. Sun Nov 1, 2026: the "New: u-pick tomatoes & basil" chip and the "New" badge. Wed Nov 4, 2026: the "Home School Day" line. When every line in the "Fall 2026 special days" box has gone, the box hides itself.
- **You:** nothing.
- **Where:** `index.html` at `data-t="tcda0fa57"` and `data-t="t5efe64c3"` (the two special days). The full list is in section 9.
- **If you forget:** nothing visible. `?check` lists them in its green box ("remove them when you like").

### Tue Oct 27, 2026: the last pizza row opens; that night the countdown and the chip disappear

- **By itself:** the last row is `data-release="2026-10-27"` (visits Oct 30 to Nov 8). Six hours after it opens, at 11:00 PM on Tue Oct 27, 2026, the pizza countdown box and the chip in the fall hero vanish, because no opening is left ahead.
- **You, by Tue Oct 27, 2026:** if pizza weekends go on after Nov 8, add the rows now (question **d23**). The dates translate themselves. The chip needs at least one row whose `data-release` day is still ahead.
- **Where:** `index.html` at `data-release="2026-10-27"`: copy that whole row and change its four dates (README row "Open a new pizza weekend").
- **If you forget:** pizza is on sale, but there is no countdown, no "Remind me" and no chip: visitors only see "New weekends open every Tuesday at 5:00 PM".

### Mon Nov 9, 2026: the fall season is over

- **By itself:** no season is in progress. The farm badge goes, the top bar says "Next up: Christmas trees at The GreenHouse", the hero line becomes the all-year one, the pizza rows are gone, and the "Fall schedule" button on the pumpkin page hides. The page keeps its fall look until Wed Nov 18, 2026, and the "Reserve" buttons keep showing.
- **You, by Sun Nov 1, 2026:** answer **d23** (is the farm open after November 8?) and **d25** (Reserve buttons when nothing can be booked). If you stay open, Claude moves the end of fall; you add pizza rows and open the times in Bookeo.
- **Where:** `js/season.js` at `id: 'fall'` (the end date is on that line; ask Claude).
- **If you forget:** from Nov 9 to Nov 17 visitors see "Reserve a fall visit" with no farm badge, and may book times that do not exist.

### Wed Nov 18, 2026: the winter look

- **By itself:** the page turns wintry. The first-screen button "Visit The GreenHouse" replaces "Reserve your visit", and the farm's "Reserve" buttons mostly go.
- **You, by Tue Nov 17, 2026:** answer **d01** (what visitors see in winter), **d09** (The GreenHouse winter hours) and **d69** ("Every tree is lit!" appears too early). If the winter hours differ from Friday to Sunday, 10 am to 8 pm, change them in both places: the settings and the words.
- **Where:** `js/content.js` at `greenhouse: { days: [5, 6, 0]` (the green badges), then the words (README row "Change opening hours"; README, section "Change a fact everywhere"), then `python3 tools/check_facts.py hours`.
- **If you forget:** badges and text keep saying Friday to Sunday, 10 to 8, all winter. That is wrong only if your hours really change.

### Fri Nov 27, 2026: Christmas tree season starts (the Friday after Thanksgiving)

- **By itself:** the winter season is in progress until Dec 8: the top bar says "In season: Christmas trees at The GreenHouse", the headline becomes "Wise Acres Christmas trees", and the "This week" box lists trees "In season". Thu Nov 26, 2026 (Thanksgiving Day) is not an open day, so it needs no closure.
- **You, by Wed Nov 25, 2026:** confirm the tree dates and prices (**d50**, **d54**). Add a short note to `week` ("Trees arrive Friday"; `updated` is today).
- **Where:** `js/content.js` at `week: {},` (2 places: the setting and the note about it); `index.html` at `data-t="t53cf41e8"` (the tree dates in the Shop). README row "Say what is ripe / spots left this week".
- **If you forget:** the site says trees are in season from Nov 27 whatever your stock, and the Shop line says "Prices coming soon".

### Tue Dec 1, 2026: the schedule box hides

- **By itself:** the "No pizza" block (`data-until="2026-11-30"`) was the last dated line, so the whole "Fall 2026 reservation schedule" box hides. The sentence "See the current fall schedule" in the home page FAQ hides with it (`data-needs="schedule"`), so no link leads nowhere.
- **You:** nothing. If you plan winter pizza dates, add rows and the box comes back.
- **Where:** `index.html` at `data-t="t6fab8a7b"` (the sentence with the link); `pages/pumpkin-patch.html` at `data-until="2026-11-30"` (2 places).
- **If you forget:** nothing. The sentence comes back by itself when a schedule box is back.

### Wed Dec 9, 2026: the tree season is over in the site's calendar

- **By itself:** the code's last tree day is Dec 8. From Wed Dec 9, 2026 no season is in progress: the top bar says "Next up: Strawberries, usually mid-April", the headline is the all-year one, and trees leave the "This week" box.
- **You, by Fri Dec 4, 2026:** if you sell trees after Dec 8, or sell out earlier, say so (question **d50**). Until Claude moves the end date, use the notice bar and `week` (`crops: { trees: 'peak' }`, or `'off'` when they are gone).
- **Where:** `js/season.js` at `id: 'winter'`; `js/content.js` at `notice: '',`.
- **If you forget:** the site stops saying trees are in season on Dec 9 while you still sell them, or keeps saying it after they are gone.

### Fri Dec 25, 2026: Christmas Day is an open day (also Sat Dec 26, 2026 and Sun Dec 27, 2026)

- **By itself:** The GreenHouse and Wise Pie are open Friday to Sunday, so their badges say "Open now" (10 am to 8 pm and 4 pm to 8 pm).
- **You, by Wed Dec 23, 2026, if you are closed:** add the days to `closures` (one range works: `'2026-12-25..2026-12-27'`). Write a notice in all five languages with `noticeUntil: '2026-12-27'`. Close the times in Bookeo, and set the holiday hours in your Business Profile. New Year's Day is also a Friday (below).
- **Where:** `js/content.js` at `closures: [],` and `noticeUntil: '',` (README rows "Close for rain or a holiday" and "Show a banner on every page").
- **If you forget:** the badge says "Open now" on a day you are closed.

### Fri Jan 1, 2027: the new year

- **By itself:** the footer year turns from 2026 to 2027 (`data-year`), and the "New this year" ribbon hides (`data-until="2026-12-31"`). Nothing in the search-engine data or the sitemap has a date that runs out.
- **You, by Fri Dec 18, 2026:** answer **d66** (stop saying "new this year" from January?) and **d24** (Fall 2027 prices, schedule and menu). Eight places still say the tomatoes are new, and seven places write "2026" in a label (two more labels hide themselves in the fall). If you are closed on Jan 1, add it to `closures`.
- **Where:** "new": `index.html` at `data-t="td6ecd1d8"`, `data-t="t1c989256"`, `data-t="tedce5b9f"`, `data-t="tbc119a85"`, `data-t="t4eb3e326"`, `data-t="t247dcbc5"` and `data-t="t398007b0"`, and `pages/pumpkin-patch.html` at `New this year. Certified organic cherry tomatoes`. The year: `python3 tools/check_facts.py year` lists every place (README, section "A new year, a new season").
- **If you forget:** in 2027 the FAQ still says "Yes, and it's new this year!", and the pages say "Fall 2026 prices" all winter, spring and summer. That is true but looks old.

## 4. The calendar, 2027

### Wed Feb 10, 2027: the spring look

- **By itself:** the page turns to spring. "Reserve your visit" and "Reserve a strawberry visit" come back, and the note "No reservation? Visit The GreenHouse next door" shows again. The top bar says "Next up: Strawberries, usually mid-April".
- **You, by Tue Feb 9, 2027:** answer **d25** (Reserve buttons when nothing can be booked). Open the spring times in Bookeo, or the buttons lead to an empty calendar for nine weeks.
- **Where:** Bookeo; the Reserve buttons are in `index.html` (README row "Change the booking link" if the address changes).
- **If you forget:** from Feb 10 to Apr 14 "Reserve" buttons show while nothing can be booked.

### Thu Mar 25, 2027: strawberries show up in the "This week" box

- **By itself:** the box starts to say "Strawberries: usually starts Apr 15", three weeks ahead. Typical dates, not promises.
- **You:** nothing now. From here on update `week` when you know better.
- **Where:** `js/content.js` at `week: {},` (2 places). README row "Say what is ripe / spots left this week".
- **If you forget:** the box keeps the typical dates, which is fine.

### Sun Mar 28, 2027: Easter Sunday (an open day)

- **By itself:** a Sunday, so the badges say "Open now".
- **You, by Thu Mar 25, 2027, if you are closed:** add it to `closures` and write a notice. The gallery shows the "Happy Easter" picture all year (questions **d13** and **d32**).
- **Where:** `js/content.js` at `closures: [],`.
- **If you forget:** "Open now" on a closed day.

### Thu Apr 15, 2027: the strawberry season starts (by the calendar, not by the weather)

- **By itself:** the top bar says "In season: Strawberries", the first screen says "It's strawberry season!" and the "This week" box says "In season". Nothing on the site follows the weather.
- **You, by Thu Apr 8, 2027:** answer **d41** (cancel fee on the strawberry page), **d54** (prices) and **d26** (when are cut flowers available?). If the field is late or early, say so with the notice bar and `week` (`crops: { strawberries: 'soon' }`). Open the Bookeo times. If you take reserved visits in spring, add the days to `hours` (`farm`) so the farm badge shows: `farm:       { fall: [4, 5, 6, 0], spring: [4, 5, 6, 0] }`.
- **Where:** `js/content.js` at `farm:       { fall: [4, 5, 6, 0] }` (today only fall has farm days), `notice: '',` and `week: {},` (2 places).
- **If you forget:** the first screen says it is strawberry season on a day the field is not ready; with no spring farm days there is no farm badge (that is a gap, not an error).

### Tue Jun 8, 2027 to Tue Jun 15, 2027: spring ends, summer begins

- **By itself:** the strawberry season's last day is Jun 7. On Tue Jun 8, 2027 no season is in progress; the look turns to summer on Sat Jun 12, 2027; on Tue Jun 15, 2027 the blueberries and sunflowers season starts ("It's blueberry season!").
- **You, by Mon Jun 7, 2027:** answer **d59** (summer programs), **d58** (snacks and drinks in spring and summer?) and **d68** (the sunflower badge works only on big screens). Open the summer times in Bookeo; add summer farm days to `hours` if you want the badge (`summer: [4, 5, 6, 0]`, in the same place); update `week`.
- **Where:** `js/season.js` at `id: 'summer'` (the dates are on that line; ask Claude); `js/content.js` at `week: {},` (2 places).
- **If you forget:** the same as the strawberries: calendar words on a day the blueberries may not be ready.

### Sun Jun 20, 2027 and Sun Jul 4, 2027: Father's Day and the Fourth of July

- **By itself:** both are Sundays: "Open now". The gallery shows the "Happy Father's Day" picture all year (**d13**, **d32**).
- **You, by Thu Jul 1, 2027, if you are closed on Jul 4:** `closures` and a notice.
- **Where:** `js/content.js` at `closures: [],`.
- **If you forget:** "Open now" on a closed day.

### Sun Jul 11, 2027: the summer season is over

- **By itself:** the top bar says "Next up: Pumpkins & tomatoes, usually mid-September" and the "This week" box empties.
- **You:** nothing yet. Start collecting the fall 2027 facts (see the entry for Thu Aug 12, 2027).
- **Where:** nothing yet.
- **If you forget:** nothing yet.

### Thu Aug 12, 2027: the fall look starts, a month before the season

- **By itself:** the page turns to fall: "Reserve a fall visit" and the fall lines show, though the season starts on Mon Sep 13, 2027.
- **You, by Wed Aug 11, 2027:** have the fall 2027 facts in.
  1. The prices and the labels that say 2026 (question **d24**, with **d54** and **d16**).
  2. The special days (Home School Day and the others), with a `data-until` on each line, and the box heading.
  3. The schedule: the "No pizza" block's words and last day, the pumpkin page button's last day (they must match), and the first pizza rows.
  4. The new menu picture, under a new file name.
  5. The Bookeo times; the tomatoes and the haunted trail (**d48**); the fall hours (**d51**); Thai night (**d08**).
- **Where:** `python3 tools/check_facts.py year` lists the 2026 places. `index.html` at `data-t="t7f10df40"` (special days heading), `data-t="t65d35823"` (schedule heading), `data-t="tb848cce7"` (the "No pizza" words) and `data-t="t4f7c68ac"` (Fall Menu heading); `pages/pumpkin-patch.html` at `data-until="2026-11-30"` (2 places). README, section "A new year, a new season"; README row "Open a new pizza weekend". Every changed English sentence needs its four translations (README, section "Change one sentence and its translations, step by step").
- **If you forget:** from Aug 12 visitors see a fall page with 2026 prices and no schedule box.

### Mon Aug 23, 2027 to Sat Sep 25, 2027: the "This week" box counts down by itself

- **By itself:** pumpkins "usually start Sep 13", tomatoes and basil "usually start Sep 25", cut flowers from Sep 1.
- **You:** optional: `week` when you know better.
- **Where:** `js/content.js` at `week: {},` (2 places).
- **If you forget:** the box keeps the typical dates.

### Mon Sep 13, 2027: the fall season starts

- **By itself:** "In season: Pumpkins & tomatoes", the farm badge "Reserved visits today" Thursday to Sunday, the fall hero line. The "New: u-pick tomatoes" chip and the "New" badge stay gone for good.
- **You, by Mon Sep 6, 2027:** the pizza table must hold rows for the first weekends, with the first opening still ahead (the countdown needs it). Write the sentence under the table on each opening day (it translates itself, see "How to read it").
- **Where:** `index.html` at `data-release-time="17:00"`; README row "Open a new pizza weekend".
- **If you forget:** with no rows left from 2026 there is no countdown and no chip all fall. The schedule box shows only its "No pizza" lines, or stays hidden if you did not renew their last day in August.

### Mon Nov 8, 2027 to Tue Nov 9, 2027: the fall season is over (as on Mon Nov 9, 2026)

- **By itself:** the farm badge goes on Mon Nov 8, 2027; no season in progress on Tue Nov 9, 2027; the rows are gone.
- **You, by Mon Nov 1, 2027:** questions **d23** and **d25** again, if the answer was for 2026 only.
- **Where:** `js/season.js` at `id: 'fall'`.
- **If you forget:** the same as on Nov 9, 2026.

### Thu Nov 18, 2027 to Fri Nov 26, 2027: winter look, Thanksgiving (Thu Nov 25, 2027), trees from the Friday after

- **By itself:** winter look on Thu Nov 18, 2027; tree season starts Fri Nov 26, 2027.
- **You, by Wed Nov 24, 2027:** the tree dates and prices, the winter hours, the `week` note, as on Nov 25, 2026.
- **Where:** `js/content.js` at `greenhouse: { days: [5, 6, 0]` and `week: {},` (2 places).
- **If you forget:** the same as in 2026.

### Thu Dec 9, 2027 and Fri Dec 24, 2027 to Fri Dec 31, 2027: trees end, Christmas, the end of the year

- **By itself:** tree season is over on Thu Dec 9, 2027. Fri Dec 24, 2027, Sat Dec 25, 2027 and Sun Dec 26, 2027 are open days (The GreenHouse and Wise Pie are open Friday to Sunday).
- **You, by Wed Dec 22, 2027:** closures and a notice for the days you are closed; the "new" and "Fall 2027" labels for next January (see Fri Jan 1, 2027).
- **Where:** `js/content.js` at `closures: [],` and `noticeUntil: '',`.
- **If you forget:** "Open now" on a closed day.

### Sat Jan 1, 2028: the year turns again

- **By itself:** the footer year becomes 2028. The "Fall 2027" labels begin to look old, as the 2026 ones did.
- **You:** repeat the Jan 1, 2027 entry.
- **Where:** `python3 tools/check_facts.py year`.
- **If you forget:** old labels, nothing wrong.

## 5. Any day: closing for rain and other surprises

- **The quick way, on the day itself.** Run `python3 tools/close_today.py rain` (or `wind`, `holiday`, `late-open 10:30`, `sold-out`). It adds the day to `closures`, writes the notice in five languages with its last day, and keeps a copy of the old file outside the website folder. Then it prints what it cannot do: the times in Bookeo, the Business Profile and Instagram, with words ready to paste (`docs/NOTICE_KIT.md`). Add `--dry-run` first to see the change. `python3 tools/close_today.py --undo` puts everything back.
- **Close the day.** Add the date to `closures` in `js/content.js` (`'2026-10-11'` for one day, `'2026-11-09..2026-11-15'` for a run). The farm, The GreenHouse and Wise Pie then show as closed on that day, all three together. It does not stop Bookeo: close the same times there (README row "Close for rain or a holiday"). Past dates may stay in the list.
- **Say it on every page.** Write `notice` (the yellow bar) and `noticeUntil` (the last day it shows). The bar shows from the moment you publish, with no start date, so put the date in the words ("Closed Oct 10 for rain.") and, for a closure weeks away, add the bar later. One bar at a time; for each language write `{ en, es, hi, zh, vi }` (README row "Show a banner on every page").
- **How long it stays.** A closure works on its day only. The bar hides itself the day after `noticeUntil`; `?check` then says so in its green box ("nothing is broken": it only reminds you to clear the old words). A bar with no `noticeUntil` stays until you write `notice: ''`.
- **A same-day closure.** Visitors' browsers may keep the old file for up to an hour after you publish, so also post it where people look first: Facebook, Instagram and your Business Profile.
- **If you forget:** the badges say "Open now", and a bar with no last day stays up after the day it was about.
- **Where:** `tools/close_today.py` does the edit for you. By hand it is `js/content.js` at `closures: [],`, `notice: '',` and `noticeUntil: '',`.

## 6. Lines that never switch off by themselves

These stay on the page every day until you edit them. Nothing ties them to a date.

- **"Prices coming soon"** on the Shop and the price lists. Fill each when you have the price (**d54**). Search those words in `index.html`.
- **School tours "Now booking"** (`index.html` at `data-t="td727517c"` and `data-t="t61e401ae"`): they show all year (**d27**). Change them when the tours are not booking.
- **The "2026" labels** ("Fall 2026 reservations", "Fall Menu 2026", "Prices are for fall 2026", the pumpkin page). `python3 tools/check_facts.py year` lists them. The menu picture name has 2026 in it: add the new one under a new name (README, section "A new year, a new season").
- **"Usually mid-April to early June" and the other usual dates in the words.** They repeat every year (search `mid-April`, `mid- to late June`, `Mid-September` and `Friday after Thanksgiving`: the Season by season table, the season cards, the FAQ, the Strawberry and Pumpkin pages). Change them only when the usual dates change, in the words and in `js/season.js` together (ask Claude: a test compares them).
- **Pictures with dated words** (Easter, Father's Day, "waiting all summer", "berries & sunflowers"): they are in the gallery all year (**d13**, **d32**).
- **Reviews** you added, with their free-text `date`.
- **Prices and tax.** The site shows only the prices you typed, and no sales tax. When a price changes, follow README, section "Change a fact everywhere", then `python3 tools/check_facts.py price`. Bookeo and Square show what is charged at checkout.

A check for date problems (3 October 2026) found nothing in the code tied to a year. The seasons, the hours, the footer year and the countdowns all work from the clock. Visitors in other time zones get the farm's day, not their own. The search-engine data has no date that runs out, and the sitemap has no "last changed" date to keep up. A page left open over midnight or New Year catches up by itself in the badges, the top bar, the notice bar, the footer year and the lines that hide themselves. The season look and the words of the first screen change when the page is opened again. The only dates that go stale are the ones you write in the words, and they are listed above.

## 7. Once a year

Put each date in your phone calendar twice: 60 days before and 14 days before.

- **The domain.** Look up the renewal date at your registrar (`docs/LAUNCH_CHECKLIST.md`, section "4. Before you go live", rows D1 and D2). If it lapses, the website **and the email addresses** on `wiseacresorganic.com` stop.
- **The padlock.** Cloudflare Pages and Netlify renew it by themselves. The monthly launch check says "The padlock (HTTPS) is not ready" if it ever does not.
- **Search Console.** The site stays verified while its tag stays in `index.html` (search the words "GOOGLE SEARCH CONSOLE"); the Sitemaps report should say "Success" (`docs/LAUNCH_CHECKLIST.md`, section "3.10").
- **Business Profile.** Hours, holiday hours, the website address and the booking link match the site (section "3.12").
- **Paid accounts.** Your host plan, Mailchimp, Bookeo, Square and any analytics service: the renewal date, and that a changed booking or pre-order address is changed on the site too (README row "Change the booking link").
- **The translations.** Once a year, in August before the fall look starts, have a native speaker read what changed (questions **d37** and **d71**).
- **Old closure dates.** In January delete the passed dates from `closures`, if you like (passed dates may stay).

## 8. Questions that wait for a date

None of these is decided here. Each is a card on your dashboard; this list says when it starts to matter.

| Question | Needed by | Why then |
|---|---|---|
| d60 Closed Sunday, October 4 for rain? | Sat Oct 3, 2026 | the Sunday badges |
| d23 Is the farm open after November 8? | Sun Nov 1, 2026 | the fall season ends Nov 8 |
| d25 Reserve buttons when nothing can be booked | Sun Nov 1, 2026 (again Tue Feb 9, 2027) | the buttons show between seasons |
| d01 What visitors see in winter, d09 The GreenHouse winter hours, d69 "Every tree is lit!" appears too early | Tue Nov 17, 2026 | the winter look starts Nov 18 |
| d50 Christmas tree dates, d54 Prices for pumpkins, berries, flowers and trees | Wed Nov 25, 2026 | the tree season starts Nov 27 |
| d66 Stop saying "new this year" from January? | Fri Dec 18, 2026 | the new year |
| d26 When are cut flowers available?, d41 Cancel fee on the strawberry page | Thu Apr 8, 2027 | the strawberry season starts Apr 15 |
| d58 Snacks and drinks in spring and summer?, d59 Do you still run summer programs?, d68 Sunflower badge only works on big screens | Mon Jun 7, 2027 | the summer season starts Jun 15 |
| d24 Fall 2027 prices, schedule and menu | Wed Aug 11, 2027 | the fall look starts Aug 12 |
| d48 Haunted trail and u-pick tomatoes this fall, d51 Are the fall opening hours right?, d08 Thai night | Mon Sep 6, 2027 | the fall season starts Sep 13 |
| d27 School tours banner, d13 Photos with words or people, d32 Photos that have dated words on them | any time | they show all year |
| d37 Native speakers for the translations, d71 Friendly or formal in the translations? | any time | before the next August check |

Cards with no date: d61, d62, d63, d64, d65, d67, d70, d72, d73.

## 9. The dates the site uses (checked by the test)

The test `node tests/owner-calendar.test.mjs` compares every row below with the files. It needs no browser and takes about a second. If you change a season date or a dated line, ask Claude to run it and to update this page.

### The days the site changes its season look or its season, by itself

| Date | Day | What changes |
|---|---|---|
| `2026-11-09` | Mon Nov 9, 2026 | fall season over (last day Nov 8); no season in progress |
| `2026-11-18` | Wed Nov 18, 2026 | winter look |
| `2026-11-27` | Fri Nov 27, 2026 | tree season starts (the Friday after Thanksgiving) |
| `2026-12-09` | Wed Dec 9, 2026 | tree season over (last day Dec 8) |
| `2027-02-10` | Wed Feb 10, 2027 | spring look |
| `2027-04-15` | Thu Apr 15, 2027 | strawberry season starts |
| `2027-06-08` | Tue Jun 8, 2027 | strawberry season over (last day Jun 7) |
| `2027-06-12` | Sat Jun 12, 2027 | summer look |
| `2027-06-15` | Tue Jun 15, 2027 | blueberries and sunflowers season starts |
| `2027-07-11` | Sun Jul 11, 2027 | summer season over (last day Jul 10) |
| `2027-08-12` | Thu Aug 12, 2027 | fall look |
| `2027-09-13` | Mon Sep 13, 2027 | fall season starts |
| `2027-11-09` | Tue Nov 9, 2027 | fall season over (last day Nov 8) |
| `2027-11-18` | Thu Nov 18, 2027 | winter look |
| `2027-11-26` | Fri Nov 26, 2027 | tree season starts (the Friday after Thanksgiving) |
| `2027-12-09` | Thu Dec 9, 2027 | tree season over (last day Dec 8) |

### The lines that have a last day (a `data-until`) or an opening day (a `data-release`)

A line with `data-until="D"` hides itself on the day after D. A pizza row has both: it opens on its `data-release` Tuesday and hides after its `data-until`.

| In the files | What it is | Hides on |
|---|---|---|
| `data-until="2026-10-04"` | the note "Open now: pizza reservations for Oct 2 & 3" | Mon Oct 5, 2026 |
| `data-until="2026-10-06"` | the "Exceptional Children Day" line | Wed Oct 7, 2026 |
| `data-release="2026-10-06"` `data-until="2026-10-11"` | pizza row: opens Oct 6, visits Oct 9 to 11 | Mon Oct 12, 2026 |
| `data-release="2026-10-13"` `data-until="2026-10-18"` | pizza row: opens Oct 13, visits Oct 16 to 18 | Mon Oct 19, 2026 |
| `data-release="2026-10-20"` `data-until="2026-10-25"` | pizza row: opens Oct 20, visits Oct 23 to 25 | Mon Oct 26, 2026 |
| `data-release="2026-10-27"` `data-until="2026-11-08"` | pizza row: opens Oct 27, visits Oct 30 to Nov 8 | Mon Nov 9, 2026 |
| `data-until="2026-10-31"` | the "New: u-pick tomatoes & basil" chip and the "New" badge (2 places) | Sun Nov 1, 2026 |
| `data-until="2026-11-03"` | the "Home School Day" line | Wed Nov 4, 2026 |
| `data-until="2026-11-30"` | the "No pizza" block (the "Fall schedule" button on the pumpkin page carries the same date, but it already hides on Nov 9 with the fall season) | Tue Dec 1, 2026 |
| `data-until="2026-12-31"` | the "New this year" ribbon | Fri Jan 1, 2027 |

### Facts this page relies on

- Pizza rows open on Tuesdays at 5:00 PM (`data-release-time="17:00"` in `index.html`).
- The GreenHouse is open Friday to Sunday, 10 am to 8 pm, and Wise Pie 4 pm to 8 pm; the farm has a badge only in the fall, Thursday to Sunday (`hours` in `js/content.js`).
- "This week at the farm" stays for 14 days after `updated` and is gone from the 15th day (`expireDays: 14` in `js/features.js`).
- Easter Sunday 2027 is Sun Mar 28, 2027; Thanksgiving is Thu Nov 26, 2026 and Thu Nov 25, 2027.
- Footer year: `data-year` in `index.html`; it turns over at midnight on Jan 1 (Eastern Time).

*How this page is kept true.* `node tests/owner-calendar.test.mjs` checks these things:

- Every weekday written with a date is the right weekday.
- The entries are in date order.
- The season days above are exactly the days listed in [WHAT_VISITORS_SEE_WHEN.md](WHAT_VISITORS_SEE_WHEN.md). `node tests/calendar-doc.test.mjs` keeps that file equal to the real season code.
- Every `data-until` and `data-release` in the page files is in the second table, and every one in the second table is in the files.
- Each "Hides on" day is the day after its last day.
- `docs/OWNER_YEAR_CALENDAR.md` is linked from the README and the launch checklist.
- The Spanish copy, `docs/OWNER_YEAR_CALENDAR.es.md`, has the same dates, entries, tables, paths and words.

The file and words that each entry names are checked by `node tests/docs.test.mjs`.
