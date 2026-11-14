# Store gaps (helper "store-gaps"): less empty space in the "What to buy" cards

The builder's words: "for some of the little boxes, like under Drinks where it says Organic iced coffee, most of the box is empty ... make it so there's less empty space ...
also make sure it stays uniform ... Don't make all the text bigger." (on a computer).

## Cause (measured)
The cards of a row (`.shop-grid`, a flex row) are stretched to the tallest card of the row. A card with a long note or a list of sizes (Hot pretzel, Slushie, Beer/cider/wine,
NC pumpkins, the u-pick tomatoes ...) made its whole row 100-155 px tall and the plain cards beside it (Organic iced coffee, Mini pumpkin, Bag candy ...) were 30-45% full.
"Fill" = from the top of a card's first part to the bottom of its last part, over the card's white box (inside its border).
At 1440 px, English, before: 19 cards under 55%, the worst Mini pumpkin 29.7%, Bag candy / Jar candy 32.8%, Organic iced coffee 37%.

## What changed (final pass, after the independent measurement of 1dd0e25)
The first version made 13 cards two boxes wide, which mixed box sizes in 4-6 groups and left blank space at the side of some wide boxes (Painted rocks, Water bottle refill, Corn pit,
Lavender oil). The final version keeps wide boxes only where they clearly pay: a long note or a list of sizes that made the row tall, and a note that fills the box across.
- css/extras.css, "Wide cards": a card can take the width of two cards (+ the gap) and carry its note BESIDE the name and price (a list of sizes runs across). Such a card is about as
  tall as a card without a note (61-65 px instead of 93-155), so the row is short and its neighbours are full. Type sizes, pictures, words and order are unchanged. The note stays
  under the name when it cannot get 11em beside it. `shop-spread` (the u-pick card only): its two prices share the width of the box, so no blank is left at its side.
- index.html: only classes on 10 card `<li>`s. The class says for how many cards across the card is wide, because a wide card must not leave a hole at the end of the row before it
  (the order of the cards is fixed):
  - `shop-wide3` three across (from 1264 px, and 761-991 px): Hot pretzel, Spicy pecan brittle, Slushie, Organic olive oil, Popcorn kernels, NC pumpkins; farm group, 761-991 px only:
    Wagon ride and the u-pick tomatoes
  - `shop-wide2` two across (992-1263 px, and a phone up to 760 px, where a wide card is a whole row): Hot pretzel, Spicy pecan brittle, Slushie, Blackberry plant, NC pumpkins;
    farm group, phone only: Corn pit and the u-pick tomatoes
  - `shop-wide5` / `shop-wide4` five / four rides across in the farm group (from 1264 / 992 px): the u-pick tomatoes & basil only
  At 1366 px 7 of the 67 boxes are wide (13 before), 6 at 1100 px. No wide box ends alone in a row (the pumpkin and drink boxes that did are normal again).
  The print layout is untouched (every wide rule is `@media screen`, and the print block still sets `display:block` on every card).
  If cards are added to or taken out of a group, the rows can get a hole: tests/shop.test.mjs ("every row of cards is full except the last") names the row; change the classes.
- Drinks: no wide boxes. The Beer, hard cider & wine card (3 lines of note) made the Organic iced coffee row 125 px tall; it is to leave Drinks for a group of its own, and
  then that row is [coffee, refill] = 61-95 px, the coffee box 61-68% full (simulated by removing the card: before 17 cards under 55% at 1440 px, after 3). Until it is gone the
  coffee box is 37% full at 1440 px (50% at 1366 px). tests/shop.test.mjs measures the fill without that card (it does nothing once the card is gone).
- tests/shop.test.mjs: the cards across are counted with a wide card as two; every row but the last of a grid is full; the cards of a row end at the same height (no ragged
  bottoms); and a fill check in English at 1440, 1280 and 1100 px (no card under 40%, at most 4 under 55%, at most 7 under 60%, Organic iced coffee at least 60%, wide boxes filled
  across at least 75%).

## Numbers (English, page without the Beer card, 1440 / 1280 / 1100 px; cards under 55% / under 60%; worst card)
before 17 / 18 (29.7%), 14 / 20 (26.8%), 9 / 9 (31.2%); after 3 / 4 (50.6%), 3 / 6 (42.7%), 1 / 3 (50.6%).
Left: Lip balm (beside the two-line notes of Lavender oil), Scavenger hunt and Sunn hemp maze (no note, beside the 93 px Corn pit and the rides). Making more boxes wide for them
would leave blank at the side of those boxes.

## Text for the main (README files are not edited by this helper)
tests/README.md, row `shop`, layout part: "the product grids count a wide card as two cards across; every row of cards but the last is full (no hole); the cards of a row end at
the same height; in English at 1440, 1280 and 1100 px no card is mostly empty (none under 40% of its white box, at most four under 55% and seven under 60%, Organic iced coffee at
least 60%) and every wide box is filled across (at least 75%)".

No new CSS property or JS: every property used in the new rules was already in the stylesheet (tests/validity, browser-support: nothing to add).
