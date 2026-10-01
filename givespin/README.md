# GiveSpin

**Give big. Let luck pick where it lands.**

A game-show way to donate. Pick an amount, choose the causes you care about, then spin a wheel, pull a slot
machine, open a drop crate or play Plinko. The game picks a charity, confetti goes off, and you get a receipt.
Built for streamers and anyone who thinks giving should be a little more fun.

Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, no network requests, no tracking.
It works from a web server or by double-clicking `index.html`.

```
cd givespin
python3 -m http.server 8000     # then open http://localhost:8000
```

> **Demo mode is the default.** Out of the box nothing is charged and no money moves: rounds are simulated,
> the banner says so, and every receipt is stamped DEMO. See [Going live](#going-live) before using real money.

## What's in it

**Four games**, all with equal odds for every charity:

| Game | How it works |
| --- | --- |
| Lucky Wheel | Canvas wheel with chasing LED bulbs and a ticking, flicking pointer. |
| Slot Machine | Three reels, three charities. The gift splits across the reels. Three of a kind is a Triple Threat. |
| Drop Crate | A case-opening strip rolls past a marker and crawls to a stop. Familiar to anyone who watches streams. |
| Plinko | A ball ricochets through the pegs into a charity's bin. Deliberately uniform (a real board favours the middle). |

**Set-up controls:** any amount from $1 to $1,000 (presets or custom), 11 cause filters (Kids, Animals, Planet,
Hunger, Health, Education, Disaster Relief, Veterans, Mental Health, Housing, Clean Water), and a split option
that divides a gift across 1, 3 or 5 rounds to the exact cent.

**Game layer:** XP and 10 levels, a daily streak, 10 unlockable badges, and a history of recent rounds. All of it
is stored in the player's own browser (`localStorage`) and can be reset from the Impact section.

**The roster:** 45 hand-picked, well-known charities. Players can switch any of them off.

**Stream Mode:** the TV button (or `?stream=1`) enlarges the game and hides everything else. Add
`&transparent=1` for a see-through background in an OBS browser source. Space bar plays.

**Polish:** synthesised sound effects (no audio files, mutable), confetti that draws above dialogs, reduced-motion
support, keyboard-operable everywhere, screen-reader announcements for results, a phone-friendly layout.

## Going live

Everything about real money lives in `js/config.js`.

- `mode: 'demo'` (default): simulated end to end.
- `mode: 'redirect'`: after the game picks a charity, the receipt shows a **Donate** button that opens a checkout
  page for that charity in a new tab. GiveSpin never sees card details and never holds funds. The player pays on
  the provider's own page.

To switch on redirect mode, set `mode: 'redirect'` and fill in `checkout.url(charity, cents)` so it returns an
`https://` link for your donation platform (links that are not `https://` are ignored). Add whatever per-charity
field your builder needs (for example a `slug`) to the entries in `js/data.js`. Charities without a link show a
clear "no checkout link set up" note instead of a button.

In redirect mode the site cannot know whether the player finished checkout, so it records the round as "sent to
checkout", not as a completed gift, and labels the stat that way.

**Please read before launching:**

- **Legal.** Collecting donations and passing them to charities can trigger charitable-solicitation registration
  and money-transmission rules that vary by location. The redirect design is meant to leave payment handling with
  a regulated donation platform. Confirm the details with that platform (and a lawyer if you are unsure) before
  you promote the site.
- **Charity list.** The roster and descriptions are short paraphrases written from general knowledge. The
  charity hostnames in `js/data.js` were **not link-checked** when this was built. Verify that every entry is
  still active, accurate and one you are comfortable with, and that your checkout provider supports it.
- **Names and logos.** Charity names are used only to identify the organisations and no logos are used. The footer
  says GiveSpin is not affiliated with them. Keep it that way unless you have their permission.

## Customising

| To change | Edit |
| --- | --- |
| Amount limits, presets, split options, mode, checkout links | `js/config.js` |
| Causes and charities (names, descriptions, accent colours) | `js/data.js` |
| Colours, fonts, spacing | the `:root` tokens at the top of `css/styles.css` |
| Level names, XP, badges | `LEVELS`, `xpForPlay` and `BADGES` in `js/core.js` |
| Brand name and copy | `index.html` |

Each cause needs at least a few charities so a single-cause filter still plays well (the test suite checks this).

## How the games stay fair

1. The winner is chosen **before** any animation, using `crypto.getRandomValues` with rejection sampling (no
   modulo bias).
2. The animation only *reveals* that result: the wheel is computed to stop with the pointer inside the winning
   slice, the strip lands on the winning card, the reel stops on it, the ball follows a path that ends in its bin.
3. When the pool is bigger than the game can show (the wheel shows 12 slices, Plinko 7 bins), a uniformly random
   subset is displayed and the winner is drawn uniformly from it. That is still exactly equal odds for the whole
   pool, which the unit tests check statistically.
4. Split gifts use integer cents, so the parts always add up to the exact total (a $10.00 gift in 3 rounds is
   $3.34 + $3.33 + $3.33).

## Tests

```
node --test givespin/tests/core.test.js
```

16 unit tests for the logic in `js/core.js`: money formatting and splitting, the RNG and fairness argument, pool
filtering, XP and levels, streaks, badges.

```
NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
```

End-to-end tests in headless Chromium (needs Playwright installed globally). They start their own static server
and drive the real UI: every game, split gifts, validation, persistence and corrupt-data recovery, keyboard use,
the receipt dialog, Stream Mode, live (redirect) mode including rejecting non-https links, a phone-sized viewport,
reduced motion, and a check that the console stays clean. Most importantly, they verify across repeated runs that
**what is on screen matches the winner that gets recorded** in all four games. Set `SHOTS=/some/dir` to save
screenshots, and `AXE=/path/to/axe.min.js` to add an axe-core accessibility scan.

Append `?fast=1` to the URL to squeeze every animation (the tests use it; it is handy for quick demos too).

## Browser support

Current Chrome, Edge, Safari and Firefox. The page uses `<dialog>`, the Popover API (for confetti above dialogs),
`color-mix()` and container query units. Confetti falls back to a plain overlay where Popover is missing.

## Structure

```
index.html          page + all content
css/styles.css      tokens, base, page chrome, hero, controls
css/games.css       stage, tabs and the four games
css/sections.css    impact, roster, how it works, FAQ, footer, receipt dialog
js/config.js        mode, limits, checkout hook
js/data.js          causes and charities
js/core.js          pure logic (money, RNG, pool, XP, badges); unit-tested in Node
js/store.js         player state in localStorage, with defensive loading
js/payments.js      the money step (demo or redirect)
js/audio.js         synthesised sound effects
js/confetti.js      confetti particle system
js/games/*.js       wheel, slots, drop, plinko
js/app.js           wires everything together
tests/              unit and end-to-end tests
```

## Credits

Fonts: Bricolage Grotesque and Inter (SIL Open Font License). Icons: Lucide (ISC). Licence texts are in
`assets/licenses/`.
