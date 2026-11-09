# Notes from critter (second wave): the bee and butterfly, the calm mode, the falling leaves

Short and plain. Everything is committed on branch `critter` in /tmp/critter-clone2 (the second review round, R2, is the last commit).

## What was really wrong (and is fixed): "jumping around"

The follower starts a short straight leg ten times a second and starts each one from "where it is now". It used to ask the leg how far
it had got (`getComputedTiming().progress`). A new leg only gets its start time when the browser draws its next frame. On a computer that
draws a frame only now and then (a slow phone, a laptop with many things open, a preview in a frame) the script still thought the leg had
not started (progress 0) while the browser was already moving it. The next leg then began at the place where the last leg STARTED, so the
bee or butterfly went back to where it had been, again and again, and only moved on in bursts. I watched this in screenshots of what the
browser really draws (a screencast, creature painted pink): with the old code the same few spots came back all the time and the creature
was a long way from the pointer (median 236 px); with the fix it keeps company with the pointer (median about 100 px under the same load).

Fix (js/main.js, initBee): every leg gets its start time at once (`anim.startTime = clock()`, the browser's own animation clock) and where the
creature is at a moment is worked out from that start time and the leg's length. A browser that does not take a start time falls back to
asking the leg, as before, and then waits for a leg that is not drawn yet instead of throwing it away (R2). Nothing else about how it moves
changed (same speeds, same 240 ms legs, same 100 ms look).

## R2 (the reviewer's list), item by item

js/main.js, initBee:
- A change of kind can never stay stuck: `swap()` sets a guard (12 s, `LEAVE_MAX`) that puts the other kind there if the creature has not got out of the hero by then;
  `arrive()` clears it. The guard is set before the first leg is made, so even an error inside it cannot leave a change without an end.
- Pause (or a hidden tab, or scrolling away) while the creature is changing kind: if it is still in sight it stays where it is, as what it is (the change is put off
  for 45 to 75 s); if it is already out of sight it is put back inside the hero as the other kind, parked (as before). It used to be put at x 12 in the other kind.
- A window made smaller: `fit()` puts a creature that lies outside the hero (parked or at rest) back inside it, and the spot it was going for; a pointer left beyond the new
  edge is followed to the edge (`spotOf` clamps).
- The fallback for a browser that takes no start time waits one look for a leg that is not drawn yet (`chase()`).
js/main.js, initMotion:
- "most" spares the follower, like "light": only the visitor's Pause ("all") rests its wings. (`wanted()`: the follower check is before the "most" test.)
- The leaves and snow fade out (0.6 s) before they rest: `FADE = 650`, `fadeEnd`; `wanted()` skips `.particles` until it has passed; `set()` rests again 680 ms later.
- After the one way back from "light" the next look comes at once (`quick = 1`) and ONE bad look puts it back to "light" (`bad >= (recovered && !level ? 1 : 3)`).
  A page that was only slow while it loaded still stays at full motion.
- `wake()` (see below) starts the tipping of a falling leaf again with its drifting.
css/hero.css:
- `.particles` has its own `transition: opacity .6s` in the base rule (it used to be only inside the calm rule, so the layer faded out but jumped back in).
- `heroSnow` uses `--fh` (the hero's own height) like the leaves, instead of 34vh / 70vh / 108vh.
- `@supports not (translate:0 0){.particles{display:none}}`: a browser without single-property transforms shows no leaves or snow instead of a row of them along the top edge.
js/hero.js:
- `--fh` is set again by a ResizeObserver on `#critters` (and still on the window's resize): the hero's picture changes size without a window resize (fonts, a season's words).
- (earlier, kept) `window.WISE_ACRES.critter.changeIn`: read-only, ms until the next change of kind (Infinity when the address picks the kind); the test uses it for "45 to 75 s".

Other change in initMotion `wake()` (first round): when motion comes back after Pause (or after the page's own calm mode), the animation on a leg's `::before` (the
tipping of a falling leaf) was only resumed, while the leaf itself was started again: after one Pause and Play the tipping was no longer in step with the drifting. It is
now started again with it.

## Tests (all four files are mine)

- tests/critter.test.mjs: rewritten for the new flight. It writes down every leg the page starts (a wrapper round `Element.animate`) and checks: short, straight, only the
  transform, speed of the kind, start time at once, each leg begins exactly where the one before it had got to. The way the creature goes is worked out from the legs (a look
  at the box every frame is not used: every look costs a busy page so much that its timers run late). A light look at the real box proves the browser draws what the legs say.
  Also: speed by distance, the bee's smooth turn, the butterfly's sway and lean, the circle, 20 s of rest (settles, strolls slowly, stays in the hero, never still for long, rests beside
  the buttons), parked by Pause / hidden tab / out of sight / winter, calm light and most do not stop it, resize, a pointer that enters over a button or a drawn friend, the change of kind,
  reduce motion, phone 390, the 45 to 75 s schedule. New in R2: a BUSY page (every frame costs 90 ms: the real requestAnimationFrame is taken before the pretend clock replaces it)
  where the creature must still reach the pointer three times, never go back, keep the start-time and join checks, and finish a change of kind; the same in a browser that takes no
  start time (the setter is made to do nothing); a change of kind that cannot get out (the page's animation clock is made to stand still: 5 s on it is still the same kind, 13 s on
  the other kind is there); Pause as the change starts (stays where it is, same kind) and when it is already out of sight (back inside, other kind); a window made smaller with the
  creature parked beyond the new edge, and with a pointer resting beyond it.
  Run against the code before R2 it fails exactly those: busy page without start time (never reaches the pointer), the stuck change, Pause in sight, both resize checks.
  Run against the code from before the first fix it fails the start-time check and every busy-page check (the creature never reaches the pointer).
- tests/calm.test.mjs: the real slow-processor switch also checks that the follower flies to a touch in "light" and in "most", that its wings run in both, and that they run after the press;
  a second slow page checks the way back from "light" by itself (skipped when this computer is too busy at full speed); after Pause and Play the falling leaves drift and tip in step.
  New in R2 (section 5): the automatic check on a pretend clock with pretend frames (no dependence on how busy this computer is): "light", full motion after four good looks, "light"
  again after ONE bad look; a computer that was only slow for the first 6 s stays at full motion; in both the follower keeps its wings, and the leaves keep falling for 0.3 s after the
  change and rest by 0.75 s. (The real slow-processor page still checks "light" then "most" and the wings in both.) The check that the small decorations rest after the first step now looks
  for a few seconds, because the leaves go on falling until their layer has faded.
- tests/hero.test.mjs: every fall leaf has its three animations (heroFall, heroSway on the leaf, heroRock on its ::before), alternate and eased, `--fh` is the hero's height (also at 7 widths
  and after a resize), every leaf falls from above the top edge to below the bottom edge, light / most fade the layer out (opacity 0, snow too), the visitor's Pause (all) does not.
  New in R2: the layer's base transition (a transition runs both when the calm mode comes and when it goes), the `@supports not (translate:0 0)` rule, the snow's keyframes use `--fh`,
  every flake falls from above to below the hero in a window 600 px high (where "108vh" and "the hero's height" differ), `--fh` follows a change of the picture's height with no window resize.
- tests/touch.test.mjs: only the `bee` function (it read the last keyframe of the newest leg, which is now only a step on the way): the bee's middle must come within 60 px of the finger.

## Text for main to put in

- README.md, the "Bee and butterfly" paragraph: replace "The bee goes straight and fast. The butterfly takes longer, flutters on a curved path, flaps
  its wings faster, and comes in one of three colour sets..." with: "The bee goes straight and fast and turns round smoothly. The butterfly is slower
  and lighter: it drifts a little from side to side, leans the way it goes, flaps its wings faster and comes in one of three colour sets from the site's
  palette. Both glide to the pointer in short straight steps, ten a second, each one beginning exactly where the one before it ended (a bee up to 860
  pixels a second, a butterfly up to 540, slower and slower as they come near), and stroll slowly about the field when the pointer has rested for 2.5 seconds."
- README.md line 654 (the paragraph "On a slow phone the page calms itself"): the first step now rests "sparks, smoke puffs, swaying flowers, butterflies and the little bees of the picture"
  and makes the falling leaves and snow fade out (0.6 s) and rest when they have faded; the bee or butterfly that follows the pointer keeps its wings and its bobbing in BOTH steps (only
  the visitor's "Pause animations" stops them). Add: "After four good looks in a row it goes back to full motion, once; the next look comes at once, and one bad look puts it back to the first step."
  (The paragraph says "twice in a row"; initMotion's header comment and the code say three bad 2-second looks for each step, `bad >= 3`. Please check which is right for the README.)
- docs/SLOW_PHONE_TEST.md line 97: "first step ("light": the small decorations rest, the falling leaves fade out; the bee keeps flying and keeps its wings)".
- tests/README.md has no row for `critter`. Suggested: "| `critter` | the bee and butterfly that follow the pointer over the first screen, both kinds: every leg of the flight (short, straight, transform only, start time at once,
  each beginning where the one before ended), speed by distance, the bee's smooth turn, the butterfly's sway and lean, a circle of the pointer and 20 s of rest (no step too big, none back, strolls slowly,
  stays inside the hero, rests beside the buttons), parked by Pause / hidden tab / out of sight / winter, the page's calm mode does not stop it, resize (also a parked creature), buttons and drawn friends, the change
  of kind (its 45 to 75 s schedule, Pause while it changes, it can never stay stuck), a busy page and a browser without start times, reduce motion, a phone |" and in the `calm` row add "the follower keeps flying
  and keeps its wings (light and most), the way back from light, one bad look puts it back, the leaves fade before they rest", in the `hero` row add "the falling leaves and the snow (three animations each, the height they
  fall through, they fade out in the calm mode, the layer is hidden without `translate`)".
- tests/browser-support.table.json (main's): the `css-prop:rotate` fallback sentence says "leaves and snow that fade but do not fall". Now: "...An older browser shows the photos straight, no pop, and no falling leaves or
  snow at all (css/hero.css hides that layer with @supports not (translate:0 0), so that none hangs in a row along the top edge)." `css-prop:translate` says "See rotate." and needs no change.
- tests/timings.json (main's): see the numbers in my report.

## browser-support

`document.timeline` (js/main.js, the animation clock) is a name the table does not have yet (the test says `js-name:timeline`); it is in every browser from Safari 13.1, Chrome 69, Firefox 63 (older than
the targets), so no fallback is needed. (`startTime` is guarded: if the browser does not take it, the old way is used.) The other two red names, `notify` (js/demo-kitchen.js, js/demo-store.js) and `resize`
(css/demo-visits.css), are not mine.

## For main, not mine

- The comment at js/main.js about line 337, in initNav, is stale (R2 4d). I did not touch initNav.

## tests/contrast-pixels (asked by main): where the leaves are, and what the test measured

- The leaves and snow are BEHIND all the hero's words: `.hero-scene` (which holds `#critters` and `.particles`) has z-index 1, `.hero-copy` (the headline, the chips, the buttons) 5, the bee or butterfly 6, the picker 7;
  `.particles` and `.hero-scene` have `pointer-events:none`. Nothing to change there.
- Run on its own, the failing item (index.html, fall, en, 1280: "the words at the top of the page ... animations at 15% of their cycle") fails now and then (2 times in 12 runs of the whole item, while the computer was busy,
  none in the 40 runs of the same item that followed and none in more than 100 shorter runs of just the hero measurement): `ul.chips > li "Family farm since 2013" 1.19:1` and `"USDA Certified Organic" 2.98:1`, worst pixel in the first row of the line box. The picture the test saves of the failing text
  shows the BUTTERFLY (`#bee-fly`, z-index 6, in front of the chips) lying across the lower part of the chip's words, its antennae and the top of its wings inside the line box. The test hides what is in front of the words
  (`data-cx-occ`), but it finds it by looking at the middle of each line every 16 px; a creature that only touches the top or the bottom rows of the line box (and moves a little before the photograph) is not found, and its dark
  outline counts as "what is behind the words". The flake needs the creature to be resting or flying right over a chip, which is why it is rare. The leaves play no part: at the 15% moment 15 of the 16 leaves stand in a row
  along the top edge of the hero (the test sets a negative time on animations with a negative delay, which Chrome shows as "not started"), 700 px above the chips; the sixteenth is near the sun.
- Not reproduced without the creature (16 runs, `#bee-fly{display:none}`), nor with it on a quiet computer (20 runs), so the creature is the only suspect that was seen in a failing picture.
- Suggested fix, in the test (main's file, one line, I did not touch it): `const OCC = '[data-cx-occ],#bee-fly{visibility:hidden!important}';` (line 66 of tests/contrast-pixels.test.mjs; both photo modes use it).
  The creature moves, so it is never "what is behind" a word. (I tried the other way, keeping the creature off the chips and the "open now" pills with `keep`: pointers resting among those stacked boxes then sent it far
  from the pointer, so I took that back.)

## The confirmation run on a busy computer (walker, integ 86e426f, load 7 to 17 on 4 cores): which failure was which

js/main.js is not changed. Every failure was in the tests; none came back as a fault of the page. Evidence, by item:

**The cause behind most of them.** Playwright's pretend clock runs the page's timers one after the other, and waits a real `setTimeout` of the browser after each one. On this computer (load 2) it serves at most
about 110 timers a second, and a chain of 100 ms timers ticks 8.5 times a second, not 10 (scratchpad/critter/clockthru.mjs). A page that the test asked for 60 more timers a second (a look every 16 ms, a pointer made
inside the page every 16 ms) serves its own timers late: the creature's next look, and the 12-second guard of the change of kind. With a busy computer the pretend clock serves far fewer.
The page's own timers were never the problem (a real phone has real timers); the test's own were.

critter:
- (a) "about ten a second when the computer keeps up (3.9 / 4.7 ; 2.5 / 4.7)": TEST, load. A fixed bound of 6 legs a second cannot be right when the pretend clock serves the timers late. The check now compares the legs a second
  with the page's own 100 ms timer chain (a probe in the page, the same kind of timer, over the same seconds): at least 70 % of it.
- (b) "Pause animations while it is out of sight changing kind: ... parked inside the hero": the expectation is what the code does (this check passed 2 of the 4 times it ran, at x 1376 = 1440 - 52 - 12 in the other
  kind; the box is inside the hero, `gone.x < gone.w` is the right measure). The two failures: the creature had not left the hero 25 s after the change began (`out: false`, same kind): once standing exactly at the pointer
  (x 1074 = 1100 - 26: it had not moved at all), once mid-flight 66 px short of the edge. Cause: the check looked every 16 ms from a timer of the page, 62 timers a second,
  and the pretend clock served the creature's looks and the 12-s guard (set 12 s of pretend time ahead, behind all the 16 ms ticks before it) too late for the 25 s real-time limit.
  Reproduced without any other load on the computer, by asking the pretend clock for more (scratchpad/critter/reprob.mjs): the old check with no extra timer in the page: the creature is out of the hero after 1.1 s; with
  four extra 16 ms intervals in the page (312 timers a second asked for): 25.0 s, the creature at the pointer for the first seconds, then at x 1374, then stopped at x 1425 for 15 s (its next looks not served), out when the guard came;
  the new look from the browser's own frames, with the same four extra intervals (250 timers a second): out after 6.4 s. Now: the creature is looked at in every frame the browser
  really draws (the browser's own requestAnimationFrame, taken before the pretend clock replaces it) and Pause is pressed in the frame in which less than 8 px of it are left inside the hero; the pointer made by the circle and the
  rest-finding look use the browser's own timer too; and when the computer was busy and the creature did not leave in 25 s x the load factor, it is said (info: too busy to judge) and not failed. On a quiet computer it is still a failure.
- (c) "every leg has its start time at once (start time null)", butterfly, once: TEST. A leg that was taken back in the same turn it was made (`swap()` and the Pause click in one turn, a leg made at once when the creature
  had just arrived) has no start time because it was cancelled. The leg log now notes the state of every leg and ignores legs that were "idle" in the same turn.
- (c) "never goes back (at worst 30 px, at most 25)", bee busy page, once: TEST. The old way sampled the box and counted the stroll before the pointer arrived and the time the pointer took to arrive on a busy computer. Now it is
  measured along the legs the page started after the first pointer event of the trip (each leg begins where the one before ended).
- (c) "a pointer that comes in over the big Reserve button ... settles next to it, not on it", "with the pointer resting on each of 6 buttons ... Reserve: did not come to rest near the pointer; See what's in season:
  it sits on a button at 848,593", "where it rests (69 pictures) it is never on a button or a card": TEST, timing. The logic first (your question): at rest the creature is never on a button: `clearOf` puts its box at the nearest
  spot that overlaps no button by more than 2 px (the test says "on" for more than 8 px both ways), also when the pointer rests on a button; the path that skips a pending leg (a browser that takes no start time) only waits, it never moves it.
  What the test saw was a creature standing between two late legs, in the middle of its way past a button (a page that is late stands still for a moment at the end of each leg, and the legs were seconds apart). Now "at rest" means: it
  has stood still for 250 ms, within 170 px of the pointer, AND no new leg has begun for 2.2 times the gap the legs lately had (250 ms to 1 s); and for the strolls: no new leg for 1.15 s after a SHORT last leg (it has got where it is
  going; the last legs are the slowest). If it does not rest that long anywhere in the 20 s (a butterfly strolls on soon after it has got somewhere) the check says so instead of failing.
- Not on the walker's list, found in my own run on a busy computer (load 10): "...a turn goes through the numbers between 1 and -1 over several legs (1 legs begin part-way through a turn)". A turn lasts one 240 ms leg:
  legs that begin 100 ms apart begin twice part-way through it, 150 ms apart once, 220 ms apart not at all. The number needed now follows the gap the legs really had (median over the trip: 2, 1 or 0).

calm:
- "a computer that was only slow for the first 6 s (pretend frames): light, then full motion, and it stays at full motion ()  []" (both runs, empty log): TEST, a race, reproduced (scratchpad/critter/simdry2.mjs). The pretend frames were put
  into the page one real second after it had loaded, and the page's first look comes 4 s after the load. A computer that needed more than 4 s to load had started the look already: the "slow for 6 s" stretch (counted from the first
  pretend frame) then no longer lined up with the page's spells, it never found three bad spells in a row, and nothing was written down. With the same start 6 s later the old arrangement gives an empty log (and the quiet start gives
  "light, full motion" at 6.2 s and 14.2 s as it should); the new one gives 6.2 s and 14.2 s with a start 8 s late too. Fix: the pretend clock stands still from before the page's first script (pauseAt right after the install), the
  page's observer is told that the hero is in sight (our own observer is told after it), the pretend frames go in, and the clock is moved by hand from there (4 s, then 2 s at a time). The A check (slow while nothing rests) never
  depended on this, which is why it passed both times.
- "a page that calmed itself (light) goes back to full motion by itself when the computer is fast again" (run 1 only): LOAD. The way back needs the four looks that follow at once to be all good; one bad 2-s spell among them and the next look
  comes only after 15 s (then three more of those would be a minute: the check's 60 s). The check skipped itself only when one of the LAST THREE frame-rate windows of the computer was slow. Now it looks at every window since the computer was
  fast again (the page's own frame counter, 2 s at a time): one slow window, or fewer than four, and it is said, not failed. A page that did not come back while every window was fast is still a failure.
- The two pages that look at the real frame rate (the real slow page and the way back) used to run together with the two pretend-clock pages, which work the computer hard for a while. The pretend-clock pages now run first, together;
  then the two real ones.

## The spring field: more people at the left and right, and the sunflowers can be snipped (branch `spring`, on top of integ 86e426f)

Code: only the KIDS table in `springField()` (js/hero.js) and its comment. Everything else in 86e426f stays (`snippable()` for the five sunflowers, `kindOf()`, the hint and its four translations).

Final table (row = index in FIELD_T, entries [k, shirt, hat, faces left]; 10 kids, 3 in the middle rows behind the words as before, 7 at the sides: 3 left, 4 right):

    6:  [-1.5 #e5334b straw 0] [1.5 #4b5bb8 cap 1]          (middle, behind the words: as before)
    8:  [-4.6 #ffc928 cap 0]   [4.15 #e5334b hair 1]
    9:  [0.5 #ffc928 beanie 0 (middle, as before)] [-2.85 #ff8fb1 pony 1]
    10: [-2.1 #43a047 straw 0] [3.65 #4b5bb8 cap 0]
    11: [2.15 #e5334b cap 1]
    12: [4.5 #ffc928 beanie 0]

(86e426f had 9 kids: rows 6 x2, 8, 9 x3, 10 x2, 11.) With the test's own measure at 1440 x 900 (a grid of 6 x 6 over each kid, only the points where the kid is drawn, covered by the page's words, chips, pills,
buttons and card, by plants, sunflowers or another kid): 86e426f 2 of 9 kids have more than half of their drawing free (0 at the left); this table 7 of 10 (2 at the left, 4 at the right, one in the middle).

How it was found (scripts in scratchpad/spring): every row 6 to 12 and every k from -6.6 to 6.4 in steps of .25 was drawn as a kid at each of 6 window sizes (explore.mjs, ex3-*.json: how much of the kid, and of its face, is free);
then a hill-climb on the real page (search.mjs, 45 steps: the table is changed, the scene is drawn again, every kid measured at 1440, 1920 and 1280); then by hand, one kid at a time (variants.mjs). The pictures:
spring-final-1920/1600/1440/1280/1100/992.png (the real page, a kid bends over the rows as it does) and spring-phone-390.png.
What decided it:
- On a computer there are two free zones at each side: at 1440 the left one lies between the little sunflower (x about 250) and the chips (x about 515), the picker card (32 to 392 px, bottom) takes the rest; the right one between the
  pills (x about 1055) and the big sunflower (x about 1250). About three people fit into each without hiding each other's faces. At 1920 and 1600 there is more room at both sides, at 1100 and 992 less (the card and the chips take
  more of the picture; the kid at the far right, row 12, is outside the window below about 1250 px).
- A person standing in the rows is covered by the plants of its own row and of the next one: the share of its drawing that can be seen is at most about 50 to 65 % even when nobody is in front of it (a kid with 90 to 100 % free stands
  free of the plants, with its feet showing). "More than half" is therefore met just (53 to 64 %) by the kids that stand well; I took the position of each kid from where the share is highest without a neighbour in front.
- Kids that stand one behind the other in rows next to each other must be at least 50 px apart across, or a head is hidden (T1, T2, T3, V1, V2 in scratchpad/spring/cands*.log: 8 and 9 side kids gave fewer free kids than 6).
Static pose (the bending animation off), at each window size, kids with more than half of their drawing free / with a clear head (80 % of the upper half free), final table: 1920 x 1080: 8 / 6; 1600 x 900: 7 / 5; 1440 x 900: 7 / 7;
1280 x 800: 7 / 6; 1100 x 800: 5 / 5; 992 x 800: 4 / 5. 86e426f (9 kids): 1920: 3 / 3; 1600: 3 / 3; 1440: 2 / 3; 1280: 4 / 3; 1100: 2 / 2; 992: 2 / 2.
At 390 px nothing is broken (the scene is mostly behind the words there, as before); no error in the console in any of the five languages at 1440, 1920 and 390.

The sunflowers (checked, nothing to change): a click on a head snips it (`.berry` gets `is-picked`, the basket counts one, it grows back after 7 to 11 s like the summer ones: tests/hero.test.mjs); the badge: 100 snips in spring alone are
"Sunflower Whisperer" (tests/games.test.mjs, new section 1c, real mouse clicks for the first four and the 100th); the five heads can be hit with the mouse at 1440 (reach 5 of 5) and none of them lies over a kid's face (the kids were
measured with the sunflowers as covering). The hit area is the top 42 % of the plant, in the layer in front of the kids: where a head lies over a kid the click goes to the flower, nowhere else; the buttons, the chips and the card are HTML
above the scene (z-index 5 and 7), so a head can never take a click from them. Keyboard and screen reader: nothing is drawn tabbable in any season (the scene is hidden from screen readers: `aria-hidden`); the round "Pick a strawberry" button
takes one of everything that can be picked and is not picked now, and in spring that now includes the sunflowers, exactly as in summer (its label says "strawberry" in spring and "blueberry" in summer, as it did). Summer is unchanged
(the same `snippable()`, `kindOf()` gives 'sunflower' for a cut flower in every season).
One thing on the side: the new spring hint is a third line in Vietnamese (the picker card is 135 px high instead of 116) and at 1440 x 900 the card's bottom edge then lies 47 px below the window (it is as high as it already was in summer,
whose hint is just as long). Spanish, Hindi and Chinese stay at two lines.

Tests: tests/hero.test.mjs (new block after the seasons: at least 5 people can be seen at 1440, 2 at each side; the hint is the new sentence; five snippable sunflowers; a real click on a head snips one, the flower is drawn picked and
grows back, the basket's button takes one more), tests/games.test.mjs (the fruit loops click `:not(.flower-cut)`, which spring needs now; new section 1c: the spring badge for sunflowers), tests/npc.test.mjs (every person in the spring
field can be tapped: a tap lands on that person), tests/touch.test.mjs (the spring list: a strawberry is not a sunflower; a sunflower, "pick?").

## The falling leaves, calmer (item d of the second review of the spring field)

Mrs. Cathy asked for calmer leaves. The acceptance walk found the fall (60 px/s) and the turning (44 degrees/s) good, but the sideways drift twice as fast as the first leaves had (42 px/s, a swing every 2.5 s). Now (js/hero.js,
`particles()`; css/hero.css has only the defaults and the comment; the random stream is the same, so the leaves are in the same places, of the same size and colour, with the same delays):

| a leaf, 16 in the hero | first leaves | integ 1048193 | now |
|---|---|---|---|
| falls (px/s; hero 800 px high, 874 px of fall) | 70 on average | 60 on average, 47 to 87 | 41 on average, 36 to 53 (worked out: 35 to 53; at most 60 up to a hero 916 px high) |
| sideways, the mean speed of a sine: 2 * reach / (time of one drift) | 21 | 45 on average, up to 79 | 16.6 on average, at most 19.4 (worked out: 16 and 20.4) |
| a whole swing, there and back (2 * the time of one drift) | about 7 s | 3.2 to 6.4 s | 5.6 to 9.2 s |
| how far it reaches to each side | 20 to 70 px, in kinks | 25 to 66 px | 15 to 42 px (reach = drift time * 5.5 to 10, so a long drift reaches farther and the speed stays low) |
| tips (degrees/s, 2 * tip / time of one drift) | 70, a spin | 46 on average, up to 74 | 24 on average, at most 36 (the tip is 26 to 50 degrees) |

"Measured" is the page itself: the middle of each of the 16 leaves every 100 ms for 24 s at 1440 x 900 (scratchpad/critter/leafpath2.mjs; the pictures of the paths are leafpaths-before.png and leafpaths-after.png there: the
new paths are smooth sines with fewer, wider swings, none is a straight line). The "worked out" numbers are the same seeded stream the page uses, taken from the values that js/hero.js gives each leaf (leafnums.mjs).

The path stays a sine (the same `heroSway`, eased in and out, alternating), the tipping stays in step with the drifting (`heroRock`, the same time), nothing else moved: the calm modes (light and most fade the layer, the visitor's Pause
keeps the picture) are untouched. The test measures it on the animations themselves (tests/hero.test.mjs, in the fall block: each leaf stopped at the start and the end of one of its own drifts): the fall 25 to 60 px/s, the sideways at
most 21 px/s (8 or more on average, a reach of 10 px or more so that no leaf goes straight down), a whole swing 4.5 s or more, the turning at most 44 degrees/s. At a hero taller than 916 px (a screen wider than about 2200 px) the shortest falls
come to a little over 60 px/s; the first leaves fell at 70 to 95 there.

## Where I stopped (spring-final: the kids table measured on the real page, nine tests run)

Branch `spring` in /tmp/spring-final (a clone of critter-clone2, integ 1a61a49 merged). Scripts and data: scratchpad/sf (explore4.mjs: every place alone on the real page; own.mjs: tap areas; opt2.py, pick.py: sets of three; eval6.mjs + check.py: a whole table with the hero test's own measure; talk.mjs: real clicks and the friend button; pix/: look.mjs + analyze.py, now with the kids held still; compare.mjs: pictures).
- The first table (rows 6, 7, 10) was a prediction. On the real page it gave 2 + 2 clear people at 1920 x 950, 1920 x 1080, 2560 x 1440 and 1440 x 900 (row 10 showed 58 and 59 % of the body), and the tap areas of the edge pair lay on each other (24 % their own, 70 % asked): 7 failures of the hero test.
- New table (js/hero.js KIDS): rows 3, 4, 6 at the right, rows 4, 6, 8 at the left, small people close to the edge of the rows (a bigger one has 55 to 75 % of its tap area left; 3 tap areas per side do not fit otherwise). The target of the test did not change.
- Clear per side (left + right), the hero test's measure, integ's 9 people -> now: 1920 x 950 1+1 -> 3+3, 1920 x 1080 1+1 -> 3+3, 2560 x 1440 1+2 -> 3+3, 1440 x 900 0+1 -> 3+3, 1440 x 780 0+0 -> 2+3, 1536 x 730 0+0 -> 1+2 (the pixel pipeline says 1+1 there: one at 55 %). Also 3+3 at 1536 x 864, 1600 x 900, 1680 x 1050, 1920 x 1200, 2048 x 1152, 2+3 at 1366 x 768, 1280 x 800, 1100 x 800; nothing in windows lower than about 700 px.
- Pixel pipeline (owner's pixels): head 91 to 100 % and whole person 72 to 97 % for all six at the four big sizes; at 1440 x 780 the front one at the left is 56 % (cut by the bottom edge). Real clicks: all six speak at 1440 x 900, 1920 x 950, 1920 x 1080, 2560 x 1440, 1440 x 780, 1536 x 730; the friend button never picked an off-screen friend at those and at 1366 x 650.
- Tests on the final tree: quick checks 243/0; hero 166/0, npc 20/0, touch 97/0, pause 12/0, farm-seasons 24/0, calm 55/0, critter 189/0, contrast-pixels 19/0, games 97/0. One test change besides comments: "it goes round" of the friend button (when no friend shows, 1366 x 650, it goes round all 17, as js/hero.js says).
- Summer, fall and winter pictures: the same pixels as integ (animations off, leaves hidden): at most 71 pixels differ at rounded edges, as much as two loads of one build differ (50).
- Left: other pill states and languages. With the farm's pill (fall, spring picture chosen by hand) at 1440 x 900 it is 2 + 1; in Spanish and Vietnamese the chips are 42 px wider at each side: 2 + 2 at 1440 x 900 (3 + 3 at 1920 x 950 in es, 3 + 2 in vi). English at the pinned moment is what the test checks.

## What I could not do / am unsure about

- I did not change the 240 ms leg or the 100 ms look. On a computer that is so busy that its timers come 300 ms late or more, a leg ends before the next one begins and the creature
  waits a moment at its end; it never goes back. A longer leg when the last look came late would remove even that; I left it out because the brief describes 240 ms legs.
- In a browser that takes no start time the creature can still step back a little on a busy page (up to a tenth of a second of flight: the leg is read at the last drawn frame). The test allows 70 px
  there (25 px with start times). Only a browser older than the targets takes no start time, so this is the fallback and nothing more.
- The leaves rest 680 ms after the calm mode comes (a page timer). The fade itself starts at the first frame drawn after the change, so on a phone that draws 6 frames a second the leaves are paused
  while the layer is still about 15% visible (about 40% at 3 frames a second), and it is gone a fraction of a second later. Waiting for the transition's own end (its `finished` promise) would be
  exact; I kept the timer because it is simpler, it can be tested on the pretend clock (a transition runs on the real one), and the effect is a few leaves that stop a moment before they have faded.
- The drawn picture (what the compositor really shows) can only be checked with a screencast and a second page that finds the pink creature in each picture: too slow and too
  dependent on the load for the suite, so it is not in the tests. The scripts I used are in the scratchpad (screen2.mjs, analyse4.mjs).
