# a11y helper (wave 3): keyboard stops, touch targets, receipt overflow, overlay and toasts

Work tree: `ag-a11y/work/givespin`. Patch: `handoff/changes.patch` (made with `diff -ruN base/givespin work/givespin`). Own checks: `tests/sections/33-a11y.mjs`, ids 33a to 33d (new file).
No new JS or CSS file, no new script tag, no new icon, no change to `index.html`, so `tools/make-precache.mjs` needs no re-run. Unit tests: none added, the README count line is unchanged (488).
Everything below was checked in headless Chromium only (see "Verified" and "Not verified").

## What I did, per item

### 1. Live table feed: one tab stop (`js/ui/live.js`, `css/live.css`, `css/profile.css`)
- Before: every bot name in the feed is a button in the tab order (up to 24), plus the list itself (`tabindex=0`): 13 Tab stops in a row on the base in section 33a.
- Now: the names are ONE tab stop (`ui.rove`, the pattern the odds board and the finished-round chips already use). Arrow keys, Home and End move between names; Enter or Space opens the profile; a mouse or a finger still reaches every name; focus returns to the same name after the dialog closes (25h pins this and still passes, see "Tests I changed").
- New `roveFeed(box)` in `renderTab` (after the feed is written, the listeners are added once per box and `ui.roveSync` runs after each write). At either end of the list it also scrolls the feed to its end, so the table's own lines above the first and below the last name can be read.
- The list (`ol.feed`) keeps `tabindex="0"` only when it holds no bot name (only your own bets or the table's lines), so it can always be scrolled by keyboard; with names the names are the way in. `feedHTML` decides it from the rows (join/cancel by a bot, or a crew row).
- No `aria-live` on the feed (33a checks none inside `#tabp`).
- `.feed { scroll-padding-block: 40px }`: arrowing to a name keeps the lines around it in view.
- Hit area of the names: `.botname { padding: 2px 0; margin: -2px 0 }` (`css/profile.css`) makes the button 24.2 px high while the line of text is exactly as tall as before (33b measures every feed row with and without the padding: equal). This is global (leagues rows, crew chat, leaderboards "Players", the profile page), so those names are 24 px high too; nothing else moved.

### 2. Target sizes (WCAG 2.5.8), measured with `getBoundingClientRect` at 390x844, 768x1024, 1280x720
| What | Before | Now | Where |
| --- | --- | --- | --- |
| `a.spot__link.extlink` (charity of the week) | 21.2 px at 768 and wider | 24 px | `css/ticker.css` |
| `a.hist__name.extlink` (Live tables page, recent results) | 21.1 px | 24 px | `css/live.css` |
| waitlist tick's label `.wl-check` (and every `.check`: the live table's toggles, the stream "Let chat pick") | 22.8 px | 24 px | `css/live.css` (`.check`) |
| charity's web address in its profile (`.facts dd a`) | 16 px | 24 px | `css/dialogs.css` |
| bot names | 20.2 px | 24.2 px | `css/profile.css` |
| ticker Pause button | 26 px (28 on a laptop) | unchanged, checked >= 24 | none needed |
- "About" marks on shrunk game pictures: Dice and Coin Flip were already a whole tile or slot to tap (the walk round added a `::after` that fills the tile); the real hit area I measure by hit-testing (`elementFromPoint`) is 64 x 45 on Dice at 320x568 (the mark's own box is 17 x 17), 37 x 27 on Coin Flip at 320x568 and 75 x 27 at 844x390. I did NOT grow the mark's own box (a bigger box would overlap the neighbouring slot). 33b hit-tests Dice, Coin Flip, Cosmic Spin and Classic Slots.
- Cosmic Spin on a 320x568 phone: the eight reel buttons are 19.3 x 30 (hit area 20 x 30). Eight reels share a 196 px box in a 260 px machine; 24 px would need 218 px, so they cannot be wider without making the machine wider than the screen (and the fit is by height only). Not fixed. WCAG 2.5.8 accepts an equivalent control on the same page: every charity also has its own button under the picture ("In play" tab, `chip--link`, at least 24 px high), and 33b checks that. At 375x667 and wider the reels are 29 px or more. At the smallest sideways phone (568x320) Cosmic, Deep Sea, Sweets and Coin Flip marks are 12 to 21 px wide (the old known limit of the shrink-to-fit); I left those.
- Inline text links in a sentence ("How?" in the giving-limit note, "Open Fair Play?", "How it works" in a live table's note, "How we make money: we do not.") are 14 to 16 px high. WCAG 2.5.8 exempts a link inside a sentence, axe passes them, I left them.
- 33b also runs axe's `target-size` rule on the Live tables page at the three sizes: clean.

### 3. Receipt dialog sideways pan (`css/dialogs.css`, `css/walk.css`)
Two causes, both found by listing every element wider than the body (probe, not in the patch):
1. **The sticky button bar**: `css/walk.css` gave `.modal--result .rs-actions` `margin: 0 -24px -24px; padding: 12px 24px` for the 24 px body padding, but at 560 px and narrower the body padding is 16 px (18 at the bottom) (`css/dialogs.css`), so the bar stuck out 8 px on each side: that is the 8 px pan at 360, 390 and 412. Fix: a `max-width: 560px` rule with `margin: 0 -16px -18px; padding: 12px 16px 14px; bottom: -18px`.
2. **The body grid's single auto column**: `.modal__body` is a grid with one implicit `auto` column, which grows to the widest child's min-content width, and so does `ul.alloc`. A split round (Cosmic Spin: 8 charities, Sweets) made the whole receipt 30 to 65 px wider than the dialog (that is the 62 px at 320 the review measured). Fix: `grid-template-columns: minmax(0, 1fr)` on `.modal--result .modal__body` and on `.alloc` (the rows then wrap inside).
- Found while measuring: at the end of a scroll the line under the buttons ("Demo mode. This receipt is not a tax document.") was drawn 10 px UNDER the sticky bar (the bar's -24 px bottom margin pulled it up). It is an honesty line, so I gave it room: `.modal--result .rs-actions + .rs-fine { margin-top: 24px }`. 33c checks it is below the bar and reachable at every size.
- Result: `scrollWidth == clientWidth` at 320, 360, 390, 412 and 768 for a single gift (Lucky Wheel) and a split round (Cosmic Spin, 8 charities); base: 360 vs 298 at 320 (62 px), 346 vs 338 at 360.

### 4. Stream `?overlay=1` and toasts on short windows
- **Overlay at 844x390** (`css/stream.css`): the picture ended at 408 in a 390 px window. In a window up to 520 px tall the DEMO tag now shares the title's row (`#main` padding-top 40 -> 8, the title moves 164 px right to clear the tag, the stage's gap 3 px and padding 4 px). Picture bottom: 374 at 844x390 (was 408), 374 at 667x375 (was 408, 33 px cut), 374 at 915x412. A tall window keeps the 40 px (33d checks it at 1366x768). Not fixed: windows shorter than about 360 px (the picture is at its 0.34 floor, so 640x360 still ends a few px low), because that needs the JS floor in `fitStage` to change.
- **Toasts on a short window** (`css/base.css`): up to 520 px tall they are smaller (6px 10px padding, 0.78rem), at most 300 px wide, and sit in the lower LEFT corner (`left: 8px`; beside the side rail when there is one) instead of the middle. At 667x375 and 844x390 they no longer touch the stage (picture and result), measured with four toasts at once; the base covered 8 to 11 % of the stage's area with four toasts. `role=status`, `aria-live=polite` and the one-announcement-per-toast behaviour are untouched (CSS only, no JS), checked in 33d. Trade-off: they now sit over the left gift panel for the three seconds they live (they have `pointer-events: none`, so taps pass through). See "Questions for the owner".

### 5. Other things found
- The hidden "Demo mode" receipt line (above, item 3).
- Nothing else under 24 px that is not an inline link or the documented small-window limits, in a probe of 19 game screens at 320x568, 360x640, 375x667, 390x844, 568x320, 667x375, 844x390 and of the lobby, Live tables, Spotlights and a live table at three sizes (the probe applies the WCAG rule: 24 px circle spacing counts).

## Tests I changed
- `tests/sections/25-profile.mjs` line 470 (25h): the check said every bot name in the live feed has `tabIndex === 0`. That is exactly what changes on purpose (one tab stop). Now: every name is a real button with the same name text and label, `tabIndex` is 0 or -1, and exactly one is 0. The label says so and points to 33a. No other assertion of 25h was touched (the dialog, the BOT pill, the "(made up)" facts, focus back on the name after Escape, the Close button, the redrawn feed).
- No wording or honesty test was touched.

## Verified (headless Chromium 1243 via Playwright only)
- New sections on the work tree: 33a 27 checks, 33b 37, 33c 34, 33d 21 (see the numbers at the end of this file) and on the UNFIXED base the same file gives 33a 3 FAIL, 33b 13 FAIL, 33c 26 FAIL, 33d 6 FAIL (each regression check fails on the base and passes on the tree).
- axe 4.10.3 in the sections (`AXE=`): clean on the live feed, the 320 px split receipt; `target-size` clean on the Live tables page.
- Unit tests: `node --test tests/*.test.js` 488 pass.
- Other sections run on a snapshot of the final tree (list and results at the end).

## Not verified
- A real phone, real touch targets under a real thumb, Safari, Firefox, a real screen reader (the feed's reading order, "BOT" wording and focus return were checked from the DOM and with keyboard events in Chromium only). Roving tabindex with VoiceOver or TalkBack was not heard.
- iOS Safari does not focus a button on click: the roving "current name" is then set by the keyboard only (a tap still opens the profile).
- 400 % zoom / large system fonts, right-to-left text.
- Toast placement on a real landscape phone with a notch (`env(safe-area-inset-*)` is not applied to the new left offset; the side rail case uses `--side-w`).

## Questions for the owner
1. **Toasts in the lower left on short windows.** They now cover the gift panel (not the result) for 3 seconds. Alternative: top right under the top bar (covers the odds board). Recommendation: keep the lower left (the panel is not being read at that moment, and taps pass through).
2. **Cosmic Spin reels on the smallest phones.** 19 px wide at 320x568; the only fix would be a redesign of the machine (fewer reels on a very small phone, or a bigger lever-less machine). Recommendation: leave it; each charity has its own larger button under the picture.
3. Should the same hit area (24 px) be given to the other `.botname` lists (already the case, global rule)? Recommendation: yes, kept.

## Left / not done
- Windows shorter than about 360 px in the overlay (the picture's 0.34 floor): needs a change in `fitStage` (JS) to let the overlay shrink further.
- Slot machines in Stream Mode on 320x568 ("Turbo" 42x18, "How it pays" 60x18, the lever 17x65): the old shrink-to-fit limit, not touched.
- 195 px wide pages (200 % zoom of a phone), below the 320 px reflow floor: untouched.

## Merge cautions (shared files, all small and localized)
- `js/ui/live.js`: `feedHTML` (the `tabindex` of the list and two lines before it), `renderTab` (one line after `box._liveFirst = ...`), and a new function `roveFeed` with `FEED_NAMES` right after `renderTab`. Nothing else moved.
- `css/profile.css` (`.botname` margin/padding), `css/live.css` (`.feed`, `.hist__name`, `.check`), `css/dialogs.css` (`.modal--result .modal__body`, `.alloc`, `.facts dd a`), `css/walk.css` (the `rs-actions` rule: a media query and one rule added right below it, NOT at the end of the file), `css/ticker.css` (`.spot__link`), `css/stream.css` (a block after the `#main.main` overlay rule), `css/base.css` (a block after `@keyframes toast-in`).
- `README.md`: one new paragraph after "**Polish:**" and the tests sentence now lists `33-a11y` (the other helpers add their own file names to the same sentence: keep all). `docs/next-steps.md`: the items "From the walkthrough, not fixed", "Bot names ... tab stop", "Link targets under 24 px" and "The receipt dialog body can pan sideways" were replaced by two shorter bullets about what is still open.
- `tests/sections/25-profile.mjs`: one assertion (see above). New file `tests/sections/33-a11y.mjs`.
- I did not touch `js/ui/receipt.js`, `js/ui/game.js`, `css/fit.css`, `index.html`.
- Slip to disclose: once I ran `git diff --stat` in the work folder by habit (read-only, it printed nothing); no other git command.
