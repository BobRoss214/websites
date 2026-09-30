# Wise Acres Organic Farm: website redesign

A colorful, illustrated, interactive redesign of the Wise Acres Organic Farm site (Indian Trail, NC).
Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, works offline.

```
index.html          the page (content + inline SVG illustration library)
css/styles.css      design system, hero, base components
css/sections.css    section styles (visit, packages, pizza, GreenHouse, groups, story…)
js/main.js          interactions (scroll effects, picking game, seasons, groups, bouquet…)
js/content.js       editable content: the photo gallery list
assets/photos/      farm photos
assets/fonts/       Fredoka, Nunito, Caveat (SIL Open Font License), self-hosted
```

Preview locally: open `index.html`, or run `python3 -m http.server` and visit http://localhost:8000.

## Sections

Visit (farm vs. GreenHouse chooser, 3 steps, Fall 2026 packages and add-ons, reservation schedule,
what's on the farm) · Seasons (spring / summer / fall / Christmas trees + farm-year calendar) ·
**U-pick tomatoes & basil** (new this year: prices, growing method, 19-variety guide with filter) ·
Wise Pie pizza (how to get it, Fall 2026 menu, ingredients) · The GreenHouse (bold "Next door / No
reservations needed" banner, animated ice cream shop and wood-fired oven, Christmas trees) · Flowers & photography
(schedule, bouquet toy, photographer passes and rules) · School tours / Parties / Corporate events
(deep-linkable tabs: `#school-tours`, `#parties`, `#corporate`) · Our story · Photo gallery · FAQ ·
Directions & contact.

## Content status: please read

Text, prices and links come from the wording you pasted from the current site. Things to know:

| Item | Status |
| --- | --- |
| **Corporate events prices** | **Draft placeholders.** $750 (up to 50 guests), $1,400 (51–100), 3-hour block, modeled on comparable farm venues (e.g. an organic u-pick farm near Charlotte lists events of 20–80 guests at $790–$2,000). The section shows a "Draft pricing" tag. Confirm with Cathy, edit the numbers in `index.html` (`#corporate`), then delete the `.draft-tag` line. |
| **Time-sensitive blocks** | Fall 2026 reservation schedule (`#schedule`), Exceptional Children Day / Home School Day dates (`#school-tours`), and the Fall Menu 2026 (`#menu`) must be updated as they change. `#schedule` is marked `UPDATE WEEKLY` in the HTML. |
| **School tour form link** | Uses the Google Forms address you provided, which ends in `/edit` (the form *editor* link). Public visitors usually need the `/viewform` link. Please double-check it. |
| **Phone number** | Not shown. The official pages you pasted list email only (and a photographer emergency number, which is shown in the photography section). Tell us if a public phone number should be added. |
| **Facebook** | Not linked. Instagram accounts are (farm, Wise Pie, GreenHouse, Bloomin' at Wise Acres). |
| **Booking link** | Every Reserve/Book button uses `https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356`. Search & replace that string to change it. |
| **Christmas tree season** | Friday after Thanksgiving to early December, **located at The GreenHouse** (shown in the Seasons tab, the calendar, the GreenHouse section and the FAQ). No other tree details were provided. |
| **Tomatoes & basil (new this year)** | Every weekend, late September through October. Tomatoes $4.50/lb, basil $1/stem. The page says "more than a dozen tomato varieties and 4 kinds of basil" because the counts you gave don't agree (14 in one note, 16 in another, 15 tomato varieties actually listed). Give us the right number and we'll state it. All 19 varieties are listed (15 tomatoes + 4 basil) with a filter. |

## Photos

Five photos are in `assets/photos/` and used in context (family: Our Story · strawberries + barn:
Spring · zinnias + sunflowers: Summer · cosmos field + sunflowers: Flowers), and all appear in the
gallery. To add more, drop files into `assets/photos/` and list them in `js/content.js`:

```js
photos: [
  { src: "assets/photos/example.jpg", alt: "Describe the photo", caption: "Optional caption" },
],
```

**Only these five photos reached the build environment as files.** Photos sent later in the chat
arrived as previews with no file behind them, so they could not be copied in. Easiest fix: upload the
image files to `assets/photos/` on the `claude/wise-acres-redesign-w9m4bi` branch on GitHub (Add file →
Upload files), then ask for them to be placed. Descriptive file names help.

Planned homes for the remaining photos (to add as soon as the files are available):

| Photo | Where |
| --- | --- |
| Red poppies with larkspur | Flowers: "Estimated flower schedule", April–June |
| Sunflower bouquets with the "be kind" sign | Flowers |
| Black goat eating a cucumber; goats behind the "rubs make us happy" sign; baby goat; kid goat with pumpkins | The GreenHouse (goats) and "Meet the Animals" |
| Sunflowers and pumpkins by the fire | Seasons: Fall panel (replaces the drawn scene) |
| Mums display and red shed | Seasons: Fall / gallery |
| Sunflowers with a bowl of blueberries; sunflower field with chairs and blueberries | Seasons: Summer / gallery |
| Strawberries in a pink bucket; strawberries and blueberries in green pints | Seasons: Spring and Summer / "U-Pick Fields" |
| Pizza in a box with drinks and the playground behind it; menu photos (pickle, pepperoni in the oven, Farmer Cathy) | Wise Pie |
| Wise Pie Fall Menu 2026 image | Wise Pie ("View printed menu"); the menu text is already on the page |

## What's interactive

- **Hero:** parallax hills, swaying sunflowers, drifting clouds, butterflies, a bee that follows the
  cursor, and a strawberry field you can pick from (basket counter and a keyboard/touch button).
- **Growing vine** under the header shows scroll progress.
- **Visit steps:** a tractor drives along a road as you scroll and checks off the steps.
- **Seasons:** four tabs; the current season is detected from today's date and badged "Happening now".
  Season dates, including Thanksgiving-based Christmas tree season, are computed each year.
- **Week strips:** show which days each option runs, with today highlighted.
- **Farm-year calendar** with a "Today" marker.
- **Group tabs** (school tours / parties / corporate) with deep links.
- **Bouquet builder**, tappable goat, crops that grow along section edges, FAQ accordion.
- Mobile: hamburger menu and a sticky **Reserve / Directions / Email** bar.

Everything respects `prefers-reduced-motion`, works without JavaScript (content and links), and is
keyboard navigable.

## Notes

- Colors, fonts and spacing live in the `:root` tokens at the top of `css/styles.css`.
- Illustrations are an inline SVG sprite at the bottom of `index.html` (`<symbol id="strawberry">` etc.).
- The "USDA Certified Organic" chip is plain text, not the official USDA seal.
