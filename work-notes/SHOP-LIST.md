# Wise Acres: the products list for the shop section (the final list, 24 Oct 2026)

Source: 36+ photos of real signs and shelves (transcribed in `PRODUCTS.md` next to this file; read it if you need a detail).
RULES: never invent a price, a flavor, an hour or a fact. `?` means "Prices coming soon" (the farm has not confirmed it). Do NOT copy phone numbers, health claims, or fine print. Third-party makers may be named plainly (no contact details).

This is the list the Shop section of `index.html` (`#shop`, "What to buy at Wise Acres") shows today, after the decisions at the end of this file. `tests/shop.test.mjs` checks the page against it, through `tests/shop-list.json`. After you change a line here, make that file again and run the test:
`node tests/shop-list.make.mjs work-notes/SHOP-LIST.md` and then `node tests/run-all.mjs =shop`. The test also fails when the file and this list no longer match.

Format: `slug | English name | price | small note | what to draw`
The slug is the icon id: the picture is the SVG symbol `p-<slug>` (so `p-hot-pretzel`).
A price is `$5`, `$3 small, $4 large`, `$.84 a pound`, `$15 to $17` (a range), `$19.99 (8 oz)` (one size), `basil $1 a stem` or `Free`. The card's English name is exactly the name in this list.

## A. Groups 1-6 (food and drink). Group names are the section headings.

### 1. Snacks & treats (at the barn)
- hot-pretzel | Hot pretzel | $5 | Add Pumpkin Spice Ricotta or Caramel Apple for +$2. Caramel Apple contains nuts. | a big salted soft pretzel
- cider-donut | Apple cider donut | $4 | | a cinnamon-sugar ring donut with a bite out
- popcorn | Organic popcorn | $4 | | a red-and-white striped bag/cup overflowing with popcorn
- kettle-corn | Kettle corn | $11 | | a clear bag of golden kettle corn with a green label
- snack-bag | Bagged snacks | $1.25 | | a small crinkly chip bag
- brittle | Spicy pecan brittle | $8 | Barnhardt Sweets, Matthews NC, 5.5 oz | a kraft bag with a window showing amber brittle pieces + a pecan
- bag-candy | Bag candy | $5 | | a clear bag of colorful candies
- jar-candy | Jar candy | $11 | | a glass jar with a lid full of candy
- slushie | Slushie | $3 small, $4 large | Also on the board with the slushies: organic strawberry lemonade, apple cider | a clear cup with a red-and-blue swirl slush and a straw
(The lemonade and the apple cider are NOT cards of their own: they hang under the slushies on the barn board with no price, so they are only named in the slushie note.)

### 2. Ice cream (Waxhaw Creamery, in the Ice Cream Barn)
- ice-cream | Waxhaw Creamery ice cream | 1 scoop $4, 2 scoops $6 | Gluten-free sugar cone +$1. Flavors on the board: Cookie Dough, Chocolate, Vanilla, Cookies & Cream, Mint Chocolate, Peach, Brownie Bites | a two-scoop cone (pink + brown)
(One card only; the flavors are small chips; the board changes, so the page says "on the board now".)

### 3. Pizza (The GreenHouse)
- pizza | Wise Pie pizza | $15 to $17 | Gluten-free crust is +$9 and vegan cheese is +$3. These prices come from the farm's own older page and stay. LINK to the existing page wise-pie.html. Opening hours may show in this group, as on the older page | a pizza with a slice pulled away
(The older page is the site before the Shop was built, commit e3a195f; `tests/shop-list.make.mjs` checks these words against it. The hours it gave are Friday-Sunday, 10 am-8 pm.)

### 4. Drinks
- water | Water | $1 | | a clear bottle with a blue cap
- sparkling-water | Sparkling water | $2 | | a bottle with bubbles
- izze | Izze | $2 | | a can with fruit
- organic-milk | Organic milk | $3 | | a small milk bottle
- canned-water | Canned water | $2 | | a tall silver can with a blue drop
- kombucha | Kombucha | $5 | | an amber bottle with a swirl
- iced-coffee | Organic iced coffee | $5 | | a clear cup, iced coffee, straw
- refill | Water bottle refill | $0.50 | bring your own bottle | a water bottle with a tap/drip
- beer-wine | Beer, hard cider & wine | $6 | Every beer, hard cider and wine is the same price. What's pouring changes. | a beer glass + a wine glass + a cider can (no brand names, no logos)
(Do not put an age statement; check what the page already says about alcohol and reuse it, or say nothing. The older "Please do not bring your own alcohol" line stays in this group.)

### 5. From our pantry & friends (jars, bags and bottles at the barn)
- honey | Local honey | $14 | 16 oz jar, from a local beekeeper | a skep-shaped honey jar with a bee
- honeycomb | Honey with honeycomb | $20 | a jar with a piece of honeycomb inside | a quilted jar with a comb
- jam | Jam | ? | Best Jam Ever: Fizzy Bizzy Berry, Blapple, raspberry | two jam jars with kraft labels
- olive-oil | Organic olive oil | $35 | Almeria Gold, extra virgin, 500 ml, from Spain | a dark bottle with a green olive label
- olives | Olives | $12 | | a jar of green olives
- pasta | Pasta | $9 | | a bag of spiral pasta with a window
- popcorn-kernels | Popcorn kernels | $8 | Brian Severson Farms, organic white heirloom, 24 oz | a clear bag of white kernels with a green label
- elderberry-syrup | Elderberry syrup | $19.99 (8 oz) | Sweet's Elderberry. Kept in the cooler | a dark bottle with a purple berry label
- elderberry-shrub | Elderberry shrub | ? | Sweet's Elderberry, 16 oz, on the table | a dark bottle with a berry + ginger label
- elderberry-kit | DIY elderberry syrup kit | $20.99 | Sweet's Elderberry. Makes up to 32 oz | a kraft bag with a berry sticker
(Do NOT repeat any health claim from the brand's sign. Describe the product, name the maker. Only the 8 oz syrup bottle is shown: no 16 oz line.)
(The honey with honeycomb card is REAL: the owner's last two photos, "Batch 14" in `PRODUCTS.md`.)

### 6. Fresh bread & cookies (Crowe's Dough)
- sourdough | Sourdough bread | $14 | Long-fermented, in a paper bag | a round crusty loaf with a score mark in a paper bag
- pancake-mix | Sourdough pancake mix | $11 | | a pouch with a pancake stack picture
- sourdough-cookie | Sourdough chocolate chip cookie | $9 | | a chunky cookie with chips

## B. Groups 7-12 (things to take home and things to do)

### 7. Gifts & home (the gift corner at the barn)
- candle | Soy candle | $20 | Wood wick. Scents like Kokomo and Apple Harvest | an amber jar with a gold lid and a little flame
- room-spray | Room & linen spray | $17 | 8 oz. Scents like Tobacco Barn and Christmas Hearth | an amber spray bottle with a white label
- soap | Soap | $5 | In a little organza bag | a flower-shaped soap in a sheer bag with a ribbon
- lavender-oil | Lavender oil | $15 | Made with flowers grown and dried here, in sunflower oil | an amber dropper bottle with a lavender sprig
- eucalyptus-oil | Eucalyptus oil | $15 | In sunflower oil, with lemon | an amber bottle with eucalyptus leaves
- lip-balm | Lip balm | $4 | | a little tin or tube with a bee/flower
- painted-rock | Painted rocks | $4 small, $5 large | | two smooth rocks painted like a ladybug and a sunflower
(No candle weight: the photos give 16 oz in one place and 14 oz in another.)

### 8. Wear Wise Acres
(ALL prices are `?`. Do not state any price.)
- trucker-cap | Trucker cap | ? | Green, with the Wise Acres heart logo. In the youth sunhats basket | a green mesh-back cap with a red apple-heart logo
- bucket-hat | Bucket hat | ? | Cream or black. In the youth sunhats basket | a cream bucket hat with a little logo
- t-shirt | T-shirt | ? | Youth T-shirts | a red t-shirt with the heart logo
- sweatshirt | Sweatshirt | ? | Adult sweatshirts | a green hoodie
- tote-bag | Canvas & linen bags | ? | | a cream canvas tote with the logo

### 9. Plants to take home
- lavender-plant | Lavender plant | $5 | Provence, Exceptional, Phenomenal | a small pot with a purple lavender bush
- strawberry-plant | Strawberry plant | $5 | Fronteras | a small pot with a strawberry plant and a red berry
- blackberry-plant | Blackberry plant | $17.50 | Ouachita, Natchez, Prime Ark Traveler | a pot with a cane and black berries
- mum | Local mums | 8" $8, 10" $13, 12" $20 | Potted mums in yellow, orange, gold and pink | a pot of round fall mums

### 10. Fall & holidays
- pumpkin | NC pumpkins | $0.84 a pound | Big pumpkins are sold by the pound. Weigh them at the weight station by the barn. On the barn display, each mini pumpkin is $1.50 and each medium pumpkin is $4.00. | three pumpkins (orange, white, blue-gray)
- mini-pumpkin | Mini pumpkin | $1.50 | | one tiny orange pumpkin and a striped gourd
- straw-bale | Mini straw bale | $6 | | a small tied straw bale
- corn-stalks | Corn stalk bunch | $8 | | a tied bundle of tall corn stalks
- christmas-tree | Christmas trees | ? | from the NC mountains. Dates: keep the page's existing wording only (the farm has two different dates on file); details and pre-orders are on this website | a green fir tree with a red bow
(The $0.84 is the card's price. The $1.50 and the $4.00 are only named in the note, as the barn display's prices; the page shows no other amount on this card.)

### 11. Flowers
- flower-jar | U-cut flower jar | $18.50 | Buy a jar at the register, pick up clippers, head to the field | a jar of zinnias, marigolds, celosia and a sunflower
- farmhouse-jar | Farmhouse jar | $3 | An empty jar for your flowers | a clear mason jar with a pink tag

### 12. Farm visit, rides & picking (ride tokens at the barn). These are already on the site; show them as a small compact group that links to the add-ons and u-pick sections, do not duplicate their long text.
- wagon-ride | Wagon ride | $4.50 | Ages 2 and younger ride free. These words come from the farm's older page and stay | the tractor + wagon (reuse the existing symbols `#tractor`/`#wagon` if they fit)
- barrel-train | Barrel train | $3 | Ages 12 and under only. These words come from the farm's older page and stay | reuse the existing `#barrel-train`
- corn-pit | Corn pit | $4 | Buy one, get one free on Thursdays with reservations. These words come from the farm's older page and stay | a small corn cob drawing (`p-corn-cob`, made for the Shop) Better: skip an icon for this one and use `p-corn-cob`.
- scavenger-hunt | Scavenger hunt | Free | | a magnifying glass over a paw print
- sunn-hemp-maze | Small sunn hemp maze | Free | | a small green plant with yellow flowers (`p-sunn-hemp-mini`, made for the Shop)
- upick | U-pick tomatoes & basil | tomatoes $4.50 a pound, basil $1 a stem | Every weekend, late September through October. These words come from the farm's older page and stay | a basil leaf + a tomato

## Cards the page also shows that are NOT in this list

Five cards were already on the farm's older page, before the Shop was built, and stay with exactly their old words (the test names them, and `tests/shop-list.make.mjs` checks each one against commit e3a195f): "Farm fun, no pizza" ($3 per person), "Farm fun with pizza" ($31 base price, plus $3 per person), and "Prices coming soon" for "U-pick strawberries" (in spring), "U-pick blueberries" (in summer) and "U-pick pumpkins" (pick your own in the patch).

## Decisions (24 Oct 2026) that the list now follows

1. Card names: where the page and the list only differed in wording the page's name wins: "Waxhaw Creamery ice cream", "Local mums", "NC pumpkins", "Small sunn hemp maze", "U-pick tomatoes & basil", and the heading of group 12, "Farm visit, rides & picking". The soap card is just "Soap" (no photo says handmade).
2. Pizza: the prices ($15 to $17, +$9, +$3) and the opening hours shown in the pizza group come from the farm's own older page and stay. The old rule "pizza shows no price" is dropped.
3. Taken out on purpose: the cards "Organic strawberry lemonade" and "Apple cider" (their words are a note on the Slushie card), the "16 oz $32.99" elderberry syrup line, the kettle corn note "big bag", "sparkling juice" after Izze, and the candle weight. The test makes sure "big bag", "handmade" (soap) and "sparkling juice" do not come back.
4. Pumpkins: the card's price is $0.84 a pound; the note names the barn display's $1.50 (mini) and $4.00 (medium). No other amount.
5. The pretzel note adds "Caramel Apple contains nuts."; the beer, hard cider and wine card says "$6" and "the same price" (no "each").
6. The ages on the wagon ride (2 and younger ride free) and the barrel train (12 and under) come from the older page and are allowed.
7. The honey with honeycomb card ($20) is real and stays. A price the farm has not confirmed stays "Prices coming soon", and the test checks that those cards show no dollar sign (jam, elderberry shrub, the five wear cards, Christmas trees, and the three older "Prices coming soon" cards).
8. The two jump buttons "Wise Pie pizza" and "U-cut flower jar" do not carry their group's name ("Pizza", "Flowers"): the top menu already has links with those names that go somewhere else, and the link-names check wants two links with the same words to lead to the same place. The test knows these two names.
