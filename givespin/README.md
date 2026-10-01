# GiveSpin

**The giving casino. Every round is a win for someone.**

Pick an amount, filter by the causes you care about, then spin, roll, scratch or race your way to a charity. Eleven
casino-style games, 228 charities, a lobby that feels like an online casino, confetti, levels and a receipt for
every gift. Built for streamers and anyone who thinks giving should be a little more fun.

Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, no network requests, no tracking.
It works from a web server or by double-clicking `index.html`.

```
cd givespin
python3 -m http.server 8000     # then open http://localhost:8000
```

> **Demo mode is the default.** Out of the box players get free demo credit, nothing is charged, no money moves,
> the banner says so, and every receipt is stamped DEMO. The account and saved-card screens are a **preview**: they
> do not work yet and never send, store or charge anything real. See [Going live](#going-live) before using real money.

## What's in it

**The lobby** has promo banners, category tabs (Originals, Table games, Instant wins), a tile for every game,
quick cause chips, your latest gifts and a "Repeat last round" shortcut. A side nav (a bottom bar on phones)
leads to My Giving, Charities, the Giving Club, Fair Play and Help. Search finds games and charities.

**Eleven games.** Every one is equal odds for every charity in play.

| Game | How it works |
| --- | --- |
| Lucky Wheel | Canvas wheel with chasing LED bulbs and a ticking, flicking pointer. |
| Slot Machine | Three reels, three charities; the gift splits across them. Three of a kind is a Triple Threat. |
| Drop Crate | A case-opening strip rolls past a marker and crawls to a stop. |
| Plinko | A ball ricochets through pegs into a charity's bin. Deliberately uniform (a real board favours the middle). |
| Roulette | Up to 16 pockets; the ball runs against the wheel and settles in a charity's pocket. |
| Pick a Card | Five face-down cards are shuffled; pick one and flip it. |
| Dice | A 3D die tumbles and lands on a face; every face on the board belongs to a charity. |
| Coin Flip Showdown | A knockout bracket of up to eight charities decided by coin flips. |
| Scratch Cards | Scratch the foil with a finger or mouse (or reveal by keyboard) to find three matching charities. |
| Charity Derby | Up to six charities race; the first across the line wins. |
| Lucky Draw | Balls tumble in a drum; one rolls out through the chute. |

**Setting up a gift:** any amount from $1 to $1,000 (presets, half and double buttons), a split into 1, 3, 5 or 10
rounds to the exact cent (no round may be under $1, so small gifts have fewer split options), a frequency (once,
weekly or monthly, as a preview plan), an optional dedication ("in honor of" or "in memory of", with a note), and a
payment method (demo credit or a preview saved card). You can also **give directly** to any charity, no luck
involved.

**Filters.** Causes (30, in six groups), who they help, where they work, how they help, when they were founded
and values (hide or show only faith-based, only charities with full profiles). Choices combine as OR within a
group and AND between groups, with a live count. The same filters drive every game. Filter values that fewer
than three charities have are hidden so a filter cannot just empty the pool.

**228 charities, each with a profile.** Tap any charity anywhere (a card, a receipt, My Giving, search, or a
`#charity-<id>` link) to see what it does, who it helps, where it works, how it helps, when it started, and a
**Visit website** link. Switch individual charities on or off for the games.

**My Giving** shows every charity you have given to, with totals, last gift date, a link to its profile and
website, a "Give again" button, a breakdown by cause, repeat gift plans and your recent rounds (each expandable,
with a verify button).

**Giving Club:** XP and 10 levels, a daily streak, 14 badges and a level ladder. Stored in the player's own
browser (`localStorage`) and resettable.

**Fair Play:** every winner is drawn from a committed seed before the animation starts. See
[How the games stay fair](#how-the-games-stay-fair).

**Optional account (preview).** Sign up with an email or a phone number and a password (strength meter, a
verify-code step, a display name), log in, save a card for easy giving, set a monthly giving limit. All of it is a
**mock-up**: the sign-up validates what you type and keeps a tiny profile in this browser, the password is never
stored, a saved card keeps only its type, last four digits and expiry, and nothing is sent anywhere or charged.
Never type a real card number into a preview. The sample card `4242 4242 4242 4242` is provided for testing.

**Demo credit.** In demo mode every player starts with $1,000 of play money that goes down as they give, with
"Add credit" top-ups. In live mode the credit pill, the banner and the pay-with field disappear.

**Stream Mode:** the TV button (or `?stream=1`) enlarges the game and hides everything else. Add
`&transparent=1` for a see-through background in an OBS browser source. The space bar plays.

**Polish:** synthesised sound effects (no audio files, mutable), confetti that draws above dialogs, reduced-motion
support, keyboard-operable everywhere, screen-reader announcements for results, a phone-friendly layout.

## Going live

Everything about real money lives in `js/config.js`.

- `mode: 'demo'` (default): simulated end to end.
- `mode: 'redirect'`: after the game picks a charity, the receipt shows a **Donate** button that opens a checkout
  page for that charity in a new tab. GiveSpin never sees card details and never holds funds. The player pays on
  the provider's own page.

To switch on redirect mode, set `mode: 'redirect'` and fill in `checkout.url(charity, cents, opts)` so it returns
an `https://` link for your donation platform (links that are not `https://` are ignored). `opts` carries the
chosen frequency (`once`, `weekly`, `monthly`) and any dedication. Add whatever per-charity field your builder
needs (for example a `slug`) to the entries in `js/data.js`. Charities without a link show a clear "no checkout
link set up" note instead of a button.

In redirect mode the site cannot know whether the player finished checkout, so it records the round as "sent to
checkout", not as a completed gift, and labels the stat that way.

**Accounts and cards are not real yet.** `js/accounts.js` is the one file to replace with calls to your own
backend (keep the `{ ok, message }` return shapes and the screens will not need to change). A real build must
handle passwords and cards on a server, through a payment provider's hosted fields, never in this page.

**Please read before launching:**

- **Legal.** Collecting donations and passing them to charities can trigger charitable-solicitation registration
  and money-transmission rules that vary by location. The redirect design is meant to leave payment handling with
  a regulated donation platform. Confirm the details with that platform (and a lawyer if you are unsure) before
  you promote the site. The "casino" look is a visual theme only: no one stakes anything and there is no prize.
- **Charity list.** The roster was researched from public sources, and short descriptions are paraphrases.
  194 entries have verified founding years, headquarters and descriptions. **34 entries are marked `unverified`**
  because they could not be fully checked: they carry a short generic description and no founding year or
  headquarters, say so on their profile, and can be excluded with the "full profiles only" filter. The charity
  hostnames in `js/data.js` were **not link-checked**. Verify that every entry is still active, accurate and one
  you are comfortable with, and that your checkout provider supports it.
- **Names and logos.** Charity names are used only to identify the organisations and no logos are used. The footer
  says GiveSpin is not affiliated with them. Keep it that way unless you have their permission.

## How the games stay fair

1. **Commit.** Before a round the page shows the SHA-256 hash of a secret round seed it has already chosen.
2. **Draw.** The app (not the game) draws every winner: HMAC-SHA256 of the round seed with your own seed and a round
   number, read as 32-bit numbers with rejection sampling (no modulo bias), applied to the charities in play sorted
   by id. That is exactly equal odds for the whole pool.
3. **Show.** The game then animates to the already-chosen winner. The slices, reels, bins, pockets, cards and runners
   on screen are decoration around that result: a sample of the pool that always includes the winner.
4. **Reveal.** After the round the seed is revealed. Hash it and compare with step 1, then recompute the draws. The
   Fair Play page and every receipt have a one-click verifier, and the Fair Play page also shows a standalone
   snippet you can paste into a browser console.
5. Split gifts use integer cents, so the parts always add up to the exact total (a $10.00 gift in 3 rounds is
   $3.34 + $3.33 + $3.33).

**Honest limits.** In this browser-only build the secret seed is generated on the same device that plays the game, so
the check shows how results are derived and that they were fixed before the animation. It is **not an audit by a
separate party**. A live deployment should generate and commit seeds on a server the player does not control and
publish the hashes. If the browser cannot run the hashing (it needs https or localhost), winners fall back to the
browser's random generator and the site makes no verifiability claim.

## Customising

| To change | Edit |
| --- | --- |
| Amount limits, presets, split options, minimum per round, demo credit, mode, checkout links | `js/config.js` |
| Causes, filter values and charities (names, descriptions, accent colours) | `js/data.js` |
| Colours, fonts, spacing | the `:root` tokens at the top of `css/base.css` |
| Level names, XP, badges | `LEVELS`, `xpForPlay` and `BADGES` in `js/core.js` |
| Sign-up, log-in and saved-card behaviour | `js/accounts.js` |
| Brand name and copy | `index.html` and `js/ui/` |

Each cause needs at least a few charities so a single-cause filter still plays well (the test suite checks this).

## Tests

```
node --test givespin/tests/core.test.js givespin/tests/fair.test.js givespin/tests/data.test.js
```

41 unit tests: money formatting and splitting, the minimum per round, the RNG and equal-odds argument, filters (OR
within a group, AND between), XP, levels, streaks, badges, email/phone/password/card/expiry validation, the fair-play
draw (cross-checked against Node's own HMAC, uniformity over 30,000 rounds, tampering is caught, the standalone
snippet matches), and the charity data (unique ids, valid vocabulary, short names and blurbs, bare hostnames, no
superlatives, minimum counts per cause and filter).

```
NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
```

About 320 end-to-end checks in headless Chromium (needs Playwright installed globally). They start their own static
server and drive the real UI: every game (and that **what is on screen matches the winner that gets recorded**),
real-speed card picking and scratching, split gifts and the minimum per round, amount validation, filters checked
against an independent computation, the charity directory and profiles, direct gifts, repeat plans and dedications,
My Giving, the whole account preview (including that no password or full card number ever reaches storage), demo
credit, the monthly limit, fair-play verification and tamper detection, stream mode, reduced motion, persistence,
live (redirect) mode including rejecting non-https links, a phone-sized viewport, loading from `file://`, and a check
that the site never contacts another host and the console stays clean. Set `SHOTS=/some/dir` to save screenshots,
and `AXE=/path/to/axe.min.js` to add an axe-core accessibility scan of every page and dialog.

Append `?fast=1` to the URL to squeeze every animation (the tests use it; it is handy for quick demos too).

## Browser support

Current Chrome, Edge, Safari and Firefox. The page uses `<dialog>`, the Popover API (for confetti above dialogs),
`color-mix()`, container query units and the Web Crypto API. Confetti falls back to a plain overlay where Popover is
missing.

## Structure

```
index.html          the page shell (top bar, side nav, empty views)
css/base.css        tokens, reset, buttons, forms, chips and other shared pieces
css/shell.css       top bar, side nav, layout, stream mode
css/views.css       lobby, game screen, My Giving, Club, Fair Play, Help, Charities
css/dialogs.css     modal frame, filters, profile, direct gift, account, credit, receipt
css/games.css       the eleven games
js/config.js        mode, limits, demo credit, checkout hook
js/data.js          causes, filter vocabulary and the 228 charities
js/core.js          pure logic (money, RNG, filters, XP, badges, validation); unit-tested in Node
js/fair.js          commit/reveal draws (HMAC-SHA256); unit-tested in Node
js/store.js         player state in localStorage, with defensive loading
js/payments.js      the money step (demo credit or redirect)
js/accounts.js      the account and saved-card PREVIEW
js/art.js           lobby tile artwork (inline SVG)
js/icons.js         inline Lucide icons
js/audio.js         synthesised sound effects
js/confetti.js      confetti particle system
js/games/*.js       wheel, slots, drop, plinko, roulette, cards, dice, coin, scratch, derby, lotto
js/ui/*.js          shared helpers, amount and gift options, filters, charities, account, receipt,
                    game screen, lobby, pages
js/app.js           boots everything, routing, top bar, search
tests/              unit and end-to-end tests
```

## Credits

Fonts: Sora and Inter (SIL Open Font License). Icons: Lucide (ISC). Licence texts are in `assets/licenses/`.
