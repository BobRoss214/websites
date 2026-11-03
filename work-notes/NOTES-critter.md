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
