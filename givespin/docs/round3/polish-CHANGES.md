# polish: CHANGES (wave 3)

Helper "polish". Work copy `ag-polish/work/givespin`, untouched base `ag-polish/base/givespin`, patch `handoff/changes.patch` (`diff -ruN base/givespin work/givespin`).
Only headless Chromium was used (Playwright). Nothing was tried on a real phone, in Safari or Firefox, or with a real screen reader.

STATUS: items 1 to 6 are built, tested and handed off. Item 7 ("small leftovers") found nothing that is clearly mine and safe (see the end). A regression run of the existing
sections that touch these pages is summarised under "Verified".

## What changed, per item

### 1. Roster tag accuracy ("Protects land & wildlife" on charities that protect people)
Seven charities carried the how-tag `protection` although they are not about land or wildlife (NSPCC, Daniel Morcombe Foundation, Missing & Exploited Kids, STOP THE TRAFFIK,
HALO Trust, IRC UK, and Mines Advisory Group, which the notes' "..." stood for), so their profile said "How they help: Protects land & wildlife".
The smallest accurate fix, with no charity fact touched: a new facet value `safeguard`, named "Protects people", and those seven re-tagged from `protection` to `safeguard`
(only the `how` list of each of the seven lines changed; a diff of the roster with the new id mapped back to the old one is empty). The 41 conservation, ocean and animal charities keep `protection`.
- `js/data.js`: the new entry in `GS.facets.how` (icon `shield-half`, which already exists) and the seven `"how":[...]` lists. The filters dialogs, the chooser, the profile ("How they help") and
  the facet counts read the vocabulary, so the Charities-page filter and the game filter list the new chip ("Protects people", 7) by themselves.
- `js/weekly.js` (the two sentences of Charity of the week / Spotlights): `HOW.safeguard = 'work to protect people'` (a test requires a plain word for every facet id). `HOW.protection` stays
  "protection work", which is still true for the 41 that remain. Read out: "A gift to NSPCC supports its work helping children and families in the United Kingdom, through direct help,
  advocacy and work to protect people." and "A gift to WWF supports its work in the United States and worldwide, through protection work and advocacy."
- `README.md` (Filters paragraph) and `docs/next-steps.md` (the open item is removed).
- Tests: `tests/data.test.js` (new test: `protection` only on charities about nature or animals, `safeguard` only on safety or refugee charities, the seven by id, both names; and `safeguard`
  added to the headline-facet list), `tests/weekly.test.js` (two sample sentences added to an existing test), e2e `35a`.

### 2. Quest deep links
An open quest is now a link (its own words, underlined, with a small arrow) to where it is done. It is a link, not a second button, so an open row still has no button and a done row still has
exactly one (Claim); the progress bar and its `aria-*` are untouched. A finished or claimed quest is plain words.
- `js/quests.js`: `LINKS` (quest id to address) and `linkOf(id)`, exported. Lobby for the quests about giving, games, charities, causes, splits, streaks and backing a charity; `#spotlights` for the
  two "Back the charity of the week" quests; `#live` for the live-table quests; `#fair` (Fair Play, where a round is verified) for the two verify quests; `#charities` for "Give directly";
  `#lobby-slots` / `#lobby-races` for the slot and race quests; `#cards`; `#leagues` (the Charity Cup); none for "Claim 5 daily quests" (done on this page). "Spin the daily bonus wheel" has no page: its link
  is `#lobby` (where the wheel's button is) and a click opens the wheel dialog instead (`data-quest-act="daily"`, `ui.daily.open()`).
- `js/ui/quests.js`: `titleHTML(q)` (new, next to `questHTML`, which calls it for the title) and one line in the page's click handler for the wheel.
- `css/quests.css`: four lines for `.qcard__go`, put right after the `.qcard__n` rule.
- Tests: `tests/quests.test.js` (every quest has an entry, every address is a real route read from `js/app.js`'s `PAGES`, the examples of the brief), e2e `35b` (all 25 quests are seen in the
  browser over a few fixed days; each link, its words, its one-link-no-button shape and its progress bar are checked; one link per address is followed with the mouse and the right page opens; Enter
  follows a link; the wheel link opens the wheel; a finished and a claimed quest have no link; no sideways scroll at 320, 390 and 1366 px; axe on laptop and phone).

### 3. Midnight redraw of the Quests page
- `js/quests.js`: `msToMidnight(now)` (pure, the arithmetic, unit-tested in five time zones including the 23 and 25 hour days).
- `js/ui/quests.js`: one `setTimeout` to the next local midnight (+500 ms so an early timer never finds yesterday), set by the existing `route` handler only while the Quests page is shown and
  cleared when it is left (so none elsewhere and no interval). When it fires and the day really changed: `sync()` (new daily quests, the side-menu badge, the lobby block), the page is drawn again
  even if the keyboard is inside it (its old Claim buttons would be dead) with focus moved to `#main`, one toast ("A new day has started. Today's quests are new."), and the timer is set again.
  It reads `new Date()` and `setTimeout` at call time, so a fake clock moves it. `ui.quests.midnightArmed()` is a read-only hook for tests.
- Tests: `tests/quests.test.js` (`msToMidnight`), e2e `35c` with `page.clock.install` and `fastForward`: 23:59:20 on Sunday 29 Nov: "Ends tomorrow night", a badge; after midnight (focus inside the page)
  the new day's quests, "Ends tonight at midnight", a smaller badge, focus on `#main`, one toast, timer set again; Monday's weekly quests; the next midnight the 1st: "Winter Gala", "Ends in 31 days"; on the lobby the timer is
  gone and a midnight there does nothing; coming back sets it again. Leak check like 30d: ten visits and leaves, exactly one pending long timer on the page, none elsewhere, no interval.

### 4. "Your account" shows the chosen display name
- `js/ui/account.js`: `whoName()` = `ui.displayName()` else "Mystery Giver" (what the profile page calls a visitor with no name). Used in the settings dialog (name and avatar initials), the account
  menu (it already used `ui.displayName() || a.name`), the "You're in, ..." step of sign-up and the "Welcome back, ..." toast. The preview notices are untouched.
- `js/profile.js`: `looksLikeEmail()` and `displayName()` no longer falls back to an account name that is an email address. The sign-up nickname box takes anything, so someone could type their email
  there and it was shown as their name (profile page, share cards, the league table, the account menu). Now it reads "Mystery Giver" everywhere and the address is shown nowhere (the dialog still shows the masked
  contact, "a•••@example.com", on its second line, as before).
- `js/ui/profile.js`: the hint under the name box ("Leave it empty to use your account name (...)") does the same check.
- Tests: `tests/profile.test.js` (email guard), e2e `35d` (chosen name wins and its initials; account's own name when none; an email as the account name shows "Mystery Giver" on the profile page, the menu and the
  dialog and the address appears nowhere; choosing a name fixes it everywhere; the log-in dialog and the settings dialog still say "Preview" / "mock-up" / "Nothing is sent anywhere"; welcome-back toast; axe on both dialogs).

### 5. Back a charity chip: the first click on the x did nothing after typing a board size
Cause (confirmed on the base with a probe and in 35e): the field loses focus on mousedown, its `change` event runs `refreshSize()`, which ran `refreshPick()`, which rewrote the chip's HTML; the x that was
pressed was replaced before the release, so no click happened. Fix in `js/ui/game.js` `refreshPick()`: the chip is rewritten only when its HTML changed (the same `data-sig` pattern `refreshSize()` and the
rounds buttons already use), so the node under the pointer is kept. Changing the backed charity, or a round starting (disabled buttons), still redraws it. e2e `35e` does NOT blur first: types "37"
in "Any number" and clicks the x at once, and again after the 350 ms debounce applied it (both fail on the base), plus a phone, and checks the typed 37 is kept and a new charity redraws the chip.

### 6. Leaderboards, Players tab: "Show all 61"
- `js/ui/boards.js`: a real `<button>` (`aria-expanded`, `aria-controls`) that is the first thing in a line ABOVE the table, so the rows it adds never move it; the line next to it says what is showing
  ("Showing the top 10 of 61, and your row under them." / "Showing all 61."). The old sentence "Your row is under the top 10." moved from the "You are #61 of 61..." line into that line, so nothing above the
  button changes when it is pressed (the first version moved the button by 21 px on a phone; 35f checks 0 px). The label changes to "Show only the top 10". Focus stays on the button (the panel is redrawn and the
  new button gets it back), Enter and Space both work, switching This week / All time keeps the choice, a new visit starts with the top ten, and the other tabs have no button. All 61 rows keep their BOT pill.
- `css/boards.css`: two rules (`.bd__more`). No change to `js/boards.js`.
- Tests: e2e `35f` (laptop and phone: 10 rows then 61, 60 bots with a BOT pill, your own row once, ranks 1 to 61, `aria-expanded`, keyboard, no jump (button top and scroll position unchanged), no sideways scroll at 320 px, 844 x 390 and 2560 px, axe).

### 7. Small leftovers
Checked `docs/next-steps.md`'s "Open, small" list and the "Left" lists of the notes. The two items that were mine are items 1 and 5 above (removed from next-steps). Everything else there is another helper's
territory (targets and the bot-name tab stops: a11y; the Fair Play button and the crew card's repeated drawing code: share; the Quests order on a phone: lobby) or an owner question. The ticker's NOTE wording
("not from real people") is the same sentence on every page it is shown on, so there was nothing to make consistent without touching the "standing in for a real person" wording, which the brief says not to touch.

## Tests I changed
- `tests/data.test.js` line 74 (headline facets): `'safeguard'` added to the list of facet values that must each have at least 5 charities. Strengthened, nothing loosened.
- `tests/weekly.test.js` "sample sentences read plainly": two assertions added (NSPCC, WWF). Nothing removed or loosened.
- No existing assertion was edited, relaxed or deleted. The wording and honesty tests (BOT labels, "simulated", no real money, banned words) were not touched and pass.

## Verified (headless Chromium only)
(see the end of this file for the numbers; filled in when the regression run finished)

## NOT verified
- A real phone (touch, the on-screen keyboard, a real long press), Safari, Firefox, a real screen reader (I checked names, roles, `aria-expanded`, focus order and axe 4.10.3 only).
- A real midnight, a real DST change in the browser (the unit tests cover the arithmetic in five zones; the browser test uses a fake clock, `page.clock`).
- The whole e2e suite (the lead's job) and the other helpers' merged work.

## Questions for the owner
1. **"Protects people" for STOP THE TRAFFIK and Mines Advisory Group.** Their blurbs do not use the word "protect" (they say "working to end human trafficking worldwide" and "landmine and cluster munition
   clearance"); the earlier roster work had tagged them `protection` already and I kept that decision, only moving it to the people tag. Recommendation: keep, it is the same judgement the roster already made and the
   alternative (no how-tag) would hide them from the filter.
2. **An email address typed as the sign-up nickname.** It is now never shown as a name. Should the sign-up step 3 also refuse it with one plain sentence ("That looks like an email address. A nickname shows
   on shared cards, so pick one that is not your email")? It touches personal data wording, so I did not add it. Recommendation: yes.
3. **The midnight toast** ("A new day has started. Today's quests are new.") is one announced line at midnight, only to someone who has the Quests page open. Recommendation: keep (otherwise the numbers change under
   a reader without a word); say if you would rather it were silent.

## Merge cautions (shared files, where I touched them)
- `js/ui/game.js`: only `refreshPick()` (the chip HTML is built into `chipHtml` and written when it changed): a few lines at the end of the function's chip part.
- `js/ui/boards.js` (the share helper works in the crew-card part): the top (a new `showAll` variable), `playersPanel()`, the start of `render()` (`showAll = false`) and the page's `root.onclick` (one branch).
- `js/ui/quests.js` (lobby helper: CSS ordering only; share helper: a button): `titleHTML()` before `questHTML()` and the one call in it; a new "stroke of midnight" block before the lobby block; the `ui.quests` export and the
  `route` handler line; one branch in `wire()`.
- `css/quests.css`: four lines after `.qcard__n`; `css/boards.css`: two lines after `.bd__you b, .bd__lede b`. No new CSS file, no new JS file, `index.html` and `sw.js` untouched.
- `README.md`: the Filters paragraph, the Leaderboards paragraph (one sentence), the Quests paragraph (one sentence), the "files are ..." list (`35-polish`) and the unit-test count ("402 unit tests:" is
  `grep -h "^test(" tests/*.test.js | wc -l` on my tree; the other helpers add theirs: the lead recounts). `docs/next-steps.md`: two lines removed.
- `tests/data.test.js`, `tests/weekly.test.js`, `tests/quests.test.js`, `tests/profile.test.js`: new tests added in the places named above; `tests/sections/35-polish.mjs` is new.
- Roster data: `js/data.js`'s seven lines differ only in `"how":[...]`. If another helper edits those lines the merge must keep `safeguard`.
