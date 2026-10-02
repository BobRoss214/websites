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
css/hero.css            seasonal hero: sky/card colours per season, tractor, campfire and snow animations
css/extras.css          open-now badges, notice bar, countdown, seasonal dividers/footer, languages, reviews, inner pages
css/features.css        pizza countdown, "this week" box, email signup, review + press, photo wall, farm map, drive times
js/content.js           editable content: hours, closures, notice bar, reviews, analytics, photo list
js/season.js            season dates + "which season is it today?" (sets html[data-season])
js/i18n.js              language switcher + text swapping (loaded first so the page paints in the chosen language)
js/hero.js              draws the four hero scenes, footer art, and runs the picking / lighting / toot interactions
js/main.js              everything else: scroll effects, seasons tabs, groups, bouquet, goat, reviews, print checklist…
js/live.js              "Open now" badges, notice bar, next-season countdown, top-bar text
js/analytics.js         privacy-friendly analytics (off until you pick a provider)
js/features.js          pizza-reservation countdown + calendar reminders, "this week" box, email signup, review links, photo wall, farm map, drive times
js/farm-map-data.js     the points of the farm map (written by tools/farm_map.py; empty until the map is marked)
js/map-art.js           draws the illustrated farm map from those points (forest, fields with plants, parking with cars, maze, trails, icons)
lang/src/<code>.json    the translations (you edit these)
lang/<code>.js          built from lang/src (what the pages load; do not edit)
tools/                  pages.py (builds the extra pages), i18n.py (tags text, builds translations),
                        make_qr.py + qr_links.json (QR signs), farm_map.py (saved map -> js/farm-map-data.js)
assets/qr/              QR codes (SVG), made by tools/make_qr.py
print/qr-signs.html     printable signs, one per page, English + Spanish (not listed in Google)
assets/photos/          farm photos
assets/fonts/           Fredoka, Nunito (+ Vietnamese letters), Caveat (SIL Open Font License), self-hosted
```

Preview locally: run `python3 -m http.server` and visit http://localhost:8000 (a plain double-click on
`index.html` also works, but languages other than English load more reliably over http).

## Day-to-day changes

| I want to… | Do this |
| --- | --- |
| Close a place for rain / a holiday | `js/content.js` → add the date (`'2026-10-04'`) to `closures`. The "Open now" badges say closed that day. |
| Show a banner on every page | `js/content.js` → `notice: 'Closed Saturday for rain.'`, optionally `noticeUntil: '2026-10-05'` so it disappears by itself. |
| Change opening hours | `js/content.js` → `hours` (Eastern Time; `days` 0 = Sunday … 6 = Saturday). |
| Change season dates | `js/season.js` → `SEASONS`. |
| Turn off the season switcher | `js/content.js` → `seasonPicker: false`. |
| Add a review | `js/content.js` → `reviews: [{ quote, name, source, url, date }]`. Only add words a reviewer really wrote. The section stays hidden until there is at least one. |
| Add a photo | Put the file in `assets/photos/` and list it in `photos` in `js/content.js`. |
| Turn on analytics | `js/content.js` → `analytics: { provider: 'plausible', site: 'wiseacresorganic.com' }` (also `goatcounter`, `umami`, `cloudflare`). Nothing is sent until you do, and never for visitors with Do Not Track. |
| Change the hero text for a season | `index.html` → the `.hero-sub[data-only="spring"]` (summer, fall, winter) lines under the big headline, and the winter headline (`#hero-h`). hero.js shows the one for the current season. Then run the `extract` / `missing` / `build` commands under Languages. |
| Change the booking link | Search & replace `https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356`. |
| Open a new pizza weekend | `index.html` → `#schedule` table: add a row `<tr data-release="2026-11-03"><td>Nov 3</td><td>Nov 6–8</td></tr>`. The countdown, the "Remind me" calendar buttons and the hero chip all follow those rows. |
| Say what is ripe / spots left this week | `js/content.js` → `week` (see "Planning features" below). Takes two minutes, and stops showing by itself after 14 days. |
| Make the email signup work | `js/content.js` → `signup.action` (see "Planning features"). |
| Set the Google review link | `js/content.js` → `reviewUrl: 'https://g.page/r/…/review'`. Every "Leave a Google review" button follows it. |
| Show a visitor's photo | `js/content.js` → `community` (only after they said yes in writing). |
| Print QR signs | `python3 tools/make_qr.py`, then open `print/qr-signs.html` and print. |
| Update the farm map | Mark it in the Farm Map Marker, save, then `python3 tools/farm_map.py saved-map.json`. |

## Planning features (countdown, weekly box, signup, map…)

All of these live in `js/features.js` (styles in `css/features.css`). Each one hides itself until it has something to show.

**Pizza countdown + "Remind me".** Inside the Fall reservation schedule (`#schedule`) a box counts down to the next Tuesday 5:00 PM
Eastern release, taken from the `data-release` rows of the table, and shows "just opened" with a Reserve button for six hours after.
"Remind me" adds all the upcoming release times to the visitor's calendar: a Google Calendar link (repeats weekly), or a `.ics`
file for Apple / Outlook with a 15-minute alarm. A small chip in the hero says "Pizza reservations open in 5d 1h". Visitors outside
Eastern Time also see their own time. After the last row passes, the box and chip hide themselves. The times are Eastern on purpose.

**Weekly box ("This week at the farm").** Fills itself from today's date: what is normally in season (strawberries, blueberries,
sunflowers, pumpkins, tomatoes & basil, flowers) and what starts in the next three weeks (Christmas trees at The GreenHouse). The dates
are the typical ones in `js/features.js` (`CROPS`) and `js/season.js`. To add a real update, fill in `week` in `js/content.js`:

```js
week: {
  updated: '2026-10-01',                         // the day you checked. Everything below stops showing 14 days later.
  note: 'Tomatoes are at their best. Bring a bucket!',   // or { en: '…', es: '…' } to write it in each language
  crops: { tomatoes: 'peak', pumpkins: 'starting', flowers: 'off' },   // soon | starting | peak | ending | off
  days: [ { date: '2026-10-02', farm: 'few', pizza: 'open', note: 'Rain possible' },
          { date: '2026-10-03', farm: 'full', pizza: 'full' } ],         // open | few | full | closed
  waitlistEmail: 'cathy@wiseacresorganic.com',   // "Join the waitlist" opens an email to this address
},
```

"Spots left" and the waitlist are filled in by hand. **Live availability from Bookeo is not built in:** it needs your Bookeo API
keys and a small server function (a website cannot read Bookeo directly, and the keys must never be on the page). If you want it,
make that function return the same JSON as `week` (`{updated, note, crops, days}`) and put its address in `week.feed`; the page reads it
(and falls back to the hand-written box if it is down).

**Email signup with interests.** In the Contact section, a form with interest choices (strawberries, blueberries, flowers, pumpkins,
tomatoes & basil, Christmas trees, pizza, events). It stays hidden, and the old "Join the email list" button shows, until you connect
Mailchimp: in Mailchimp go to Audience → Signup forms → Embedded forms, copy the address inside `<form action="…">`, and set:

```js
signup: { action: 'https://YOURNAME.us21.list-manage.com/subscribe/post?u=…&id=…',
          interests: { pumpkins: 'group[12345][1]', trees: 'group[12345][2]' },   // names from the same embed code
          tags: '' },
```

When it is set, the other "Tell me when" / "Sign up" links scroll to the form instead. Choices with no `interests` entry are simply not sent.

**Reviews, news, photos.** The Reviews section has a "Leave a Google review" button (set `reviewUrl`) and an **In the news** list
(two Axios Charlotte articles, found by web search: **please open both links and confirm** before launch). Award badges: save the image
in `assets/badges/` and uncomment the `press-badges` block under the news list (only with permission from whoever gave the award).
"From families who visit" (photo gallery) shows the photos in `community` (`src`, `alt`, `by`, optional `url`); nothing from Instagram is
embedded. The First-visit page can show an entrance / parking photo: set `entrancePhoto` in `js/content.js`.

**Farm map.** The Farm Map Marker (a private page you were sent) lets you mark parking, check-in, restrooms, fields, the corn maze and
its sign, and so on on the Google Earth photo. The website does not publish that photo (it is Google's picture); it draws its own
illustrated map from your points (forest, mown lawn, dirt lanes, fields full of plants, a parking lot with cars, a maze, trails with little characters and an icon for every pin), with a picture list you can tap and Apple Maps / Waze / Google Maps links. After you press "Save for
Claude" in the tool, Claude fetches the saved JSON and runs `python3 tools/farm_map.py saved-map.json`, which writes `js/farm-map-data.js`.
The map section (home page and First-visit page) appears as soon as that file has points. **Your real map (25 points) is in** (`tools/saved-map.json` is the saved copy; re-run the script after you change it). Names and notes you typed need translating:
the script lists them. Freehand scribbles are notes for Claude and are not drawn.

**Drive times and map apps.** The Contact section and the First-visit page list drive times (`data-drive="minutes"` in the HTML; edit them
there) and "Open in Apple Maps or Waze" links.

**Accessibility & comfort** (First-visit page, `#comfort`) only repeats facts the farm has already published (accessible porta-john,
hand washing, parking, shade, little ones, service animals). Path surfaces, quieter times and
baby-changing details can be added whenever you know them.

**QR signs.** `python3 tools/make_qr.py` (needs `pip install segno`; `--check` also needs `zxing-cpp pillow` and scans every code back)
makes `assets/qr/<name>.svg` and `print/qr-signs.html`: one letter-size sign per page in English and Spanish for Google review (needs
`reviewUrl`), Instagram, the #wiseacresorganic hashtag, Facebook, reserving, pre-ordering pizza, the pizza menu, the email signup, the
farm map and directions. Edit `tools/qr_links.json` to change wording or addresses. Open the page in a browser and print or save as PDF.
The Spanish text was written by an AI: have a Spanish speaker read it before you print.

**Analytics + Google Search Console.** Analytics stays off until you pick a provider in `js/content.js` (see `js/analytics.js`). New events
it records once on: Review click, Waitlist click, Reminder added, Map select, Email signup click, Press click, Directions (Google,
Apple, Waze). QR signs that point at this website carry `utm_source=qr` so you can see scans. For Search Console: add the site at
search.google.com/search-console, choose "HTML tag" verification, paste the tag in the marked comment in the `<head>` of `index.html`
(and nowhere else), then submit `https://www.wiseacresorganic.com/sitemap.xml`.

## Extra pages (for Google)

`first-visit.html`, `pumpkin-patch.html`, `strawberry-picking.html`, `school-field-trips.html` and
`wise-pie.html` are separate pages with their own titles, descriptions, FAQ markup and breadcrumbs.
They are **generated**: edit the short source in `pages/<name>.html`, then run

```
pip install beautifulsoup4
python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build
```

The header, footer and icons are copied from `index.html`, so a change there reaches every page after
the rebuild. The same command writes `sitemap.xml` and `robots.txt`. If the site is published somewhere
other than www.wiseacresorganic.com, change `SITE` at the top of `tools/pages.py`.
`assets/og-share.png` is the picture shown when a link is shared.

## Languages

English, Español, हिन्दी, 中文 (Simplified) and Tiếng Việt. A visitor picks one in the globe menu in the
header or the footer. The choice is remembered. If their browser is set to one of these languages
they are asked once, in that language, whether they'd like it.

**The translations were written by an AI. Please have a native speaker of each language read them
before relying on them**, especially prices, policies and anything about alcohol, allergies or safety.
Names (Wise Acres, Wise Pie, The GreenHouse), emails and tomato varieties stay in English on purpose.

How it works: every block of text in the HTML gets a short id (`data-t="t1a2b3c4d"`) made from its
English wording. The English stays in the HTML (so Google and visitors without JavaScript get
complete pages); other languages are swapped in by id from `lang/<code>.js`. Text that JavaScript
writes goes through `WISE_ACRES.t("English text")`.

- **Changing English wording changes its id**, so the block shows up as "missing" until retranslated.
  After editing any English text run:

  ```
  python3 tools/i18n.py extract            # re-tag the pages
  python3 tools/i18n.py missing es --list  # what still needs a translation (es, hi, zh, vi)
  python3 tools/i18n.py build              # rebuild lang/*.js
  ```
- Translations live in `lang/src/<code>.json` as `{ "ui": { id: text }, "js": { "English text": text } }`.
  Keep tags such as `<strong>`, `<br>`, `<svg/>` and `<a1>…</a>` (a link) exactly as in English.
  `python3 tools/i18n.py dump es 0 50` prints missing strings with their ids; `merge` folds
  `lang/src/parts/<code>.*.json` into the main file.
- Text that must stay as is (names, text JavaScript fills in) carries `data-no-i18n`.
- To add a language: add it to `LANGS` in `js/i18n.js`, create `lang/src/<code>.json`, run `build`.
  If it needs its own font, add a rule at the bottom of `css/extras.css`.

## Content status: please read

Text, prices and links come from the wording you pasted from the current site. Things to know:

| Item | Status |
| --- | --- |
| **Corporate events prices** | **Draft placeholders.** $750 (up to 50 guests), $1,400 (51–100), 3-hour block, modeled on comparable farm venues. The section shows a "Draft pricing" tag. Confirm with Cathy, edit the numbers in `index.html` (`#corporate`), delete the `.draft-tag` line, then run the rebuild commands above. |
| **Season dates & switcher** | Dates live in `js/season.js`. Between seasons the site shows whichever is closest. The season switcher is for previewing. |
| **Time-sensitive blocks** | The Fall 2026 reservation schedule (`#schedule`), Exceptional Children Day / Home School Day dates, and the Fall Menu 2026 must be updated as they change (and re-translated: run `missing`). |
| **Open-now badges** | Based on the hours in `js/content.js` (farm: reserved visits Thu–Sun in fall; GreenHouse Fri–Sun 10–8; Wise Pie at The GreenHouse Fri–Sun 4–8). Please check these match real life. |
| **School tour form link** | Uses the Google Forms address you provided, which ends in `/edit` (the form *editor* link). Public visitors usually need `/viewform`. Please double-check it. |
| **Facebook & hashtag** | Facebook links to https://www.facebook.com/wiseacresnc/ (found by web search, **please confirm it is the right page**). The photo notes ask people to tag @wiseacresorganic and use **#wiseacresorganic** (our suggestion; change it in the two `tag-us` notes in `index.html`, the Flowers section and the Photo gallery). Social links are in the footer, the Contact section and the winter "watch for details" line. |
| **Christmas trees** | Friday after Thanksgiving to early December, at The GreenHouse. |
| **Tomatoes & basil** | The page says "more than a dozen tomato varieties and 4 kinds of basil" because the counts you gave don't agree. Give us the right number and we'll state it. |
| **Reviews** | The reviews section is built but empty. It needs real quotes (with permission) from you. |
| **Shop section (`#shop` in `index.html`)** | **Draft.** It sits between The GreenHouse and Flowers on the main page. The layout is done and every price we know is on it (tomatoes, basil, farm fees, rides, pizza). Everything marked "Prices coming soon" (pumpkins, strawberries, blueberries, flowers, concessions, drinks, local goods, ice cream, Christmas trees) needs the real list. Edit the `#shop` section in `index.html`: change a `<dd class="soon">Prices coming soon</dd>` to the price, e.g. `<dd>$5 each</dd>`, then run the rebuild commands. |
| **Farm map** | Done: your marked map is on the home page and the First-visit page. Re-mark in the tool and run `python3 tools/farm_map.py saved-map.json` to change it. The map calls the maze "Corn maze" (your label) while the cards say "Small Sunn Hemp Maze" (the farm's own wording); pick one when you have time. |
| **Drive times** | My estimates (Stallings 10, Matthews 15, Mint Hill 20, Monroe 20, Waxhaw 25, Uptown Charlotte 30 minutes, light traffic). Please check them and edit the `data-drive` numbers. |
| **In the news** | Two Axios Charlotte articles (2017, 2018) found by web search. The headlines are copied from the search results; I could not open the articles from here. Please open both links. |
| **Email signup** | Built and tested against a pretend Mailchimp. Hidden until you set `signup.action` (see above). |
| **Google review link** | Buttons open the farm on Google Maps until you set `reviewUrl`. The QR review sign is skipped until then. |
| **Accessibility & comfort** | Only published facts. Needs your details on paths (surface, slope), quieter times and baby changing. |
| **Phone number** | Listings online show (704) 628-6232, but it is **not** on the site until you confirm it. |

## Photos

All 19 farm photos are in `assets/photos/`, plus the printed Fall Menu 2026 (`wise-pie-fall-menu-2026.webp`).
They appear in the photo gallery (every one), and in context: season panels (spring, summer, fall photo strips),
the flowers collage, "Meet the goats" at The GreenHouse, the Wise Pie section ("View the printed menu" opens the
menu image) and the pumpkin, strawberry and Wise Pie pages. Tap any photo to enlarge it.

To add more, drop files into `assets/photos/` and list them in `js/content.js`:

```js
photos: [
  { src: "assets/photos/example.jpg", alt: "Describe the photo", caption: "Optional caption" },
],
```

Then run `python3 tools/i18n.py extract && python3 tools/i18n.py missing es --list` (and hi, zh, vi) to see the new
alt text and captions that still need translating.

## What's interactive

- **Seasonal hero:** the first screen shows the season the farm is in today. The grey line under the headline describes only that season (strawberries, blueberries, pumpkins + tomatoes & basil, Christmas trees), and in winter the headline itself becomes "Wise Acres Christmas trees". A red, open tractor (no cab) pulls the wagon ride past the fields in **spring, summer and fall**: riders sit behind the side boards and wave (no hay: it is a wagon ride). **Fall:** pumpkin patch (tap to pick), a little barrel train on the far lane, scarecrow, crow, falling leaves. **Winter:** Christmas trees to light, campfires to stoke, a snowman, snow. **Summer:** blueberry bushes to pick, bees, sunflowers to snip. **Spring:** strawberries to pick, kids picking in the rows. A "See the farm in…" switcher changes the season, the Seasons tabs and the u-pick card colour.
- **What's on the farm** (home page, `#farm`): it opens on the current season. Spring / Summer / Fall / Winter buttons swap the cards (`data-seasons="spring summer fall winter"` on each `<li>` in `#farm-cards`; `initFarmSeasons` in `js/main.js`). The u-pick card changes crop, colour and drawing per season (strawberries, blueberries, pumpkins + tomatoes & basil, Christmas trees at The GreenHouse). One-season things (haunted trail, sunn hemp maze, corn pit) only show in fall, the barrel train and wagon ride not in winter. A season-by-season table sits underneath; edit its ticks in `#farm-glance`. Seasons are the typical dates in `js/season.js`.
- **Farm friends:** tap a kid in the strawberry rows, the sunflower cutter, a wagon rider, a barrel-train kid, the scarecrow (its crow flies off) or the snowman and they react and say something (`SAY` and `npcTalk` in `js/hero.js`; the lines are translated like other JS text).
- **Hero reactions:** the sun beams, wobbles and blinks on hover and hops, squints and bursts into sparks when clicked (`initSun` in `js/hero.js`, styles at the bottom of `css/extras.css`). The "No reservation? Visit The GreenHouse" pill lifts, glows green and shines on hover, and pops with a spray of leaves before it glides down to The GreenHouse (`initNote`). The big buttons and the "New" tomato chip have their own hover moments. All of it is switched off by `prefers-reduced-motion`, and the hover parts only run on devices that can hover.
- **Achievements:** pick 100 of one kind (strawberries, blueberries, sunflowers, pumpkins, or trees lit + fires stoked in winter) and a badge pops up above the basket while that item rains down the screen; pick 1,000 in all and a gold "you've got a lot of time on your hands" badge appears. Counted per visit (`credit()` in `js/hero.js`).
- **Menu:** Visit, On the Farm, Seasons, Tomatoes, Pizza, GreenHouse, Shop, and a **More** menu (Flowers, Groups, Our Story, FAQ, Contact). On phones it is one long list. In winter the main buttons (hero and phone bar) point to The GreenHouse, since the farm is closed. A round **back to top** button shows after scrolling.
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

## Putting it online

1. Upload the whole folder to a static host (Netlify, Cloudflare Pages, GitHub Pages, or any web server). There is no build step.
2. Use your real domain at the **root** (`https://www.wiseacresorganic.com/`). If it lives elsewhere, change `SITE` in `tools/pages.py`, run the rebuild commands, and search & replace the domain in `index.html` (canonical, share image, structured data).
3. Turn on HTTPS and compression (gzip/brotli) at the host. The `_headers` file is read by Netlify and Cloudflare Pages; other hosts need the same headers set in their settings.
4. Send people to the Google Business profile, and add your site's address there.
5. Before launch: fill every "Prices coming soon", confirm hours, Facebook and the hashtag, and have a native speaker read each language (see Content status).

How the page stays fast: sections far down the page are skipped until you scroll near them (`initLazyRender` in `js/main.js`), animations pause when off screen, and photos load lazily. If you ever add a tall new section, nothing needs to change.

## Notes

- Colors, fonts and spacing live in the `:root` tokens at the top of `css/styles.css`.
- Illustrations are an inline SVG sprite at the bottom of `index.html` (`<symbol id="strawberry">` etc.). The tractor, wagon and barrel train are drawn in `js/hero.js` (`tractorOpen`, `wagonArt`, `barrelTrain`) and copied into the sprite as static icons.
- The "USDA Certified Organic" chip is plain text, not the official USDA seal.
