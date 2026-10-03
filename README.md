# Wise Acres Organic Farm: website redesign

A colorful, illustrated, interactive redesign of the Wise Acres Organic Farm site (Indian Trail, NC).
Plain HTML, CSS and vanilla JavaScript. No build step needed to run it, no dependencies, works offline.
Available in English, Spanish, Hindi, Chinese (Simplified) and Vietnamese.

```
index.html              the home page (all sections + the inline SVG illustration library)
first-visit.html        generated guide pages (see "Extra pages" below)
pumpkin-patch.html
strawberry-picking.html
school-field-trips.html
wise-pie.html
sitemap.xml, robots.txt generated with the pages
404.html                a friendly "page not found" page (plain English, expects the site at the domain root)
manifest.webmanifest    icon + colors for phones that bookmark the site
_headers                security and cache headers for Netlify / Cloudflare Pages (copy the same into other hosts)
pages/                  the short sources the extra pages are built from
css/styles.css          design system, hero layout, base components
css/sections.css        section styles (visit, packages, pizza, GreenHouse, groups, story…)
css/hero.css            seasonal hero: sky/card colors per season, tractor, campfire and snow animations
css/extras.css          open-now badges, notice bar, countdown, seasonal dividers/footer, languages, reviews, inner pages
css/features.css        pizza countdown, "this week" box, email signup, review + press, photo wall, farm map, drive times
js/content.js           editable content: hours, closures, notice bar, reviews, "this week" box, email signup, review link, analytics, photo list, farm spot, season switcher
js/season.js            season dates + "which season is it today?" (sets html[data-season])
js/i18n.js              language switcher + text swapping (loaded first so the page paints in the chosen language)
js/hero.js              draws the four hero scenes, footer art, and runs the picking / lighting / toot interactions
js/main.js              everything else: scroll effects, seasons tabs, groups, bouquet, goat, reviews, print checklist…
js/live.js              "Open now" badges, notice bar, next-season countdown, top-bar text
js/analytics.js         privacy-friendly analytics (off until you pick a provider)
js/features.js          pizza-reservation countdown + calendar reminders, "this week" box, email signup, review links, photo wall, farm map, drive times
js/farm-map-data.js     the points of the farm map (written by tools/farm_map.py from tools/saved-map.json; do not edit by hand)
js/map-art.js           draws the illustrated farm map from those points (forest, fields with plants, parking with cars, maze, trails, icons)
lang/src/<code>.json    the translations (you edit these)
lang/<code>.js          built from lang/src (what the pages load; do not edit)
lang/en.json, lang/js-strings.json   written by tools/i18n.py (the English text of the pages by id; the text JavaScript writes): do not edit
tools/                  pages.py (builds the extra pages), i18n.py (tags text, builds translations),
                        make_qr.py + qr_links.json (QR signs), farm_map.py + saved-map.json (saved map -> js/farm-map-data.js),
                        add_photo.py (adds a photo: web size, no hidden data, listed in the gallery) + test_add_photo.py (its check)
assets/qr/              QR codes (SVG), made by tools/make_qr.py
print/qr-signs.html     printable signs, one per page, English + Spanish (not listed in Google)
tests/                  automatic browser checks for developers, not part of the website (do not upload; see tests/README.md)
docs/                   notes and questions for the farm, the launch checklist, what the site stores (not for visitors: do not upload)
assets/photos/          farm photos
assets/fonts/           Fredoka, Nunito (+ Vietnamese letters), Caveat (SIL Open Font License), self-hosted
```

Preview locally: double-click `index.html` (English works at once; the other languages load more reliably over a small web server:
run `python3 -m http.server` in this folder and visit http://localhost:8000).

## Start here (for the farm owner)

You can change many things on the site yourself, with no programming: you type words, dates and numbers into a plain text file, save it,
and look at the site. Anything marked **ask Claude** needs a command typed into a terminal window. You can ask Claude, or set your own computer up once and type the commands yourself (see "Commands: one-time setup" below).

**Editing a file safely**

1. Open the file in a plain text program: Notepad (Windows), TextEdit with Format > Make Plain Text (Mac), or a code editor.
   Not Word, Pages or Google Docs: they turn straight quote marks into curly ones, and the page stops working.
2. Keep a copy of the file before you start. To undo everything, put the copy back.
3. Change only what is between quote marks, and the numbers and dates. Leave the quote marks, the commas at the ends of lines and the
   brackets `{ } [ ]` where they are.
4. Write dates as year-month-day with two digits each: `'2026-10-04'` is October 4, 2026.
5. An apostrophe inside single quotes breaks the file. Put double quotes around the whole text instead: `notice: "We're closed Saturday.",`
6. Save, then look at the site (see "Check your changes" below). A yellow "Site check" box tells you what to fix.
7. Saving on your computer does not change the live site: publish the changed file the way you publish the site (see "Putting it online").
   Browsers may keep the old file for up to an hour. A hard refresh (Ctrl+F5, or Cmd+Shift+R on a Mac) shows the new one at once on your own screen.

`js/content.js` has the same instructions at the top, with an example for each setting.

**Commands: one-time setup** (only for the changes below that say "run")

Changes to the words on a page, the translations, photos and the QR signs use short commands typed into a terminal window. Set this up once; after that each command is one line.

1. Install Python 3 from python.org/downloads. On Windows, tick "Add python.exe to PATH" on the first screen of the installer.
2. Open a terminal in the site folder. Windows: open the folder in File Explorer, click the address bar, type `cmd` and press Enter. Mac: open the Terminal app, type `cd ` (with a space after it), drag the site folder into the window and press Return.
3. Type `python3 --version` and press Enter. It should answer `Python 3.` and some numbers. On Windows type `python --version` instead; if Windows says Python was not found, or opens the Microsoft Store, run the installer again and tick the PATH box. This file writes every command as `python3 ...`: on Windows type `python ...` (or `py ...`).
4. Once, install the three helper packages: `python3 -m pip install beautifulsoup4 pillow segno` (`beautifulsoup4` is for `pages.py` and `i18n.py`, `pillow` for `add_photo.py`, `segno` for `make_qr.py`).

A message that ends in `No module named ...` means step 4 was skipped. `command not found`, or `'python3' is not recognized`, means step 1, or that Windows needs `python` instead of `python3`.

## Day-to-day changes

| I want to… | Do this |
| --- | --- |
| Close for rain or a holiday | `js/content.js` → in `closures` add the date between quote marks: `closures: ['2026-10-04'],` (more days: `['2026-10-04', '2026-10-11']`; a whole week: write all seven days; there is no range). Days that have passed can stay. The "Open now" badges for the farm, The GreenHouse and Wise Pie then show closed (or "No visits today") that day. **All three are closed together: you cannot close only the farm** (for that, use the banner in the next row and close the times in Bookeo). It does not stop people booking in Bookeo, so close those times in Bookeo too. To see a closed badge today, write today's date for a minute, look, then put the real date back. After a long closure the badge names only the weekday ("Opens Friday"): if the next opening is more than a week away, say the date in the banner. |
| Show a banner on every page | `js/content.js` → `notice: "Closed Saturday, Oct 10, for rain.",` and, to make it disappear by itself, `noticeUntil: '2026-10-11',` (the last day it shows). **The banner shows from the moment you publish, not from the day it is about** (there is no start date), so write the date in the words and, for a closure weeks away, add the banner later (put a reminder in your calendar). There is one banner at a time, and the words "Heads up:" are put in front of it for you. The banner is in English for everyone; to write it in each language use `notice: { en: '…', es: '…', hi: '…', zh: '…', vi: '…' },` (a language you leave out shows the English). To remove it: `notice: '',`. Write `"We're closed"` in double quotes if the words have an apostrophe. |
| Change opening hours | `js/content.js` → `hours`. Times are Eastern Time on a 24-hour clock (`'16:00'` is 4 pm). `days`: 0 = Sunday, 1 = Monday … 6 = Saturday. **The GreenHouse and Wise Pie each have one set of days and hours for the whole year**; only `farm` can be set per season. For different winter hours, change them when winter starts and again when it ends. This changes only the green "Open now" badges. The hours written in the page text are separate, and so are their translations: see "Change a fact everywhere" below. A misspelled name (`houers:`) is silently ignored: the Site check box does not look at `hours`. |
| Change season dates | The site follows the calendar by itself, every year (the dates in `js/season.js` have no year), so you do **not** add 2027 dates: see "A new year, a new season" below. To change the usual dates, ask Claude. They move the hero scene, the season tabs, the top bar and the countdown. |
| Turn off the season switcher | `js/content.js` → `seasonPicker: false,`. The "See the farm in…" buttons in the first screen disappear and the site follows the calendar. Do this before you launch. (The "What's on the farm" and "What's in season" tabs stay.) |
| Add a review | `js/content.js` → inside `reviews: [ ]` add `{ quote: "…", name: "Sarah M.", source: "Google", url: "https://…", date: "May 2026" },`. `quote` and `name` are required. Only add words a reviewer really wrote, and ask first. The quote cards stay hidden until there is one. The Google, Tripadvisor and Yelp buttons always show. |
| Add a photo | Run `python3 tools/add_photo.py` (steps under "Adding a photo" in the Photos section below), or ask Claude and send the picture with a few words on what is in it. It shrinks the picture, takes out the hidden camera and location data, saves it and lists it in the gallery. Other languages show the description in English until you add the translations. |
| Turn on analytics | Ask Claude. You first sign up with one of Plausible, GoatCounter, Umami or Cloudflare Web Analytics; Claude then puts the details in `analytics` in `js/content.js`. Nothing is counted until then, and never for visitors who send Do Not Track or Global Privacy Control. |
| Change the hero text for a season | Ask Claude. (The words are in `index.html`: the `.hero-sub` lines under the big headline and the winter headline `#hero-h`. They need new translations too.) |
| Change the booking link | Ask Claude. The Bookeo address `https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356` appears in many places and must be replaced in all of them. |
| Open a new pizza weekend | Open `index.html` and search for `data-release`. You find the table "When pizza reservations open": one row for each Tuesday, like `<tr data-release="2026-11-03" data-until="2026-11-08"><td>Nov 3</td><td>Nov 6–8</td></tr>`. Copy one whole row (from `<tr` to `</tr>`), paste it under the last row and change four things: **1.** the date inside `data-release="…"`, which is the day reservations OPEN, written year-month-day with two digits each (`2026-11-03`; not `11/3/2026`, not `2026-11-3`); **2.** the date inside `data-until="…"`, the last visit day (`2026-11-08`), after which the row hides itself; **3.** the first date people read (`Nov 3`); **4.** the second (`Nov 6–8`, the visit days). Then change by hand the sentence under the table that starts "Open now: pizza reservations for…", and its `data-until` (the last day it is true). Save and look: the countdown box, the "Remind me" buttons and the hero chip (fall hero only) follow the rows by themselves, so check that the countdown names the right day. The 5:00 PM comes from `data-release-time="17:00"` on that table (17:00 is 5 pm); the words "Tuesday, 5 PM" in the table heading are plain text. Last, ask Claude to update the translations, otherwise Spanish, Hindi, Chinese and Vietnamese visitors see "Nov 6–8" in English letters. |
| Say what is ripe / spots left this week | `js/content.js` → `week`. Copy the example under "Planning features" (or the one at the top of that file), change every date and word, save. It shows for 14 days after `updated`, then the box goes back to its automatic "typical dates" version. If something in it cannot be used, the "Site check" box says so: see "Check your changes". |
| Make the email signup work | `js/content.js` → `signup` → `action` (steps under "Planning features"). Easiest: paste your Mailchimp embed code to Claude. Then sign up once with your own email address to test it. |
| Hide something after a date | In `index.html`, add `data-until="2026-10-04"` to the tag that starts it (the last day it is true, Eastern Time): from the next day it hides itself. Visitors without JavaScript still see it. If you reuse it for new dates, change the date too. |
| Set the Google review link | `js/content.js` → `reviewUrl: 'https://g.page/r/…/review',` (steps under "Planning features"). Every "Leave a Google review" button follows it. |
| Show a visitor's photo | `js/content.js` → `community`, only after they said yes in writing (steps at the top of that file). |
| Print QR signs | Ask Claude to make the signs. Then open `print/qr-signs.html` in your browser and press Print (Letter paper; or "Save as PDF" for a print shop). Scan every printed sign with your own phone before you put it up. |
| Update the farm map | Change the marks in the Farm Map Marker and press "Save for Claude", then ask Claude to update the map. (Claude puts the saved file at `tools/saved-map.json` and runs `python3 tools/farm_map.py tools/saved-map.json`.) |
| Change wording on a page | Ask Claude. Every change of English wording needs the other four languages updated (see "Languages"). |

## Change a fact everywhere (hours, a price, the phone number, an email address)

The same fact is usually written in several places, and each place has four translations. The site cannot find them for you, so search the whole folder:

1. Use an editor that can search inside all the files of a folder ("Find in Files": Notepad++ and VS Code both have it, Ctrl+Shift+F). Plain Notepad searches one file at a time: open `index.html` and each file in `pages/` and press Ctrl+F in each.
2. Search for the **words in the table below**, not for a whole sentence. A dash is written `&ndash;` in the files, so search `10 am`, not `10 am–8 pm`. A number can be split by a tag (`<span class="big">$3</span> per person`). Look at every hit before you change it: `$3` is also the barrel train and the vegan cheese, and `$35` is a photo pass.
3. Change `index.html` and the files in `pages/`. **Never** change `first-visit.html`, `pumpkin-patch.html`, `strawberry-picking.html`, `school-field-trips.html` or `wise-pie.html` in the top folder: they are rebuilt from `pages/`, and your change would be lost.
4. Run `python3 tools/pages.py`, then `python3 tools/i18n.py extract`, then `python3 tools/i18n.py missing es --list`. Every text you changed is listed there. Translate each one (next section), then `python3 tools/i18n.py build`. A number, a phone number or an email address on its own is not listed: it has nothing to translate.
5. Look at the site with `?check` (see "Check your changes"). A developer can run `node tests/consistency.test.mjs`: it lists every place a price, time, day, phone number or email is written and says which places disagree. The file names it prints for the five pages in the top folder mean the file of the same name in `pages/`.

| Fact | Search for | Places |
| --- | --- | --- |
| The GreenHouse hours (now Friday–Sunday, 10 am–8 pm) | `10 am` | `index.html`: four places say 10 am–8 pm (the facts card, the heading of the GreenHouse section, "Open Friday–Sunday", the note in Contact). The others say `10 am – 4 pm`: that is pizza at the farm. Also in `index.html`: `data-days=` and `aria-label="Open Friday, Saturday and Sunday"` under that heading (the little week picture), and `hours` in `js/content.js` (the green badges). |
| Wise Pie hours at The GreenHouse (now Friday–Sunday, 4–8 pm) | `4 to 8`, `4 pm`, `4:00` | `index.html` (pizza section, GreenHouse section, FAQ), `pages/wise-pie.html` (the `description:` line at the top, "Two ways to get it", the FAQ), `pages/pumpkin-patch.html`, and `hours` → `pizza` in `js/content.js`. |
| The per-person farm fee (now $3) | `$3 per person`, then `>$3<` | `index.html`: the two package texts, the price list in the Shop, and the two photographer passes ("+ $3 per person farm fee"). `pages/pumpkin-patch.html`: the price list and the FAQ answer. **Leave** "$3 per child" (barrel train) and "+$3" (vegan cheese): other prices. |
| The $31 package | `$31` | `index.html` (the package and the Shop) and `pages/pumpkin-patch.html`. |
| The main phone number | `tel:`, `footer-contact`, `Questions?` | Add `<a href="tel:+17046286232">(704) 628-6232</a>` in the footer block (`footer-contact`), under the address on the farm card (the `<address>` after "The u-pick farm") and next to the "Questions?" email; add `"telephone": "+1-704-628-6232",` under the `"email"` line in the structured data at the top of `index.html`. Keep the photographers' "Day-of emergencies" number as it is. The footer block has translations: after `extract`, copy its old translation for each language and add `<br> <a2>(704) 628-6232</a>` at the end (the next section explains the `<a1>` / `<a2>` link tags). The developer's facts test then reports two phone numbers (the main one and the day-of one): that is expected, and a developer should allow it. |
| An email address | `@wiseacresorganic.com` | The general address is in many places (search the address). For a new person for one subject: Contact section, "Who to email": copy one whole `<li>…</li>` line, and change the words and the address in both spots. `extract` then lists two texts: the words (translate them) and `<svg/> name@wiseacresorganic.com` (use the same text in every language). |

## Change one sentence and its translations, step by step

**The English sentence is the key.** Each block of English text gets a short code made from its exact words (`data-t="t3b8b1f71"`), and each language file has one line per code: `"t3b8b1f71": "Preferimos efectivo…"`. Change one letter of the English and the code changes, so the old translation no longer fits anything. Example: add "Samsung Pay" to "Cash is preferred. We also accept all major credit cards, Apple Pay and Google Pay."

1. Change the English in `index.html` (and in the file in `pages/` if the sentence is there too: search a few of its words). Save.
2. Run `python3 tools/pages.py`, then `python3 tools/i18n.py extract`.
3. Run `python3 tools/i18n.py missing es --list`. It prints one line per text that needs a translation: `tf63372c4 | Cash is preferred. We also accept …`. The first word is the new code. (`hi`, `zh` and `vi` list the same codes.)
4. Open `lang/src/es.json`. Press Ctrl+F and search a few words of the old translation (`Apple Pay`): you find the old line, for example `"t3b8b1f71": "Preferimos efectivo… Apple Pay y Google Pay.",`. Leave it (an unused line does no harm). Directly under it, add a new line with the NEW code and your translation:
   `"tf63372c4": "Preferimos efectivo… Apple Pay, Google Pay y Samsung Pay.",`
   Rules: straight double quote marks `"` only (not curly ones); a comma at the end of every line except the last one before a `}`; keep tags such as `<strong>`, `<br>` and `<a1>…</a>` exactly as in the English (a link `<a1>` stays `<a1>`, and a second link is `<a2>`); where the English has `&amp;`, use the word for "and" in your language (or write `&amp;`); a `"` inside the text is written `\"`. Texts that JavaScript writes (the list at the end of `missing`, marked `js |`) go in the `"js"` part of the file, which comes first, with the English text as the key.
5. Do the same in `hi.json`, `zh.json` and `vi.json`. Names, email addresses and numbers stay as they are.
6. Run `python3 tools/i18n.py build`. If it says "not valid JSON … line N", look at line N and at the line **above** it: a comma is usually missing at the end of the line above, or a quote mark is curly. If it says "its tags differ", compare the tags in the English text it prints with the tags in your translation.
7. Run `python3 tools/i18n.py missing es` (then `hi`, `zh`, `vi`): each must say `0 missing`.
8. Look at the page in each language: `index.html?lang=es`, `?lang=hi`, `?lang=zh`, `?lang=vi`.

If a step is skipped, nobody sees an error:

- No `extract` after you edit the English: English visitors see the new words, but visitors in the other languages still see the OLD translation (for example the old price). `python3 tools/i18n.py missing es` now warns about this.
- `extract` but no translation: that block shows in English inside the translated page. `missing` lists it; the Site check box does not.
- One language left out: only that language shows English for that block.

## A new year, a new season

- **The seasons switch by themselves, every year.** The site follows the calendar: spring from April 15, summer from June 15, fall from September 13, winter from the Friday after Thanksgiving. The dates in `js/season.js` have no year, so they repeat. You do not add 2027 dates. If you ever edit that file: months count from 0 there (`new Date(y, 8, 13)` is September 13, `0` is January).
- **What does not switch by itself** (search for `2026`): the "Fall 2026" headings (the Visit section, the schedule, the Shop and its note "Prices are for fall 2026", "Fall 2026 special days", the Pumpkin patch page), "Fall Menu 2026" and its picture, the dates of the special days (Exceptional Children Day, Home School Day), and the rows of the pizza table. Search `2026` and look at each hit; a `data-until` or `data-release` date is a row or line that hides itself.
- **The pizza table:** delete the old rows and add the new ones (see "Open a new pizza weekend" above). New rows can go in weeks early, but the "Open now" sentence under the table shows the moment you publish it, so write it on the day the reservations open.
- **The menu picture** (`assets/photos/wise-pie-fall-menu-2026.webp`): add the new menu with `add_photo.py` under a NEW file name and change the link next to "View the printed menu". Visitors' browsers keep the old picture for up to a year if you reuse the name. Changing the heading to "Fall Menu 2027" does not change the pizzas on the page: check each pizza and price.
- Every text you change needs four translations ("Change one sentence", above). The footer year (2026 ©) changes by itself.

## Planning features (countdown, weekly box, signup, map…)

All of these live in `js/features.js` (the farm map is drawn by `js/map-art.js`; styles are in `css/features.css`). Each one hides itself until it has something to show.
Each paragraph says what visitors see, then what you do.

**Pizza countdown + "Remind me".** *Visitors see:* inside the Fall reservation schedule (`#schedule`) a box that counts down to the next
Tuesday 5:00 PM Eastern opening time (taken from the rows of the table) and, for six hours after it opens, says "just opened" with a Reserve
button. "Remind me" puts the opening times in their calendar: a Google Calendar link (it adds the next row, and repeats it every week only
when the rows are exactly 7 days apart), or a calendar file for Apple, Outlook and others with every upcoming row (up to 12) and a reminder
15 minutes before. A small chip in the fall hero says "Next pizza reservations open in 5 days 1 hour". Visitors outside Eastern Time also
see their own time. After the last row passes, the box and the chip hide themselves. The times are Eastern on purpose.
*You:* add a row to the table for each new weekend (see "Open a new pizza weekend" above). Nothing else.

**Weekly box ("This week at the farm").** *Visitors see:* a light green box under the first screen. It fills itself from today's date: what is
normally in season (strawberries, blueberries, sunflowers, pumpkins, tomatoes & basil, flowers) and what starts in the next three weeks
(for example Christmas trees at The GreenHouse). These are typical dates, not promises, and the box says so ("Based on typical dates. Real
dates depend on the weather."). The typical dates live in `js/features.js` (`CROPS`) and `js/season.js`: ask Claude to change them.
*You:* when you know better, add your own update (a note, how each crop is doing, and a "Spots left" table). In `js/content.js` find
`week: {},` and replace it with the example below. It is only an example: change every word and date, and delete the lines you do not need.

```js
week: {
  updated: '2026-10-01',                         // TODAY's date. Everything below is hidden once this date is more than 14 days old.
  note: 'Tomatoes are ripe this weekend. Bring a bucket!',   // or { en: '…', es: '…', hi: '…', zh: '…', vi: '…' } to write it in each language
  crops: { tomatoes: 'peak', pumpkins: 'starting', flowers: 'off' },   // soon | starting | peak | ending | off
  days: [ { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' },
          { date: '2026-10-03', farm: 'full', pizza: 'full' } ],         // open | few | full | closed
  waitlistEmail: 'cathy@wiseacresorganic.com',   // the "Email us to join the waitlist" button opens an email to this address
},
```

Rules for `week` (if you break one, that part is skipped; the "Site check" box tells you which):

- `updated` is required, written `'YYYY-MM-DD'` with two digits for month and day. Without it nothing else in `week` shows.
  `expireDays: 14,` is optional: the number of days after `updated` that the note, crops and spots stay. Leave it out unless you want a different number.
- `crops` names: `strawberries`, `blueberries`, `sunflowers`, `flowers`, `pumpkins`, `tomatoes`, `trees` (all small letters). Values: `soon`
  ("Coming soon"), `starting` ("Just starting"), `peak` ("Peak picking"), `ending` ("Winding down"), `off` (hides that crop), all small letters.
  A crop you do not mention keeps its typical dates.
- `days`: `date` written `'YYYY-MM-DD'`; only today and the next 14 days show. `farm` is the "No pizza" column (visits without pizza) and
  `pizza` is the "With pizza" column. Their values: `open` ("Spots open"), `few` ("A few spots left"), `full` ("Full"), `closed` ("Closed"); leave one
  out to show a dash. A day with spots in either column gets a Reserve button. A day that is Full with nothing open gets "Email us to join
  the waitlist". If the farm column says Closed and the pizza column is Closed or left out, there is no button.
- Use `full` only if someone will read and answer the waitlist emails. The button opens an email to `waitlistEmail`; the family still has to press Send.
  The email is always written in **English** (subject and lines), because the farm reads English. A visitor on a Spanish, Hindi, Chinese or Vietnamese page sees a line
  in their own language under each English line, and a "Preferred language" line, so you can answer in that language. What they type is never changed.
  If you leave `waitlistEmail` out, `cathy@wiseacresorganic.com` is used. If you type something that is not an email address, that same address is used and the "Site check" box says so.
- `note` (and a day's note) is shown exactly as typed in every language. For other languages write `{ en: '…', es: '…', hi: '…', zh: '…', vi: '…' }`; a language you leave out shows the English.
- Apostrophes: `note: "We're open Saturday!"` (double quotes) or `'We\'re open Saturday!'`. A single apostrophe inside single quotes stops all of `js/content.js`: hours, closures, the notice bar, photos and reviews disappear.

"Spots left" and the waitlist are typed in by hand. **Live spot counts from Bookeo are not included.** Showing them needs a web developer to
set up a small, safe connection to Bookeo (a website cannot read Bookeo directly, and Bookeo's secret keys must never be on the page). If you want
that later, hand this paragraph to a developer: the page already has a place for it, `week.feed`. The address must return the same information
as `week` (`updated`, `note`, `crops`, `days`, and `expireDays` if you send it; the page ignores anything else in it, including the waitlist address) and must answer with the
header `Access-Control-Allow-Origin: *`, or browsers refuse to read it from your website. The page reads it once when it opens, and falls back
to the hand-typed box if it cannot.

**Email signup with interests.** *Visitors see:* in the Contact section, until you connect Mailchimp, the plain "Join the email list" button.
After you connect it, a form: an email box, choices to tick (strawberries, blueberries, flowers, pumpkins, tomatoes & basil, Christmas trees,
pizza, events) and a "Join the email list" button. The other "Tell me when" and "Sign up" links then scroll to the form.
*You:* easiest is to paste the code of your Mailchimp embedded form to Claude. To do it yourself:

1. In Mailchimp go to Audience → Signup forms → Embedded forms. (Mailchimp changes its menus now and then; if you cannot find them, search
   Mailchimp Help for "embedded form".)
2. In the box of code, find `<form action="` and copy only the long web address between the quote marks after it. It starts with `https://`
   and contains `list-manage.com`. It is fine if it contains `&amp;`; the page turns that into `&` by itself.
3. In `js/content.js` paste it between the quote marks:

```js
signup: { action: 'https://YOURNAME.us21.list-manage.com/subscribe/post?u=…&id=…',
          interests: { pumpkins: 'group[12345][1]', trees: 'group[12345][2]' },   // optional, see below
          tags: '',
          languageField: '' },   // optional, see "Language of the people who sign up" below
```

4. Save, look at the site, and sign up once with your own email address. Mailchimp should send you a confirmation email; after you confirm it
   your address appears in Mailchimp under Audience → All contacts. If the form does not appear, or the "Site check" box complains, the address is wrong.
5. The page says "Check your email to confirm your signup". That is true only while Mailchimp asks people to confirm (Mailchimp calls this
   "double opt-in"). If you switch it off, tell Claude so the message can be changed.

`interests` is optional. The ticked choices only reach Mailchimp if you first create one Mailchimp group (type: checkboxes) for each choice you
want to keep, copy the embed code again, and match each choice to its `name="group[12345][1]"` line. The choice names are `strawberries`,
`blueberries`, `flowers`, `pumpkins`, `tomatoes`, `trees`, `pizza`, `events`. A choice with no `interests` entry is simply not sent: people can
tick it, but Mailchimp never hears about it. If you do not want to set groups up, ask Claude to hide the choices. Leave `tags: ''` empty.

*Language of the people who sign up (optional).* So you can write back in Spanish, Hindi, Chinese or Vietnamese: in Mailchimp add a **text field** to
the audience (Audience → Settings → Audience fields and *|MERGE|* tags → Add a field → Text; call it "Language"), copy the embed code again and find the
name of that field in it (it looks like `LANGUAGE` or `MMERGE6`: `name="MMERGE6"`). Put that name in `languageField: 'MMERGE6'`. Each signup then
carries the language of the page in English (`English`, `Spanish`, `Hindi`, `Chinese` or `Vietnamese`) in that field, and you can pick those people in
Mailchimp (Segment → Language is Spanish). Leave it empty and nothing about the language is sent. The Mailchimp confirmation email itself is in the
language of the Mailchimp form, which you set in Mailchimp (the signup page and QR sign have their own language setting).

**Reviews, news, photos.** *Visitors see:* in the Reviews section a "Leave a Google review" button and an **In the news** list (two Axios
Charlotte articles, found by web search: **please open both links and confirm** the headline, year and name before launch). The photo gallery has
a "From families who visit" row once you add photos to `community`, and the First-visit page can show an entrance / parking photo.
*You:*

- **Google review link.** Until you set `reviewUrl`, "Leave a Google review" only opens the farm on Google Maps. To set it: (1) sign in to Google with
  the account that manages the farm's Google Business Profile; (2) open the profile and choose "Ask for reviews" (it may be called "Get more
  reviews" or "Share review form"); (3) choose "Copy link" (it looks like `https://g.page/r/…/review`); (4) paste it in `js/content.js`:
  `reviewUrl: 'https://g.page/r/…/review',`; (5) save, then tap the button on your phone: it should open a box where you pick stars. If you cannot
  find the button, ask Claude to build the link. It must start with `https://` (the "Site check" box tells you if it does not).
- **Visitor photos** (`community`) and the **entrance photo** (`entrancePhoto`): step-by-step instructions are at the top of `js/content.js`.
  Only add a visitor's photo after they said yes in writing. Nothing from Instagram is embedded.
- **Award badges:** ask Claude (the image goes in `assets/badges/`; only with permission from whoever gave the award).

**Farm map.** *Visitors see:* an illustrated map (forest, mown lawn, dirt lanes, fields full of plants, a parking lot with cars, a maze, trails
with little characters and an icon for every pin) drawn from the points you marked, with a picture list they can tap and Apple Maps / Waze /
Google Maps links. The website does not publish the Google Earth photo itself (it is Google's picture). The map section (home page and
First-visit page) appears as soon as `js/farm-map-data.js` has points. **Your real map (25 points) is in.**
*You:* change the marks in the Farm Map Marker (a private page you were sent: parking, check-in, restrooms, fields, the maze and its sign, and so on)
and press "Save for Claude". Then ask Claude to update the map. *Claude:* fetches the saved JSON, saves it as `tools/saved-map.json` and runs
`python3 tools/farm_map.py tools/saved-map.json`, which writes `js/farm-map-data.js` (and refuses to write an empty map). Names and notes you typed
need translating: the script lists them for every language; add each one under `"js"` in `lang/src/<code>.json`, then run `python3 tools/i18n.py build`.
Freehand scribbles are notes for Claude and are not drawn. Text labels are translated like other names (add them under `"js"` as above). Only mark things that are
really there: for example a smooth path, drinking water or first aid are claims visitors will rely on.

**Drive times and map apps.** The Contact section and the First-visit page list drive times and "Open in Apple Maps or Waze" links. The times are
our estimates (see Content status). To change one, tell Claude the right number of minutes (in the HTML it is `data-drive="10"`).

**Drive time from a visitor's address.** In the Contact section a visitor can type an address, press "Get drive time" and see the miles and minutes to the farm or to The GreenHouse (a "Drive to" choice above the button; in winter it starts on The GreenHouse). In plain words:

- It uses two free public services: OpenStreetMap's address search (Nominatim) and the OSRM routing demo server, which a German non-profit (FOSSGIS) runs. Nothing is contacted until a visitor presses the button, and this website does not keep the address. `docs/WHAT_THE_SITE_STORES.md` lists exactly what is sent.
- Both are free and come with no promise. They ask for about one request a second and may refuse without notice. The routing server's own page calls its demo "reasonable, non-commercial" use, and this is a business site, so there is a real chance they stop answering one day. Nothing breaks when that happens: the box says "The lookup is not working right now" and offers a Google Maps button.
- **Once, before launch:** set `farmPoint` in `js/content.js`. It halves the requests and makes the answer faster. On Google Maps, right-click the farm: the first line of the menu shows two numbers like `35.0712, -80.6534` (click it to copy it). The first number is `lat`, the second is `lon` (in North Carolina it starts with a minus sign). Type them like this, with a comma between and no quote marks: `farmPoint: { lat: 35.0712, lon: -80.6534 },`. The Site check box does not check these numbers: swapped numbers or a missing minus sign are accepted, and every answer is then wrong. Press "Get drive time" once with an address in Indian Trail: the miles should be small.
- If you add the Content-Security-Policy line to `_headers`, its `connect-src` must allow exactly `https://nominatim.openstreetmap.org` and `https://router.project-osrm.org`. The line in `docs/LAUNCH_CHECKLIST.md` already does; without them the box only ever says "not working right now".
- Keep the three small links that the box shows under every answer: "© OpenStreetMap contributors", "Routing: OSRM" and "Fix the map". The two services ask for that credit.
- To switch the box off, or to move it to a service with a contract (Mapbox, Google), see step 3.13 of `docs/LAUNCH_CHECKLIST.md`. Test the box yourself once a week in season.

**Accessibility & comfort** (First-visit page, `#comfort`) only repeats facts the farm has already published (porta-johns including a
handicapped-accessible unit, hand washing, parking, shade, little ones, service animals). It does not say what the paths are like. When you know
the path surfaces, quieter times and baby-changing details, tell Claude and they will be added.

**QR signs.** *You:* ask Claude to make the signs. *Claude:* runs `python3 tools/make_qr.py` (needs `pip install segno`; `--check` also needs
`zxing-cpp pillow` and scans every code back). It makes `assets/qr/<name>.svg` and `print/qr-signs.html`: one letter-size sign per page in English
and Spanish for Google review (needs `reviewUrl`; if it is empty that sign is skipped and the script says so), Instagram, the hashtag, Facebook,
reserving, pre-ordering pizza, the pizza menu, the email signup, the farm map and directions. The wording and addresses are in `tools/qr_links.json`.
To print, open `print/qr-signs.html` in your browser and press Print (or "Save as PDF" for a print shop). Before you print:

1. Have a Spanish speaker read the Spanish (it was written by an AI).
2. Scan each sign with your own phone and check it opens the right place.
3. Print the hashtag sign only when the hashtag page on Instagram shows some photos, and the Facebook sign only after you confirm it is the right page.
4. The pizza menu sign opens the Fall Menu: update the menu on the website each season.
5. The Mailchimp signup page the signup sign opens should show in the language of the sign (Mailchimp's form settings have a language option; check your screens).

**Analytics + Google Search Console.** *Analytics* is off until you pick a provider (ask Claude; see `js/analytics.js`), and it is skipped for visitors who send Do Not Track or Global Privacy Control. Once on, it records:
`Section view` (a main section scrolled into view), taps on links (`Reserve click`, `Pizza pre-order click`, `Directions click`, `Email click`, `Phone click`, `Email signup click`, `Instagram click`, `Facebook click`, `School tour form click`; the Google, Apple Maps and Waze links all use the one name `Directions click`), `Review click`, `Waitlist click`, `Press click`, `Reminder added` (type: google or ics), `Map select` (kind), `Signup submit` (how many boxes were ticked), `Season preview`, `Language change`, `Hero played` (first tap in the game at the top) and `drive_time` (a drive-time answer was shown; nothing about the address). The Cloudflare provider counts page views only. `docs/WHAT_THE_SITE_STORES.md` has the table of what is sent. QR signs that point at this website carry `utm_source=qr`
so an analytics tool that understands it can show scans; signs that open Instagram, Facebook, Bookeo or Google cannot be counted here.
*Google Search Console* (so the site shows up in Google): the website must be online first. Then (the names of the buttons may differ a little,
Google moves them): (1) go to search.google.com/search-console and sign in with the farm's Google account; (2) choose "Add property", pick the
**URL prefix** box (not "Domain") and type `https://www.wiseacresorganic.com/`; (3) under "Other verification methods" choose **HTML tag** and copy the
whole line that starts `<meta name="google-site-verification"`; (4) paste it in `index.html` where the comment in the `<head>` says
"GOOGLE SEARCH CONSOLE" (only there; the page rebuild does not copy it into the other pages), publish, and click
**Verify**; (5) in the left menu choose **Sitemaps**, type `sitemap.xml` in the box (the start of the address is already filled in) and click Submit.

## Check your changes

Do this after you edit `js/content.js` or the pizza schedule.

1. Save the file.
2. Look at the site: double-click `index.html` (the box shows by itself on your own computer; or run `python3 -m http.server` and visit http://localhost:8000/). On the live
   site add `?check` to the address: https://www.wiseacresorganic.com/?check . Anyone who adds ?check sees the box too, so it only ever shows what is already in the public files. **Visitors never see a message**: if `js/content.js` breaks, the live site silently loses its banner, badges, closures and photo gallery. So open the live site with `?check` after every change you publish.
3. Look at the bottom of the page. If something you typed cannot be used, a yellow "Site check" box says what and where. No box means the check
   found nothing wrong.
4. The check covers `week`, `signup`, `reviewUrl`, `community`, `entrancePhoto`, the rows of the pizza schedule and every `data-until` date (it says what has already hidden itself) and every date in `closures` and `noticeUntil` (it lists any it cannot read; write each closed day on its own, like `'2026-10-04'`). It does **not** check hours,
   the notice words, reviews, photos or `farmPoint`: look at those yourself. For `farmPoint`, press "Get drive time" once with an address in Indian Trail and see that the miles look right.
5. If the box says "js/content.js did not run", there is a typo in that file (most often an apostrophe inside single quotes, a missing comma, or curly
   quotes pasted from Word). Press F12 (on a Mac in Chrome: Cmd+Option+J), open Console, and find the red line that names `content.js`: it ends with the line number. (If you opened the page by double-click, Chrome also prints red lines about fonts: ignore those.) Until it is
   fixed, hours, closures, the notice bar, photos, reviews and the signup are off. Undoing your last change (Ctrl+Z) or putting your copy back also fixes it.
6. The box finds wrong values, not wrong names: a misspelled setting (`noticeUntill:`) is silently ignored, and so is a setting put in the wrong place. Copy the names from the examples instead of retyping them.

## Extra pages (for Google)

`first-visit.html`, `pumpkin-patch.html`, `strawberry-picking.html`, `school-field-trips.html` and
`wise-pie.html` are separate pages with their own titles, descriptions and FAQ markup (no breadcrumb markup: the pages have no visible breadcrumb trail).
They are **generated**: edit the short source in `pages/<name>.html`, then run

```
pip install beautifulsoup4
python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build
```

The header, footer and icons are copied from `index.html`, so a change there reaches every page after
the rebuild. The same command writes `sitemap.xml` and `robots.txt`. If the site is published somewhere
other than www.wiseacresorganic.com, change `SITE` at the top of `tools/pages.py`.
The picture shown when a link is shared is `assets/og-share.png` for the home page and `assets/og-<page>.png` for each extra page (1200 x 630, set by the `image:` and `image_alt:` lines at the top of `pages/<page>.html`; the description of a picture is written only there, and the home page's only in `index.html`). A page with no `image:` line uses `assets/og-share.png`. See `docs/LAUNCH_CHECKLIST.md` 3.11.

## Languages

English, Español, हिन्दी, 中文 (Simplified) and Tiếng Việt. A visitor picks one in the globe menu in the
header or the footer. The choice is remembered. If their browser is set to one of these languages
they are asked once, in that language, whether they'd like it.

**For the owner:** you can type the commands below yourself (set the computer up once: "Commands: one-time setup", and follow "Change one sentence and its translations, step by step"), or ask Claude to update the translations after you change any wording on a page.

**The translations were written by an AI. Please have a native speaker of each language read them
before relying on them**, especially prices, policies and anything about alcohol, allergies or safety.
Names (Wise Acres, Wise Pie, The GreenHouse), emails and tomato varieties stay in English on purpose.

How it works: every block of text in the HTML gets a short id (`data-t="t1a2b3c4d"`) made from its
English wording. The English stays in the HTML (so Google and visitors without JavaScript get
complete pages); other languages are swapped in by id from `lang/<code>.js`. Text that JavaScript
writes goes through `WISE_ACRES.t("English text")`.

- **Changing English wording changes its id**, so the block shows up as "missing" until retranslated. Visitors who read another language see the
  English words for that block meanwhile. If you edit the English but do not run `extract`, they keep seeing the OLD translation (for example an old price).
  After editing any English text run:

  ```
  python3 tools/i18n.py extract            # re-tag the pages
  python3 tools/i18n.py missing es --list  # what still needs a translation (es, hi, zh, vi)
  python3 tools/i18n.py build              # rebuild lang/*.js
  ```

  Then add the missing ids and texts to `lang/src/<code>.json` (or ask Claude to translate everything `missing` lists) and run `build` again.
  `missing` also counts text that JavaScript writes (`t('…')` in `js/*.js`). `python3 tools/i18n.py jsstrings` refreshes `lang/js-strings.json`, the list of that text (kept for reference; the site does not load it). `python3 tools/i18n.py orphans` lists text that would never be translated, and `stats` counts strings and words per page.
- Words you type in `js/content.js` (the week note and a day's note, the entrance photo's alt and caption, a community photo's description and credit)
  are shown exactly as typed in every language. For the week note, a day's note and `notice` you can write `{ en: '…', es: '…', hi: '…', zh: '…', vi: '…' }`;
  a language you leave out shows the English. The entrance photo's alt and caption can be written the same way (`alt: { en: '…', es: '…' }`), or add the exact English text under `"js"` in
  `lang/src/<code>.json` and run `python3 tools/i18n.py build`. (A community photo's alt and credit are never translated.)
- Translations live in `lang/src/<code>.json` as `{ "ui": { id: text }, "js": { "English text": text } }`.
  Keep tags such as `<strong>`, `<br>`, `<svg/>` and `<a1>…</a>` (a link) exactly as in English.
  `python3 tools/i18n.py dump es 0 50` prints missing strings with their ids; `merge` folds
  `lang/src/parts/<code>.*.json` into the main file. Do not run `merge`: those files are old drafts (on 3 October 2026 it only added about 20 strings per language that the site no longer uses, and it would also put old wording back over any translation edited since).
- Text that must stay as is (names, text JavaScript fills in) carries `data-no-i18n`.
- To add a language: add it to `LANGS` in `js/i18n.js`, create `lang/src/<code>.json`, run `build`.
  If it needs its own font, add a rule next to the `html:lang(hi)` rules in `css/extras.css`.

## Content status: please read

Plain-English questions to send to the farm, with notes at the bottom on what to change for each answer: [docs/QUESTIONS_FOR_THE_FARM.md](docs/QUESTIONS_FOR_THE_FARM.md) (Spanish copy for the farm: [docs/QUESTIONS_FOR_THE_FARM.es.md](docs/QUESTIONS_FOR_THE_FARM.es.md)).

What to change for each answer to the open questions on the owner dashboard (one entry per question, with the files, patches and tests): [docs/DECISION_PLAYBOOK.md](docs/DECISION_PLAYBOOK.md)

What the website keeps in visitors' browsers and which other sites it contacts (a dated fact sheet, not a privacy policy): [docs/WHAT_THE_SITE_STORES.md](docs/WHAT_THE_SITE_STORES.md)

Text, prices and links come from the wording you pasted from the current site. Things to know:

| Item | Status |
| --- | --- |
| **Corporate events prices** | **Draft placeholders.** $750 (up to 50 guests), $1,400 (51–100), 3-hour block, modeled on comparable farm venues. The section shows a "Draft pricing" tag. Confirm with Cathy, edit the numbers in `index.html` (`#corporate`), delete the `.draft-tag` line, then run the rebuild commands above. |
| **Season dates & switcher** | Dates live in `js/season.js` (ask Claude to change them). Between seasons the site shows whichever is closest. The "See the farm in…" switcher is for previewing: set `seasonPicker: false` in `js/content.js` before launch. |
| **Time-sensitive blocks** | The Fall 2026 reservation schedule (`#schedule`), Exceptional Children Day / Home School Day dates, and the Fall Menu 2026 must be updated as they change (and re-translated: ask Claude). The schedule rows, the "Open now" line, the two special days and the "New this year" tags hide themselves after their `data-until` day; the headings that say 2026 do not. |
| **Open-now badges** | Based on the hours in `js/content.js` (farm: reserved visits Thu–Sun in fall; GreenHouse Fri–Sun 10–8; Wise Pie at The GreenHouse Fri–Sun 4–8). Please check these match real life. |
| **School tour form link** | Uses the Google Forms address you provided, which ends in `/edit` (the form *editor* link). Public visitors usually need `/viewform`. Please double-check it. |
| **Facebook & hashtag** | Facebook links to https://www.facebook.com/wiseacresnc/ (found by web search, **please confirm it is the right page**). The photo notes ask people to tag @wiseacresorganic and use **#wiseacresorganic** (our suggestion; change it in the two `tag-us` notes in `index.html`, the Flowers section and the Photo gallery). Social links are in the footer, the Contact section and the winter "watch for details" line. |
| **Christmas trees** | Friday after Thanksgiving to early December, at The GreenHouse. |
| **Tomatoes & basil** | The page says "more than a dozen tomato varieties and 4 kinds of basil" because the counts you gave don't agree. Give us the right number and we'll state it. |
| **Reviews** | The reviews section shows only its buttons (Google, Tripadvisor, Yelp, "Leave a Google review"); the quote cards are built but stay hidden until there is a real quote. It needs real quotes (with permission) from you. |
| **Shop section (`#shop` in `index.html`)** | **Draft.** It sits between The GreenHouse and Flowers on the main page. The layout is done and every price we know is on it (tomatoes, basil, farm fees, rides, pizza). Everything marked "Prices coming soon" (pumpkins, strawberries, blueberries, flowers, concessions, drinks, local goods, ice cream, Christmas trees) needs the real list. Edit the `#shop` section in `index.html`: change a `<dd data-t="…" class="soon">Prices coming soon</dd>` to the price, e.g. `<dd>$5 each</dd>` (this also drops the red dashed "soon" pill), then run the rebuild commands. |
| **Farm map** | Done: your marked map is on the home page and the First-visit page. Re-mark in the tool and ask Claude to update it (`python3 tools/farm_map.py tools/saved-map.json`). The map's list says "Corn maze" (the name that came from the Farm Map Marker) while the page says "Small Sunn Hemp Maze" (the farm's own wording): please tell us which name you want. Its list also says "Restrooms" and "Concessions or farm store" where the page says "Bathrooms" and "Concessions & local goods". The "Wagon ride route" in the saved map has 4 points outside the photo (it runs off the bottom and right edge); the script pins them to the edge, so that route bends along the border: please re-mark it inside the picture. |
| **Drive times** | Our estimates, not yours (Stallings 10, Matthews 15, Mint Hill 20, Monroe 20, Waxhaw 25, Uptown Charlotte 30 minutes, light traffic). Please check them and tell Claude the right numbers (in the HTML they are `data-drive`). |
| **In the news** | Two Axios Charlotte articles (2017, 2018) found by web search. The headlines and years are copied from the search results; I could not open the articles from here. Please open both links and check that the headline, year and name match, or ask Claude to hide the list. |
| **Email signup** | Built and tested against a pretend Mailchimp, not yet against yours. Hidden until you set `signup.action` (see "Planning features"). After you set it, sign up once with your own email. |
| **Google review link** | Buttons open the farm on Google Maps until you set `reviewUrl`. The QR review sign is skipped until then. |
| **Waitlist button** | When you mark a day `full` in the weekly box, visitors see "Email us to join the waitlist". It opens an email to cathy@wiseacresorganic.com (they must press Send). No page of the old site mentions a waitlist. Please confirm that you keep one and that this is the right address; if not, do not use `full` (use `closed`) and tell us. |
| **Season by season** | The "Season by season" table and the cards under "What's on the farm" follow your pages for what you pick and for fall and the GreenHouse. The wagon ride and barrel train in spring and summer were added as requested. The ticks for "Concessions & local goods" in spring and summer are our plan, not words from your pages: please check them. |
| **Accessibility & comfort** | Only published facts, in softer words than before. It does not say yet what the paths are like, when it is quieter, or about baby changing: tell us when you know. It invites people to email Cathy: please make sure cathy@wiseacresorganic.com is read and answered. |
| **Phone number** | The main number in online listings, (704) 628-6232, is **not** on the site until you confirm it. The day-of emergencies number for photographers, 704-207-6347, **is** on the site ("Day-of emergencies: call or text", in the photography section). |
| **Drive time box (farm spot, free services)** | Built and tested with pretend services. Our test computer cannot reach the real ones, so press the button yourself once the site is live. Still open: the farm's exact spot for `farmPoint` in `js/content.js` (question 35), whether to write to the free routing server's operators about business use or move to Mapbox later (question 36), and a lawyer's view on sending a typed address to outside map services (question 43). Steps and risks: `docs/LAUNCH_CHECKLIST.md`, step 3.13. |
| **Winter and early-spring wording** | The Visit area, the Shop and the schedule say "Fall 2026" all year, with "Reserve now" and package prices, also from January to April when the farm is closed. The GreenHouse shows Friday to Sunday, 10 am to 8 pm, all year, and "Christmas trees are here." stays up until the site switches to spring (about 10 February). The farm card itself is right in winter. Waiting for question 37. |
| **13 new photos** | Added on 3 October and now **on the site**, though the farm has not answered questions 38 to 40. Seven sit in context (the Seasons photo strips, the Tomatoes section, the goat strip at The GreenHouse, the flowers collage, the school tours panel and School field trips page, and the Strawberry picking page); twelve are in the photo gallery (all but the school bus). They are only 206 px wide, so they show only as small tiles (question 38). One shows four people at a Foster Village table (question 39). Four have words printed in the picture and are in the gallery only, and one shows price signs in the Tomatoes section (question 40). If an answer is No, take the photo out: the notes at the bottom of the questions file say where. |
| **Bottom-bar "Email" button** | On phones the bar at the bottom has Reserve, Directions and Email. Email opens a blank message to cathy@wiseacresorganic.com, not the email list. Question 41. |
| **Entrance and parking** | The site says "limited parking", and the farm map marks a parking area, an entrance and check-in, but nothing says in words which entrance cars use or where to park. Question 42 (the photo is question 34). |
| **Fall pizza package and allergens** | The "Yes pizza" package ($31 base, "2 Wise Pie pizzas, plus $3 per person") is not on the printed menu. We do not know which pizzas it covers or whether the gluten-free crust and vegan cheese cost extra on top. Neither the printed menu nor the site has an allergen or cross-contact line, and the printed menu lists no cheese on The Dill Pickle. Questions 44 to 46. |
| **Wise Pie facts the printed menu does not show** | The nine pizzas, their prices, the two extras and the cheese, dough and sauce notes match the printed menu in all five languages (checked 3 October 2026). These are not on the menu and are waiting for the farm: the oven "700 degrees" (no unit; it is also drawn in the Wise Pie share picture), the pre-order link "posted 5 days ahead", pick-up "1 hour after your reservation time", 12 inches and who one pizza serves, "locally sourced", and "drop-in dining". Questions 47 and 49 to 52, and 54. |
| **Pre-order page, drinks and ice cream** | We could not open the Square pre-order page to compare its prices with the printed menu (question 48). The ice cream (Waxhaw Creamery) and the beer, wine and cider on the site are not on the printed menu, and the farm side says "hard cider" where The GreenHouse side says "cider" (question 53). |

## Photos

The farm photos are in `assets/photos/`, plus the printed Fall Menu 2026 (`wise-pie-fall-menu-2026.webp`). Every photo listed in `photos`
(in `js/content.js`) is in the photo gallery. Some also sit in context: season panels (spring, summer, fall photo strips), the flowers collage,
"Meet the goats" at The GreenHouse, the tomatoes section, the school tour and the strawberry, pumpkin, school and Wise Pie pages. Tap any photo to enlarge it.
On phones the gallery shows two photos to a row.

**Topic buttons.** Above the gallery a row of buttons (All, Berries, Flowers, Farm animals, Fall, Pizza, People & events) shows only the photos of that topic;
"All" is the default, and a line under them says how many photos are showing ("12 photos"). Each photo can carry `tags: ["berries", "flowers"]` in `js/content.js`
(a photo with no tags shows under "All" only; a button with no photos hides itself). Tag only what you can see in the picture. The allowed topics are listed in the comment
at the top of `js/content.js` (after "Allowed tags:"). A new topic needs a new button in `index.html` (section "Photo gallery", `data-gtag="..."`), its name added to that list,
and the button label translated (Claude: `python3 tools/i18n.py extract`, then add the new text under `"ui"` in `lang/src/<code>.json`). `python3 tools/test_add_photo.py` fails
if the buttons and the allowed list ever disagree; the "Site check" box (`?check` on the address) names a photo whose tag has no button.

### Adding a photo

When the farm sends new photos, Claude adds each one with one command (the farm owner does not need to run anything):

```
python3 tools/add_photo.py path/to/picture.jpg --name goat-in-frog-hat --alt "A small animal wearing a green knitted frog hat" --caption "Frog hat"
```

| Part | What it means |
| --- | --- |
| `picture.jpg` | A JPEG, PNG, WebP or iPhone HEIC file (HEIC needs `pip install pillow-heif`). Files that are tiny (under 120 pixels), huge (over 60 MB or 100 megapixels), animated or not pictures are refused with a plain message. The original file is never changed. |
| `--name` | A few plain words for the file name: "goat in frog hat" becomes `assets/photos/goat-in-frog-hat.webp`. An existing picture is never overwritten, unless you add `--replace`. After launch use a new name instead: pictures are kept by visitors' browsers for up to a year (`/assets/*` in `_headers`), so a picture swapped under the same name keeps showing the old one to anyone who has seen it. |
| `--alt` | **What is visible**, read aloud to people who cannot see the picture. Never put prices, names of people or dates in it: they go out of date and can be wrong. The tool warns when it sees one. If you are not sure what an animal or a place is, say only what you can see ("a small animal wearing a green knitted frog hat"). |
| `--caption` | Optional. A short line under the picture when it is enlarged. |
| `--tags` | Optional. The topic buttons above the gallery it belongs under, for example `--tags berries,flowers`. Only tag what you can **see**. The tool refuses a topic that has no button and says which ones exist. Without `--tags` the picture shows under "All" only (the tool says so). |
| `--seasonal-text` | The picture has words printed on it (a season, a date, a price, "Happy Easter!"). Those go out of date, so such a picture is listed last in the gallery (marked `// words on the picture` in `js/content.js`) and should not be put in a prominent spot on a page. Say the words in `--alt`. |
| `--place none` | Only save the file; do not list it in the gallery. |
| `--dry-run` | Show what would happen, change nothing. Do this first when in doubt. |

What the tool does: turns the picture upright when the phone stored it sideways, shrinks it to at most 1400 pixels on the long side (a small picture is **never blown up**),
saves a WebP copy (quality 85) **with no camera or GPS data in it** (the tool says when the original had a location), adds one entry to `photos` in `js/content.js`
(before the pictures with words on them), checks that `js/content.js` still works before it writes it, and warns when the picture looks like one that is already on the site.

**Small pictures.** A picture sent through a chat app is often only about 200 pixels wide. The tool saves it as it is and warns that it will look soft if shown big.
Such a picture belongs in a small tile (a photo strip or the gallery), never wide. If you can, ask the farm for the original from the phone.

Then (the tool prints these steps too): `python3 tools/i18n.py jsstrings`, add the alt text and caption under `"js"` in `lang/src/es.json`, `hi.json`, `zh.json` and `vi.json`
(the English text on the left, the translation on the right), `python3 tools/i18n.py build`, and `python3 tools/i18n.py missing es` (and hi, zh, vi) until each says 0 missing.
To show a photo on a page as well, ask Claude: it becomes a small tile in a photo strip (the tool prints the tile), then `python3 tools/pages.py` and `python3 tools/i18n.py extract`.

To check the tool itself: `python3 tools/test_add_photo.py` (it works on a throw-away copy and never touches the real site).

By hand, if you ever have to: put the shrunk picture in `assets/photos/` and add `{ src: "assets/photos/name.webp", alt: "What is visible", caption: "Optional" },`
(and, if you like, `tags: ["berries"]` after the caption) to `photos` in `js/content.js`. The description (`alt`) is read aloud for people who cannot see the picture, so write one for every photo. Other languages show the
description and caption in English until you ask Claude to translate them. (Claude: run `python3 tools/i18n.py extract && python3 tools/i18n.py missing es --list`,
and hi, zh, vi, to see what still needs translating.)

## What's interactive

- **Seasonal hero:** the first screen shows the season the farm is in today. The gray line under the headline describes only that season (strawberries, blueberries, pumpkins + tomatoes & basil, Christmas trees), and in winter the headline itself becomes "Wise Acres Christmas trees". A red, open tractor (no cab) pulls the wagon ride past the fields in **spring, summer and fall**: riders sit behind the side boards and wave (no hay: it is a wagon ride). **Fall:** pumpkin patch (tap to pick), a little barrel train on the far lane, scarecrow, crow, falling leaves. **Winter:** Christmas trees to light, campfires to stoke, a snowman, snow. **Summer:** blueberry bushes to pick, bees, sunflowers to snip. **Spring:** strawberries to pick, kids picking in the rows. A "See the farm in…" switcher changes the season, the Seasons tabs and the u-pick card color.
- **What's on the farm** (home page, `#farm`): it opens on the current season. Spring / Summer / Fall / Winter buttons swap the cards (`data-seasons="spring summer fall winter"` on each `<li>` in `#farm-cards`; `initFarmSeasons` in `js/main.js`). The u-pick card changes crop, color and drawing per season (strawberries, blueberries, pumpkins + tomatoes & basil, Christmas trees at The GreenHouse). One-season things (haunted trail, sunn hemp maze, corn pit) only show in fall, the barrel train and wagon ride not in winter. A season-by-season table sits underneath; edit its ticks in `#farm-glance`. Seasons are the typical dates in `js/season.js`.
- **Farm friends:** tap a kid in the strawberry rows, the sunflower cutter, a wagon rider, a barrel-train kid, the scarecrow (its crow flies off) or the snowman and they react and say something (`SAY` and `npcTalk` in `js/hero.js`; the lines are translated like other JS text). A small round "Say hi to a farm friend" button next to the basket does the same for people who use a keyboard or a screen reader.
- **Hero reactions:** the sun beams, wobbles and blinks on hover and hops, squints and bursts into sparks when clicked (`initSun` in `js/hero.js`, styles in `css/extras.css` under "The sun is a friend"). The "No reservation? Visit The GreenHouse" pill lifts, glows green and shines on hover, and pops with a spray of leaves before it glides down to The GreenHouse (`initNote`). The big buttons and the "New" tomato chip have their own hover moments. All of it is switched off by `prefers-reduced-motion`, and the hover parts only run on devices that can hover.
- **Achievements:** pick 100 of one kind (strawberries, blueberries, sunflowers, pumpkins, or trees lit + fires stoked in winter) and a badge pops up above the basket while that item rains down the screen; pick 1,000 in all and a gold "you've got a lot of time on your hands" badge appears. Counted per visit (`credit()` in `js/hero.js`).
- **Menu:** Visit, On the Farm, Seasons, Tomatoes, Pizza, GreenHouse, Shop, and a **More** menu (First-visit guide, Flowers, Groups, Our Story, FAQ, Contact). On phones it is one long list, and the First-visit guide is its second item. In winter the main buttons (hero and phone bar) point to The GreenHouse, since the farm is closed. A round **back to top** button shows after scrolling.
- **Seasonal touches elsewhere:** the top bar says what is in season; dividers and the footer scene change with the season.
- **Open now** badges, a **notice bar**, and a **next-season countdown** with an email sign-up.
- **Pizza countdown** with calendar reminders, a **this-week** box, **email signup with interests**, a **review button** and QR signs, a **farm map**, drive times, and Apple Maps / Waze links (see "Planning features").
- **Growing vine** under the header shows scroll progress.
- **Visit steps:** a tractor drives along a road as you scroll.
- **Seasons** tabs, **week strips**, **farm-year calendar** with a "Today" marker, **group tabs** with deep links.
- **Bouquet builder**, tappable goat, FAQ accordion, tomato variety filter, photo viewer (tap any photo).
- **First-visit guide** with a printable "what to bring" checklist (remembers what you ticked).
- Mobile: hamburger menu and a sticky **Reserve / Directions / Email** bar.

Everything respects `prefers-reduced-motion`, works without JavaScript (content and links), and is
keyboard navigable.

## Testing

Automatic browser checks (countdown, languages, farm map, accessibility, the tools…) live in `tests/`; how to install and run them is in `tests/README.md`. You do not need them to edit the site, and the folder is not part of the website. `tests/visual-check.mjs` (not one of the tests: it needs a baseline made on your own computer) tells you which parts of the pages look different after a change, with a picture of each; see "The visual check" in `tests/README.md`.

## Putting it online

New to this? Follow the plain-English checklist in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md): which host, what to upload, the steps in order, and what to test afterwards.

1. Upload the folder to a static host (Netlify, Cloudflare Pages, GitHub Pages, or any web server). There is no build step. Every later change is uploaded the same way: make a clean copy and drag it in again (`docs/LAUNCH_CHECKLIST.md`, section 2). **Leave out the `docs/` and `tests/` folders** (`docs/`: notes and questions for the farm owner; `tests/`: automatic checks for developers; neither is for visitors). You can also leave out `tools/`, `pages/` and this README, which are for whoever edits the site.
2. Use your real domain at the **root** (`https://www.wiseacresorganic.com/`). If it lives elsewhere, change `SITE` in `tools/pages.py`, run the rebuild commands, and search & replace the domain in `index.html` (canonical, share image, structured data), and set `site` in `tools/qr_links.json` and run `python3 tools/make_qr.py` again (the QR signs carry the address).
3. Turn on HTTPS and compression (gzip/brotli) at the host. The `_headers` file is read by Netlify and Cloudflare Pages; other hosts need the same headers set in their settings.
4. Send people to the Google Business Profile, and add your site's address there.
5. Before launch: fill every "Prices coming soon", confirm hours, Facebook and the hashtag, and have a native speaker read each language (see Content status).
6. Also before launch: set `reviewUrl`; set `farmPoint` (Drive time box); open both "In the news" links; confirm the drive times, the waitlist and the "Season by season" ticks; decide on the maze name; set `seasonPicker: false`; then check the live site once with `?check` added to the address.

How the page stays fast: looping animations pause when they are off screen (a whole section far away, or one drawing inside a long section: `initOffscreenPause` in `js/main.js`) and while the tab is hidden, and photos load only when you scroll near them (`loading="lazy"`; in JavaScript set `loading` before `src`, or the photo downloads at once). If you ever add a tall new section, nothing needs to change.

## Notes

- Colors, fonts and spacing live in the `:root` tokens at the top of `css/styles.css`.
- Illustrations are an inline SVG sprite at the bottom of `index.html` (`<symbol id="strawberry">` etc.). The tractor, wagon and barrel train are drawn in `js/hero.js` (`tractorOpen`, `wagonArt`, `barrelTrain`) and copied into the sprite as static icons.
- The "USDA Certified Organic" chip is plain text, not the official USDA seal.
