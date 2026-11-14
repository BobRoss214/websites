# Notes from helper B: My family, Tell me when, My year (and the shared kit), 3 Nov 2026

> Update, 3 Nov 2026 (second wave): the My year screen described below was taken out at the builder's request (no visit counts, no badges, nothing about how many times a family came). `js/demo-view-year.js`, the `badges` in the store and the `acct-year` hook are gone. See `work-notes/NOTES-account.md`. The rest of this note is as it was written.

Notes only, not part of the website. For the main session to apply or keep.

## Files I made (all of them mine)
- `js/demo-view-kit.js`: shared helpers (DOM builder that only writes text, labelled boxes, On/Off switch, check box, chips, a message thread, date and money words, `mount()` that draws a screen, `view()` that registers it). B2's three screens use it too. It adds ONE style element, `<style id="dvk-css">`, and each screen adds one more (`dvf-css`, `dva-css`, `dvy-css`); every rule starts with `.dvk`, so nothing leaks to the rest of the page. No CSS file of mine exists, so the preview build needs nothing extra.
- `js/demo-view-family.js` (My family), `js/demo-view-alerts.js` (Tell me when), `js/demo-view-year.js` (My year).
- Script order on `account.html`: `demo-view-kit.js` before every `demo-view-*.js` (A's page already has it).

## What the three screens read and write (the names are in /tmp/helpers/KEYS.md and, later, docs/ACCOUNT_DEMO.md)
- My family: reads `family`, saves `update('family', null, {adults:[{name}], kids:[{name, age}], allergies, glutenFree, vegan})` only when the family presses Save (the account `name` in `family` is kept). Pizza (A) and the kitchen (C2) read `allergies`, `glutenFree`, `vegan` from the same record.
- Tell me when: reads `alerts`, `waitlist`, `notices` (link `#alerts`); writes `setAlert(key, bool)` for `strawberries`, `blueberries`, `pumpkins`, `trees`, `spot`. The full-day alert adds ONE waitlist entry `{day, party}`; switching it off, or picking another day, sets the old entry to `active:false` (nothing is deleted). After the desk fires the alert for that day, A marks the entry `notified:true` and the card shows Off again.
- My year: reads `visits` (past = date before today and not `closed`; coming up = today or later) and `badges` (sample picks per kind).
- Tour hooks (one on the outer box of each screen): `acct-family`, `acct-alerts`, `acct-year`.

## The hero game keeps nothing (decided with main)
`js/hero.js` counts the badges in one in-memory object (`tally`, "counted per visit"), writes nothing to the browser, fires no event, and `window.hero` only has `setSeason`. So My year cannot read the game's badges. It shows the six real badges (names, limits and cheering lines copied from `ACH` in `js/hero.js`) with SAMPLE counts that A put in `DemoData.sample` (`badges`), and says so on the screen: "These counts are samples for the demo" and "On the home page game, a badge lasts for one visit. On a real account it would be kept here and follow you to any phone." `js/hero.js` is untouched. If the owners ever want the game to keep badges, that is a separate change: `js/hero.js`, the privacy page, `docs/WHAT_THE_SITE_STORES.md`, and the tests `calm`, `privacy`, `privacy-static`, `monkey`.
If `js/hero.js` changes its badge texts, the words in `BADGES` of `js/demo-view-year.js` must follow (one list, six lines).

## Text for the files I was told not to edit
- `docs/WHAT_THE_SITE_STORES.md`: one sentence for the demo section: "The three family screens My family, Tell me when and My year never touch browser storage themselves; they only call DemoStore."
- `tests/browser-support.table.json`: nothing to add. `node tests/browser-support.test.mjs` passes with my four files (3 Nov, 16 checks).
- `tests/README.md`, `README.md`, `tests/timings.json`: nothing from me.

## Things other people need to know
- `tests/code-rules` ("the home page loads every script in js/") names `demo-view-alerts.js`, `-family.js`, `-kit.js` and `-year.js` until the pattern for `demo-*` is added (A / main, already in the notes).
- `tests/code-read` reads comment lines too: the two characters question mark + full stop (or two question marks) must not appear in a comment of any script.
- The plain AXE path in the setup lines of HANDOFF.md (`/tmp/claude-0/axe-core/axe.min.js`) did not exist on this machine on 3 Nov; `/tmp/axe-install/node_modules/axe-core/axe.min.js` did.
- The shell redraws the screen on every store change and waits while a text box has the focus, so a screen must keep what was typed in a variable of its own and never write to the store while it draws (My family does both).

## For docs/ACCOUNT_DEMO.md (plain words, short sentences; A may use or change them)
- My family: "This screen keeps the family on the account: the grown-ups, the kids with their ages, allergies and food notes, and two reminders (gluten-free crust, vegan cheese). Nothing is saved until the family presses Save. The kitchen shows the food notes on the pizza orders. Saving does not change a visit that is already booked."
- Tell me when: "Five On/Off switches: strawberries, blueberries and sunflowers, pumpkins and tomatoes, Christmas trees, and a spot on a full day (with a day to choose). Each switch is saved at once. When Mrs. Cathy sends an alert from her desk, the family sees a notice under the bell and in the list on this screen. Nothing is sent to anyone."
- My year: "This screen counts the family's visits (so far, this year, coming up), shows a year strip with a dot for each visit, and shows the six badges of the picking game on the home page. That game keeps nothing between visits, so the badge counts here are made-up samples, and the screen says so. A real account would keep them and show them on any phone."

## The kit for people who add a screen later (js/demo-view-kit.js, window.DemoViewKit)
`K.view(name, label, {paint(root, d, redraw), slice(d)})` registers a screen with the shell; `K.h` builds elements (text only); `K.field`, `K.check`, `K.toggle`, `K.chip`, `K.btn` build the controls; `K.thread` is a message box with Mrs. Cathy; `K.toast` uses DemoUI's toast; `K.keepFocus(dataK)` puts the focus back on a control after the shell draws again; `K.onSignOut(fn)` is called when the family signs out or starts over; `K.css(id, text)` adds style rules (all under `.dvk`) when the first screen is drawn; `K.fmtDate / fmtTime / fmtStamp / money` write the farm's words for dates, times and money.
