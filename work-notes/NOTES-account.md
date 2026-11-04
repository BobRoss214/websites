# Notes from helper "account" (H-B), second wave, 3 Nov 2026

Branch `account` in /tmp/account-clone (made from integ b02d6a0). Three requests from the builder, one more from main.

## What changed
- G, "remove how many times they have come": the My year screen is gone. `js/demo-view-year.js` is deleted; the `year` tab is out of `js/demo-app.js`, the script tag is out of
  `pages/account.html` (and so out of the built `account.html`, which also loses the trophy drawing only that screen used), `badges` and `setBadges` are out of the store, the
  sample and the tests, the tour card `ch10-year` is gone (the other cards keep their ids and order numbers, so there is no 1017), and the docs and plans no longer describe it.
  The real badges of the home page game (js/hero.js) are untouched.
- H, "My event only when chosen": the sign-up asks ONE question, "Do you plan or manage a party, an event or a school trip?", with four big buttons made in JavaScript
  (`DemoUI.choices`, real radio buttons): No / Yes: a party / Yes: a school trip / Yes: another event. `DemoStore.createAccount({ name, email, eventKind })` keeps the answer on the
  account (`current().eventKind`: none, party, school, other) and loads an event of that kind. With No the My event tab is not on the bar and `#event` opens the first tab
  (the shell has a new `shownIf` option for a screen). "I also plan an event", a small link at the bottom of My family, opens a box with the three kinds and calls
  `DemoStore.addEvent(kind)`. `seedSample()` (the tour, the preview) always has the school trip. The tour cards for the sign-up and for My event say it. The facts of the
  new events come from the site: a party is one price for the whole party ($300, farm entry included, up to 50 guests, children age 2 and younger free and not counted, 2.5 hours);
  another event shows no price (the site names none; the corporate prices are still marked as a draft); a school trip is as before ($11 each, 100 students at least).
- L, contacts: "Questions? Email Vanessa" (school trip card, the sign-up hint, the add-later box); "Pizza questions? Email Ava" on My pizza and in the pizza editor;
  and, asked by main, "Pizza kitchen contact: ava@wiseacresorganic.com" at the foot of the kitchen screen. Both addresses are on the site already, with the site's own subject
  lines (`DemoData.CONTACTS`). No phone number anywhere.
- Desk (nobody owned it in this wave): `js/demo-desk.js` got 4 small hunks so a party or another event (guests only, no students) reads "24 guests" instead of
  "0 students and 24 chaperones", and its empty-state sentence no longer promises a school trip to every sample family.

## What I ran (on this branch, 3 Nov, the computer was busy: load 11 to 20 on 4 cores)
- Quick: `code-rules`, `validity`, `privacy-static`, `seo` pass; `demo-store` 122, `demo-data` 37, `demo-kitchen` 42, `tour-demo-script` 68 pass; `pipeline` 50 passes (the rebuild commands change nothing).
- Browser: the new `tests/account-event.test.mjs` passes (61 checks, with axe really running: the AXE_PATH main corrected). `WA_TOUR_ONLY=10 node tests/tour-targets.test.mjs`
  (chapter 10 in a real browser at 1440 and 390 px) passes except the words check below.
- Red, and not caused by this work (the same at b02d6a0): `browser-support` (`notify` and `resize` are not in the table), `docs` (docs/DECISION_PLAYBOOK.md names words that moved),
  `consistency` (corn pit found in 4 places, 5 expected), `tour-targets` words check (`ch10-paid` has 47 words, 45 allowed).
- Also not new: the card `ch10-answer` is always skipped (its target `acct-reply` exists only when Mrs. Cathy SUGGESTS something, and the tour answers yes). The test only prints it as a note.

## Hunks in files that other helpers also touch (main merges by hand)
- `js/demo-data.js`, `js/demo-store.js`, `tests/demo-data.test.mjs`, `tests/demo-store.test.mjs`: alerts (H-A) trial-merged my commit 96eeec9 and says these merge cleanly.
- `docs/ACCOUNT_DEMO.md`: conflicts with alerts in "The shapes" list (family / event / notice lines): keep both.
- `js/tour-steps-c.js`: mine are the header comment, `ch10-signup` and `ch10-event` texts, the removed `ch10-year`, and the new `eventShown()` helper; alerts has `ch10-alerts`.
- `tests/tour-demo-script.test.mjs` (owned by seasons for the engine, but it tests chapter 10): numbers 1 to 25 stay, card 17 no longer exists, a few lines added.
- `work-notes/preview/arttest.mjs` line 163: the word `year` is out of the list of dynamic hashes (main owns that folder).
- `ch10-paid` in `js/tour-steps-c.js` has 47 words (the words check of `tests/tour-targets.test.mjs` allows 45). It was already so before this wave and I did not touch it.

## Text main may want in the README files (I did not edit them)
- `tests/README.md`, a row for the new browser test: `| `account-event` | the pretend account as a family sees it (about 1 to 3 minutes): the sign-up question and each answer, the My event tab only for a family that has an event, "I also plan an event", no My year anywhere, the contact links for Vanessa and Ava, and an axe check of the new boxes |`
- `docs/WHAT_THE_SITE_STORES.md` says nothing about the demo today; if it ever does: the pretend account keeps, with everything else of the demo, the answer to the event question in the one demo key.
- `tests/timings.json`: `account-event` has no time yet.
- browser-support: my changes add no new name to the table. The two names it already misses are `notify` (js/demo-store.js, js/demo-kitchen.js) and `resize` (css/demo-visits.css).

## Not done, or unsure
- Phones: only checked that the four sign-up buttons fit inside the card at 390 px and that the page does not scroll sideways.
- The sample dates and head counts (a party of 24 guests on a Saturday two weeks after the sample visit, another event of 30 guests) are made up, like the rest of the sample.
- `DemoStore.createAccount({ name, email })` with no `eventKind` still gives the ready-made sample WITH the school trip (so older callers and tests keep working); the sign-up form
  always sends an answer.

## Update: making `tests/browser-support.test.mjs` green (branch `support`, 3 Nov 2026)
- `DemoStore.notify` is now `DemoStore.postNotice(text, link, to)` (js/demo-store.js, js/demo-kitchen.js, docs, plan): `notify` is also the name of a browser property, and the test watches that word.
  The same word on the Tell me when preference was flagged too (`family.notify`), so the key is now `family.notifyBy` (js/demo-store.js, js/demo-data.js, tests, docs). `getNotify()`/`setNotify()` keep their names (not flagged).
  A demo state saved a day ago with the old key simply reads as both on.
- The table was made again from the compat data 8.1.8 (`node tools/browser_support_table.mjs --bcd /tmp/bcd-dl/package`). The six names that needed a person: `css-prop:resize` and
  `css-value:resize:vertical` (`na`: the drag handle of a text box, iPhones have none), `css-value:align-content:start`, `css-value:align-self:start`, `css-value:place-items:end` (`manual`: dated for flex boxes,
  every use on the site is on a grid box) and `css-value:justify-content:safe` (`manual`: the empty visitor photo strip; Chrome 90 to 114 know the word but ignore `safe`, so a strip with many photos could lose its first photo at the left).
  Every older entry kept its `how` and `fallback`. The `css-prop:translate` line is exactly as it was (the leaf CSS is still being changed); its pinned count for css/hero.css is 10, the tree uses 7.
- `docs/BROWSER_SUPPORT.md`: the `manual` line names the alignment words.

## Update: what the independent tour walker found in the pretend account and chapter 10 (branch `demofix`, 4 Nov 2026)
1. The answer card ("The answer arrives", number 57) was always skipped: the family's box with Mrs. Cathy's answer had its tour hook (`acct-reply`) only while she suggests something. The box that is left after a yes, a no, an OK or a "No thanks" now has it too (`js/demo-view-visits.js`, `lastBlock`). The card says "the lit box is your answer".
2. The dialogs of the lit buttons sat under the dimmer. In `js/tour-steps-c.js` the five cards whose lit button is the point of the card (the strip with Start over three times, Request a different day, the closed-day banner) say `allowClicks: true`.
   Seven cards (those five, the visit card of "My visits, with a sample family" and "My family") have an `after()` that closes a dialog the owner left open. It calls the new `DemoUI.closeModals()` (`js/demo-ui.js`):
   it closes every open dialog, the top one first, each by its own close (focus goes back, a "Are you sure?" question answers no). Nothing is removed by hand and the store is never touched.
   The `css/tour.css` part (dialog above the dimmer, Esc to the dialog) is for the helper that owns that file and is not in this branch.
3. The reason of a closed day was said twice or wrongly ("because of weather. rain"). The banner and the new-day box now say "because of <reason>." once, from the reason the desk gave (`rain`, `strong wind`, the owner's own words, or `weather` when none), and a full stop typed by the owner is not doubled.
   The tour closes the day for `rain`, the desk's first choice, so the three sentences match: the desk's confirm box, the family's notice and the banner.
4. Wording: the family-OK card names the button as written, "No thanks, keep my order as it is"; the Tell me when card says first where messages go (the two switches at the top), then the order of the choices. Both are under 45 words.
5. Going Back and forth: after each card's preparing, only the newest copy of a notice stays (the bell was growing by 9 every round; now 14 after the first walk and 15 after any number of rounds). The sign-up card only signs the family out; the card after it signs the same family in again, so a family made by hand is kept (a new sample is made only when there is none or its visit is over).
   Texts made true for any family: sign-up ("gets a sample family ready"), sample ("This family has a made-up visit"), waiting ("The request is sent"), My event ("This family has one"), closed day ("The day is closed ... a banner with the reason").
   The closed-day card cancels a request that is still open for the visit (one the owner left, or sent from the lit "Pick a new day"), because the banner shows only while no request is open.
- Tests: `tests/tour-demo-script.test.mjs` (95 checks: the seven after() cards, the bell, the hand-made family, the open request, the new words, the rain sentence) and `tests/account-event.test.mjs` (78 checks: the answer box in each state, the exact closed-day sentences including the desk's own form, `closeModals`, and the real chapter-10 cards run on the real screen). Both were also run against the old files and fail there (22 and 9 checks).
- Left alone: when the owner presses "Pick a new day" and sends it while the closed-day card is up, the banner goes away (it shows only while no request is open) and the lit box is gone. The next card works as before. Going Back and forward brings the banner back.
- For main (not edited by me): the `account-event` row of `tests/README.md` can also say "Mrs. Cathy's answer box on My visits in every state, a closed day with its reason (banner, new-day box and the desk's own form), `DemoUI.closeModals()`, and the tour's chapter 10 cards that open dialogs, run on the real screen"; it takes about 30 seconds now (`tests/timings.json`). `tests/tour-demo-script.test.mjs` has no row.
- Run here with axe-core (AXE_PATH): `account-event` 88 checks and `demo-alerts` 43 checks pass; without it 78 and 39. Also run and passing: `demo-store` 144, `demo-data` 43, `demo-kitchen` 42, `tour-demo-script` 95, `tour-targets` (`WA_WORDS_ONLY=1` 8 checks, `WA_TOUR_ONLY=10` 86 checks), `code-rules`, `validity`, `browser-support`, `privacy-static`, `seo`, `docs`, `doc-commands`, `plain-lint`, `files-audit`, `runner`, `time-bombs`, `no-js`, `privacy`, `interference`.
