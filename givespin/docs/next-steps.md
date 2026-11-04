# Where things stand, and what to do next

Last saved: the "make it popular and memorable" round (all twelve items below are in the site and tested; the preview is version 30). Everything under "Done" is built and tested; the rest is open. Only headless Chromium was available, so nothing here was seen on a real phone, in Safari or Firefox, with a real screen reader, in real OBS or with a real install prompt.

## Done (in the site)
- **Brand voice** (`docs/voice.md`, `js/ui/voice.js`): "a gambling website, but it is for charity" as a casino-style giving site with one joke per page ("House edge: 0%. The house is a charity."), a style guide with word lists, and every page's copy brought in line. Nothing implies real money; the demo wording is untouched.
- **Share cards** (`js/share.js`, `js/ui/sharecard.js`): a picture of a round (plain frame, fancy frame for a Triple Threat, a rank-up, a called charity or a gift of $100 or more) and of a profile, in square and portrait, with a name switch that starts OFF. Plus the **fair play showcase** (`js/ui/fairshow.js`): "Every round can be checked. Try it yourself." with a sample round checked with the real code.
- **Live ticker and charity of the week** (`js/ticker.js`, `js/weekly.js`): a bar of simulated players' gifts (every line says BOT), one charity of the week with 25 bonus XP (XP only, never money), the Charity of the week page.
- **Public profile** (`#me`, `js/profile.js`): display name (with a block list), frames and titles, favourite causes, badges, and a profile for every simulated player (labelled BOT).
- **Quests and the 30-tier season track** (`#quests`, `js/quests.js`): three daily quests, a monthly season, XP and cosmetics (frames, card backs, confetti), never money.
- **Leaderboards** (`#boards`, `js/boards.js`): crews, players, charities (by times backed; never "top" about a charity), weekly goals, a lobby block and a crew share card. Everyone but the visitor is a labelled bot.
- **Stream Mode upgrade** (`js/streamlib.js`, `js/ui/stream.js`): a pot and "chat picks" vote with simulated viewers, a transparent overlay page (`?stream=1&overlay=1`), big-screen sizes.
- **Make it real** (`#make-it-real`, `docs/make-it-real.md`): the honest checklist for real giving. Nothing here can take money: `mode` in `js/config.js` stays `'demo'`.
- **Real-players seam** (`js/transport.js`, `docs/live-protocol.md`): a message format, checks and a local stand-in. There are no real players and none are invented.
- **Installable app** (`manifest.webmanifest`, `sw.js`, `offline.html`, `js/appkit.js`, `js/ui/install.js`, `tools/make-icons.mjs`, `tools/make-precache.mjs`): installable and usable offline once served from https. The published preview cannot register a service worker; run `node tools/make-precache.mjs` after changing any script, style or icon listed in `index.html`.
- **Lobby layout**: the four lobby blocks (charity of the week, fair play, quests, this week's leaders) sit UNDER the game tiles, so the live tables and the first row of games are on the first laptop screen again.
- **An independent review** found and fixed three real bugs (the season track opened centred on the wrong tier on wide screens; "1 in over a thousand" and "over a thousand charities" when the roster is 500; an erased card back stayed on screen until reload) and some wording and spacing. A phone, tablet and big-screen walkthrough followed (15 screen sizes, five rounds upright and three sideways, resizing and turning mid-round) and fixed six CSS bugs: Stream Mode scrolling sideways on a 320 px phone, Stream Mode on an upright tablet (a 330 px column and half the screen empty) and on a phone (the docked panel floating above a hidden bottom bar), a focused control hidden under the phone's bottom bar or under the sticky top bar, and "Ends in 27 days" splitting from its number. Each has a check in `tests/sections/31-walk.mjs`.
- Earlier work, still in: ranks (eight emblem ranks from $1,000 to $1,000,000), one screen per game on laptops, phones upright and sideways (all 19 games), live tables that fit one screen, an accessibility scan (axe 4.10.3) with no violations on the pages checked.
- Tests: see the README ("Tests") for the unit-test and end-to-end counts. A few timing-based checks (13j, 13m, 13c, 13za, 13zp, 13zr, 13zu, 25f, 25h) can fail once under heavy machine load; each passes alone.

## Questions for the owner (nothing is blocked on them; each has a default)
**Wording and the brand**
- **A 1,000-dollar live table?** The biggest board now is 500. (Recommendation: not yet.)
- **Crypto-parody jokes?** The site avoids crypto words and a test bans them; I did not loosen it. If you want clearly labelled parody ("HODL your gift"), tell me which words, and the test list gets a reviewed exception. (Recommendation: skip, the casino joke is enough.)
- **"Triple Threat pot"** is used at live tables for the rolling pot, and the Giving Tuesday sponsor match no longer says "Jackpot" ("Giving Tuesday Match"). If you want the old words back it is about six strings in `js/ui/live.js`, the event name in `js/live.js`, one Help sentence and the voice test 22d.
- **"Provably fair" is not used**, because the secret is made on the visitor's own device and the site says so ("not an outside audit"). Change `T.head` in `js/ui/fairshow.js` if you want other words.
- **`manifest.webmanifest`** describes the site as "A gambling website, but it is for charity." followed by "Demo play: nothing is charged and no real money moves." An install dialog or a store listing may show that line. Everywhere else the site says "giving casino" or "casino-style". Keep the joke there? (Recommendation: use "A giving casino: play-money games that give to charity".)

**Honest wording about the bots** (needs your yes)
- Leaderboards, Live tables, Leagues and Crews say the other players are "bots standing in for a real person" or "real people" (`js/ui/boards.js`, `js/ui/leagues.js`, `js/ui/live.js`). A quick reader can take that as a real person behind each name. Recommendation: use the bot profile's wording, "Every other name here is a bot, and its numbers are made up." The old lines are older than this round and are pinned by existing tests, so I did not change them without asking.

**Numbers and design**
- **Games first.** The four lobby blocks now sit under the game tiles, but no game tile is on the first screen of the lobby in a window up to 1366 x 768 (the banners, the house-edge strip and the Live tables strip, which has playable tables, come first); the first tile is 52 px below the first screen at 1366 x 768, 135 px at 1024 x 768, 326 px at 390 x 844 and 526 px at 375 x 667. Before this round the first tile started at 730 px at 1366 x 768, so its top edge was just on screen. Recommendation: on phones move the house-edge strip and the Live tables strip under the tiles and make the welcome banner about 200 px tall; I did not prototype it.
- **Quests on a phone**: today's quests start about 3,400 px down the page, under the 30-row season track. Folding claimed tiers into one row, or showing today's quests first, needs a small change in `js/ui/quests.js` and test 26b (it requires a vertical list).
- **XP sizes**: the charity of the week gives 25 bonus XP; the season track pays 875 XP a month in all (about $88 of giving at 10 XP per $1) plus 25 XP for a cosmetic already owned; each round is 10 quest points, the first 10 a day, so a $1 round counts like a $1,000 one. Right sizes? (`js/weekly.js`, `js/quests.js` `ROUND_CAP`.)
- **Seasons**: every month's track has the same 30 rewards. A theme per month needs new frames and card backs (the names are already in `SEASON_NAMES`).
- **Two crew goals**: the Crews page shows an XP goal, the leaderboards a dollar goal. Keep both, or show dollars on both (a small change in `js/ui/leagues.js`)? A crew's board total adds all of the visitor's gifts of the week (the save has no join date).
- **Quests on phones**: the bottom bar has five places and no Quests entry; it is reached from the lobby block and Help. A shell change (`css/shell.css`) would add it.
- **Stream Mode** hides the Split / Charities / Back a charity / Filters panels on a wide screen to make room for the pot and the vote; "Let chat pick" makes chat's winner the charity you BACK (never who wins); the round id is the sealed fingerprint's first 8 characters. OK?
- **Reminders** (installable app) are tied to the live tables' featured events (Double Pot Hour, Disaster Relief Night, Giving Tuesday), since tables run all the time. The Install button is only in the footer for now.
- **Lobby block in real-donation mode** is hidden (simulated crews next to a real checkout could mislead).
- **Lobby promos**: the third welcome card ("Check every result yourself") and the fair-play block say nearly the same thing; one of them could go.

## Open, small (each is a few lines)
- From the walkthrough, not fixed: Stream `?overlay=1` at 844 x 390 cuts the picture 18 px at the bottom; bot-name buttons are 20 to 22 px high (axe passes them); the small "About <charity>" buttons on shrunk pictures (Dice 17 x 17 at 320 x 568, Coin Flip, Cosmic Spin); six pages scroll sideways at 195 px wide (below the 320 px reflow floor); toasts cover a third of a live result at 667 x 375 for a few seconds; the charity's web-address link in its profile is 16 px high.
- Bot names in a live table's feed are each a tab stop (up to 24 more); a roving tabindex (`ui.rove`) would fix it.
- Link targets under 24 px tall: the charity-of-the-week link (21 px at 768 px and wider), the Live tables' charity links, the ticker's Pause button (26 px).
- The receipt dialog body can pan sideways by 8 px at 360 and 390 wide, and 62 px at 320 (it did before this round, a little worse).
- Roster data: seven charities (NSPCC, Daniel Morcombe Foundation, Missing & Exploited Kids, STOP THE TRAFFIK, HALO Trust, IRC UK, ...) carry the how-tag `protection`, whose facet name reads "Protects land & wildlife".
- Back a charity chip: after typing a board size, the first click on the chip's x does nothing (the field blurs and the chip is redrawn). It was in the base.
- The crew share card repeats about 140 lines of drawing code from `js/ui/sharecard.js` (`js/ui/boards.js`); export those helpers once and delete the copy.
- The favourites on the profile and the visitor's week on the boards come from the 60 rounds the store keeps; a longer record would need a new field in the save.
- A live table result has no Share button; the Fair Play page has no "Try the checker" button (`ui.fairshow.openChecker()` exists).
- Stream Mode: the canvas games (wheel, roulette, plinko, races) do not grow on a 2560 px screen; on a phone held sideways 8 games still scroll a few dozen px.
- Idle CPU with motion allowed is about 300 style recalculations per 5 s on every page, from the animated background (it was the same before this round); reduced motion drops it to about 30.
- First load of the lobby is 103 requests and about 2.4 MB (`data.js` 304 KB, `marble.js` 146 KB).
- The smallest windows are much better but not perfect: on a 568 x 320 phone a Coin Flip slot is about 22 x 15 px. A real phone's on-screen keyboard was never tried (`interactive-widget=resizes-content` in the viewport meta tag would make Android behave like the tests).
- axe 4.10.3 is pinned; newer versions (4.14) were not tried.
- A win that is also a rank-up plays a win sound, the rank-up jingle and a second win sound within 0.6 s on purpose (`moment()` in `js/ui/rankui.js`).

## Making it real, real tables and the app (written down, not built)
- **Real giving:** none of it is started. `docs/make-it-real.md` is the owner's checklist (a lawyer, a payment provider that accepts a casino-styled charity site, agreements with charities, receipts, a privacy policy, refunds and fraud) and the **Make it real** page says the same to visitors. The one code switch is `mode` in `js/config.js`; leave it on `'demo'` until the steps in that file are answered. Anything that could take money needs the owner's go-ahead first.
- **Real tables:** `docs/live-protocol.md` and `js/transport.js` are the seam. A server, sign-in and who supplies the client seed are not built or decided. The waitlist only saves on the visitor's own device. Real players must never be faked.
- **The app:** needs a real phone to check the install prompt, the iPhone "Add to Home Screen" steps and Android notifications.

## How to work on it
- Unit tests: `cd givespin && node --test tests/*.test.js`. End-to-end: `NODE_PATH=$(npm root -g) node tests/e2e.mjs` (see the README, "Tests"); `ONLY=13zs,13zt node tests/e2e.mjs` runs only some sections (whole section ids; `ONLY=24` matches nothing, use `ONLY=24a,24b`).
- The README test checks that every top-level js and css file is named in the Structure list and that the stated unit-test count equals the number of lines starting with `test(` in `tests/*.test.js`; `tests/pwa.test.js` checks `sw.js` against `index.html` (fix with `node tools/make-precache.mjs`).
- On a phone the gift panel is docked: fields other than the amount buttons and Play are in the Options sheet, so tests call `openOptions(page)` (live tables: `openLiveOptions`) before touching them.
- New lobby blocks: `ui.lobby.addBlock({ id, order, label, mount, refresh })` (they show under the game tiles). New end-to-end files go in `tests/sections/NN-name.mjs` (default export `async function (h)`).
