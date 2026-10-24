# Saved, ready to add: phones held sideways and live tables on one screen

`merged-one-screen.patch` is NOT applied to the site yet. It is the finished work of two helpers merged together (and merged with the rank fixes that are
already in the site), made against the code as committed when this was saved. Apply it from the `givespin/` folder:

    patch -p1 < docs/wip/merged-one-screen.patch

What it adds:
- **Solo games on a phone held sideways and on short laptop windows** (landQA, notes in `notes/landQA-sideways-phones.md`): a two-column layout, a rotation fix,
  a cramped-568x320 fix, Drop Crate / Slots / Plinko / Coin Flip / Last One Standing short-window rules, a Drop Crate bug fix. New test section 13zt (79 checks).
- **Live tables on one screen** (liveQA, notes in `notes/liveQA-live-tables.md`): a docked stake and join bar with an Options sheet on a phone, a "Pick a charity"
  button that opens the odds board, the result card scrolled into view, keyboard fixes, sideways-phone layout. New test section 13zu (87 checks); section 13c now runs
  on a laptop and a phone.
- Rank notes for the record are in `notes/rankQA-ranks.md` (those fixes are already in the site).

How it was checked: each helper ran the WHOLE end-to-end suite on its own copy (landQA 2,425 checks, liveQA 2,452 checks, 0 failures; 290/290 unit tests on the merge).
The two were then merged by hand in one place (`js/ui/game.js`, the line that works out how much room to keep under the picture): this merged result has had the
unit tests and a syntax check; the whole end-to-end suite on the MERGED tree may not have been run yet. Run it before committing:
`cd givespin && patch -p1 < docs/wip/merged-one-screen.patch && node --test tests/*.test.js`, then the end-to-end suite (see the README, "Tests"), fix what fails,
set the README's end-to-end count to the real total, delete this `docs/wip/` folder, commit and publish.

Known limits (details in the notes): Chromium only (no real phone, Safari or Firefox); windows narrower than 561 px and shorter than about 520 px cannot fit a
picture; a few landscape controls are small when the picture is shrunk (Coin Flip marks, slot Turbo / How it pays); axe reports a "partially obscured" target-size
item on whichever control straddles the bottom of the scrolling landscape panel (a geometry artefact); live tables on a 568x320 phone are cramped.
