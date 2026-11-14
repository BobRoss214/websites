# Notes: the Christmas trees of the winter picture are bigger (helper "winter-trees")

## What changed
- `js/hero.js`, `winterField` (the tree lot of the winter picture at the top of the home page): the trees are drawn 1.5 times as tall and wide
  (`TREE_SIZE`; a tree of row t is 1.5 * (18 + 188 t) units tall and 0.727 of that wide: 64 x 46 units in the row at the back, 109 x 79 in the first row
  that can be lit, 210 x 153 in the row at the front; the picture is 1440 units wide) and stand 1.5 times as far apart (`TREE_STEP`: every 1.5th snow lane, every 3rd in
  the two rows at the back). Follow-up (qa): every row is shifted by its own part of a step (`TREE_SHIFT` = 0, .5, .5, 0, .125, .375; it was every other row half a step over),
  because the trees of the rows at 0.4, 0.52 and 0.65 then stood in a line from the back to the front (the two at 0.4 were 80 % behind others): now none is more than 40 % behind
  the trees in front of it (the cone model of the QA helper, also in `tests/hero.test.mjs`), and a tree has to stand whole inside `WHOLE` = 580 units on each side of the middle,
  so 1280 x 1024 (it shows the middle 1182 of the 1440 units, 129 to 1311) cuts none (the first tree at the front left was cut by 27 % there, the next by 3 %; measured in a browser, 10 Nov). In the browser the most hidden tree is now 38 % behind others (was 73 %, 8 trees at 40 % or more), 23 trees drawn, 16 can be lit, as before. The tap area of a tree is its picture and a tenth more all round, so it grew with it.
- The clearings follow the size of the tree (`inTheWay`): none on the stones or in the flames of the two campfires, none in front of the snowman's body
  (`SNOWMAN` is now one constant for `winterFore` and for the clearing).
- 16 trees can be lit (it was 22) and 7 far ones are only drawn (it was 9). The number is written in `docs/QUESTIONS_FOR_THE_FARM.md` (question 64, English and Spanish) and
  `docs/DECISION_PLAYBOOK.md` (d69): changed from 22 to 16 there, and "at least 10 trees are still dark" at the 12th light to "at least 4".
- Not changed: the fires, the snowman, the two big lit trees at the sides (170 x 234 and 150 x 206 units), the far hills, the GreenHouse and its doors, the footer strip, any other season.
- `tests/hero.test.mjs`: new winter checks (`winterView`, `lotView`, and the block after "winter: flames animate"): 16 trees, each 1.5 times the first size, the tap area is the
  picture and a little more, none of the 23 drawn trees is more than 45 % behind trees in front, none is cut by a 1280 x 1024 or 1100 x 800 window, and in 6 window sizes both
  campfires and the snowman are in sight with nothing in front of them and most of the trees can be seen.

## Text to add to tests/README.md (the `hero` row, at the end, before the closing bar)
`, the winter picture (the Christmas trees are 1.5 times as big as they first were and 16 can be lit, the tap area of a tree is its picture and a little more, no tree is more than 45 % behind the trees in front of it, none is cut off by a 1280 x 1024 or 1100 x 800 window; at 1920 x 1080, 1920 x 950 and 1440 x 900, and scrolled down at 1440 x 780, 1366 x 768 and 1280 x 720, both campfires and the snowman are in sight with nothing in front of them and most of the trees can be seen)`

## The other Christmas-tree pictures (not changed)
- Winter button of the season switcher, `index.html` (`data-season="winter"`, `.ss-ico`, `#fir`): a 26 px box (the tree is about 19 x 26 px), 20 px on a phone, 17 px at 360 px.
- "What's on the farm" (`#farm-cards`, the card `data-seasons="winter"`, `.card-art`, `#fir`): 88 px high; its season buttons `.fs-art`: 36 px high (30 on a phone).
- The winter panel of the seasons tabs (`#panel-winter`): the picture `sceneWinter` in `js/main.js` (five firs, 88 to 138 units high in a 480 x 340 card) and the tab `.tab-art` (`#fir`).
- Store (`#shop`), the Christmas trees card: `#p-christmas-tree` in a 56 px bubble (the icon is 78 % of it), 72 px in the wide cards.
- Also `#fir`: the chooser card `.choose-art` (96 px high), the GreenHouse section (`.gh-fir`, 118 and 98 px high; `.gh-trees` 56 px), the footer strip in winter (`footerArt`, 62 to 116 px high firs).
- In the hero picture itself: the firs on the far hill and by the GreenHouse door (`winterFar`, `greenhouse`: 41 to 105 units high) were left as they are.
