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
