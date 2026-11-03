# Notes from helper alerts (H-A): the "Tell me when" screen, 3 Nov 2026 (second wave)

Notes only, not part of the website. For the main session to apply or keep. Branch `alerts` in /tmp/alerts-clone.

## What the builder asked, and what is now on the screen
1. "A spot opens on a full day" is the FIRST choice, and there are two choices about a visit: "A spot opens on a full day" and "Reservations open". After them come the four seasons in the site's order (strawberries, blueberries and sunflowers, pumpkins and tomatoes, Christmas trees).
2. At the TOP: "Where should we send these messages?" with two big switches, "Text message" (shows the pretend phone number) and "Email" (shows the account's email). One or both can be on. If the family turns off the last one it stays on and a note says "Keep at least one on, so we can reach you." Nothing is sent; the choice is only kept in the pretend account.

## Files I changed (all inside my parts)
- `js/demo-view-alerts.js`: rewritten (mine).
- `js/demo-data.js`: new constant `SAMPLE_PHONE` ('(555) 010-0123', exported), `alertKinds` (new key `reservations`, new order spot, reservations, strawberries, blueberries, pumpkins, trees, and each entry now has a `note`), two keys `phone` and `notify` in the sample family, one export line.
- `js/demo-store.js`: `getNotify()` and `setNotify(patch)` after `setAlert`, and one more line in the returned object. The choice lives in `family.notify` (no new top-level key, so a state saved before this still loads: it reads as both on).
- `js/tour-steps-c.js`: ONLY the text of the step `ch10-alerts` (44 words).
- `account.html` (generated): two more drawings in its icon sprite (`i-phone`, `i-clock`), because the screen now names them.
- Tests: `tests/demo-store.test.mjs` (first line of section 9 changed, new section "9b", one new block with a fake page for the change event), `tests/demo-data.test.mjs` (one new block before "the demo's scripts keep to the data file"), new `tests/demo-alerts.test.mjs` (browser).
- `docs/ACCOUNT_DEMO.md`: the store table row, the `alerts` shape, a new section "The Tell me when screen", the list of checks.

## Merge by hand (main)
- I trial-merged the account helper's committed branch (96eeec9 in /tmp/account-clone) into mine in a temp copy with a real `git merge`: ONE conflict, `docs/ACCOUNT_DEMO.md` in the list "The shapes" (the `family`, `event` and `notice` lines). Keep their new lines and put my two small edits back: the `family` line gets `phone, notify` at the end of its braces plus the words "`phone` and `notify` belong to Tell me when (see "The Tell me when screen" below)", and the `alerts` fragment at the end of the `notice` line reads `{ spot, reservations, strawberries, blueberries, pumpkins, trees }`. Everything else merged by itself (js/demo-data.js, js/demo-store.js, js/tour-steps-c.js, both store and data test files, even the generated account.html, which is rebuilt anyway, see below). After the pages were rebuilt, `tests/demo-alerts.test.mjs` (42 checks), `demo-store` (144), `demo-data` (43) and `tour-demo-script` (68) all passed on the merged tree.
- `js/demo-data.js`: my hunks are the `SAMPLE_PHONE` constant and the `alertKinds` block (both just above "Links that already exist"), the two keys after `allergies:` in the sample family, and one line at the top of the `api` object. Their changes (`SAMPLE_ACCOUNT`, `sample()` signature, `events:` and `badges:` lines, the events block, `CONTACTS`) are elsewhere.
- `account.html` is generated. After merging both branches run, one after the other: `python3 tools/pages.py`, `python3 tools/i18n.py extract`, `python3 tools/i18n.py build`. The result must keep `<symbol id="i-phone"` and `<symbol id="i-clock"` (they come from the quoted words 'i-phone' and 'i-clock' in `js/demo-view-alerts.js`). `K.sprite()` leaves a picture out when the page lacks it, so nothing breaks if that is forgotten, the two big switches just have no round picture.
- If H-B's sign-up gets a phone box: after `createAccount` call `DemoStore.setFamily({ phone })`. Nothing else reads a phone.

## Text for the files I was told not to edit
- `tests/README.md`: one row for `demo-alerts` (order 87, needs a browser, not part of `--quick`): "The Tell me when screen of the account demo in a real browser: the order of the choices, the two big switches for text message and email (at least one stays on, the friendly note), the full-day choice and Reservations open with the desk, a phone, axe-core."
- `tests/timings.json`: nothing yet (`node tests/run-all.mjs --update-timings demo-alerts` once it has run on a quiet machine).
- `tests/browser-support.table.json`: nothing to add. The test is red before and after my change for the same two old names only (`js-name:notify` in `js/demo-kitchen.js` and `js/demo-store.js`, and `css-prop:resize` in `css/demo-visits.css`); my new names (`getNotify`, `setNotify`, `notifyOf`) are not flagged.
- `docs/WHAT_THE_SITE_STORES.md`: nothing. The new screen touches no browser storage itself; the choice is kept by `DemoStore` under the same one key.
- `README.md`: nothing.

## Things other people should know
- `tests/tour-targets.test.mjs` (words part) is red before and after my change on the step `ch10-paid` (47 words, the limit is 45; the batch-1 wagon change made it longer). It is not my step; my step `ch10-alerts` passes the word rules.
- `tests/docs.test.mjs` is red before and after on `docs/DECISION_PLAYBOOK.md` lines that still quote the old wagon-ride words (batch 1). Not mine.
- The farm desk (`js/demo-desk.js`) needed no change: it builds its "People waiting" rows from `DemoData.alertKinds`, so "Reservations open" appears there by itself (first, then the four seasons, then one row for each day somebody waits for). Its own fall-back word list (used only when `DemoData` is missing) does not know `reservations`; that list is never used on the real page.
- The sample phone is the one main wrote in the brief, `(555) 010-0123`. Area code 555 is not in use, so it cannot ring anyone. (The reserved "555-01xx" lines are written `xxx-555-01xx`, so if main prefers that style, change the one constant `SAMPLE_PHONE` in `js/demo-data.js`; `tests/demo-data.test.mjs` only asks for the shape `(555) ddd-dddd`.)
- `tests/code-read` reads comments too: the two characters question mark plus full stop (or two question marks) must not appear in a comment.
