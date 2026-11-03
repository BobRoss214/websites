# Notes from critter (second wave): the bee and butterfly, the calm mode, the falling leaves

Short and plain. Everything is committed on branch `critter` in /tmp/critter-clone2.

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
asking the leg, as before. Nothing else about how it moves changed (same speeds, same 240 ms legs, same 100 ms look).

Other changes in js/main.js (all in initBee / initMotion, which are mine):
- `window.WISE_ACRES.critter.changeIn`: read-only, milliseconds left until it changes kind by itself (Infinity when the address picks the
  kind). The test uses it to check "45 to 75 seconds" exactly. Nothing else reads it.
- initMotion `wake()`: when motion comes back after Pause (or after the page's own calm mode), the animation on a leg's `::before` (the
  tipping of a falling leaf) was only resumed, while the leaf itself was started again: after one Pause and Play the tipping was no longer in
  step with the drifting. It is now started again with it (one line).
- The big comment above initBee says how a leg gets its start time.

## Tests (all four files are mine)

- tests/critter.test.mjs: rewritten for the new flight (143 checks; about 70 s on this machine at load 5 to 8; both kinds run at the same time).
  It writes down every leg the page starts (a wrapper round `Element.animate`) and checks: short, straight, only the transform, speed of the
  kind, start time at once, each leg begins exactly where the one before it had got to. The way the creature goes is then worked out from the legs
  (a look at the box every frame is not used any more: every look costs a busy page so much that its timers run late, and from a script the box of a
  leg that has not started looks fine anyway). A light look at the real box proves the browser draws what the legs say (within 0.1 px).
  Also: speed grows with the distance and slows near it, the bee flies straight and turns smoothly, the butterfly sways and leans, the circle
  (no step too big, none back, it keeps company with the pointer), then 20 s of rest (settles, strolls slowly, stays in the hero, never still for long,
  rests beside the buttons not on them), parked by Pause / hidden tab / out of sight / winter, calm light and most do not stop it, resize, a pointer that
  enters over a button or a drawn friend, the change of kind (out of the nearer edge, back from the same edge, Pause while away), reduce motion,
  phone 390, and the 45 to 75 s schedule. Checks that depend on the page's timers being on time say "too busy to judge" (and are left out) when the legs
  came 300 ms or more apart, as the other tests do on a busy computer.
  Run against the OLD code it fails the start-time check (and the schedule, which needs `changeIn`).
- tests/calm.test.mjs: the real slow-processor switch now also checks that the follower still flies to a touch in "light" and in "most", that its wings
  run in "light" and rest in "most", and that they run again after the press; a second slow page checks the way back from "light" by itself
  (skipped when this computer is too busy at full speed); after Pause and Play the falling leaves drift and tip in step.
- tests/hero.test.mjs: every fall leaf has its three animations (heroFall, heroSway on the leaf, heroRock on its ::before), alternate and eased,
  `--fh` is the hero's height (also at 7 widths and after a resize), every leaf falls from above the top edge to below the bottom edge,
  light / most fade the layer out (opacity 0, snow too), the visitor's Pause (all) does not.
- tests/touch.test.mjs: only the `bee` function (it read the last keyframe of the newest leg, which is now only a step on the way): the bee's
  middle must come within 60 px of the finger.

## Text for main to put in

- README.md, the "Bee and butterfly" paragraph: replace "The bee goes straight and fast. The butterfly takes longer, flutters on a curved path, flaps
  its wings faster, and comes in one of three colour sets..." with: "The bee goes straight and fast and turns round smoothly. The butterfly is slower
  and lighter: it drifts a little from side to side, leans the way it goes, flaps its wings faster and comes in one of three colour sets from the site's
  palette. Both glide to the pointer in short straight steps, ten a second, each one beginning exactly where the one before it ended (a bee up to 860
  pixels a second, a butterfly up to 540, slower and slower as they come near), and stroll slowly about the field when the pointer has rested for 2.5 seconds."
- tests/README.md has no row for `critter`. Suggested: "| `critter` | the bee and butterfly that follow the pointer over the first screen, both kinds: every leg of the flight (short, straight, transform only, start time at once,
  each beginning where the one before ended), speed by distance, the bee's smooth turn, the butterfly's sway and lean, a circle of the pointer and 20 s of rest (no step too big, none back, strolls slowly,
  stays inside the hero, rests beside the buttons), parked by Pause / hidden tab / out of sight / winter, the page's calm mode does not stop it, resize, buttons and drawn friends, the change of kind (and its
  45 to 75 s schedule), reduce motion, a phone. About 70 seconds |" and in the `calm` row add "the follower keeps flying (and keeps its wings in light), the way back from light, the leaves keep their step",
  in the `hero` row add "the falling leaves (three animations each, the height they fall through, they fade out in the calm mode)".
- tests/timings.json (yours to edit): critter about 70 s (load 5 to 8 on 4 cores, all chains at the same time). calm: see the numbers in my report.

## browser-support

`document.timeline` (js/main.js, the animation clock) is a name the table does not have yet; it is in every browser from Safari 13.1, Chrome 69, Firefox 63 (older than
the targets), so no fallback is needed. (`startTime` is guarded: if the browser does not take it, the old way is used.)

## What I could not do / am unsure about

- I did not change the 240 ms leg or the 100 ms look. On a computer that is so busy that its timers come 300 ms late or more, a leg ends before the next one begins and the creature
  waits a moment at its end; it never goes back. A longer leg when the last look came late would remove even that; I left it out because the brief describes 240 ms legs.
- The drawn picture (what the compositor really shows) can only be checked with a screencast and a second page that finds the pink creature in each picture: too slow and too
  dependent on the load for the suite, so it is not in the tests. The scripts I used are in the scratchpad (screen2.mjs, analyse4.mjs).
