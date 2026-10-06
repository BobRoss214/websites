# The cheat sheet: the 12 jobs you do most

*For the farm owner. Every step was done by hand on a practice copy of the site on 4 October 2026. The dates below are examples: use your own. A page to print (one sheet, both sides): `print/owner-cheat-sheet.html`. Spanish copy: [OWNER_CHEAT_SHEET.es.md](OWNER_CHEAT_SHEET.es.md).*

## Before you start

- Open the site folder, then open a terminal in it (README, "Commands on Windows, Mac and Linux"). On Windows type `python` (or `py -3`) where this sheet says `python3`.
- Edit files in a plain text program: Notepad, or TextEdit with Format, Make Plain Text. Not Word.
- First copy the whole site folder and put today's date in its name. That copy is your undo (job 9).
- To search a file press Ctrl+F. In `index.html` a dash is written `&ndash;`, so search `10 am&ndash;8 pm`.
- Edit `index.html`, `js/content.js` and the files in `pages/`. Never edit the five built pages in the top folder (`first-visit.html`, `pumpkin-patch.html`, `strawberry-picking.html`, `school-field-trips.html`, `wise-pie.html`).

## T. Translations (job 5 sends you here, and so does a command that says NOT DONE yet)

Every English sentence you change needs four translations: Spanish, Hindi, Chinese and Vietnamese. The commands in jobs 1, 6 and 7 write them for you. Or send Claude what step 1 prints.

1. Run `python3 tools/pages.py`, then `python3 tools/i18n.py extract`, then `python3 tools/i18n.py missing es --list`. You should see one line for each changed text, like `t87b79837 | Fri–Sun, 10 am–9 pm`. The first word is the new code.
2. Open `lang/src/es.json`. Search the old words in Spanish (for example `10 a. m.`). Copy the old line, paste it under itself, then change the code and the number or the address. Change nothing else.
3. Do the same in `lang/src/hi.json`, `lang/src/zh.json` and `lang/src/vi.json`. Use straight quote marks. Keep a comma at the end of every line except the last one before a `}`.
4. Run `python3 tools/i18n.py build`. You should see one line for each language, like `lang/zh.js  ui=1056 js=305`. If it says `not valid JSON` and a line number, look at that line and the line above it.
5. Run `python3 tools/i18n.py missing es`, then the same with `hi`, `zh` and `vi`. Each one must say `0 missing`.

## 1. Change opening hours (example: The GreenHouse closes at 9 pm)

1. Run `python3 tools/change_fact.py hours "Fri-Sun, 10 am-8 pm" "Fri-Sun, 10 am-9 pm"`. It lists every place that holds the old hours, in `index.html` and `js/content.js`. It changes nothing yet.
2. Run the same command with `--yes` on the end. It changes the places, writes the four translations itself and checks everything. It takes about 10 seconds. You should see `Ready.` and `every fact agrees and no text is missing`.
3. It also prints the new hour lines in Spanish, Hindi, Chinese and Vietnamese. Have a native speaker read them once.
4. Run `python3 tools/serve.py`. On a Friday, Saturday or Sunday before 9 pm the green badge says `Open now, until 9 pm`. Then publish (job 8).
5. If it says `NOT DONE yet`, it lists what is left. Send those lines to Claude. Or put everything back: `python3 tools/change_fact.py undo`.

## 2. Close for one day (rain)

1. Open `js/content.js`. Search `closures: [],`. Put the day between the brackets, in quote marks: `closures: ['2026-10-11'],`. Two days: `['2026-10-11', '2026-10-18']`. A whole week: `['2026-11-09..2026-11-15']`.
2. Write each date as year-month-day with two digits each. If you write `'2026-10-4'`, the yellow Site check box says `closures "2026-10-4" was read as 2026-10-04.`
3. Run `python3 tools/serve.py`. On that day the badges at the top say `Closed today. Opens Friday at 10 am` and `No visits today. Next reserved day: Thursday`. On other days nothing changes: the badges follow the date.
4. This does not close Bookeo. Close those times in Bookeo yourself. Also show a notice (job 3).
5. Publish (job 8). Dates that have passed may stay in the list. Next time search `closures:` and use the line with no `*` at the start.

## 3. Show a notice bar

1. Open `js/content.js`. Search `notice: '',`. Write your words between the quote marks: `notice: "Closed Sunday, Oct 11, for rain.",`. Use double quotes when your words hold an apostrophe.
2. On the next line search `noticeUntil: '',`. Write the last day the bar shows: `noticeUntil: '2026-10-12',`. After that day it goes away by itself. There is no start day, so write the day in the words.
3. Run `python3 tools/serve.py`. You should see a bar at the top of the page: `Heads up: Closed Sunday, Oct 11, for rain.` It shows in English in every language.
4. If the Site check box says `js/content.js stopped at line` and a number, look at that line and the line above it. The usual causes are a missing comma, or an apostrophe inside single quotes.
5. To take the bar down, write `notice: '',` and `noticeUntil: '',` again. Then publish (job 8).

## 4. Open a new pizza weekend

1. Open `index.html`. Search `data-release=`. The last row of the pizza table looks like `<tr data-release="2026-10-27" data-until="2026-11-08">`. Copy that whole row (from `<tr` to `</tr>`) and paste it under itself.
2. In the copy change four things: `data-release="2026-11-03"` (the Tuesday reservations open), `data-until="2026-11-08"` (the last visit day), `Nov 3` (that Tuesday) and `Nov 6&ndash;8` (the visit days). Type the dash as `&ndash;`.
3. Search `<strong>Open now:</strong>`. Replace the whole paragraph with `<p class="notice" data-until="2026-11-08"><strong>Open now:</strong> pizza reservations for Nov 6&ndash;8.</p>`. It shows the moment you publish, so do this on the day reservations open.
4. Run `python3 tools/make_deploy_folder.py`. It writes the date lines in Spanish, Hindi, Chinese and Vietnamese by itself (`tools/date_phrases.py`), so you send nothing to anyone. You should see `Ready:` at the end. If it stops, it names the line and says why.
5. Run `python3 tools/serve.py`. The table "When pizza reservations open" shows the new row. Before 5 pm on that Tuesday the countdown says `Next pizza reservations open in 4 hours 59 minutes`. After 5 pm it says `Pizza reservations are open now`.
6. Every week: add the next row, change the sentence, run step 4, then publish (job 8).

## 5. Add or change a photo

1. Run `python3 tools/add_photo.py "C:\Pictures\goat.jpg" --name goat-on-grass --alt "A white goat on green grass" --caption "Goat on the grass" --tags animals`. Say only what you can see in `--alt`: no prices, names or dates. You should see `Done.` and a line that starts with `picture:`.
2. Run `python3 tools/i18n.py jsstrings`. You should see a line like `306 JavaScript strings -> lang/js-strings.json`.
3. Open `lang/src/es.json`. Under `"js": {` at the top add two lines, with the English words first: `"A white goat on green grass": "Una cabra blanca sobre hierba verde",` and `"Goat on the grass": "Cabra en la hierba",`. Do the same in `lang/src/hi.json`, `lang/src/zh.json` and `lang/src/vi.json`. Box T shows how to write a translation line.
4. Run `python3 tools/i18n.py build`. Then run `python3 tools/i18n.py missing es`, and the same with `hi`, `zh` and `vi`. Each one must say `text written by JavaScript: 0 missing`.
5. Run `python3 tools/serve.py` and scroll to the photo gallery. It counts one photo more (`All: 31 photos`) and shows your photo. Then publish (job 8).
6. To change a photo, add the new one with a NEW name: browsers keep an old picture for up to a year. Ask Claude to take the old one out.

## 6. Change a price (example: the $31 package becomes $32)

1. Run `python3 tools/change_fact.py price '$31' '$32'`. Keep the single quote marks: they stop your terminal from changing `$31`. You should see `3 places in 2 files`, in `index.html` and `pages/pumpkin-patch.html`. It changes nothing yet.
2. Run the same command with `--yes` on the end. It changes the 3 places, copies the 3 translations in each language and checks everything. You should see `Ready.`
3. A price can mean two things. If it says `means more than one thing` (`$3` is also the barrel train), add words that are next to your price: `python3 tools/change_fact.py price '$3' '$4' --only "per person"`.
4. Run `python3 tools/serve.py` and look at the package and the Shop. Then publish (job 8).
5. Wrong? `python3 tools/change_fact.py undo` puts everything back.

## 7. Change the phone number or the email address

1. Run `python3 tools/change_fact.py email cathy@wiseacresorganic.com office@wiseacresorganic.com`. It lists every place, the waitlist button in `js/features.js` too. It changes nothing yet. For the day-of phone number: `python3 tools/change_fact.py phone 704-207-6347 704-555-1234`.
2. Run the same command with `--yes` on the end. It changes the places, writes the translations (6 texts for the email, 1 for the phone) and checks everything. You should see `Ready.`
3. Run `python3 tools/check_facts.py e-mail`, or `python3 tools/check_facts.py phone`. The old address or number should be gone from the list, and the last lines should say `agree everywhere; 0 disagree.`
4. Publish (job 8). Then open the live site with `?check` (job 10).
5. Wrong? `python3 tools/change_fact.py undo` puts everything back.

## 8. Publish

1. Check your change first (job 10).
2. Run `python3 tools/make_deploy_folder.py`. It takes about 15 seconds.
3. You should see `Ready:` and `Upload what is INSIDE that folder`. Ready means the pages are up to date, the facts agree, all four translations are in, and every file the pages need is in `deploy/`. Lines that start with `WARNING:` are settings still to set. They do not stop you.
4. If you see `NOT READY: 4 checks are red.` instead, read each red line. It names the file and says what to do. Nothing is written to `deploy/`. Fix it and run the command again. Do not use `--force` unless Claude says so.
5. Upload the files inside `deploy/`: in Cloudflare open Workers & Pages, your project, "Create a new deployment", and drag the files in (`docs/LAUNCH_CHECKLIST.md`, step 3.2). Keep a copy of the folder with the date in its name, like `wise-acres-upload-2026-10-09`.
6. Open `https://www.wiseacresorganic.com/?check`. No yellow box means all is well. Press Ctrl+F5 (Mac: Cmd+Shift+R) to see the new version at once. Other people may see the old one for up to an hour.

## 9. Undo my last change

1. Close your editor. Put your dated copy of the folder back. If you only changed one or two files, put back just those files (`js/content.js`, `index.html`, `pages/`, `lang/src/`).
2. If you put back only some files, run these four commands, one after the other: `python3 tools/pages.py`, `python3 tools/i18n.py extract`, `python3 tools/i18n.py jsstrings`, `python3 tools/i18n.py build`. They change nothing that is already right.
3. Run `python3 tools/make_deploy_folder.py --check`. You should see `Facts agree everywhere. Translations complete: es, hi, vi, zh.` and `Ready to make deploy/ (nothing was written: --check).`
4. Already uploaded? In Cloudflare open your project, then "Deployments", and roll back to the earlier one (`docs/LAUNCH_CHECKLIST.md`, section "5. After launch"). Then open the live site with `?check`.

## 10. Check my change

1. Save your files. Run `python3 tools/serve.py`. It prints `Address:` and a web address like `http://localhost:54755/`, and opens your browser. After each save press F5. Press Ctrl+C to stop it.
2. Look at the bottom of the page. A yellow box, `Site check: 1 thing to fix`, says what to fix and where. A green box, `Site check: nothing is broken`, is fine: it only lists old lines that hid themselves. No box means nothing was found.
3. Run `python3 tools/check_facts.py`. The last lines should say `agree everywhere; 0 disagree.` A fact written two ways is marked `DIFFERENT`, with the file and the line.
4. Run `python3 tools/make_deploy_folder.py --check`. It writes nothing. You should see `Facts agree everywhere. Translations complete: es, hi, vi, zh.`
5. On the live site add `?check` to the address: `https://www.wiseacresorganic.com/?check`. Visitors never see a message, so look after every upload.

## 11. Something looks wrong

1. Stay calm. Nobody sees your changes until you upload them. After an upload the earlier version is still kept in Cloudflare.
2. Open the site with `?check` (on your computer: `python3 tools/serve.py`). Read the box. It names the setting and what to type. `js/content.js stopped at line` and a number means a typo in that file: look at that line and the line above it.
3. Run `python3 tools/check_facts.py` and `python3 tools/make_deploy_folder.py --check`. Each red line names the file and the fix.
4. Still wrong? Undo your last change (job 9). Wrong on the live site? In Cloudflare open "Deployments" and roll back to the earlier one.
5. To test the live site run `python3 tools/launch_check.py https://www.wiseacresorganic.com/ --quick`. It takes about 10 seconds. Each `FAIL` line says what to do. The last lines start with `== Summary ==`.
6. Ask Claude, the helper who looks after the site. Send what you changed, when, and the words from the yellow box or the red lines (copy and paste).

## 12. New year: the four yearly jobs

1. Renewals. Put each date in your phone calendar twice, 60 days and 14 days before. The domain `wiseacresorganic.com` (it also keeps the farm email working). Your paid accounts: host, Mailchimp, Bookeo, Square.
2. Look at the live site: the padlock, Google Search Console (it should say "Success" for the sitemap) and the hours in your Google Business Profile.
3. Words with a year. Search `2026` in `index.html` and in the files in `pages/`. Some words do not change by itself. These are the "Fall 2026" headings, the fall menu picture (job 5), the special days and the pizza rows (job 4). The year in the footer does change by itself.
4. Once a year have a native speaker read the translations (August, before the fall look starts). In January delete the passed dates in `closures:` if you like.
5. All the dates, one by one: `docs/OWNER_YEAR_CALENDAR.md`, section "7. Once a year".

## Notes for the team

Not for the owner, and not printed.

- How it was checked. On 4 October 2026, on a copy of the site with the optional patches, every step above was done by hand and the results were read in the browser (with a pretend clock for the badges, the notice bar and the pizza countdown). The commands and the words you should see are the real ones.
- The print page. `print/owner-cheat-sheet.html` and `print/owner-cheat-sheet.es.html` are made from these two files by `python3 tools/make_cheat_sheet.py`. They are not uploaded (`tools/make_deploy_folder.py` leaves them out). A test fails when they are out of date.
- The Spanish copy. `docs/OWNER_CHEAT_SHEET.es.md` has the same lines in the same order. A test compares the kind of every line, the words in backticks and the numbers. Change both files together.
- Not in the tree yet, so not on the sheet: a one-command tool to close for a day (tools/close_today.py), an answer-rehearsal tool (tools/rehearse_answers.py) and a doctor tool. When one arrives, add a line to job 2 or job 11.
- Known limits. `tools/change_fact.py` swaps a number, a price, an address or an hour in the old translations; a change of words (job 5, box T) still needs a person. Only The GreenHouse hours are shown as an example: the same command works for Wise Pie hours, for example "4 to 8 pm".
