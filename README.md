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
pages/                  the short sources the extra pages are built from
css/styles.css          design system, hero layout, base components
css/sections.css        section styles (visit, packages, pizza, GreenHouse, groups, story…)
css/hero.css            seasonal hero: sky/card colours per season, tractor, campfire and snow animations
css/extras.css          open-now badges, notice bar, countdown, seasonal dividers/footer, languages, reviews, inner pages
js/content.js           editable content: hours, closures, notice bar, reviews, analytics, photo list
js/season.js            season dates + "which season is it today?" (sets html[data-season])
js/i18n.js              language switcher + text swapping (loaded first so the page paints in the chosen language)
js/hero.js              draws the four hero scenes, footer art, and runs the picking / lighting / toot interactions
js/main.js              everything else: scroll effects, seasons tabs, groups, bouquet, goat, reviews, print checklist…
js/live.js              "Open now" badges, notice bar, next-season countdown, top-bar text
js/analytics.js         privacy-friendly analytics (off until you pick a provider)
lang/src/<code>.json    the translations (you edit these)
lang/<code>.js          built from lang/src (what the pages load; do not edit)
tools/                  pages.py (builds the extra pages), i18n.py (tags text, builds translations)
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
| Change the booking link | Search & replace `https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356`. |

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
| **Phone number / Facebook** | Not shown (the pages you pasted list email only). Instagram accounts are linked. |
| **Christmas trees** | Friday after Thanksgiving to early December, at The GreenHouse. |
| **Tomatoes & basil** | The page says "more than a dozen tomato varieties and 4 kinds of basil" because the counts you gave don't agree. Give us the right number and we'll state it. |
| **Reviews** | The reviews section is built but empty. It needs real quotes (with permission) from you. |
| **Farm map** | Waiting on the annotated Google Earth screenshot. The first-visit page still has draft notes for parking and check-in until then. |

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

- **Seasonal hero:** the first screen shows the season the farm is in today. A red, open tractor (no cab) pulls the wagon ride past the fields in **spring, summer and fall**: riders sit behind the side boards and wave (no hay: it is a wagon ride). **Fall:** pumpkin patch (tap to pick), a little barrel train on the far lane, scarecrow, crow, falling leaves. **Winter:** Christmas trees to light, campfires to stoke, a snowman, snow. **Summer:** blueberry bushes to pick, bees, sunflowers to snip. **Spring:** strawberries to pick, kids picking in the rows. A "See the farm in…" switcher changes the season, the Seasons tabs and the u-pick card colour.
- **Seasonal touches elsewhere:** the top bar says what is in season; dividers and the footer scene change with the season.
- **Open now** badges, a **notice bar**, and a **next-season countdown** with an email sign-up.
- **Growing vine** under the header shows scroll progress.
- **Visit steps:** a tractor drives along a road as you scroll.
- **Seasons** tabs, **week strips**, **farm-year calendar** with a "Today" marker, **group tabs** with deep links.
- **Bouquet builder**, tappable goat, FAQ accordion, tomato variety filter, photo viewer (tap any photo).
- **First-visit guide** with a printable "what to bring" checklist (remembers what you ticked).
- Mobile: hamburger menu and a sticky **Reserve / Directions / Email** bar.

Everything respects `prefers-reduced-motion`, works without JavaScript (content and links), and is
keyboard navigable.

## Notes

- Colors, fonts and spacing live in the `:root` tokens at the top of `css/styles.css`.
- Illustrations are an inline SVG sprite at the bottom of `index.html` (`<symbol id="strawberry">` etc.). The tractor, wagon and barrel train are drawn in `js/hero.js` (`tractorOpen`, `wagonArt`, `barrelTrain`) and copied into the sprite as static icons.
- The "USDA Certified Organic" chip is plain text, not the official USDA seal.
