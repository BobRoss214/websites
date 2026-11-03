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
| 3 | First screen picture (`#hero-scene`) | strawberry rows with pickers, the wagon ride and barrel train | blueberry bushes with pickers and bees | pumpkin rows, the wagon and barrel train, falling leaves (`particles: 'leaves'`), no butterflies | snowy rows of Christmas trees, campfires, a snowman, falling snow (`particles: 'snow'`), no butterflies, no bee | Peek (js/hero.js `SCENES`, css/hero.css) |
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
3. draws the clock parts again, exactly as js/live.js does when the farm's day changes: `WISE_ACRES.live.refresh()` (strip, countdown, badges, year), then the `wa:day`
   event (This week at the farm, the "In season" fact, the "Happening now" and "Now" marks, the week strips, the farm-year "Today" marker, the pizza countdown), for a
   PRETEND day: the Saturday on or before the middle of the season's dates, in the latest year when that day is not after today (spring about May 9, summer about June 27,
   fall about Oct 10, winter about Nov 28 or 29, of the latest year not after today; at 17:00 UTC, which is noon or 1 pm in New York). `Date` is replaced only while those
   functions draw, then put back. A pretend day is never after today, so a `data-until` line is never hidden by it (`expireDated` only hides, it never un-hides).

`seasonsEnd` puts everything back: the season switch, every `data-only` line as it was, the open "What's in season" tab and farm tab, and the clock parts drawn again with the
real date. It runs when the owner presses Next, Back, a part in Contents, Close or Esc (the engine waits for a press that is still being carried out first).

What was checked by looking (a page at 3 Nov, fall): after Spring, Summer, Fall, Winter and the end, every box above is exactly as it was at the start (the strip, the countdown,
This week, the badges, the facts line, the tabs' "Happening now", the farm tabs' "Now" and "This season", the lines of a season).

Things to know:
- The "Site check" box (`#wa-problems`) only shows on a computer's own address (127.0.0.1, localhost), never in the claude.ai preview. In tests it covers the tour on any day after
  the first `data-until` date (Oct 4), so tests/tour-seasons.test.mjs hides it.
- A badge is re-drawn by the page every minute with the real clock (`tick`). If the owner stays more than a minute on one button, the open-now badges in the lit box go back to the real
  day's words (the rest stays as pressed). Nothing else in the walk is re-drawn by a timer.
- The page's own "See the farm in" buttons can still be pressed while the first-screen step is up (they are inside its lit box). They change the season but not the clock parts; the
  step puts everything back all the same.

## 6. Changes in the tour

Chapters: NOT renumbered (still 1 to 11, same titles). The seasons are walked IN PLACE, where each part comes up, not in a chapter of their own: the owners meet each part
with its other seasons right there, and chapter 10 (the pretend account, js/tour-steps-c.js, orders 1001 to 1025) keeps its number. Main has nothing to change in chapter 10.

Steps with Spring / Summer / Fall / Winter buttons (10): ch2-strip, ch2-seasons (the first screen), ch2-badges, ch2-game, ch3-countdown, ch3-week, ch4-places, ch5-tabs, ch5-cards, ch6-trees.
Steps added (3): ch1-seasons (a card about the buttons), ch3-countdown, ch6-trees. Step removed (1): ch2-headline (its words are now the first-screen walk).
Steps changed: ch2-seasons (was "Peek at the other seasons": now the first-screen walk, lit box `.hero-copy`, no `allowClicks`), ch3-week (order 301 -> 302), ch5-tabs (was the row of tabs
with `allowClicks`: now the open panel `#seasons .season-stage`), ch5-tomatoes and ch5-flowers ("This box stays all year."), ch7-soon-fall ("This group shows all year.").
Total: 77 steps in the three files (was 75), 52 when the pretend account is off. The welcome card counts a step with buttons as three steps of 15 seconds: "about 25 minutes" (was 20).

Engine (js/tour.js, documented in docs/TOUR.md "A row of small buttons on a card"): `step.choices` (a list, or a function that gives the list when the card shows), `step.choicesLabel`,
`choice.pressed`; a press runs `choice.run(ctx)` and then changes the card's title and text; the engine waits for a press before running `after()`; a press is ignored while the tour moves on;
after a press a box taller than the room is left where it is while part of it shows (the step's run() may have scrolled). The welcome card's minutes count a step with buttons as three.
css/tour.css: the row (`.wa-tour-choices`, `.wa-tour-choice`), the pressed button yellow with a thick dark edge.

Not changed on purpose: the "between seasons" days have no button. They are told in the words: the strip ("After June 7 it says Next up ..."), the countdown ("Between seasons its happening now line is empty"),
This week ("When nothing is near, the box hides"). Showing them as a fifth button would need the page's "all-year" hero look, which `hero.setSeason` cannot draw.

Questions the cards now raise for Mrs. Cathy and Rob (these are facts of the page as it is; nothing was decided for them):
- The farm badge ("Reserved visits today") exists only in fall: `hours.farm` in js/content.js has no days for spring or summer.
- Between seasons the farm's "Reserve" buttons still show (docs/WHAT_VISITORS_SEE_WHEN.md, section 3).
- The Tomatoes & basil box, the U-cut flowers box and the Store's "Fall & holidays" group (pumpkins, Christmas trees) stay on the page all year.

## 7. For main to apply by hand

- tests/timings.json: a line for the new test `tour-seasons` (about 2 minutes on a quiet computer; order 193). tests/README.md: one line for it. I did not edit either.
- tests/browser-support.table.json is not touched. `browser-support` is red ONLY for two names that came with the demo files (js-name `notify` in js/demo-kitchen.js and js/demo-store.js, css-prop `resize` in css/demo-visits.css); my files add no new name.
- js/tour-steps-c.js, chapter 10: nothing to change (the numbers did not move). `ch10-paid` (order 1004) has a text of 47 words, 2 over the limit of the words test; it was already so at b02d6a0.
- The preview build: nothing new to add (it takes every js/tour-steps*.js). The season walk needs `window.WISE_ACRES.hero`, `.live` and `.features` (all on the home page).
