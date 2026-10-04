# Which phones and browsers the site is made for

The farm's visitors are people with phones, many of them old ones. This page says which browsers the site is made for, what it asks of them, what is
checked and how, and what a visitor with an older phone sees. It is written for the farm and for whoever edits the site; the commands at the end are
for the second kind of reader.

## In short

The site is made to **read and work** on these, from the version in the table up:

| Browser | Oldest version | Notes |
| --- | --- | --- |
| iPhone and iPad (Safari) | iOS 14 | iOS 14.5 or newer for the full look; see "Older iPhones" below |
| Safari on a Mac | 14 | |
| Chrome on a computer | 90 | |
| Chrome on Android | 80 | |
| Firefox | 78 (the "ESR" of 2020) and every newer one | |
| Samsung Internet | 13 | Chromium 83 |

"Read and work" means: every text is there and readable, every button does what it says, the farm map, the photo viewer, the pizza countdown and
the language buttons work. On the oldest versions some of the **decoration** is missing (tilted photos, falling leaves, blurred header, balanced line
breaks) and some spacing is tighter; that is on purpose, the site does not hold back newer browsers for it.

Everything else (Internet Explorer, Opera Mini, UC Browser in "extreme" mode, iOS 12 and 13) is not a target. The notes below say what you get there.

## What the site asks of a browser

- **JavaScript**, written in the plain style of 2017 (arrow functions, `async` and `await`, template strings). Nothing newer is in the scripts: no
  `?.`, no `??`, no `.at()`, no `replaceAll`, no `structuredClone`. Where a script uses something newer it first tests that it is there
  (`<dialog>`, `requestIdleCallback`, `visualViewport`, `getAnimations`) or does not need it.
- **Style sheets** that use some features from 2020 to 2023 (flex `gap`, `:is()`, `:has()`, `:focus-visible`, `clamp()`, `aspect-ratio`, `inset`,
  logical sizes such as `padding-block`, container units, `dvh`, `translate`/`rotate`/`scale`). For each one that is newer than the oldest browser
  above, there is either a fallback or the page simply looks plainer without it. `tests/browser-support.table.json` lists every one with the first
  version of each browser that has it and says in a sentence how the page copes.
- Pictures are **WebP** (every browser above has it; see "What to decide" for one old exception) and the fonts are **WOFF2**.

## What is checked, and how

`node tests/browser-support.test.mjs` (also part of `node tests/run-all.mjs`, in the group that needs no browser and takes a few seconds):

1. It **reads** every script, style sheet and page the site is made of (`js/`, `css/`, the pages, `print/`) and lists every browser feature they use,
   such as `:has()`, `inset`, `aspect-ratio`, `structuredClone`, `<dialog>`, `??=`.
2. Each feature must be in `tests/browser-support.table.json`. A feature that is not there fails the test. The table is made by
   `tools/browser_support_table.mjs` from MDN's browser-compat-data (the same data the web.dev and MDN support tables use). The test itself needs no
   network.
3. A feature that is **newer than the oldest browser** of the table must have a reviewed `how` in the table, and where a program can check it, it does:
   - `longhand`: the old way is written first (`top`, `right`, `bottom`, `left` before `inset`; `padding-top` before `padding-block`).
   - `cascade`: an older line of the same property comes first, or the use is inside an `@supports` block that asks for it.
   - `supports-not`: an `@supports not (...)` block with the old way exists (the season cards get their height this way where `aspect-ratio` is missing).
   - `prefix-pair`: the `-webkit-` form is written next to the plain one.
   - `guard`: the script tests for the feature before using it.
   - `own`: the word is the site's own name for something (a function called `close`), and the test checks it is never used as the browser's method.
   - `manual`: a person weighed each use (`:is()`, `:has()`, `:focus-visible`, `rotate`, `scale`, `translate`, `<dialog>`). A new use fails the test until it is reviewed.
   - `progressive` and `na`: the page works without it, or it only matters to a mouse or to one maker's browser.
4. The test also tries its own reader on small samples first, so a reader that stopped working cannot make the test pass.

**What is not checked.** Only Chromium can be run in the test setup (the other tests use it). Safari and Firefox are **read, not run**: this test and the
compat data say what they have, not what they do with a rule that is wrong in some way nobody wrote down. If you can, look at the finished site once on an
iPhone and once in Firefox before a launch. Words that a script writes into the page, and the pictures, are not read by this test.

## What an older browser sees

**iPhone, iPad and Safari**

- **iOS 14.0 to 14.4 and Safari 14.0** (the first months of iOS 14, from 2020 to April 2021, now very rare): rows of buttons and chips touch each other (flex `gap` came in
  14.1 on a Mac and 14.5 on a phone), and the tilted photos, hover pops and spinning sun rays are straight and still (`translate`, `rotate` and `scale`, same versions). The
  overlays, menus and spacing that use `inset` and the `padding-block` family are written the old way too, so they are placed correctly.
- **All of iOS 14** has no `aspect-ratio` (15): the photo boxes show each picture in its own shape, the week circles are pills, and the season cards use the
  `@supports not` fallback so they keep their size.
- **Before iOS 15.4 (and Safari 15.3)**: no `:focus-visible` (the browser's own focus ring shows, nothing is lost), no `:has()` (one empty box can show; the first line of the hero's message can run under the Pause animations button in the corner of its card; the checklist
  strike-through works through `:checked`), no `<dialog>` (the photo viewer is drawn as a plain box by `js/main.js`), no `dvh`/`svh` (it uses `vh`), no smooth scrolling
  (links jump), and `overflow-wrap: anywhere` is unknown (a long e-mail address still breaks, because `break-word` is written before it).
- **Before iOS 16 (Safari 16)**: no container units (the little tractor in the margin is placed with `left`), no `overscroll-behavior` (the page can scroll behind the photo
  viewer), no `overflow-x: clip` (the `@supports not` rule uses `hidden`; one decorative block that sticks out the side then does not stay stuck, so the GreenHouse picture scrolls
  with the page instead of staying under the header). **Before 16.4**: no `@property` (the sky colours change at once instead of fading).
- **Before Safari 17.5 and 18**: no `text-wrap: balance` (lines break the old way), no `content-visibility` (only a speed hint), and the header blur needs `-webkit-backdrop-filter`
  (written next to the plain one).
- **Before Safari 17.2, Chrome 101 and Firefox 132**: the font preload line has a `fetchpriority` hint that these browsers ignore: the font still preloads, without the priority.
- **iOS 13 and 12** (Apple's lists: the iPhone 5s, 6 and 6 Plus stop at iOS 12; the 6s, 7 and first SE reach iOS 15): the scripts load and run (the one `?.` that would have stopped the whole of
  `js/main.js` on iOS before 13.4 was written another way), so menus, tabs, language buttons and the farm map work. What is lost: `clamp()` (iOS before 13.4)
  is used about a hundred times for sizes and spacing, so on iOS 13.0 to 13.3 and 12 the big headings and the gaps between sections fall back to the
  browser's own sizes and look cramped or oversized; `href` on `<use>` (iOS 12.2) draws every little icon, so on iOS 12.0 and 12.1 the icons are missing;
  `hourCycle` in the date formatter (iOS 13) is ignored by iOS 12, which can make the "Open now" badge and the pizza countdown wrong around midnight and noon;
  `IntersectionObserver` before 12.2 and `ResizeObserver` before 13.4 are tested for, and without them the sections just show at once and the map keeps its size.

**Android (Chrome, Samsung Internet)**

- **Chrome 80 to 83 and Samsung Internet 13**: rows of buttons touch (flex `gap` is Chrome 84 / Samsung 14); `inset` and the logical sizes (Chrome 87) are written the
  old way so nothing moves; `replaceChildren` (Chrome 86) is not used any more (the photo counter was the one place), so the photo viewer works.
- **Chrome before 88**: rules written with `:is()` are dropped whole: the Spanish and Vietnamese phone menu rules for windows 1180 to 1330 pixels wide, a few line heights for
  Hindi, Chinese and Vietnamese, the larger touch area around some buttons. Reading and every button work.
- **Chrome before 104** (a computer or phone that never updated): tilts, pops and falling leaves are not drawn (`rotate`, `scale`, `translate`); the progress tractor is placed with
  `left` where container units are missing (Chrome before 105), which is where `translate` is also missing.
- **Chrome before 105 and Samsung Internet before 20**: no `:has()` (the same two small things as on iOS before 15.4); no container units; no `dvh`/`svh` (108) so the hero uses `vh`.

**Firefox**

- **Firefox 78 to 88**: `aspect-ratio` (89) and `:focus-visible` (85) are missing, handled as above; no `visualViewport` (91, tested for), no `<dialog>` (98, the plain box),
  no `inputmode` on the e-mail box (95, the e-mail type gives the same keyboard), no `rel="preload"` for the fonts (85), `width: fit-content` has `-moz-fit-content` written first.
- **Firefox before 121**: no `:has()`. **Before 103**: the header has no blur, only its 94% colour. **Before 110**: no container units (the margin tractor uses `left`).

## When you change the code

Add what you need. If the test says a feature is not in the table:

1. Look the feature up on MDN (the page of the feature has a table of versions). Is it older than the table above? Then it is only a missing line in the table.
2. Is it newer? Decide how the page copes: write the old way first, put the new line in an `@supports` block, test for it in the script, or accept that the
   page is plainer without it. Add the reason in plain words.
3. Install the compat data once and make the table again (it keeps what you wrote by hand and lists what still needs a `how` and a `fallback`):

   ```
   npm install --prefix ../bcd @mdn/browser-compat-data
   node tools/browser_support_table.mjs --bcd ../bcd/node_modules/@mdn/browser-compat-data
   ```

4. To see what a particular version lacks:
   `node tools/browser_support_table.mjs --bcd ../bcd/node_modules/@mdn/browser-compat-data --report safari_ios 13.0`
   (browsers: `safari`, `safari_ios`, `chrome`, `chrome_android`, `firefox`, `samsunginternet_android`).

To change which browsers the site is made for, change `TARGETS` at the bottom of `tests/browser-support.scan.mjs`, make the table again, and read what the test now asks for.

## What to decide

- **Photos are WebP only.** Every browser in the table shows WebP, but I recall from Apple's notes for Safari 14 that on a Mac the pictures need macOS 11 or newer
  (I could not look it up here: no network), so Safari on a Mac with macOS 10.15 or older would show no photos. The tool that adds a photo (`tools/add_photo.py`)
  makes WebP only. If you want those visitors too, the photos would need a second JPEG each; ask Claude before changing it.
- **Whether to care about iOS 12 and 13.** The text above says what they lose. Giving them back `clamp()` would mean a second line for about a hundred rules. The
  visitors on those phones are very few today, and the text, the buttons and the language choice work. Say if you want them covered.
- **Flex `gap` on the first versions of iOS 14 and Chrome 80 to 83.** Rows of buttons touch. A fix would add spacing rules for each of about 140 places; the share of these
  versions is tiny. Say if you want it.
