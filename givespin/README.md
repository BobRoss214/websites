# GiveSpin

**The giving casino. Every round is a win for someone.**

Pick an amount, filter by the causes you care about, then spin, roll, scratch or race your way to a charity. Nineteen
casino-style games (five of them themed slot machines) where, in most of them, **you choose how many charities are on
the board** (from a couple to 500) and can back one to put on it, or tick exactly the charities you want, **live tables** where a whole table of players backs charities and the winner takes the whole pot,
leagues, crews, collectible cards and a daily wheel, 500 charities, a lobby that feels like an online casino,
confetti, levels, ranks with their own emblems and a receipt for every gift. Built for streamers and anyone who thinks giving should be a little
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
Instant wins), a tile for every game, quick cause chips, your latest rounds and a "Repeat last round" shortcut. A
side nav leads to Slots, Live tables, Leagues, Crews, Your cards, My Giving, Charities, the Giving Club, Fair Play? and
Help. On a phone the side nav becomes a bottom bar with the five main places (Lobby, Live tables, My Giving, Charities
and Giving Club); the rest are reached from the footer links, the "More ways to play" quick links on the Live tables page,
and the tour. A daily wheel sits in the top bar. Search finds games and charities.

**Nineteen games.** Played solo, every charity on the board has equal odds. Ten of them also have live
tables (marked **Live** below), and every live game has seven table sizes.

| Game | Charities on the board | How it works |
| --- | --- | --- |
| Lucky Wheel (Live) | 2 to 500 slices | Canvas wheel with chasing LED bulbs and a ticking, flicking pointer. |
| Classic Slots | 3 to 12 reels | The original red-and-gold machine. Every reel is one charity and your gift splits across the reels. Three or more of the same charity is a Triple Threat. Bigger matches (four, five, six or more) get a bigger show and a win line drawn across the reels, and a **How it pays** button on every machine opens a plain-language paytable. All of that is display only: nothing pays you and every reel is an equal-odds draw. |
| Gold Rush | 3 to 12 reels (5 by default) | A mining-themed machine with drifting gold dust. |
| Deep Sea Treasure | 3 to 12 reels (5 by default) | An ocean machine with rising bubbles. |
| Sweet Charity | 3 to 12 reels (6 by default) | A candy-coloured machine with sprinkles. |
| Cosmic Spin | 3 to 12 reels (8 by default) | A space machine under a twinkling sky. |
| Drop Crate (Live) | 2 to 500 cards | A case-opening strip rolls past a marker and crawls to a stop. |
| Plinko (Live) | 2 to 500 bins | A ball ricochets through pegs into a charity's bin. Deliberately uniform (a real board favours the middle). Big boards are giant: the camera zooms out (more the bigger the board) and follows the glowing ball, with a long trail and a row counter, then zooms back in on the winning bin. |
| Roulette (Live) | 2 to 500 pockets | The ball runs against the wheel, rolls round every pocket and settles in a charity's. Past about a hundred pockets the wheel gets bigger than the screen so pockets stay about as wide as the ball: the camera pulls back while the ball flies and closes in as it settles. |
| Pick a Card | 2 to 100 cards | Cards are shuffled face down; pick one and flip it. |
| Dice | 6 faces | A 3D die tumbles and lands on a face. The six faces show six of the charities in play, always including the winner; the winner itself is drawn from all the charities in play, each with equal odds, so Dice has no board to set. |
| Coin Flip Showdown | 2 to 128 (a power of two) | A knockout bracket decided by coin flips. |
| Scratch Cards | 4 to 48 panels | Scratch the foil with a finger or mouse (or reveal by keyboard) to find matching charities. |
| Charity Derby (Live) | 2 to 500 runners | Charities race down lanes; the first across the line wins. |
| Duck Derby (Live) | 2 to 500 ducks | Rubber ducks bob down a river; each wears its charity's colour. |
| Marble Run (Live) | 2 to 500 marbles | Glass marbles roll, bump and overtake down a winding track (a small physics race that is worked out first, with the drawn charity's marble in the place that crosses first), on a track you choose (see **Tracks** below). |
| Balloon Race (Live) | 2 to 500 balloons | Balloons climb to a finish line in the clouds. |
| Lucky Draw (Live) | 2 to 500 balls | Balls tumble in a drum; one rolls out through the chute. |
| Last One Standing (Live) | 2 to 500 tiles | Charities are knocked out wave by wave until one is left. |

**Charities on the board.** Games that can show more than a few charities have a **Charities on the board**
control: pick a preset or type any number, from a couple up to the game's maximum (above). Make it five or five hundred:
a Plinko board with 500 bins that the camera follows the ball down, a roulette wheel with any number of
pockets, a river of 500 ducks. **The board is exactly what the winner is drawn from**, each charity on it with the
same chance, so a bigger board is a longer shot. If you ask for more spots than there are charities in play, charities
fill more than one spot (spread as evenly as possible, so odds stay equal). The receipt and the verifier record the
board. Sizes are remembered per game.

**Tracks (Marble Run).** Marble Run has more than one track. The **Track** box in the game panel shows a small picture of each
one: tap a picture to race on it, or choose **Surprise me** for a different track every round (it says which one comes next).
The box can be folded up to one line, the choice is remembered on this device, and it can be changed between rounds but not
while the marbles are rolling. A track changes the shape and the feel of the race, never the odds: the winner is drawn first,
from the charities on the board, each with exactly the same chance, and the marbles are then played out on whichever track is
showing. Any race game can offer such a choice by giving its description a `variants` entry (the comment at the top of
`js/games/crowd.js` says how); the picker itself is `js/ui/variants.js`. To write another Marble Run track, see `docs/marble-maps.md`.

**One screen per game.** Opening a game puts the game, the gift choices (amount, split, board size, back a charity) and the Play
button together on the first screen, on a phone and on a laptop, so nobody has to scroll to start a round. The picture is shrunk
to fit the window when it has to be (never below half size on a laptop or a phone held upright, about a third on a phone held
sideways; `fitStage` in `js/ui/game.js` does it with a CSS scale, which the games already allow for when they work out where a click
landed). On a wide screen the gift panel sits beside the picture with
Play right under the choices every round needs, pinned to the bottom of the panel if the window is short; "Charities in play" and the
gift options come after it. On a phone the panel is docked at the bottom of the screen with the amount presets and Play, and the
**Options** button opens everything else as a sheet over the picture. Held sideways (or in any short window up to 900 px wide) the panel
is a narrow column beside the picture that scrolls inside itself with Play kept at its bottom. Turning the phone or resizing the window
while a game is open refits the picture; the choices are kept. In a window under 561 px wide that is also under 521 px tall (a small phone held
sideways, a phone with its keyboard open) the panel stays docked, the top bar and the navigation bar are kept thin, and the picture is fitted to the room between
them (as small as a sixth of its size); Play and the amount buttons are always in the dock, and pressing Play scrolls the picture into view above it. Everything about
the game (the tabs, more games) is below, as before. The rules are in `css/fit.css`.

**Live tables follow it too** (all seventy of them: see "A table fits on one screen" under Live tables). The picture, your stake and the
join button are on the first screen in the same three layouts: on a laptop the odds board sits beside the picture with the stake and the join
button pinned under it; on a phone the stake buttons, **Options** and the join button are docked, the board is in the sheet, and "Pick a charity"
opens the sheet at the board. A table can have up to 500 spots, so its picture may be shrunk further than a solo game's (to about a quarter of its size, and
to a fifth on the smallest phone held sideways, where the page's own bars leave very little room; there the panel is wider and the odds board shows
two to four rows). When a round ends the page scrolls to the result
card, and it comes back up when the next round opens. The rules are the block for `#view-game.is-live` at the end of `css/fit.css`.

Four games stop sooner on purpose, because of what they are: Pick a Card is a table of face-down cards you tap (up to
100), a Scratch Card is one card with 4 to 48 panels, Coin Flip Showdown is a knockout bracket, so it takes a power of
two (up to 128), and Dice is one die, so it always has six faces. Anything bigger would be too crowded to read or tap, so
those limits are about the picture, not the fairness: the draw works the same at any size. The slot machines have 3 to 12
reels instead of a board. Every other game goes up to 500.

**Choose your own charities.** Every solo game has a **Choose your own charities** button. It opens a searchable
list: type a name, a cause ("animals"), a place or what a charity does, narrow it with the same kinds of filters as the rest of
the site (cause, where they work, who they help, how, when founded; here they only help you search the list), read each charity's description and details, open
its own website, and tick the ones you want or choose everything that is showing. The limit is what the game can show
(up to 100 for Pick a Card, 500 for Roulette and Plinko). A **Custom charities** chip with a tick then appears on the game
screen: turn it off and on, edit it or remove it. While it is on the winner is drawn from exactly those charities
(each with equal odds) and your game filters (see Filters below) are paused for that game. The list is remembered per game.

**Slot machines.** The Slots category has five themed machines on one engine. Each reel is a round: you choose how
many reels (3, 4, 5, 6, 8, 10 or 12) and your gift is split evenly across them to the cent, one charity per reel.
There is a Turbo switch, a pair banner and a payline sweep when charities match, and the last reel slows down when it
would complete a match of three or more. The themes, blur and banners are show; every reel's charity is drawn fairly
before anything moves.

**Back a charity.** Eleven games have a **Back a charity** step: every game with a board to put a charity on, except
Pick a Card and Scratch Cards (where you already choose). Dice and the five slot machines have no board, so they have
no Back a charity step either. Pick any charity, or let the site choose one at random: backing it puts it on the board
if it was not already there, and marks it on the table (your duck wears a ring, your bin glows). Putting it on the
board is what gives it a chance (with 8 spots it has 1 in 8, instead of about 1 in 500 for a charity that is not on
the board); once the board is set, every charity on it has exactly the same odds, yours included. If it wins you earn bonus XP that
grows with how long the shot was (a 1-in-500 pick is worth far more than a 1-in-8 one), and it counts towards the
Called It badge.

**Live tables.** See below.

**Setting up a gift:** any amount from $1 to $1,000 (presets, half and double buttons), a split into 1, 3, 5 or 10
rounds to the exact cent (no round may be under $1, so small gifts have fewer split options), a frequency (once,
weekly or monthly, as a preview plan), an optional dedication ("in honor of" or "in memory of", with a note), and a
payment method (demo credit or a preview saved card). You can also **give directly** to any charity, no luck
involved.

**Filters.** Causes (30, in six groups), who they help, where they work, how they help and when they were founded.
Choices combine as OR within a group and AND between groups, with a live count. Filter values that fewer than three
charities have are hidden so a filter cannot just empty the pool. There are two Filters dialogs and they do different jobs:

- **Game filters** ("Filters for games") are opened with the Filters button on the lobby and on the game screen (the quick
  cause chips next to it set the same filters). They choose which charities can come up when you play. They are saved on the
  device, they drive every game (except one where you chose your own charities), and they set the "N of 500 charities in play"
  line. Live tables follow them too, with two exceptions: a table needs at least 8 charities in play (with fewer it seats
  from the whole roster), and during a featured event such as Disaster Relief Night the table seats that event's charities
  whatever the filters say. The main button reads "Play with N charities".
- **Charities-page filters** ("Filter the charities") are opened from the Filters button on the Charities page. They only
  narrow the list you are looking at, together with the search box and the All / In play / Switched off / I've given tabs.
  They never change which charities the games use, they are not saved (they are kept while you move around the site, and
  cleared on a reload), and the main button reads "Show N charities". The chosen filters also show as removable chips under
  the toolbar, with a "Clear filters" link. If you want the games to use the same filters, the dialog has a separate
  **Use these filters in games** button; it is switched off when no filter is chosen, when the games already use exactly
  these filters, when fewer than 2 charities would be left to play with, and while a round is in progress.

**500 charities, each with a profile** (see [Charities](#going-live) for where they came from). Tap any charity anywhere (a card, a receipt, My Giving, search, or a
`#charity-<id>` link) to see what it does, who it helps, where it works, how it helps, when it started, and a
**Visit website** link. Switch individual charities on or off for the games.

**The Charities page** (the globe in the side nav) lists all 500 as cards. Search by name, cause, place or what they do, look
through them with the page's own Filters (they only narrow the list, see Filters above), pick a tab (All, In play, Switched off,
I've given) and sort them. A line under the toolbar reads "Showing N of 500 charities · M in play in games": the first number is
what you are looking at, the second is how many charities the games can currently draw from. **In play** means a charity can come up
in a game: the switch on each card turns it off or on, and a card the game filters leave out says "Outside game filters".

**My Giving** shows every charity you have given to, with totals, last gift date, a link to its profile and
website, a "Give again" button, a breakdown by cause, repeat gift plans and your recent rounds (each expandable,
with a verify button).

**Giving Club:** XP and 10 levels, then eight ranks, a daily streak, 24 badges and a level ladder. Stored in the player's own
browser (`localStorage`) and resettable.

**XP is a receipt for giving: every $1 given earns 10 XP**, in any game, with no cap and nothing extra for splitting a gift
(`xpForGift` in `js/core.js`). It cannot be bought on its own, cannot be lost in a game and never turns back into money or
anything with a cash value; it unlocks levels, the weekly league and its tiers, and cards. Bonuses are added on top and the
receipt shows them separately from the gift's XP: backing the winning charity, a Triple Threat, a finished card set, a hot hand
and right side predictions. The levels sit on round giving milestones (level 2 at 100 XP, about $10 given; level 10 at
9,000 XP, about $900). In demo mode the dollars are pretend, so the XP is too.

**Ranks come after level 10.** Once a player has given $1,000 in total they earn a rank, with an emblem that shows next to
their name wherever a name is shown (the live tables' feed, the weekly league, a crew's mates and chat, the account button,
menu and card), and the receipt and the Giving Club show it too. There are eight, in this order: Patron ($1,000), Benefactor ($5,000),
Champion ($10,000), Guardian ($20,000), Paragon ($50,000), Luminary ($100,000), Titan ($500,000) and Immortal
($1,000,000). Every rank has its own levels 1 to 10, spread evenly over the dollars up to the next rank (`RANKS`,
`rankFor` and `standingFor` in `js/core.js`), so a player can be "Rank 2 · Level 6" (rank 2 covers $5,000 to $10,000, so
its level 6 starts at $7,500); before $1,000 they are simply "Level 7". The top rank has no next rank, so its levels step
every $100,000 and it is maxed from level 10, at $1,900,000. A rank comes from the total given, in whole cents, so it is
worked out each time and never stored: an older save simply has the rank its total gives it, and it only goes up (until the player resets their progress).
Like XP it is a receipt for giving, not money: it cannot be bought and unlocks nothing with a cash value, and in demo
mode the dollars are pretend, so it is too. XP still drives the league tiers and the live-table stakes. When a round or a
live result takes the total across a rank boundary there is a short celebration (the emblem big, "You reached Rank 1:
Patron", the next goal, confetti and a fanfare; it is calmer with reduced motion and silent when the sound is off); a new
level inside a rank gets a lighter one. Everyone else on those pages is a simulated bot, and so is their rank: `botStanding` gives each bot name a
made-up rank that never changes (about 55% have none, then fewer and fewer at each rank; the live tables only have 60 handles, so two of them, `BOT_RANK_PINS`, are
given Luminary and Immortal by name so the top emblems are seen now and then), next to its BOT tag. The emblems
are drawn by `js/ranks.js` and `css/ranks.css`, the screens are `js/ui/rankui.js` and `css/rankui.css`.

**My profile (`#me`).** The visitor's own page, reached from the level card in the side nav, from "My profile" in the account menu and from a button on the
Giving Club page (the Giving Club itself stays in the nav, and the profile links to it). A big rank emblem (the ring of ten levels round it, or a level medal before the first
rank) sits inside the **emblem frame** they chose, with their name, their **title**, "Rank 2 · Level 6" and the bar to the next level. Under it: total given, streak and
best streak, rounds and charities, the **favourite causes and favourite charities** (the three each with the most rounds, worked out from the saved rounds, which is the latest 60), the
cards held and monthly sets finished, all 24 badges (the locked ones dimmed, each with how to earn it), the last eight gifts, and a **Share my profile** button that
only appears when the share cards are built (`ui.sharecard.openProfile`). "Make it yours" holds the **display name** (1 to 20 characters: letters, numbers, spaces and
simple punctuation, no links, no `<` or `>`, and nothing from a small block-list of rude words) and the pickers for frame and title. There are eight frames (plain, laurel, flame, halo,
stars, hexagon, diamond, sunburst; CSS and SVG only, still when the visitor prefers reduced motion) and eight titles; every one is listed with a plain "how to unlock" line
and is open only when the saved game says so (the total given, a streak, a rank, badges, cards or a finished card set), so a locked one is never hidden. The name, frame and
title live under `GS.local` 'profile' (never in the main save), are only shown on this device and on the cards the visitor shares, and are erased with "Erase my data". Where the
visitor's own name is shown (the account button and menu, the league's "(you)" row) it is `ui.displayName()`: the name chosen here, else the signed-in account's, else nothing;
the "You" of a live table's feed and of a crew's chat only changes once a name has been chosen. A later feature adds frames and titles with `GS.profileFrames.add({ id, name,
description, how, unlocked(facts, save) })` and `GS.profileTitles.add(...)`. **Simulated players have profiles too:** a bot's name at a live table, in the league and in a crew is a
button (`ui.botName(name)`), and it opens a read-only dialog (`ui.profile.openBot(name)`) with the bot's emblem and "Rank X · Level Y" and the line **BOT: a simulated player.
Everything here is made up.**, plus a made-up title, favourite cause, favourite game, habit and "pretend streak" worked out from the name alone. The rules are in `js/profile.js`, the
page in `js/ui/profile.js` and `css/profile.css`.

**Leaderboards (`#boards`).** Crews, charities and players ranked, for **This week** and **All time**, from the Leaderboards link in the side menu (and a "This week's leaders" block on the lobby, the top three crews, in demo mode). Three tabs (a real tablist: arrow keys, Home and End) and a This week / All time toggle; each list is a real table with the top ten, then the visitor's own row at its real rank when it is further down ("You are #38 of 61"). **Everything except the visitor's own numbers is simulated and says so**: a note at the top, "simulated" in every table's label, a BOT pill beside every bot and crew, and the same rank chips as everywhere else. There is no server, so every number is a pure function of the clock (`js/boards.js`, unit-tested): the week is the ISO week in local time (Monday to Sunday) cut into 672 slots of about 15 minutes; inside a slot the numbers are fixed, through the week they only grow (each one is its final number for the week times a shared busy-evening curve raised to a small seeded power, so a lead can change hands), and on Monday a new week starts small. A bot's all-time total is one fixed made-up amount that sits inside the rank and level its chip shows (the Rank 3 Level 5 bot really has given an amount that is Rank 3 Level 5), and its week is a small share of that. **Crews**: a crew's total is exactly what its seven bot members gave (the same numbers as on the Players tab) plus the visitor's own gifts if they have joined it; each crew has a **weekly goal in dollars** (a bar and the words "$X of $Y", never under $250, worked out from what its bots will have given by Sunday), and a visitor with no crew can join one from the table (the same call as on the Crews page; leaving is on the Crews page). **Share my crew** draws a picture of the crew's week (name, rank, total, goal bar; a gold frame when the goal is reached) in the same style as the share cards, with Download PNG, Share and Copy; it carries no name of yours. **Charities** are ranked by times backed (a gift landing on a charity, in any game): a made-up count from a fixed popularity plus the times the visitor's own gifts landed on it, and the page says it is not a ranking of how good a charity is or an endorsement. The visitor's numbers come from the saved history (this week's rounds; the store keeps the latest 60, and the page says when that may be short) and the saved totals: nothing is added to the save, nothing is stored. The page is demo-friendly in real-donation mode too (it says the visitor's numbers then count what was sent to checkout) but the lobby block is demo-only, like the ticker. Help has an answer, "What are the leaderboards?" (`#help-boards`).

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

**The voice.** The whole site speaks one voice: a casino, but it is for charity. "House edge: 0%. The house is a charity." is on the lobby, Fair Play and Help;
the jackpot is a **Triple Threat**; the Giving Club is the **VIP lounge**; the monthly giving limit lives in **Responsible giving**; money only ever goes
**out** ("give out", never "cash out"); loading lines and empty states have a little personality; and Help has the honest answer to **"How we make money: we do not."**
The style guide, with the vocabulary and example lines, is `docs/voice.md`; it is parody only, never mean, and never implies real money.

**The ticker and the charity of the week.** A slim bar under the top bar, on the lobby and the Live tables pages only, shows **Given today** and a
feed of recent gifts ("LuckyLark gave $25 to WaterAid", each bot with its rank chip and a BOT tag). All of it comes from **simulated players**, says so
on the bar, in its tooltip and in Help, and never includes your own gifts. The numbers are a pure function of the clock (`js/ticker.js`): the total starts at $0
at local midnight, only grows through the day and is the same on every page and reload, and no line repeats within a few minutes. The bar has one fixed height,
is not a live region (screen readers are never told about each new line), has a Pause button, starts paused and still with reduced motion, and is hidden in
Stream Mode, on every game screen and live table (they keep the one-screen rule) and in short windows (up to 520 px tall, or up to 600 px tall and wider than tall).
**Charity of the week** puts one charity in the spotlight each Monday (the lobby, the `#spotlights` page with the last twelve weeks, and a one-line strip in the
"Back a charity" field of a solo game). The charity comes from walking the whole roster in one seeded order, so none comes round again before every other
has had a turn, and the past weeks are recomputed, never stored (`js/weekly.js`). Its two sentences are built only from the roster's own entry for it. Backing it in a
game earns a flat 25 XP once a round, win or lose (XP only, never money), shown in the receipt's XP card. Live tables do not have this bonus.

**Quests and the season track (`#quests`).** Three **daily quests** and three **weekly quests**, the same for everyone, picked from the date alone (15 daily and 10 weekly to pick from; never two of a kind in a day;
live-table and daily-wheel quests are left out where those do not exist). "Give to 3 different charities today", "Play a live table", "Verify one of your rounds", "Back the charity of the week", "Keep a 3-day giving streak
going" and so on. **Progress is worked out from the saved rounds, the streak, the cards, the daily wheel and the Charity Cup**, so an old save works and nothing needs "events"; the one thing the save only keeps as a total
(rounds verified) is turned into per-day counts by watching the total go up, and because the store keeps only the latest 60 rounds a quest's progress never goes down within its day or week. Days and weeks are the
visitor's local ones (Monday to Sunday). Finishing a quest toasts once (after the receipt is closed) and a **Claim** button adds season points: 20 for a daily quest, 60 for a weekly one. The **season** is the calendar
month (a name for each month, and "Ends in 12 days" counted on calendar days so a clock change never shifts it) with a **track of 30 tiers, 90 points each**. Points also come from rounds played, 10 each and only the first 10
of a day, whatever the size of the gift: **points never come from money**. Every tier gives one free reward: a little bonus XP (12 tiers, 875 XP in all, paid with `store.grantXp`, the call the daily wheel and the Charity Cup use, so
every XP number on the site includes it), six emblem frames and four profile titles (added to the profile page's own lists), four card backs and four confetti styles. A cosmetic the visitor already has pays 25 XP instead (the same track comes
round every season). **Joined late?** Every day of the season gone before a new player's first day is worth 60 points (up to 720, tier 8), so tier 10 is a few days of play away; someone who played before the season, or has played more
rounds than the store keeps, is not new and gets nothing. The page (`js/ui/quests.js`, `css/quests.css`) has the season header and bar, the track (a strip that scrolls sideways inside itself on a laptop, a vertical list on a phone, one tab stop
with arrow keys, every tier a real button named "Tier 7, Marquee emblem frame. Locked. 540 points to go."), the day's and the week's quests with progress bars (`role="progressbar"`), **Claim all**, a picker for card backs and confetti
styles, and a short "How quests work". The side menu's **Quests** entry has a badge with the number of things to claim (`#quests-badge`, empty and hidden at zero), the lobby has a one-line block, and Help answers "What are quests?".
Card backs show on face-down cards (Pick a Card, and the cards still to win on your cards page); confetti styles are read by `js/confetti.js` (hearts and stars are drawn in code). What is kept: `GS.local` "quests" (claims, the
highest progress seen, when the visitor was first seen, the season's round counts) and "cosmetics" (what is owned and chosen); the main save is only changed by the XP. "Reset my progress" starts the quests and the season again (the
cosmetics are kept); "Erase my data" removes both keys. Everything is play: nothing here pays out, can be bought or has a cash value. The rules are in `js/quests.js`.

**Fair Play?** is the page that answers "is it rigged?" in plain language: a short version, a sealed-envelope explanation
of commit, draw and reveal, a glossary, a button that re-checks any past round, and (for the technically curious) a snippet
you can run yourself. See [How the games stay fair](#how-the-games-stay-fair) for the details.

**Share your gift.** After a round the receipt's **Share your gift** button opens a dialog with a picture drawn on a canvas (`js/ui/sharecard.js`; the words and the rules are in `js/share.js`): the rank emblem in its level ring and "Rank 2 · Level 6" (the XP level, drawn the same way, before the first rank), the amount, the game, the charity's logo or illustrated emblem and name, and the receipt id with a small **Verify this round** line (the first 8 characters of the round's fingerprint, the hash that was shown before the draw, plus the receipt id, and "Check it at Fair Play"; in the demo it also says the secret is made on your own device). A direct gift, or a browser without the hashing API, has no verify line: a card never claims a check it cannot back up. The dialog previews the picture as an image with a real alt text, with a clear **Portrait (1080 x 1350) / Square (1080 x 1080)** toggle (remembered). A big win gets a fancier frame (a gold border with a glow, marquee bulbs and confetti dots, all drawn in code): a Triple Threat, a rank-up, a backed charity that won, or a gift of $100 or more (`bigWin` in `js/share.js`); everything else gets the plain frame. The actions are **Download PNG**, **Share** (the Web Share sheet with the picture as a file where the browser allows it, otherwise the text and the address; the button only shows where Web Share exists) and **Copy link and text**. Pages shown inside another page (a preview) may block downloads without telling anyone, so after Download a small hint says how to save the picture by hand (press and hold it, or right-click). Privacy: the card holds only the rank and level, the gift, the game, the charity, the receipt id and 8 characters of the public fingerprint, plus the display name if, and only if, the visitor switches **Show my name on the card** on (it starts off, it cannot be turned on without a chosen name, it is remembered on this device under `GS.local` "share", an email address is never used as a name). Never the balance, an email, a phone number, a card, or the secret number. The same dialog is the **profile card** (`ui.sharecard.openProfile()`, called from the profile page's Share my profile button): the big emblem, the name if allowed, the standing, the total given, the charity given to most and the streak, worked out from the saved history so old saves work.

**Fair play as a selling point.** A lobby block under the game tiles (`js/ui/fairshow.js`, `ui.lobby.addBlock` id `fair`, order 30) says every round can be checked and has a **Try the checker** button. It opens a checker that runs a **sample round, clearly labelled as not one of yours**, with the real `GS.fair` code in three plain steps: **Sealed first** (the fingerprint of a fresh secret), **Drawn** (the secret is revealed and the draw maths picks a winner from 8 real roster charities) and **Check it yourself** (hash the secret again and redo the pick: three ticks; **Tamper with it** changes one character of the secret and the check fails, so the point is seen). Where the browser cannot run the hashing (it needs a secure page) the block and the checker say honestly that it is not available here. Every receipt (and every live table result) with fair-play details also has a **Verify** button that opens them and scrolls them into view. The wording stays honest: in this build the secret is made on the visitor's own device, so it shows how a draw is worked out and is not an outside audit; the Fair Play page explains.

**Optional account (preview).** Sign up with an email or a phone number and a password (strength meter, a
verify-code step, a display name), log in, save a card for easy giving, set a monthly giving limit. All of it is a
**mock-up**: the sign-up validates what you type and keeps a tiny profile in this browser, the password is never
stored, a saved card keeps only its type, last four digits and expiry, and nothing is sent anywhere or charged.
Never type a real card number into a preview. The sample card `4242 4242 4242 4242` is provided for testing.

**Demo credit.** In demo mode every player starts with $1,000 of play money that goes down as they give, with
"Add credit" top-ups. In live mode the credit pill, the banner and the pay-with field disappear.

**Stream Mode:** the TV button (or `?stream=1`) turns a game into one clean screen for a stream (`js/ui/stream.js`, `css/stream.css`). The menus, the top bar and the footer go; what is left is the
amount and Play in a small column, a toolbar in the header of the game, a **pot** (the gift on the table in a solo game; the table's pot, and the Triple Threat pot marked simulated, at a live table), the
**charity** (the one you back, the one the last gift went to, or the one in front at a table), the **round id** (the first 8 characters of the round's sealed fingerprint, which is public, never the secret)
and a **vote bar** of **simulated viewers**. Nothing personal is on the screen: no name, and your credit stays off it (and off the receipt's "left" line) until you press *Show my credit*. The picture is
fitted to one screen with no scrolling (a slot machine, being made of HTML, is also enlarged on a big screen; the games drawn on a canvas keep their own biggest size), from a laptop to 2560 x 1440 and on
a phone. The chat vote is made of counts from a seeded random generator (`js/streamlib.js`), never real people and never named, and says so ("Simulated viewers"). In a solo game it counts down before each
round ("Chat decides in 12 s"; Play never waits for it) and shows each charity's share as one wide bar; **Let chat pick** (off until you turn it on, off again when you hide the vote or leave Stream Mode) makes
the winner the charity you back (the *Back a charity* step, so only in games that have one). At a live table the bar shows that table's own simulated chat. **Copy overlay link** (in the toolbar and in Help)
copies `<this page>?stream=1&overlay=1#<this game>`, with no name, no balance and nothing else in it. `?overlay=1` opens the **compact, see-through** view for an OBS-style browser source: the page has no
background (the cards that hold words stay dark, so they read on any scene), no tour, no demo strip, no toolbar and no controls, a small honest **DEMO · play money** tag in the corner and a small button
that brings the controls back (right-click the source and choose Interact to press Play). **Keys:** Space and Enter play, 1 to 5 pick the amount buttons (the stakes at a live table), C shows or hides the chat vote,
O toggles the compact view, ? lists them, Esc leaves; they stay quiet while you type in a box, with Ctrl, Alt or Meta held, or with a dialog open, and the buttons carry `aria-keyshortcuts`. Help has
*How to use this on a stream* in five steps. Add `&transparent=1` to Stream Mode for the older see-through background.

**Polish:** synthesised sound effects (no audio files, mutable), confetti that draws above dialogs, reduced-motion
support, keyboard-operable everywhere, screen-reader announcements for results, a phone-friendly layout.

**One screen per game.** On every solo game the picture, the amount and the Play button fit on the first screen, so nobody has to scroll to
start a round (what is below, such as the charities in play and the tabs, is one scroll away). On a laptop or a desktop the gift panel is the left
column and keeps Play in view; on a phone held upright it is docked at the bottom (the amount presets and Play, with an Options button that opens
everything else as a sheet over the picture); on a phone held sideways, or in any short window, it is a narrow left column that scrolls inside itself
with the Play bar kept at its bottom. The picture is shrunk to fit when it has to be (`fitStage` in `js/ui/game.js`); the games made of real text and buttons
(the slot machines, Dice, Coin Flip, Last One Standing and, on a phone held sideways, Pick a Card, Scratch Cards and Drop Crate) and the Plinko board are drawn
lower and tighter on a short window instead, so their words and buttons stay readable.

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
- **Charity list.** There are 500 charities in three groups, chosen from a longer researched list of 1,180 by how widely
  known and trusted each one is (every charity was ranked for recognition; any with a scandal or regulator problem behind it,
  doubt that it still operates, a mainly commercial structure or a very narrow political focus was left out). 159 were
  researched from public sources, 171 were each checked with web searches (the organisation exists, its official website, and its
  founding year and headquarters where the results stated them; the evidence links are in `docs/roster-sources.json`; the checks
  caught three renames: Little Kids Rock is now Music Will, The Actors Fund is now the Entertainment Community Fund and VH1 Save The
  Music is now the Save The Music Foundation), and 170 come from two official government registers: the Charity Commission
  for England and Wales (registered charities that work internationally; 109 list the UK first) and the Australian Charities
  and Not-for-profits Commission (61 list Australia first). A register record confirms the charity exists, its official name, its
  website and its location (the register number or ABN is in `docs/roster-sources.json`); the website of each one was also checked
  with a search that asks whether the charity's own pages are on the host the site links to, and the wrong hosts were corrected
  (`docs/roster-candidates.md`). Their descriptions are short, neutral paraphrases of the register text (for Australia, of the
  register's purpose flags), so they are plainer than the others, and `founded` is empty for most because the register gives a
  registration date rather than a founding date. Where a register year is kept (16 entries) it is marked
  `foundedFrom: "register"`, shown as "(register date)", and left out of the "When they started" filter and the oldest/newest sort, because
  the register year is often when the current company was incorporated or merged rather than when the organisation began; where
  a search gave the organisation's own clear year, the entry carries that year instead. A charity that is run by a religious
  body but whose work is care (aged care, homelessness, children) stays and carries a faith-based flag. Facts can go out of date:
  registers and websites change, so re-check every entry (and its link) before using real money, and confirm each one is a
  charity you are comfortable with and that your checkout provider supports. `docs/roster-candidates.md` lists what was left out
  and what to check.
- **Names and logos.** Charity names are used only to identify the organisations. Where a charity has a simple logo it is
  shown instead of the coloured monogram circle (134 of them so far; `docs/logo-sources.md` lists each file and where it came
  from: either the picture the organisation chose for its own GitHub account, checked by eye, or the open `simple-icons`
  set). Everyone else gets an illustrated emblem: a small badge the page draws itself (no files, no network) from what the site knows about the charity, so a water charity gets a drop, an animal charity a paw and a reading charity a book, in the colour of its cause. An emblem is a plain, generic picture and never a copy of anyone's logo; the profile dialog says so under it ("Illustrated emblem, not the charity's official logo.", or "Logo shown only to identify the organisation." for a real logo). `js/marks.js` makes the emblems. `js/logos.js` lists which charities have a logo and `logos: false` in
  `js/config.js` turns them off. `node tools/fetch-logos.mjs` collects more from each charity's own website (touch icon or
  favicon) into `assets/logos/`; it needs an open internet connection, which the build environment did not have. A
  logo is the charity's trademark: showing it to identify the organisation is common, but it can look like an
  endorsement and some charities have brand rules or ask for permission, so check before you keep any. The footer says
  GiveSpin is not affiliated with the charities. In the games, a charity's logo or emblem is drawn on its slice, pocket, bin, runner, duck, balloon or ball where there is room (about 14 px or more; smaller marks stay colour only), and clicking or tapping a charity's mark opens its profile (what it does, and a Visit website button). After a round, every charity on the receipt, in a live result and in My Giving is a link to its own website, with an About button for its profile.

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
- **Triple Threat pot** (the progressive jackpot, called `jackpot` in the code). Every settled pot adds 5% to a simulated pot. Once it passes $1,500 it drops at the next
  table, goes to that table's winner on top of the pot, and starts again. A siren sounds when it lands.
- **Events.** Featured events run off the clock (they come from `eventAt()` in `js/live.js`): Giving Tuesday Match
  (all day Tuesday; a simulated sponsor matches the pot dollar for dollar up to $250), Disaster Relief Night (from 6 pm;
  disaster-relief and health charities only, 50% matched up to $150) and a Double Pot Hour in the first quarter of every
  hour (dollar for dollar up to $200).
- **Drama.** A **last call** warns that bets are closing, a big stake (half your credit or more, or $250+) asks you to confirm, the table says how
  close the finish was, and close races end in a slow-motion **photo finish**. A **croupier voice** (the browser's own
  speech, off by default) calls the action.
- **Side predictions.** Before the lock you can make XP-only predictions: the pot reaches $500, the winner has under
  25% of the pot, the leading charity wins. Right calls earn the Oracle badge.
- **Stream chat vote.** Turn on "chat vote" and simulated chatters vote for charities while bets are open; the most
  voted charity gets a simulated $25 stake when bets close. It is a way to try how a streamer's audience could take a
  seat, with no real chat connected.
- **Crews.** If you are in a crew, two or three of its simulated members back the same charity as you with small
  simulated stakes ($5 to $20 each), and the feed says so.

**Every live game is a lobby of seven tables.** The Live tables page shows the same portrait tiles as the lobby, one for
each live game: the picture, the game's name, a "Live" marker and, under the name, the range of its tables ("5 to 500
bins"). A tile opens that game's own page of tables (`#tables-<game>`, for example `#tables-plinko`), where you pick a table: 5, 10, 25, 50,
100, 200 or 500 spots (Mini, Small, Classic, High, Big, Giant, Mega). Each table is a card that shows its pot, its players
and its phase as they change, and a card opens the live table itself (`#live-<game><size>`). The "All live games" link
and the breadcrumb on that page lead back to the tiles, and so does the browser's Back button when you came from them. The address of a
game that has no live tables simply shows the tiles. A spot is a bin in Plinko, a slice on the
wheel, a pocket in roulette, a card in the drop crate, a ball in the lucky draw, a runner, duck, marble or balloon in the
races, and a tile in Last One Standing. Each table has its own pot, players and rounds, and you can hop between a game's
tables from a bar inside the table. The charities players back (the gates: 5 at the smallest table, 30 at the biggest) go
on the board, and the remaining spots are **filled in at random from the catalog** so the board is always the full size;
if the catalog has fewer charities than spots they repeat evenly. Only backed charities hold tickets, so only they can
win: the others are scenery (thin slivers on the wheel, runners with no percentage, faded bins). Bigger tables have more
bots and a longer show (the 500-spot tables take about 27 to 44 seconds to play out, depending on the game). All 70 tables run at once, and a game's
`#live-<game>` link opens its Small (10-spot) table.

**A table fits on one screen.** The picture, your stake and the join button are on the first screen, so nobody scrolls to take a seat.
On a laptop the panel beside the picture keeps the odds board (it scrolls inside itself) with your stake and the join button pinned under it.
On a phone the stake presets and the join button are docked at the bottom of the screen, and **Options** opens everything else (the clock,
the odds board, the table sizes, the side predictions, the chat vote) as a sheet above them. Before a charity is picked the join button reads
"Pick a charity" and opens that sheet at the odds board; choosing one closes it and the button names the charity. A phone held sideways gets the
panel in a column beside the picture. When a round ends the page scrolls down to the result card. The layout is in `css/fit.css` (the block for
`#view-game.is-live`) and the fit and dock code in `js/ui/game.js`; the panel's markup is `ensurePanel()` in `js/ui/live.js`.

**Live tables are demo-only.** A pooled pot needs a server to hold the money and run the table, and this site never
handles real money, so in `redirect` mode the live tables are switched off and hidden. To make them real you would
run the tables, seeds and pots on a server and replace the bots in `js/live.js` with players.

Timings (betting window, lock, result), bot names and stake sizes, and the table size are constants at the top of
`js/live.js`.

## Make it real, the app and real tables

None of this makes anything real. It is the honest page about what real giving would need, the written-down seam for real tables, and the app wrapper.

**Make it real (`#make-it-real`).** A plain-words page (`js/ui/makereal.js`, `css/app.css`), linked from the footer and from Help ("Is this real money?" and "Could this be made real?"). It lists what real giving would need as a checklist: a payment provider, receipts from the provider, written agreements with each charity, legal and tax review, a privacy policy, fraud and refund handling, and a server for real tables. Each step has two halves: **For real** (always a **Not started** chip, because none has been started, and the page counts "0 of 7") and **In this demo** (a **Done in this demo** chip for the pretend stand-in that exists). It also has a "What changes for you" paragraph and explains the one switch, `mode` in `js/config.js`, as it really is: `'demo'` simulates everything; `'redirect'` only sends the visitor to a charity's own checkout page in a new tab, takes nothing here, accepts only `https://` links, records a round as "sent to checkout", switches off the demo credit, the DEMO stamp and the live tables, and does nothing useful until someone fills in `checkout.url` (until then a charity shows "no checkout link set up"). The page only reads the mode; it cannot change it. `docs/make-it-real.md` is the owner's version (steps, who to talk to, a rough order, what is not done, a checklist). This feature added only comments to `js/config.js` and `js/payments.js`; `tests/makereal.test.js` proves the settings and the money step behave exactly as before.

**Real tables: the seam, and a waitlist note.** `docs/live-protocol.md` writes down the messages a real table server and the page would exchange (a JSON envelope `{v, type, room, seq, ts, from, body}` with seven types: `join`, `leave`, `bet`, `chat`, `state`, `lock`, `result`; who may send what; size limits; the commit and reveal fields of `js/fair.js` reused as they are). `js/transport.js` is the code (pure, unit-tested): `validateMessage`, `encode` and `decode`, `checkFair`, a local in-memory transport with a seedable clock (`createLocalTransport`, interface `connect`, `send`, `on`, `close`), and `attachLive`, which turns what the real live engine does into protocol messages without changing the engine. Nothing in the site reads a transport yet and `attachLive` is not switched on: the live screens still read the simulation, and every other player is still a bot. The Live tables page has a **Join the waitlist for real tables** note: a nickname (the profile page's name rules) and a "Tell me when real tables exist" tick, kept under `GS.local` "waitlist" with the line "Saved on this device only. Nothing is sent anywhere." There is no list anywhere else, so nobody will contact you, and no email address or phone number is ever asked for. "Erase my data" removes it.

**Installable app.** `manifest.webmanifest` (name "GiveSpin Arcade", standalone, the site's dark colours, 192 and 512 px icons and a maskable one in `assets/icons/`, drawn from the logo by `tools/make-icons.mjs`), `offline.html` and `sw.js` make GiveSpin installable and let it open with no network. `sw.js` saves the site's own files (the list `PRECACHE`, which `tests/pwa.test.js` keeps equal to what `index.html` loads; `node tools/make-precache.mjs` rewrites it), opens pages and code from the network first so a new version is never hidden behind an old copy, falls back to the saved copy (or to `offline.html`) when the network is cut, serves pictures and fonts from the saved copy, and never touches or keeps anything from another site. Change `VERSION` in `sw.js` to make every device drop its saved copy. `js/ui/install.js` registers it only on `https:` or on this computer (`localhost`, `127.0.0.1`), never from `file:`, and not in an automated browser unless the address says `?sw=on`; `?nosw=1` removes the worker and its saved copy. The **Install the app** button is in the footer (never on a game screen) and shows only when the browser offers an install prompt; on Safari on an iPhone or iPad it is a two-step "Share, Add to Home Screen" hint; it hides itself when the app is already installed. **Reminders** (a switch on the Live tables page, off by default, kept under `GS.local` "reminders") use the Notifications API only if the browser has it and the visitor says yes, and nudge them a couple of minutes before the live tables' next featured event (Double Pot Hour, Disaster Relief Night, Giving Tuesday; the rules are `js/appkit.js`). They only work while GiveSpin is open or installed and the browser keeps it alive: there is no push server and nothing is sent from here. A page published as a preview inside another page cannot register a worker, so the app features only show up when the folder is served from a web address.

## How the games stay fair

1. **Commit.** Before a round the page shows the SHA-256 hash of a secret round seed it has already chosen.
2. **Draw.** The app (not the game) draws every winner: HMAC-SHA256 of the round seed with your own seed and a round
   number, read as 32-bit numbers with rejection sampling (no modulo bias), applied to **the charities on the board**
   sorted by id. That is exactly equal odds for every charity on the board. The board is recorded with the round
   (`fair.board`), so the verifier and the standalone snippet can redo the draw from just the board. This browser keeps the
   whole board of each of your last 60 rounds, even a board of 500 (stored compactly: about 3 KB a round), so any of
   them can still be re-checked after a reload. Dice and the slot machines keep the whole pool they drew from, so they
   still check out after the charity list changes. If the browser's storage is full, the site says so once and carries on.
3. **Show.** The game then animates to the already-chosen winner. The slices, reels, bins, pockets, cards and runners
   on screen are the board itself (the charities the winner was drawn from, repeated to fill extra spots), so what you
   see is what was drawn from. Marble Run's track is part of the show too: the track you see never decides anything, the
   winner is drawn first and the marbles are only the show. The receipt and My Giving note which track a round ran on
   ("Track: Spiral Tower"), but the track is kept beside the round, never in the record the verifier redoes.
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
| Level names, XP, badges, tiers, card rarity | `LEVELS`, `xpForGift`, `BADGES`, `TIERS` and `RARITIES` in `js/core.js` |
| Rank names and the dollar amounts they begin at | `RANKS` in `js/core.js` |
| How the simulated players are spread over the ranks (and which two handles wear the top ranks) | `BOT_RANK_MIX`, `BOT_RANK_PINS` in `js/core.js` |
| Live-table timings, bots, sponsor and the Triple Threat pot | the constants at the top of `js/live.js` |
| Live-table events (Giving Tuesday, Disaster Relief Night, Double Pot Hour) | `eventAt()` in `js/live.js` |
| How often the ticker has a new gift, the gift sizes and busy hours, the XP bonus for the charity of the week | `SLOT_MS`, `AMOUNTS` and `HOURLY` in `js/ticker.js`, `SPOTLIGHT_XP` in `js/weekly.js` |
| Crews and their chat | `js/crews.js` |
| The live-table message format and its limits | `docs/live-protocol.md`, `LIMITS` in `js/transport.js` |
| The app's name, colours and icons; what is saved for offline | `manifest.webmanifest`, `sw.js` (`VERSION`, `PRECACHE`) |
| Which reminders there are and how far ahead | `LEADS` in `js/appkit.js` |
| Daily wheel segments | `js/ui/collection.js` |
| Sign-up, log-in and saved-card behaviour | `js/accounts.js` |
| Brand name and copy | `index.html` and `js/ui/` |
| The voice of that copy (casino words, "House edge: 0%", Triple Threat, VIP lounge, Responsible giving, "Give out") | `docs/voice.md` |

Each cause needs at least a few charities so a single-cause filter still plays well (the test suite checks this).

## Tests

```
node --test givespin/tests/*.test.js
```

398 unit tests: daily and weekly quests (the picks from the date alone, progress from the saved rounds on the right local day, the season's end text and the 30 tiers' arithmetic, the head start, claiming once, the cosmetics store and its damaged-storage fallbacks, run in several time zones), the leaderboards (the ISO week and its 15-minute slots, numbers that only grow, your own row at its real place, crew goals, charities by times backed), Stream Mode's simulated chat vote (seeded and repeatable, shares that add up to 100, the leader), the overlay link and the keyboard shortcuts, the message format of the live protocol (every type, who may send what, limits, odd input that must never throw), the local transport (order, `seq`, a seeded clock, no spoofing), the real live engine turned into messages that pass the commit and reveal check, the waitlist rules, the manifest and icons, the service worker's file list against `index.html` and what it does with each kind of request, when it may be registered, the reminder schedule against the real events, the settings file and money step being unchanged, the Make it real page against its checklist, and the wording rules for all of it, the brand voice in the source (no "cash out", no "Give responsibly", no visitor-facing "jackpot", the shared loading lines and house-edge strip, the style guide's shape), money formatting and splitting, the minimum per round, the RNG and equal-odds argument, filters (OR
within a group, AND between), XP, levels, ranks (every boundary from $999.99 to $1,000,000.00 and beyond, a cent either
side, the ten levels inside each rank, the top rank, the standing never going down, labels, the simulated players' spread
and what a round reports about a rank-up), streaks, badges, boards of any size (fill spots evenly, always include the
backed charity), the bonus for backing a long shot, apportioning pockets and slices by stake, the stake-weighted draw
(ticket ownership, hashes, uniformity, tampering), tiers and VIP stakes, card rarity and the monthly set, the weekly
league and the Charity Cup field, email/phone/password/card/expiry validation, the fair-play draw (cross-checked
against Node's own HMAC, uniformity over 30,000 rounds, tampering is caught, the standalone snippet matches), and the
display-name rules and the block-list (unicode, spaces, html, links, look-alike letters, words that only contain a rude one), the favourites worked out from the saved rounds (ties, empty and odd histories, 200,000 rounds), which frames and titles each save unlocks, a later feature adding its own, and the simulated players' made-up profiles, the leaderboards (the ISO week boundary in other time zones and in a week with a clock change, numbers that only grow and are the same inside a slot, a bot's totals fitting its rank chip, a crew being the sum of its bots, the visitor's own row at its real rank, tie-breaks, crew goals filling, the history that is full, the crew card's words), and the
charity data (unique ids, valid vocabulary, short names and blurbs, bare hostnames, no superlatives, minimum counts per
cause and filter), and saved rounds (a board of 300, 301 or 500 charities and a live round with 25 backed charities come back whole
after a reload and still verify, a Dice round still verifies after the roster grows, older saves still load, a full
storage is reported, and the saved text stays small), Marble Run's click spots (a marble tossed up in the shake is clicked where it is seen) and which marbles wear their charity's mark, the track of a live Marble Run table (one per round, the next one in turn, never the same twice in a row, and never part of the draw),, starting pack, race and fairness of every Marble Run map, the charity of the week (the same week gives the same charity, a full walk through the roster before any repeat, the past list, the Sunday/Monday boundary, the two sentences about it and the XP bonus), the ticker's numbers (they only grow through a day, start again at midnight, hold for a minute, and no line repeats within minutes), Stream Mode's seeded chat vote (the same seed gives the same votes, the shares always add up to 100), its keyboard shortcuts (never while typing, with Ctrl, Alt or Meta, or with a dialog open) and the overlay link (nothing personal in it), and this README (the roster size, the board sizes per game, the unit-test count and command, the file list and the wording rules are all checked against the code).

```
NODE_PATH=$(npm root -g) node givespin/tests/e2e.mjs
```

About 4,150 end-to-end checks (a few dozen fewer without the accessibility scan) in headless Chromium (needs Playwright installed globally). They start their own static
server and drive the real UI: every game (and that **what is on screen matches the winner that gets recorded**),
the first-visit tour, the choose-your-own-charities dialog, all five slot machines (up to twelve reels, Triple Threat), every game at its biggest board (500 charities), clicking a logo or slice in every game to open that charity, the website links in the results, the big Roulette wheel and the Plinko camera, backing a charity, live tables (the game tiles, each game's page of seven table sizes, stakes, refunds, the whole pot, the extras, every live game), leagues, the Charity Cup, cards, crews and the daily wheel, real-speed card picking and scratching, split gifts and the minimum per round, amount validation, game filters checked
against an independent computation, the filters on the Charities page (which only narrow the list, never the games), the charity directory and profiles, direct gifts, repeat plans and dedications,
My Giving, ranks (the Giving Club card and ladder for saves either side of every boundary, the rank-up moment once at a solo round and at a live table, the emblem and its accessible name next to every name), the whole account preview (including that no password or full card number ever reaches storage), demo
credit, the monthly limit, fair-play verification and tamper detection, stream mode, reduced motion, persistence,
live (redirect) mode including rejecting non-https links, a phone-sized viewport, loading from `file://`, and a check
that the site never contacts another host and the console stays clean. Set `SHOTS=/some/dir` to save screenshots,
and `AXE=/path/to/axe.min.js` to add an axe-core accessibility scan of every page and dialog.
`ONLY=13zs,19z` runs just those sections. The checks for the newer features live in their own files, `tests/sections/*.mjs` (run in file-name order, each handed the helpers of `tests/e2e.mjs`), so a feature's tests never have to be edited into the big file. The axe-core version the checks were run with is 4.10.3 (a newer one, 4.14, also flags the games' tile labels and the side card as "label in name" mismatches). The files are `22-voice` (brand voice), `23-ticker` (ticker and charity of the week), `24-share` (share cards and the fair-play checker), `25-profile`, `26-quests`, `27-boards`, `28-stream`, `29-app` (Make it real, transports, install), `30-review` (regression checks for what the independent review found, plus guards for damaged saves and for pages that are revisited) and `31-walk` (phone, tablet and big-screen layout regressions: Stream Mode on narrow windows, focus not hidden under the bars, the lobby blocks under the game tiles).

Append `?fast=1` to the URL to squeeze every animation (the tests use it; it is handy for quick demos too).

## Browser support

Current Chrome, Edge, Safari and Firefox. The page uses `<dialog>`, the Popover API (for confetti above dialogs),
`color-mix()`, container query units and the browser's built-in HMAC-SHA256 hashing (for Fair Play). Confetti falls back to a plain overlay where Popover is
missing.

## Structure

```
index.html          the page shell (top bar, side nav, empty views)
sw.js               the service worker: saves the site's own files so the app opens offline (PRECACHE must match index.html; network first for code, never touches another site)
manifest.webmanifest  the installable app's name, colours and icons
offline.html        the friendly page shown when the network is cut and the app is not saved yet
css/base.css        design variables, reset, buttons, forms, chips and other shared pieces
css/shell.css       top bar, side nav, layout, stream mode
css/views.css       lobby, game screen, My Giving, Club, Fair Play, Help, Charities
css/dialogs.css     modal frame, filters, profile, direct gift, account, credit, receipt
css/games.css       the games
css/live.css        live tables, leagues, crews, cards, the daily wheel and the back-a-charity picker
css/chooser.css     the choose-your-own-charities dialog and its chip
css/slots.css       the slot machines and their five themes
css/tour.css        the first-visit tour
css/fit.css         one screen per game, solo and live tables: the gift panel (or a table's panel) in three layouts (wide, a phone's docked panel and Options sheet, a landscape phone's two columns); js/ui/game.js fits the picture to the screen
css/ticker.css      the live ticker and the charity-of-the-week strip
css/sharecard.css   share cards and the fair-play showcase
css/profile.css     the profile page (#me)
css/quests.css      the Quests page, the season track, the side-menu badge, and the card backs on face-down cards
css/boards.css      the leaderboards page, crew goals and the lobby block
css/stream.css      Stream Mode: the toolbar, the pot, the vote bar, the compact view and the see-through ?overlay=1 page
css/app.css         the Make it real page, the waitlist and the install button
css/voice.css       the house-edge strip (lobby, Fair Play, Help) and the house line on a receipt
css/walk.css        small fixes found by walking every page on phones, tablets and big screens (loaded last, each rule says which window it is for)
css/ranks.css       the rank emblems: their classes and animation
css/rankui.css      rank chips next to names, the rank card and ladder, the rank-up moment
js/config.js        mode, limits, demo credit, checkout hook
js/data.js          causes, filter vocabulary and the 500 charities
js/core.js          pure logic (money, RNG, filters, XP, ranks, badges, validation); unit-tested in Node
js/ranks.js         the eight rank emblems as inline SVG (GS.ranks: emblem, ring and each rank's colours)
js/fair.js          commit/reveal draws (HMAC-SHA256); unit-tested in Node
js/store.js         player state in localStorage, with defensive loading
js/payments.js      the money step (demo credit or redirect)
js/accounts.js      the account and saved-card PREVIEW
js/util.js          small shared helpers for the games and the UI (maths, timing, escaping, the ?fast=1 speed-up)
js/local.js         small storage helper for the newer features: one key each, nothing required, memory when storage is blocked (unit-tested in Node)
js/weekly.js        week keys, the charity of the week, its two sentences, the past spotlights and the XP bonus for backing it (pure logic, unit-tested in Node)
js/ticker.js        the ticker's numbers: "Given today" and the feed of recent gifts from simulated players, a pure function of the clock (unit-tested in Node)
js/share.js         share cards, the pure parts: what text goes on which card, the verify code, file names, the big-win rule and the line breaking (unit-tested in Node)
js/ui/sharecard.js  the share card: the picture drawn on a canvas (rank emblem, amount, charity, verify line), its dialog, Download PNG, Web Share and copy; also the profile card
js/ui/fairshow.js   the fair-play showcase: the lobby block, the sample-round checker and the Verify shortcut on receipts
js/quests.js        daily and weekly quests, the 30-tier season track, the head start for late joiners, claiming and the cosmetics store, all worked out from the saved history (pure logic, unit-tested in Node)
js/boards.js        leaderboards for crews, charities and players, this week and all time, with your own row always shown: simulated numbers that are a pure function of the clock, crew goals, the crew card's words (pure logic, unit-tested in Node)
js/ui/boards.js     the Leaderboards page (#boards): tabs, the This week / All time toggle, the tables, joining a crew, the Share my crew picture and the lobby block
js/transport.js     the interface the live rooms talk through, so a server could be plugged in later: the message format and its checks, a local stand-in for a server, an adapter for the live engine, the waitlist rules (pure logic, unit-tested in Node)
js/streamlib.js     Stream Mode's pure logic: the simulated chat vote (seeded), the shares that draw the vote bar, the keyboard shortcuts and the overlay link (unit-tested in Node)
js/appkit.js        the rules behind the installable app: when the service worker may be registered, the iOS home-screen hint, the reminder schedule (pure logic, unit-tested in Node)
js/profile.js       the profile's rules: display-name checks, favourites from the saved rounds, the frames and titles with how each unlocks, a bot's made-up details (pure logic, unit-tested in Node)
js/kit.js           shared game toolkit: board samples that include the winner, the race choreography
js/live.js          live tables: rooms, rounds, bots, stakes, events, sponsor match, jackpot and the weighted draw (no DOM)
js/crews.js         simulated crews: members, chat lines, emotes, weekly goal
js/art.js           lobby tile artwork (inline SVG)
js/icons.js         inline Lucide icons
js/audio.js         synthesised sound effects
js/confetti.js      confetti particle system (the visitor's confetti style from the season track is read here)
js/games/*.js       the games; crowd.js is the engine behind Duck Derby, Marble Run and Balloon Race, and slots.js is one engine behind the five slot machines
                    (marble.js holds Marble Run's first track, Switchback, and the list of tracks; every other track is one file, marble-map-<name>.js)
js/ui/*.js          shared helpers, amount and gift options, filters, charities, account, receipt,
                    charity picker and the choose-your-own-charities dialog (picker.js, chooser.js), the Track picker (variants.js), live tables, game
                    screen, lobby, pages, cards and daily wheel (collection.js), leagues and crews (leagues.js),
                    the Quests page, the side-menu badge and the lobby block (quests.js), the first-visit tour (tour.js), rank card, ladder, side-nav card and rank-up moment (rankui.js),
                    the shared voice lines: the house-edge strip and the loading lines (voice.js)
js/logos.js         which charities have a logo file (134 so far)
js/ui/makereal.js   the Make it real page and the waitlist note on the Live tables page
js/ui/install.js    registers the service worker, the Install button in the footer and the opt-in live-table reminders
js/marks.js         charity marks for the canvas games: the real logo or the illustrated emblem, as an image to draw
tools/              fetch-logos.mjs: collects more charity logos from their own websites; make-icons.mjs: draws the app icons from the logo; make-precache.mjs: rewrites the service worker's file list from index.html
assets/logos/       the logo files (see docs/logo-sources.md)
assets/favicon.svg  the browser-tab icon
assets/icons/       the app icons (192, 512, maskable, the iPhone icon and a notification badge), made by tools/make-icons.mjs
assets/fonts/       the Sora and Inter font files (loaded from here, never from another site)
assets/licenses/    the licence texts for the fonts and the icons
docs/               roster-sources.json (evidence for the added charities), roster-candidates.md (what was left out), logo-sources.md, marble-maps.md (how to write a Marble Run track), voice.md (the brand voice: the 10 rules and the vocabulary), make-it-real.md (the owner's checklist for real giving), live-protocol.md (the message format for real tables)
js/app.js           boots everything, routing, top bar, search
tests/              unit and end-to-end tests
tools/              check-links.mjs: asks every charity website whether it still answers or has moved (run it from a normal connection)
```

## Credits

Fonts: Sora and Inter (SIL Open Font License). Icons: Lucide (ISC). Licence texts are in `assets/licenses/`.
