# Store gaps (helper "store-gaps"): less empty space in the "What to buy" cards

The builder's words: "for some of the little boxes, like under Drinks where it says Organic iced coffee, most of the box is empty ... make it so there's less empty space ...
also make sure it stays uniform ... Don't make all the text bigger." (on a computer).

## Cause (measured)
The cards of a row (`.shop-grid`, a flex row) are stretched to the tallest card of the row. A card with a long note or a list of sizes (Hot pretzel, Slushie, Beer/cider/wine,
NC pumpkins, the u-pick tomatoes ...) made its whole row 100-155 px tall and the plain cards beside it (Organic iced coffee, Mini pumpkin, Bag candy ...) were 30-45% full.
"Fill" = from the top of a card's first part to the bottom of its last part, over the card's white box (inside its border).
At 1440 px, English, before: 19 cards under 55%, the worst Mini pumpkin 29.7%, Bag candy / Jar candy 32.8%, Organic iced coffee 37%.

## What changed
- css/extras.css, "Wide cards": a card can take the width of two cards (+ the gap) and carry its note BESIDE the name and price (a list of sizes runs across). Such a card is
  about as tall as a card without a note (61-65 px instead of 93-155), so the row is short and its neighbours are full. Type sizes, pictures, words and order are unchanged.
  The note stays under the name when it cannot get 11em beside it (long names, narrow cards).
- index.html: only classes on the card `<li>`s (17 cards). The class says for how many cards across the card is wide, because a wide card must not leave a hole at the end of the
  row before it (the order of the cards is fixed):
  - `shop-wide3` three across (from 1264 px, and 761-991 px): Hot pretzel, Spicy pecan brittle, Slushie, Water bottle refill, Beer/cider/wine, Organic olive oil, Popcorn kernels,
    Lavender oil, Painted rocks, NC pumpkins, Christmas trees; in the farm group (761-991 px only): Wagon ride, Corn pit, U-pick tomatoes & basil
  - `shop-wide2` two across (992-1263 px, and a phone up to 760 px, where a wide card is a whole row): Hot pretzel, Spicy pecan brittle, Slushie, Blackberry plant, Local mums,
    NC pumpkins, Christmas trees; in the farm group (phone only): Corn pit, U-pick tomatoes & basil
  - `shop-wide5` / `shop-wide4` five / four rides across in the farm group (from 992 px): Corn pit, U-pick tomatoes & basil (both), Wagon ride, Barrel train (four only)
  The print layout is untouched (the rules are `@media screen` / `max-width`, the print block still sets `display:block` on every card).
  If cards are added to or taken out of a group, the rows can get a hole: tests/shop.test.mjs ("every row of cards is full except the last") names the row; change the classes.
- tests/shop.test.mjs: the cards across are counted with a wide card as two; every row but the last of a grid is full; the cards of a row end at the same height (no ragged
  bottoms); and a new fill check in English at 1440, 1280 and 1100 px (no card under 55%, at most 6 under 60%, the builder's Organic iced coffee at least 60%).

## Numbers (English, computer widths 992-1920 px, 8 widths; cards under 55% / under 60%)
before 114 / 128 (worst 26.8%), after 0 / 26 (worst 56.4%: Sunn hemp maze; the others under 60% are Corn pit, Scavenger hunt, Local honey, Mini pumpkin: 57.9-59.5%).
The cards left under 60% sit next to the ride cards (82 px: a 48 px picture and a note) or the "Prices coming soon" cards, which cannot get shorter without changing sizes.

## Text for the main (README files are not edited by this helper)
tests/README.md, row `shop`, layout part: "the product grids count a wide card as two cards across; every row of cards but the last is full (no hole); the cards of a row end at
the same height; in English at 1440, 1280 and 1100 px no card is mostly empty (none under 55% of its white box, at most six under 60%, Organic iced coffee at least 60%)".

No new CSS property or JS: every property used in the new rules was already in the stylesheet (tests/validity, browser-support: nothing to add).
