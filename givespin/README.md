# GiveSpin

**The giving casino. Every round is a win for someone.**

Pick an amount, filter by the causes you care about, then spin, roll, scratch or race your way to a charity. Nineteen
casino-style games (five of them themed slot machines) where, in most of them, **you choose how many charities are on
the board** (from a couple to a thousand) and can back one to put on it, or tick exactly the charities you want, **live tables** where a whole table of players backs charities and the winner takes the whole pot,
leagues, crews, collectible cards and a daily wheel, 1,183 charities, a lobby that feels like an online casino,
confetti, levels and a receipt for every gift. Built for streamers and anyone who thinks giving should be a little
more fun.

Plain HTML, CSS and vanilla JavaScript. No build step, no dependencies, no network requests, no tracking.
It works from a web server or by double-clicking `index.html`. First-time visitors get a short, skippable tour that
explains what it is (a charity site with games on top, not a betting site) and that, in demo mode, everything in it is pretend.

```
cd givespin
python3 -m http.server 8000     # then open http://localhost:8000
```

> **Demo mode is the default.** Out of the box players get free demo credit, nothing is charged, no money moves,
> the banner says so, and every receipt is stamped DEMO. The account and saved-card screens are a **preview**: they
> do not work yet and never send, store or charge anything real. See [Going live](#going-live) before using real money.

## What's in it

**The lobby** has promo banners, a "live now" strip of tables, category tabs (Originals, Slots, Table games, Races,
Instant wins), a tile for every game, quick cause chips, your latest gifts and a "Repeat last round" shortcut. A
side nav leads to Slots, Live tables, Leagues, Crews, Your cards, My Giving, Charities, the Giving Club, Fair Play? and
Help. On a phone the side nav becomes a bottom bar with the five main places (Lobby, Live tables, My Giving, Charities
and Giving Club); the rest are reached from the footer links, the "More ways to play" quick links on the Live tables page,
and the tour. A daily wheel sits in the top bar. Search finds games and charities.

**Nineteen games.** Played solo, every charity on the board has equal odds. Ten of them also have live
tables (marked **Live** below), and every live game has seven table sizes.

| Game | Charities on the board | How it works |
| --- | --- | --- |
| Lucky Wheel (Live) | 2 to 1,000 slices | Canvas wheel with chasing LED bulbs and a ticking, flicking pointer. |
| Classic Slots | 3 to 12 reels | The original red-and-gold machine. Every reel is one charity and your gift splits across the reels. Three or more of the same charity is a Triple Threat. Bigger matches (four, five, six or more) get a bigger show and a win line drawn across the reels, and a **How it pays** button on every machine opens a plain-language paytable. All of that is display only: nothing pays you and every reel is an equal-odds draw. |
| Gold Rush | 3 to 12 reels (5 by default) | A mining-themed machine with drifting gold dust. |
| Deep Sea Treasure | 3 to 12 reels (5 by default) | An ocean machine with rising bubbles. |
| Sweet Charity | 3 to 12 reels (6 by default) | A candy-coloured machine with sprinkles. |
| Cosmic Spin | 3 to 12 reels (8 by default) | A space machine under a twinkling sky. |
| Drop Crate (Live) | 2 to 1,000 cards | A case-opening strip rolls past a marker and crawls to a stop. |
| Plinko (Live) | 2 to 1,000 bins | A ball ricochets through pegs into a charity's bin. Deliberately uniform (a real board favours the middle). Big boards are giant: the camera zooms out (more the bigger the board) and follows the glowing ball, with a long trail and a row counter, then zooms back in on the winning bin. |
| Roulette (Live) | 2 to 1,000 pockets | The ball runs against the wheel, rolls round every pocket and settles in a charity's. Past about a hundred pockets the wheel gets bigger than the screen so pockets stay about as wide as the ball: the camera pulls back while the ball flies and closes in as it settles. |
| Pick a Card | 2 to 100 cards | Cards are shuffled face down; pick one and flip it. |
| Dice | 6 faces | A 3D die tumbles and lands on a face. The six faces show six of the charities in play, always including the winner; the winner itself is drawn from all the charities in play, each with equal odds, so Dice has no board to set. |
| Coin Flip Showdown | 2 to 128 (a power of two) | A knockout bracket decided by coin flips. |
| Scratch Cards | 4 to 48 panels | Scratch the foil with a finger or mouse (or reveal by keyboard) to find matching charities. |
| Charity Derby (Live) | 2 to 1,000 runners | Charities race down lanes; the first across the line wins. |
| Duck Derby (Live) | 2 to 1,000 ducks | Rubber ducks bob down a river; each wears its charity's colour. |
| Marble Run (Live) | 2 to 1,000 marbles | Glass marbles tumble down a winding track. |
| Balloon Race (Live) | 2 to 1,000 balloons | Balloons climb to a finish line in the clouds. |
| Lucky Draw (Live) | 2 to 1,000 balls | Balls tumble in a drum; one rolls out through the chute. |
| Last One Standing (Live) | 2 to 1,000 tiles | Charities are knocked out wave by wave until one is left. |

**Charities on the board.** Games that can show more than a few charities have a **Charities on the board**
control: pick a preset or type any number, from a couple up to the game's maximum (above). Make it five or a thousand:
a Plinko board with a thousand bins that the camera follows the ball down, a roulette wheel with any number of
pockets, a river of 500 ducks. **The board is exactly what the winner is drawn from**, each charity on it with the
same chance, so a bigger board is a longer shot. If you ask for more spots than there are charities in play, charities
fill more than one spot (spread as evenly as possible, so odds stay equal). The receipt and the verifier record the
board. Sizes are remembered per game.

Four games stop sooner on purpose, because of what they are: Pick a Card is a table of face-down cards you tap (up to
100), a Scratch Card is one card with 4 to 48 panels, Coin Flip Showdown is a knockout bracket, so it takes a power of
two (up to 128), and Dice is one die, so it always has six faces. Anything bigger would be too crowded to read or tap, so
those limits are about the picture, not the fairness: the draw works the same at any size. The slot machines have 3 to 12
reels instead of a board. Every other game goes up to 1,000.

**Choose your own charities.** Every solo game has a **Choose your own charities** button. It opens a searchable
list: type a name, a cause ("animals"), a place or what a charity does, narrow it with the same filters as the rest of
the site (cause, where they work, who they help, how, when founded), read each charity's description and details, open
its own website, and tick the ones you want or choose everything that is showing. The limit is what the game can show
(up to 100 for Pick a Card, 1,000 for Roulette and Plinko). A **Custom charities** chip with a tick then appears on the game
screen: turn it off and on, edit it or remove it. While it is on the winner is drawn from exactly those charities
(each with equal odds) and your filters are paused for that game. The list is remembered per game.

**Slot machines.** The Slots category has five themed machines on one engine. Each reel is a round: you choose how
many reels (3, 4, 5, 6, 8, 10 or 12) and your gift is split evenly across them to the cent, one charity per reel.
There is a Turbo switch, a pair banner and a payline sweep when charities match, and the last reel slows down when it
would complete a match of three or more. The themes, blur and banners are show; every reel's charity is drawn fairly
before anything moves.

**Back a charity.** Eleven games have a **Back a charity** step: every game with a board to put a charity on, except
Pick a Card and Scratch Cards (where you already choose). Dice and the five slot machines have no board, so they have
no Back a charity step either. Pick any charity, or let the site choose one at random: backing it puts it on the board
if it was not already there, and marks it on the table (your duck wears a ring, your bin glows). Putting it on the
board is what gives it a chance (with 8 spots it has 1 in 8, instead of 1 in over a thousand for a charity that is not on
the board); once the board is set, every charity on it has exactly the same odds, yours included. If it wins you earn bonus XP that
grows with how long the shot was (a 1-in-1,000 pick is worth far more than a 1-in-8 one), and it counts towards the
Called It badge.

**Live tables.** See below.

**Setting up a gift:** any amount from $1 to $1,000 (presets, half and double buttons), a split into 1, 3, 5 or 10
rounds to the exact cent (no round may be under $1, so small gifts have fewer split options), a frequency (once,
weekly or monthly, as a preview plan), an optional dedication ("in honor of" or "in memory of", with a note), and a
payment method (demo credit or a preview saved card). You can also **give directly** to any charity, no luck
involved.

**Filters.** Causes (30, in six groups), who they help, where they work, how they help and when they were founded.
Choices combine as OR within a
group and AND between groups, with a live count. The same filters drive every game. Filter values that fewer
than three charities have are hidden so a filter cannot just empty the pool.

**1,183 charities, each with a profile** (see [Charities](#going-live) for where they came from). Tap any charity anywhere (a card, a receipt, My Giving, search, or a
`#charity-<id>` link) to see what it does, who it helps, where it works, how it helps, when it started, and a
**Visit website** link. Switch individual charities on or off for the games.

**My Giving** shows every charity you have given to, with totals, last gift date, a link to its profile and
website, a "Give again" button, a breakdown by cause, repeat gift plans and your recent rounds (each expandable,
with a verify button).

**Giving Club:** XP and 10 levels, a daily streak, 24 badges and a level ladder. Stored in the player's own
browser (`localStorage`) and resettable.

**Leagues, crews and cards.** All play, no cash value, and everything with other people is simulated and labelled.
- **Leagues.** A weekly XP table against 14 simulated rivals (the same table for everyone that week), with promotion
  and relegation zones, and **tiers** from Bronze to Diamond by level. Gold, Platinum and Diamond unlock VIP stakes
  ($250, $500, $1,000) at live tables. The **Charity Cup** is a three-round knockout of eight charities: you back one
  champion before it starts, and only a champion win pays XP (120 XP and the Cup Seer badge; never money).
- **Crews.** Join one of four simulated crews, chat with emotes (chat stays on your device), and work towards a
  weekly crew XP goal. Members' lines are scripted bots and say so.
- **Cards.** A card is collected for every winning charity: in solo rounds, in live pots you were in, and in direct
  gifts (a common card). The longer the shot, the rarer the card (common, rare, epic, legendary). Each month there is a
  six-card set; completing it pays 150 XP once.
- **Streaks.** Back winners on the trot to build a **hot hand**: a carried streak multiplies your XP gains (up to
  x1.5). A **daily wheel** gives one free spin a day for $5 to $100 of demo credit (demo mode only).

**Fair Play?** is the page that answers "is it rigged?" in plain language: a short version, a sealed-envelope explanation
of commit, draw and reveal, a glossary, a button that re-checks any past round, and (for the technically curious) a snippet
you can run yourself. See [How the games stay fair](#how-the-games-stay-fair) for the details.

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
- **Charity list.** There are 1,183 charities in four layers. The first 228 were researched from public sources and the next
  153 were each checked with web searches (the organisation exists, its official website, and its founding year and headquarters
  where the results stated them); the evidence links are in `docs/roster-sources.json`. The 40 entries that were first marked
  `unverified` were later each checked again with a search limited to the charity's own website, which confirmed all 40 exist at
  that address, filled in founding years and headquarters where the site stated them, and caught three renames (Little Kids Rock
  is now Music Will, The Actors Fund is now the Entertainment Community Fund, VH1 Save The Music is now the Save The Music
  Foundation). A later round of 141 (veterans and first responders, justice, mental health, abuse and safety, recovery) was checked the same way, with the evidence links in the same file; two of them are flagged `unverified` because a founding year or headquarters could not be confirmed. The remaining 661 come from two official government registers: the Charity Commission for England and Wales
  (registered charities that work internationally; 359 list the UK first) and the Australian Charities and Not-for-profits
  Commission (302 list Australia first). A register record confirms the charity exists, its official name, its website and its
  location, so those entries were not web-searched; the register number or ABN is in `docs/roster-sources.json`. Their
  descriptions are short, neutral paraphrases of the register text (for Australia, of the register's purpose flags), so they
  are plainer than the first 381, and `founded` is empty for most because the register gives a registration date rather than a
  founding date. About half of the register records that were considered were left out (universities and schools,
  professional and membership bodies, grant-making trusts, religious bodies whose purpose is mainly to advance a religion,
  think tanks, commercial arms, and records whose website belongs to a different brand). A charity that is run by a religious
  body but whose work is care (aged care, homelessness, children) stays and carries a faith-based flag. Facts can go out of date: registers and websites change, so re-check every entry (and
  its link) before using real money, and confirm each one is a charity you are comfortable with and that your checkout provider
  supports. `docs/roster-candidates.md` lists what was left out and what to check.
- **Names and logos.** Charity names are used only to identify the organisations. Where a charity has a simple logo it is
  shown instead of the coloured monogram circle (53 of them so far; `docs/logo-sources.md` lists each file and where it came
  from: either the picture the organisation chose for its own GitHub account, checked by eye, or the open `simple-icons`
  set). Everyone else keeps the monogram. `js/logos.js` lists which charities have a logo and `logos: false` in
  `js/config.js` turns them off. `node tools/fetch-logos.mjs` collects more from each charity's own website (touch icon or
  favicon) into `assets/logos/`; it needs an open internet connection, which the build environment did not have. A
  logo is the charity's trademark: showing it to identify the organisation is common, but it can look like an
  endorsement and some charities have brand rules or ask for permission, so check before you keep any. The footer says
  GiveSpin is not affiliated with the charities. Games drawn on a canvas (wheel, roulette, Plinko, the races) keep the
  monogram either way.

## Live tables

Open **Live tables** (or the "live now" strip in the lobby) to take a seat at a shared pot. There is a table for
every live game and a new round every minute or so.

1. **Back a charity.** Put up a stake ($5, $10, **$20 by default**, $50, $100 or any whole-dollar amount) on any
   charity. A small table holds up to 8 charities (more at the big tables); back one already there or open a gate for another.
2. **Watch the odds move.** The odds board shows who has backed what, how many players are behind each charity, and
   each charity's chance of winning. Every dollar is one ticket, so a charity with 30% of the pot wins 30% of the time.
   You can take your bet back until the table locks.
3. **One charity takes the whole pot.** Bets close, the winner is drawn, the race, wheel or drop plays out, and
   **the whole pot goes to the winning charity, whether you backed it or not**. Your own stake is allocated to the
   winner too, so it is as if your charity won. The result shows the pot, the winner's chance and the verification
   details. Backing the winner earns bonus XP and the Called It badge; joining a $500 pot earns Pot of Gold.

**The other players are bots.** For now every other seat is a simulated player standing in for a real multiplayer
table, and every screen says so: a "simulated table" banner, a BOT tag on every bot in the feed, "bots simulated" on
the table bar, and "came from simulated bots" on the result. Their stakes are simulated too. Only your own stake is
yours, and in demo mode that is demo credit. A stake is taken when you place it, refunded if you cancel before the
table locks, and refunded if you close the page before the round settles.

**Extras at the table.** All simulated, all labelled:
- **Sponsor match.** About one table in seven has a simulated sponsor who adds 50% of the pot (up to $100) to what the
  winner receives. The result shows the stakes, the match and who the sponsor was as separate lines.
- **Progressive jackpot.** Every settled pot adds 5% to a simulated jackpot. Once it passes $1,500 it drops at the next
  table, goes to that table's winner on top of the pot, and starts again. A siren sounds when it lands.
- **Events.** Featured events run off the clock (they come from `eventAt()` in `js/live.js`): Giving Tuesday Jackpot
  (all day Tuesday; a simulated sponsor matches the pot dollar for dollar up to $250), Disaster Relief Night (from 6 pm;
  disaster-relief and health charities only, 50% matched up to $150) and a Double Pot Hour in the first quarter of every
  hour (dollar for dollar up to $200).
- **Drama.** A **last call** warns that bets are closing, an **all-in** stake asks you to confirm, the table says how
  close the finish was, and close races end in a slow-motion **photo finish**. A **croupier voice** (the browser's own
  speech, off by default) calls the action.
- **Side predictions.** Before the lock you can make XP-only predictions: the pot reaches $500, the winner has under
  25% of the pot, the leading charity wins. Right calls earn the Oracle badge.
- **Stream chat vote.** Turn on "chat vote" and simulated chatters vote for charities while bets are open; the most
  voted charity gets a simulated $25 stake when bets close. It is a way to try how a streamer's audience could take a
  seat, with no real chat connected.
- **Crews.** If you are in a crew, two or three of its simulated members back the same charity as you with small
  simulated stakes ($5 to $20 each), and the feed says so.

**Every live game is a lobby of seven tables.** On the Live tables page you pick a game, then a table: 5, 10, 25, 50,
100, 200 or 1,000 spots (Mini, Small, Classic, High, Big, Giant, Mega). A spot is a bin in Plinko, a slice on the
wheel, a pocket in roulette, a card in the drop crate, a ball in the lucky draw, a runner, duck, marble or balloon in the
races, and a tile in Last One Standing. Each table has its own pot, players and rounds, and you can hop between a game's
tables from a bar inside the table. The charities players back (the gates: 5 at the smallest table, 30 at the biggest) go
on the board, and the remaining spots are **filled in at random from the catalog** so the board is always the full size;
if the catalog has fewer charities than spots they repeat evenly. Only backed charities hold tickets, so only they can
win: the others are scenery (thin slivers on the wheel, runners with no percentage, faded bins). Bigger tables have more
bots and a longer show (the 1,000-spot tables take about 27 to 44 seconds to play out, depending on the game). All 70 tables run at once, and a game's
`#live-<game>` link opens its Small (10-spot) table.

**Live tables are demo-only.** A pooled pot needs a server to hold the money and run the table, and this site never
handles real money, so in `redirect` mode the live tables are switched off and hidden. To make them real you would
run the tables, seeds and pots on a server and replace the bots in `js/live.js` with players.

Timings (betting window, lock, result), bot names and stake sizes, and the table size are constants at the top of
`js/live.js`.

## How the games stay fair

1. **Commit.** Before a round the page shows the SHA-256 hash of a secret round seed it has already chosen.
2. **Draw.** The app (not the game) draws every winner: HMAC-SHA256 of the round seed with your own seed and a round
   number, read as 32-bit numbers with rejection sampling (no modulo bias), applied to **the charities on the board**
   sorted by id. That is exactly equal odds for every charity on the board. The board is recorded with the round
   (`fair.board`), so the verifier and the standalone snippet can redo the draw from just the board. This browser keeps the
   whole board of each of your last 60 rounds, even a board of 1,000 (stored compactly: about 3 KB a round), so any of
   them can still be re-checked after a reload.
3. **Show.** The game then animates to the already-chosen winner. The slices, reels, bins, pockets, cards and runners
   on screen are the board itself (the charities the winner was drawn from, repeated to fill extra spots), so what you
   see is what was drawn from.
4. **Reveal.** After the round the seed is revealed. Hash it and compare with step 1, then recompute the draws. The
   Fair Play page and every receipt have a one-click verifier, and the Fair Play page also shows a standalone
   snippet you can paste into a browser console.
5. Split gifts use integer cents, so the parts always add up to the exact total (a $10.00 gift in 3 rounds is
   $3.34 + $3.33 + $3.33).
6. **Live tables are stake-weighted.** The table commits to a seed (and shows its hash) before bets open. When bets
   close the pot is frozen into tickets, one per dollar, laid out in charity-id order, and the same HMAC-SHA256
   stream picks one ticket; the charity that owns it wins. That is the same uniform draw as above, over a list in
   which each charity id appears once per dollar staked. The receipt stores the frozen pot, so a live round can be
   verified (hash, pot, winner) from the result, My Giving or Fair Play, and a changed pot or seed fails the check.

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
| Colours, fonts, spacing | the `:root` variables at the top of `css/base.css` |
| Level names, XP, badges, tiers, card rarity | `LEVELS`, `xpForPlay`, `BADGES`, `TIERS` and `RARITIES` in `js/core.js` |
| Live-table timings, bots, sponsor and jackpot | the constants at the top of `js/live.js` |
| Live-table events (Giving Tuesday, Disaster Relief Night, Double Pot Hour) | `eventAt()` in `js/live.js` |
| Crews and their chat | `js/crews.js` |
| Daily wheel segments | `js/ui/collection.js` |
| Sign-up, log-in and saved-card behaviour | `js/accounts.js` |
| Brand name and copy | `index.html` and `js/ui/` |

Each cause needs at least a few charities so a single-cause filter still plays well (the test suite checks this).

## Tests

```
node --test givespin/tests/core.test.js givespin/tests/fair.test.js givespin/tests/data.test.js givespin/tests/store.test.js givespin/tests/readme.test.js
```

81 unit tests: money formatting and splitting, the minimum per round, the RNG and equal-odds argument, filters (OR
within a group, AND between), XP, levels, streaks, badges, boards of any size (fill spots evenly, always include the
backed charity), the bonus for backing a long shot, apportioning pockets and slices by stake, the stake-weighted draw
(ticket ownership, hashes, uniformity, tampering), tiers and VIP stakes, card rarity and the monthly set, the weekly
league and the Charity Cup field, email/phone/password/card/expiry validation, the fair-play draw (cross-checked
against Node's own HMAC, uniformity over 30,000 rounds, tampering is caught, the standalone snippet matches), and the
charity data (unique ids, valid vocabulary, short names and blurbs, bare hostnames, no superlatives, minimum counts per
cause and filter), and saved rounds (a board of 300, 301 or 1,000 charities comes back whole after a reload and still
verifies, older saves still load, and the saved text stays small), and this README (the roster size, the board sizes per game, the unit-test count and command, the file list and the wording rules are all checked against the code).

```
NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
```

About 780 end-to-end checks in headless Chromium (needs Playwright installed globally). They start their own static
server and drive the real UI: every game (and that **what is on screen matches the winner that gets recorded**),
the first-visit tour, the choose-your-own-charities dialog, all five slot machines (up to twelve reels, Triple Threat), every game at its biggest board, the big Roulette wheel and the Plinko camera, backing a charity, live tables (the lobby of seven table sizes for every live game, stakes, refunds, the whole pot, the extras, every live game), leagues, the Charity Cup, cards, crews and the daily wheel, real-speed card picking and scratching, split gifts and the minimum per round, amount validation, filters checked
against an independent computation, the charity directory and profiles, direct gifts, repeat plans and dedications,
My Giving, the whole account preview (including that no password or full card number ever reaches storage), demo
credit, the monthly limit, fair-play verification and tamper detection, stream mode, reduced motion, persistence,
live (redirect) mode including rejecting non-https links, a phone-sized viewport, loading from `file://`, and a check
that the site never contacts another host and the console stays clean. Set `SHOTS=/some/dir` to save screenshots,
and `AXE=/path/to/axe.min.js` to add an axe-core accessibility scan of every page and dialog.

Append `?fast=1` to the URL to squeeze every animation (the tests use it; it is handy for quick demos too).

## Browser support

Current Chrome, Edge, Safari and Firefox. The page uses `<dialog>`, the Popover API (for confetti above dialogs),
`color-mix()`, container query units and the browser's built-in HMAC-SHA256 hashing (for Fair Play). Confetti falls back to a plain overlay where Popover is
missing.

## Structure

```
index.html          the page shell (top bar, side nav, empty views)
css/base.css        design variables, reset, buttons, forms, chips and other shared pieces
css/shell.css       top bar, side nav, layout, stream mode
css/views.css       lobby, game screen, My Giving, Club, Fair Play, Help, Charities
css/dialogs.css     modal frame, filters, profile, direct gift, account, credit, receipt
css/games.css       the games
css/live.css        live tables, leagues, crews, cards, the daily wheel and the back-a-charity picker
css/chooser.css     the choose-your-own-charities dialog and its chip
css/slots.css       the slot machines and their five themes
css/tour.css        the first-visit tour
js/config.js        mode, limits, demo credit, checkout hook
js/data.js          causes, filter vocabulary and the 1,183 charities
js/core.js          pure logic (money, RNG, filters, XP, badges, validation); unit-tested in Node
js/fair.js          commit/reveal draws (HMAC-SHA256); unit-tested in Node
js/store.js         player state in localStorage, with defensive loading
js/payments.js      the money step (demo credit or redirect)
js/accounts.js      the account and saved-card PREVIEW
js/util.js          small shared helpers for the games and the UI (maths, timing, escaping, the ?fast=1 speed-up)
js/kit.js           shared game toolkit: board samples that include the winner, the race choreography
js/live.js          live tables: rooms, rounds, bots, stakes, events, sponsor match, jackpot and the weighted draw (no DOM)
js/crews.js         simulated crews: members, chat lines, emotes, weekly goal
js/art.js           lobby tile artwork (inline SVG)
js/icons.js         inline Lucide icons
js/audio.js         synthesised sound effects
js/confetti.js      confetti particle system
js/games/*.js       the games; crowd.js is the engine behind Duck Derby, Marble Run and Balloon Race, and slots.js is one engine behind the five slot machines
js/ui/*.js          shared helpers, amount and gift options, filters, charities, account, receipt,
                    charity picker and the choose-your-own-charities dialog (picker.js, chooser.js), live tables, game
                    screen, lobby, pages, cards and daily wheel (collection.js), leagues and crews (leagues.js),
                    the first-visit tour (tour.js)
js/logos.js         which charities have a logo file (53 so far)
tools/              fetch-logos.mjs: collects more charity logos from their own websites
assets/logos/       the logo files (see docs/logo-sources.md)
assets/favicon.svg  the browser-tab icon
assets/fonts/       the Sora and Inter font files (loaded from here, never from another site)
assets/licenses/    the licence texts for the fonts and the icons
docs/               roster-sources.json (evidence for the added charities), roster-candidates.md (what was left out), logo-sources.md
js/app.js           boots everything, routing, top bar, search
tests/              unit and end-to-end tests
```

## Credits

Fonts: Sora and Inter (SIL Open Font License). Icons: Lucide (ISC). Licence texts are in `assets/licenses/`.
