# Wise Acres: build the features you picked, in groups

## Context

You picked ideas from my list so you can show your boss "what could be". Everything must work when clicked, but nothing needs a real server yet: it is a show-piece. If Mrs. Cathy likes it, the pretend parts get made real later.

You chose to see it **in groups**: I build one group, test it, you look at it from the desktop icon, then the next group.

**Your picks:** A1 Plan my visit, A5 Search, A6 Ready to pick, A8 Text a friend, B1 Order pizza, B2 "Your pizza is ready", B3 Pick-up basket, B4 Reserve a Christmas tree, B6 Sold out today, C6 What to cook, D1 Field trip helper, D3 Party planner, D4 One calendar, E2 What organic means, E3 "Updates from the farm", E4 Video spot ("video coming"), F1 + F4 Owner page (big), G1 Works with bad signal, G2 "I'm at the farm", G3 Bigger text, H2 Events for Google, H3 Share picture per season, and the under-the-hood items I judge worth it. The tour must explain every new feature to Mrs. Cathy.

**Not picked, so not built:** D2, G4, and the ones you did not answer (cost helper, closed-today switch as its own thing, weather strip, coloring pages, gift cards, the games, timeline). Closing a day is still part of the owner page, because that page changes closed days anyway.

## Rules I keep (yours, from CLAUDE.md)

- **Nothing is pushed to GitHub.** Commits stay on this laptop until you say "push".
- **No invented facts.** Where the farm has not told us something (tree sizes, party prices, recipes, how the farm grows things, the numbers on the owner page), the screen shows a clear label: **"Sample, not real"**, the same way the pretend ingredient lists do today.
- **Pretend things stay off the real website.** All of this is built on the preview branch `claude/wise-acres-everything` (the one that already has the tour and the pretend lists), never on the real-website branch.
- **No test is loosened.** New features get their own tests.
- Computer layout first; phone layout after you say (except G2 "I'm at the farm", which is a phone page by nature: I will ask before I shape it).

## Step 0: finish and save what is already done (before any new feature)

On this laptop there are fixes that are **not saved in git yet**: the bug fixes from the code check, the slim fonts (speed), and the winter picture fix. Latest results: the speed check passes; the winter picture at 1440×900 passes.

1. Fix one comment I wrote in `tools/change_fact.py` that contains a year number (the "no year in code" check, `tests/time-bombs`, caught it).
2. Find out if the one red Hindi line in `tests/hero` ("a tag covers a letter") is old or mine, by running that test on an untouched copy. If it is mine, fix it; if it is old, write it in `work-notes/session-notes/OPEN_ITEMS.md`.
3. Run the tests that cover every file I changed (`node tests/run-all.mjs --changed --run`), one at a time.
4. Update the notes (`work-notes/HANDOFF.md`, `OPEN_ITEMS.md` section 3a: the three known issues are fixed, and how).
5. **Commit on this laptop only** (two commits: "bug fixes from the code check" and "the three known issues"). No push.
6. Switch the folder to `claude/wise-acres-everything`, bring these fixes into it, rebuild, run the quick tests. From here on the desktop icon shows the preview version with the tour.

## How every feature is built (the same way each time)

- **Reuse what exists.** The pretend data lives in `js/demo-store.js` (orders, requests, messages, notices, flags), the pretend "live" flow in `js/demo-live.js`, the screens use `js/demo-view-kit.js` and `js/demo-ui.js`, the pizza builder is `js/demo-pizza-editor.js` with `js/demo-pizza-data.js`, the kitchen is `js/demo-kitchen.js`, the desk is `js/demo-desk.js`. New pretend pages are made like `pages/account.html` (`robots: noindex`, own `scripts:` and `styles:` lines), so Google never lists them.
- **Keep the home page light.** The speed check allows the home page 420 KB and it is at about 412 KB now. So new features live on **their own pages or their own small script files that load only when used**, not in the home page's first load.
- **Repo rules** (`work-notes/session-notes/CONSTRAINTS.md`): one wrapped script per file, old-browser-safe code, no year numbers in code, no storage words outside the allowed files, visitor words in all 5 languages through `python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build`. Pretend and tour screens are English only, as today.
- **After each feature:** the three build commands, `git status` shows only what was meant, `node tests/run-all.mjs --quick` plus the tests for the touched files, a new test file for the feature, then a local commit.
- **After each group:** I tell you in plain words what is new and where to click; you look; I fix what you say; then the next group.
- **Helpers:** at most 2 or 3 at a time, because this laptop is small (15 at once is what jammed the last session).

## The groups, in order

### Group 1: "Dummy simple" for visitors (real features, nothing pretend)
- **A6 Ready to pick** : one clear line near the top that says what is ripe now. It reads the same data as the "This week" box (`CROPS` in `js/features.js`, `week` in `js/content.js`), so no new facts.
- **A5 Search** : a search button in the top bar; type "dogs" or "parking" and jump to the answer. It searches the page's own words in the language being shown (the texts are already in `lang/<code>.js`). Loaded only when the button is pressed.
- **A8 Text this to a friend** : one button that opens the phone's own share sheet, or copies the link on a computer. Nothing is sent to any service by the site.
- **G3 Bigger text / calm** : one button for larger text; it sits with the existing "Pause animations" button (`initMotion` in `js/main.js`).
- **G2 "I'm at the farm"** : a new, very plain page with big buttons only: what is open now (from `js/live.js`), the map (`js/map-art.js`), bathrooms and parking (from the first-visit words), pizza pick-up. A QR sign for it comes from the existing sign tool (`tools/make_qr.py`).
- **A1 Plan my visit** : three taps (who is coming, which season, pizza or not) give a short plan built only from sentences the site already has (first-visit guide, season cards), with Print and "Text this to a friend".

### Group 2: Ordering, upgraded (pretend)
- **B1 Order pizza** : a new "Order" page: build a pizza with the existing pizza builder, pick a pick-up time, press Order. The order goes into the pretend store and **shows up on the kitchen screen**. The pizza section of the home page gets a clear "Order pizza" button that leads there (in the preview only).
- **B2 "Your pizza is ready"** : the customer's page shows Waiting, In the oven, Ready as the kitchen presses its buttons.
- **B3 Pick-up basket** : "Add to basket" on Store cards, a basket, "Pick up at the barn"; the order shows on the farm desk. Things that run out often can be left out of the basket (a list you can tell me).
- **B6 Sold out today** : the kitchen or the desk taps an item; the Store card and the order page show "Sold out today".
- **B4 Reserve a Christmas tree** : pick a tree weekend (the real, worked-out dates from `js/season.js`) and a size; the desk sees the list. Sizes and prices are labelled "Sample, not real" until the farm gives them.

### Group 3: Groups and dates
- **D1 Field trip helper** : a teacher types the number of students and gets what the trip includes and a ready e-mail. It follows the Groups page rules already on the site (for example the minimum group size).
- **D3 Party planner** : pick a kind of party and a day; the request shows on the farm desk. Prices not confirmed by the farm say "Prices coming soon".
- **D4 One calendar** : one page with every dated thing (tree weekends, pizza weekends, special days) and "add to my calendar" (the calendar-file code is already in `js/features.js`).

### Group 4: The farm's story
- **E3 Updates from the farm** : a section of short dated posts with pictures, newest first. For the show it holds a few sample posts labelled "Sample post". The plan for real: re-post what the farm puts on Facebook, plus its own uploads.
- **E2 What organic means here** : a short picture story. The general part uses the public USDA organic rules; every farm-specific line waits for the farm and is labelled until then.
- **E4 Video spot** : a framed place for the farm video that says "Video coming soon".
- **C6 What to cook** : simple ideas for what you picked. Sample recipes, labelled "Sample, not the farm's recipe", until the farm gives its own.

### Group 5: The owner page (pretend, the big one)
A new page for Mrs. Cathy, "Farm office":
- **Today at a glance:** who is coming, pizza orders, basket orders, tree reservations, messages waiting (all from the pretend store, so it moves when you order from another tab).
- **Graphs:** visits and orders by day, busiest hours, best sellers. Drawn by the page itself (no chart library), with sample numbers, labelled.
- **Change things without code:** hours, closed days (this is the "close today" button), the banner, the "this week" box, prices, sold-out items. In the show, a change is seen at once on the pretend site. (For real, `tools/change_fact.py` and `tools/close_today.py` already do the file work; `docs/PROPOSAL_owner_page.md` has the plan.)
- **"Coming later" board:** a list of future features, each with one plain sentence.
- **The bigger idea, explained on the page for Mrs. Cathy:** this small page is a first look. The full version would be its own tool, not just a part of the website: one place that connects to the things she already uses (the site names Bookeo for reservations, Square for pizza pre-orders, Mailchimp for e-mail, Facebook and Instagram, the Google Business Profile) so she can see and change everything about the business from one screen. You will ask her which tools she really uses before any of that is built.

### Group 6: Found, fast and offline
- **H2 Events for Google** : the tree weekends are marked in the page's hidden data so Google can show them as events. Only the real, worked-out dates.
- **H3 Share picture per season** : the picture shown when the link is shared follows the season (made the same way as the existing `assets/og-*.png`).
- **G1 Works with bad signal** : after one visit the pages open at the farm with no signal, and the site can sit on the home screen. I will first check this against the privacy tests; if they forbid it, I stop and ask you.
- **Under the hood, my picks:** I2 (find the spring page's extra 11,000 parts: likely a free speed-up) and I1 (lighter extra pages). I3 only if the speed check needs it.

### Group 7: The tour
- New tour chapters (`js/tour-steps*.js`) that walk Mrs. Cathy through every new feature: what it is, who it is for, and what is pretend. Written as "what this does for customers and the farm", not "what changed" (your request R10).
- The tour tests (`tests/tour*.test.mjs`, `tests/tour-targets.test.mjs`) are updated to cover the new steps.
- Each group also adds its own tour steps as it lands, so the tour is never far behind; Group 7 is the full read-through.

## GitHub projects: what I download now, and what I remember for later

**Now: only one, and only if needed.** `lucaong/minisearch` (MIT licence) for the search box. I will first try a small search written for this site (it only has to search about 1,300 short texts). If that is good enough, nothing is downloaded at all, which keeps the site light and its "no outside code" tests green. If I do use MiniSearch, it is copied into the site with its licence text and loaded only when the search opens.

**Not needed now** (the site can do these itself, lighter): a chart library (the graphs are simple drawings), Workbox (the offline part is small), confetti, a photo viewer, a tour library, a map library.

**Remembered for later, when pretend becomes real** (written into `work-notes/session-notes/` so the next session has them): Pages CMS or Decap CMS (owner editing), TastyIgniter and KitchenAsty (real pizza ordering and kitchen screen), Medusa (a real shop), Easy!Appointments (bookings, though keeping Bookeo is probably wiser), Umami (visit counting), and the US weather service API (weather). Not recommended: Open-Meteo (free only for non-business use) and Cal.com (its free version changed in 2026).

## Language check (your note on I4)
No native speaker yet, so the translations stay AI-written. I will add a short page to `work-notes/session-notes/` where you can note what people tell you when they read a page, so nothing is lost.

## How I prove each part works
- The three build commands, then `git status` shows only intended files.
- `node tests/run-all.mjs --quick` after every feature, plus `--changed --run` for touched files; browser tests one at a time.
- The speed check (`slow-phone`) after every group: the home page must stay under 420 KB.
- A new test per feature (for the pretend ones: order a pizza in one tab, see it on the kitchen screen in another, like `tests/demo-kitchen.test.mjs` does).
- I look at each new screen myself in a real browser at 1440×900 and 1920×1080 before I tell you it is ready.
- You look from the desktop icon after each group.

## What I need from you along the way (not now)
- After Group 1: tell me if "I'm at the farm" should be shaped for phones right away.
- Before Group 2 ends: which Store things should not be in the basket.
- Any real facts you can get (tree sizes and prices, party prices, the farm's own recipes, what the farm wants to say about organic): each one replaces a "Sample" label.
