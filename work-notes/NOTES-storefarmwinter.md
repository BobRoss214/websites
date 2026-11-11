# Notes of the storefarmwinter helper (11 Nov 2026): the farm lines that said the opposite of the builder's winter rule

The builder's rule: while winter is on the farm is open only the two tree weekends, no reservation, no rides, tomatoes are done. These lines still said otherwise and are now for the other seasons: they carry `data-only="spring summer fall"` (the same gate as the pizza lines above them), so spring, summer and fall read and look exactly as before and a page without JavaScript shows them as before. No text was added and no key changed (nothing to translate).

## What is hidden while winter is on

- index.html, the Store: the whole group "Farm visit, rides & picking" (`#shop-farm`: Farm fun, wagon ride, barrel train, corn pit, scavenger hunt, sunn hemp maze, u-pick tomatoes & basil, strawberries, blueberries, and its foot: "reservation-only", "ride tokens", "Reserve your visit", "See the tomato varieties") and its jump button (`.shop-jump li.sg-farm`) together. The jump row has 12 buttons then.
- index.html, "Optional add-ons": the Wagon ride and the Barrel train lines.
- index.html, step 1 of the three steps and the "Reserve a time" card of the first-visit guide: the sentence "The farm is always reservation-only ..." (heading and button stay; the lead line above says the steps are for the other seasons).
- pages/first-visit.html: the same sentence. pages/pumpkin-patch.html: the card "Reservations only" and the FAQ "Do I need a reservation for the pumpkin patch?". pages/strawberry-picking.html: "By reservation only, no walk-ins" and the FAQ "Do I need a reservation to pick strawberries?".
- pages/pumpkin-patch.html, more: the Wagon ride and Barrel train prices, the card "U-pick tomatoes & basil", the card "No reservation?" ("It does not include farm access" is not true on the tree weekends), and in the Wise Pie card the sentence "drop in at The GreenHouse from 4 to 8 pm, Friday through Sunday", which in winter is replaced by the sentence the other pages already have ("The GreenHouse is open 11 am-8 pm Not official yet and serves Wise Pie pizza Not official yet", same key, same translations).

## Left alone on purpose (asked not to touch, or a question for the builder)

- Static text that cannot follow a season: the meta description and JSON-LD "Farm reservations required" (index.html lines 8 and 50; the descriptions of pages/pumpkin-patch.html and pages/strawberry-picking.html; the FAQ answers that tools/pages.py copies into those pages' JSON-LD).
- The header Reserve button, the "Fall 2026" packages and schedule (owner decision d01, patches/optional/winter-A-hide-fall-booking.patch), the add-ons "Corn pit" line (Thursdays, reservation) and the tomato add-on, the packages' "Reserve your visit" button.
- The tomato sections: #tomatoes and its varieties, the menu link "Tomatoes & basil", the calendar row, the FAQ "Do you have u-pick tomatoes?" and "Fall, tomatoes & basil", the fall tags. Also the pizza menu words "tomato sauce".
- Other ride words: the menu link "Rides & add-ons", step 3 "Add pizza, a wagon ride or the corn pit" (inside the steps that are for the other seasons), the table rows "Wagon ride"/"Barrel train" (their winter column says no), "Wagon ride through the woods" (group visits), the pumpkin page's fall prices and add-ons, the first-visit page's two lines about wagon rides.

## For main (README / tests README, not edited here)

- tests/README.md, row `shop`: add "winter (page clock 1 Dec): the farm visit group and its jump button are hidden together, 12 groups and 12 buttons, nothing in the Store says ride, wagon, barrel train, tomato, reservation-only, walk-in, Reserve your visit or Thursday; in summer 13 and 13" (part 10 of tests/shop.test.mjs).
- patches/optional/winter-A-hide-fall-booking.patch was made again (index.html part only): the farm group, its jump button and step 1 carry the new gate in its context and the patch still turns the group and the button into `data-only="fall"`.
