# Seasons in the tour (helper "seasons", 3 Nov 2026)

What the site builder asked, in her words: "when you're on the tour, any section that changes its info based on the season (spring/strawberry, summer/blueberries,
fall/October, winter), when you're clicking, it should show you all the changes for the different seasons, and the tour should explain all that and what's different,
so Mrs. Cathy and Rob can see them and say 'that's not correct', 'cool, it changes' or 'it disappears'."

This file is the list of what changes by season (the evidence for what the tour says), how the tour switches the page, what was done, and what to check.
Every fact below comes from the code or the generated list `docs/WHAT_VISITORS_SEE_WHEN.md`. Nothing was invented.

## 1. The seasons and their dates (js/season.js, `SEASONS`)

| Season | Crop (the page's own words) | Starts | Ends | The strip says after it ends ("Next up", `next`) |
| --- | --- | --- | --- | --- |
| spring | Strawberries | April 15 | June 7 | Blueberries & sunflowers, usually mid-June |
| summer | Blueberries & sunflowers | June 15 | July 10 | Pumpkins & tomatoes, usually mid-September |
| fall | Pumpkins & tomatoes | September 13 | November 8 | Christmas trees at The GreenHouse, usually the Friday after Thanksgiving |
| winter | Christmas trees at The GreenHouse | the Friday after Thanksgiving | December 8 | Strawberries, usually mid-April |

- "In season" (`live`) means today is between the two dates. Between seasons nothing is in season, and the page keeps the look of the NEAREST season
  (`current()`): Dec 9 to Feb 9 winter look, Feb 10 to Jun 11 spring look, Jun 12 to Aug 11 summer look, Aug 12 to Nov 17 fall look, Nov 18 to Nov 26 winter look
  (the exact days are in `docs/WHAT_VISITORS_SEE_WHEN.md`). On those days the all-year headline and line show, and a `data-in-season` line is hidden.
- About 150 days of the year are in season (54 + 26 + 57 + 12); the other 215 days are "between seasons".
- Today in the story (3 Nov 2026) is fall, in season (Sep 13 to Nov 8).

## 2. How the page switches season (what the tour can use)

| Mechanism | Where | What it changes |
| --- | --- | --- |
| `window.WISE_ACRES.hero.setSeason(id)` (the "See the farm in" buttons) | js/hero.js `setSeason` -> `applyOnly` | `<html data-season>`, the hero picture, every `data-only="..."` line, the "What's in season" tabs and panels, the farm cards, the menu link to Playgrounds, the Drive time default place, the footer picture; it fires `wa:season` |
| `data-only="spring summer fall"` | index.html | the line shows only in those seasons |
| `data-in-season` (with `data-only`) | index.html | shows only while that season is REALLY on (not on the "between seasons" days that wear its look) |
| `data-until="YYYY-MM-DD"` | index.html | a line with a last day; hides itself after it (`expireDated`); never un-hides |
| the clock (`new Date()`), not the buttons | js/live.js, js/features.js | the strip, the countdown box, the open-now badges, "This week at the farm", the "In season" fact, the "Happening now" tab marks, the "Now" marks, the farm-year "Today" marker |

Peeking with the page's own buttons does NOT change the parts that follow the clock. The tour has to draw those again for a pretend day (section 5).

## 3. What changes, where, in which seasons, what hides

"Peek" = follows `hero.setSeason` (the buttons). "Clock" = follows the real date only.

| # | Part (selector) | Spring | Summer | Fall | Winter | Driven by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Strip at the very top (`.announce [data-ann-season]`) | In season: Strawberries | In season: Blueberries & sunflowers | In season: Pumpkins & tomatoes | In season: Christmas trees at The GreenHouse | Clock. Between seasons: "Next up: {crop}, usually {when}" |
| 2 | First screen text (`.hero-copy`): headline `#hero-h`, line `.hero-sub`, buttons `.hero-cta`, note `.hero-note`, chips | Headline "Organic u-pick fun for the whole family"; line "It's strawberry season!..."; buttons "Reserve your visit" + "See what's in season"; note "No reservation? Visit The GreenHouse next door" | line "It's blueberry season! Fill a bucket..."; the rest as spring | line "It's pumpkin season! Pick pumpkins, plus new u-pick organic tomatoes and basil, with wagon rides and a haunted trail."; the chip "New: u-pick tomatoes & basil" (`data-until` 2026-10-31) and the pizza chip (fall only) | Headline "Wise Acres Christmas trees"; line "Pick out a North Carolina Christmas tree at The GreenHouse next door..."; the red button is "Visit The GreenHouse"; the note is HIDDEN | Peek. Between seasons: the all-year headline and line |
| 3 | First screen picture (`#hero-scene`) | strawberries, butterflies | blueberries and sunflowers, butterflies | pumpkins, falling leaves, no butterflies | snow, lit trees, no butterflies, no bee | Peek (js/hero.js `SCENES`, css/hero.css) |
| 4 | Open-now badges (`.hero-live`, also in the farm card of "Two places") | no farm badge (`hours.farm` has only `fall`); GreenHouse badge by its hours | same | farm badge "Reserved visits today" / "No visits today. Next reserved day: ..." (Thu to Sun) | no farm badge; GreenHouse badge by its hours | Clock + `hours` in js/content.js |
| 5 | The basket game (`#picker`) | "Try it! Tap the strawberries to pick them." / button "Pick a strawberry" | "Try it! Tap the blueberries to pick them, or snip a sunflower." / "Pick a blueberry" | "Try it! Tap the pumpkins to pick one, or tap the wagon." / "Pick a pumpkin" | "Tap the trees to light them up. Tap a fire to stoke it." / "Light a tree" (a tree instead of the basket) | Peek (js/hero.js `SCENES.*.hud`) |
| 6 | Countdown box (`.next-up`) | Happening now: Strawberries; Next up: Blueberries & sunflowers (mid-June) | Happening now: Blueberries & sunflowers; Next up: Pumpkins & tomatoes (mid-September) | Happening now: Pumpkins & tomatoes; Next up: Christmas trees at The GreenHouse | Happening now: Christmas trees at The GreenHouse; Next up: Strawberries (mid-April) | Clock. Between seasons the "Happening now" line is empty |
| 7 | This week at the farm (`#this-week`) | Strawberries, U-cut flowers (In season) | Blueberries, Sunflowers, U-cut flowers | Pumpkins, Tomatoes & basil (Sep 25 to Oct 31), U-cut flowers | Christmas trees (At The GreenHouse) | Clock (`CROPS` in js/features.js). "Usually starts {date}" 21 days before a crop; the whole box HIDES when no crop is near and no note or spots table is typed in |
| 8 | Two places, the farm card (`#visit .choose-farm`) | strawberry picture; "U-pick organic strawberries, plus u-cut flowers"; "Reserve the farm" | blueberry picture; "U-pick organic blueberries, plus u-cut sunflowers and flowers"; "Reserve the farm" | pumpkin picture; wagon rides, corn pit, sunn hemp maze, haunted trail; "Reserve the farm" + "See prices"; a "New: U-pick organic tomatoes & basil" link until Oct 31 | fir picture; "Picking is seasonal. Next up: u-pick strawberries, starting around mid-April"; "Reserve the farm" becomes "Tell me when"; the line "Christmas trees are next door at The GreenHouse" and the "Trees" banner show only in season | Peek (`data-only`, `data-in-season`) |
| 9 | What's on the farm (`#farm-seasons`, `#farm-cards`, `.fs-glance`) | 6 cards | 6 cards (blueberries instead of strawberries) | 8 cards (pumpkins; haunted trail and sunn hemp maze added; wagon card adds the corn pit; the snack card adds NC pumpkins) | 3 cards, all "At The GreenHouse": Christmas Trees, Playground & Goats, Pizza, Ice Cream & Drinks | Peek (`data-seasons`); "This season" tag by the clock |
| 10 | What's in season (`#season-tabs`, `.season-stage`) | "Strawberry season", mid-April to early June | "Blueberries & sunflower season", mid- to late June through early July | "Pumpkin & tomato season", mid-September through early November; Thursday to Sunday reservations; "See prices" | "NC Christmas tree season", Friday after Thanksgiving to early December; no reservation; "Get farm updates" | Peek; the "Happening now" tab mark by the clock |
| 11 | GreenHouse: "Christmas trees are here" line (`.gh-trees`) | hidden | hidden | hidden | shows | Peek, `data-in-season` (only on the real tree days) |
| 12 | Mobile action bar (`#action-bar`, phones only) | Reserve + Directions (farm) | same | same | GreenHouse + Directions (GreenHouse) | Peek |
| 13 | Menu | "Playgrounds" goes to the playground card; "Things to Do" has a red dot | same, no dot | same, dot (tomato season) | "Playgrounds" goes to What's on the farm instead; no dot | Peek (js/main.js `aim`; css/sections.css) |
| 14 | Menu "Christmas trees" line (`data-coming="winter"`) | no | no | bold with a red dot from 60 days before tree season (from Sep 28) | bold with a red dot until Dec 8 | Clock, once when the page loads |
| 15 | Drive time (`#contact .drive`) | default place: the farm | the farm | the farm | The GreenHouse | Peek (js/features.js `seasonTo`) |
| 16 | The "Season by season" strip and the footer picture (`.season-strip`, `#footer-art`) | pattern and scene of the season | same | same | same | Peek (css/extras.css `--strip`, js/hero.js `footerArt`) |
| 17 | The "In season" fact (`#fact-season`, Quick facts) and the "Happening now" / "Now" marks | follows the date | | | | Clock |
| 18 | Other pages: strawberry-picking "Tell me when it opens" (`data-out-of-season="spring"`: hidden while spring is really on); pumpkin-patch "Fall schedule" (`data-only="fall"`, `data-in-season`, `data-until` 2026-11-30); first-visit picture (`data-only`); the action bar | | | | | Peek / real season. NOT toured (the tour has no step on those pages) |

## 4. Parts that MENTION a season but do not change with it (the tour says so)

| Part | What it says | Does it change? |
| --- | --- | --- |
| Tomatoes & basil box (`#tomatoes`) | "Every weekend, late September through October"; the ribbon "New this year" has `data-until` 2026-12-31 | The box stays on the page all year. Only the ribbon has a last day |
| U-cut flowers box (`#flowers`) | "April-July and September-first frost" | stays all year |
| Store, "Fall & holidays" (`#shop-pumpkins`) | NC pumpkins, U-pick pumpkins, mini pumpkins, straw bales, corn stalks, Christmas trees ("Prices coming soon"); "Pumpkin season is mid-September through early November" | stays all year. The Store note says "Prices are for fall 2026" |
| The fall pizza menu (`#menu`), packages, add-ons, FAQ | written for fall | stay all year |
| GreenHouse feature list | "Christmas trees in season" | stays; only the green line `.gh-trees` is seasonal (row 11) |
| Pizza schedule box (`#schedule`) | the Tuesday openings of this fall | by date rows (`data-until`), not by season |

## 5. How the tour switches the page (js/tour-steps.js, "The season walk")

A step with `choices: seasonWalk({...})`, `before: seasonsBegin`, `after: seasonsEnd` gets a row of four buttons on its card. A press does, in this order:

1. `hero.setSeason(id)` (the page's own switch), and waits 320 ms for the new picture to be drawn;
2. shows the `data-in-season` lines of that season (what the page itself does when a season is really on);
3. draws the clock parts again (`WISE_ACRES.live.refresh()`, `WISE_ACRES.features.renderWeek()`) for a PRETEND day: the Saturday on or before the middle of the
   season's dates, in the latest year when that day is not after today (spring about May 9, summer about June 27, fall about Oct 10, winter about Nov 28/29 of the
   latest year not after today; at 17:00 UTC, noon or 1 pm in New York). `Date` is replaced only while those two functions draw, then put back.
   A pretend day is never after today, so a `data-until` line is never hidden by it (`expireDated` only hides, it never un-hides).

`seasonsEnd` puts everything back: the season switch, every `data-only` line as it was, the open "What's in season" tab and farm tab, and the clock parts with the real date.
It runs when the owner presses Next, Back, a part in Contents or Close (the engine waits for a press that is still being carried out first).
Not done: the "In season" fact, the "Happening now"/"Now" marks and the farm-year "Today" marker (they need the `wa:day` event, which also redraws the pizza countdown and hides
dated lines); they keep showing the real date during the walk.

## 6. Changes in the tour

(filled in at the end)

## 7. For main to apply by hand

(filled in at the end)
