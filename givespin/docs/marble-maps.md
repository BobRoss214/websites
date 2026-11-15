# Marble Run tracks: how to write one

The code calls a track a *map*. A map is one small program that walks a pen along the centre line of the course; the engine turns
what the pen laid down into the walls, the banked bends, the pegs and the physics. The engine is `js/games/marble.js`. Switchback, the
first track, is built into it; every other track lives in its own file, `js/games/marble-map-<id>.js` (Zigzag Ramps, Spiral Tower,
Peg Garden, Pinch Points, River Rapids). Everything below is what the engine does today; names in `code` are real.

A map changes the scenery and the way the race plays out, never who wins: the winner is drawn first (`js/fair.js`), and the engine
swaps that charity's marble into the starting place that crosses the line first. A map cannot change that, and nothing about a map
is part of the draw or of the record the verifier redoes.

## 1. Where a map lives and how it registers

One file per map, loaded by `index.html` right after `js/games/marble.js` (the load order does not matter: a map file that is loaded
first waits in a queue). ES5, an IIFE, 2-space indent, no network, nothing random at load time:

```js
(function () {
  'use strict';
  var GS = window.GS;
  var map = {
    id: 'spiral', name: 'Spiral Tower',          // keep id and name on ONE line: tests/readme.test.js counts a game wherever a name follows an id on the next line, and a map is not a game
    blurb: 'One plain sentence.', order: 30, theme: { ... }, physics: { ... }, wide: 1,
    width: function (c) { ... }, build: function (m, c) { ... }
  };
  if (GS.marbleMaps && GS.marbleMaps.add) { GS.marbleMaps.add(map); }      // (add never throws: a refused map is said in the console)
  else { (GS.marbleMapQueue = GS.marbleMapQueue || []).push(map); }
})();
```

| field | meaning |
|---|---|
| `id` | 1 to 24 of `a-z 0-9 -` (not `random`); it is what the saved preference `prefs().marbleMap` holds |
| `name` | 1 to 40 characters, shown in the Track picker |
| `blurb` | ONE plain sentence for the picker, 20 to 140 characters, ending with a full stop (no second sentence, no crypto wording: `tests/maps.test.js` checks both) |
| `order` | position in the picker (Switchback 10, Zigzag 20, Spiral 30, Garden 40, Pinch 45, River 60; leave gaps) |
| `theme` | colours and decoration, section 5 (anything left out is Switchback's) |
| `physics` | optional multipliers, section 6 |
| `wide` | optional: the whole track is this many times the usual width (1 to 1.6) |
| `width(c)` | optional: the narrowest width (track units) the map can be laid out in for `c`; a canvas narrower than that draws the whole picture smaller (scale `k < 1`). Default: room for a level run-out plus margins |
| `build(m, c)` | the program: draws the track with the pen `m` (section 3) and returns `{ H: height }` (track units) plus any numbers of its own |

## 2. The context `c` (what the map has to fit)

Built for n marbles on a canvas; all lengths are track units (the picture is scaled onto the canvas by `c.k`).

| `c.` | meaning |
|---|---|
| `n` | number of marbles (2 .. 500) |
| `r` | marble radius: 11 (n <= 12), 7 (<= 30), 5.5 (<= 56), 4.2 (<= 120), 3 (<= 300), 2.2 |
| `lanes`, `rows` | marbles abreast in the starting pack (3 .. 14); `rows` is the tier's row count (4 .. 7, Switchback's rows) |
| `hw` | the track's half-width (centre line to the inside of a rail); `= baseHw * wide` |
| `baseHw` | the tier's usual half-width `lanes * (2r + 2) / 2`; no piece may be wider than `1.6 * baseHw` |
| `gap` | `2r + 2`, the pitch of the starting pack |
| `pad` | 10, the margin Switchback keeps from the canvas edge |
| `gate` | how far along the track the starting pack reaches; the START line stands here (`packRows * gap + 6`) |
| `pileLen` | about how long the finished pack is on a run-out of half-width `hw` |
| `runout` | the run-out a finish of half-width `hw` must have: `runoutFor(hw)` |
| `runoutFor(h)` | the run-out length a finish of half-width h must have: `max(1.3 * pile length at h, 150) * max(1, sqrt(h / baseHw))` (a wider run-out holds the pack in less length, but its front is more ragged). Switchback keeps its own `max(1.3 * pileLen, 150)` |
| `minTurn` | the tightest allowed turn radius for the centre line: `hw + 8` |
| `W`, `k` | the width to fit (track units) and the scale of the picture (`canvas px = track units * k`) |

## 3. The pen `m`

Headings are degrees on the screen: 0 right, 90 down, 180 left, 270 up (y grows downward). A turn of `+deg` is clockwise on the screen.
Every piece starts where the last one ended, with the same heading (the centre line is always smooth).

| command | what it lays down |
|---|---|
| `m.start(x, y, heading)` | puts the pen down (once, first), at any heading. The first piece must be a straight: the starting pack stands on it (it may run on round the first turn if it is long) and a wall closes the track behind it, square to the heading |
| `m.straight(len, o)` | a straight piece at the current heading (any angle). `o.hw`: the half-width at its END (it changes evenly from the current one; the walls lean accordingly, so a narrowing wall also pushes marbles back); `o.ease: true`: the width changes in a smooth S instead (no corner where the change starts or ends); `o.pull`: a stronger (> 1) or weaker (> 0) pull along this piece |
| `m.hwTo(h, len, o)` | the same as `straight(len, { hw: h, ease: true })`: a smooth width step over `len` (the walls are curved and lean with the local slope) |
| `m.turn(radius, deg, o)` | an arc of `deg` degrees round a centre `radius` from the centre line (`radius >= c.minTurn`; more than 180 degrees is laid as equal arcs of at most 180). `o.bank`: how strongly THIS bend is banked, as a share of the usual 1300 px/s^2 (1 = Switchback's U-turns, the default; 0.54 is about 700 px/s^2; 0.3 a gently banked spiral; 0 flat: marbles slam into the outside wall); `o.pull`. The width does not change along an arc (change it on a straight before or after) |
| `m.peg(x, y, r)` | a round peg (bumper) of radius r at (x, y). Marbles bounce off it (bounciness `physics.pegBounce`, default 0.7) with NO sliding friction (see section 4 for what keeps a marble from sticking to one). A peg in the starting pack (before `gate`), on the finish line or in the run-out is left out (and `check` reports it) |
| `m.pegRow(x0, y0, x1, y1, count, r)` | `count` pegs evenly from (x0, y0) to (x1, y1), both ends included |
| `m.finish(len, runout, o)` | the LAST piece: a straight `len` long, any heading (level, sloped or straight down), its width as it is (change the width on a straight before it for a wider run-out, up to 1.6 x `baseHw`; `c.runoutFor(h)` is the run-out length a half-width h needs), with the chequered finish line `runout` before its far end and a padded end wall at the end. Past the line the pull is weak and the drag grows towards the wall, so the finished pack rolls in and settles there. `o.pull`: the pull on the stretch before the line (Zigzag uses 0.8 so the field does not arrive too fast). Nothing may follow |
| `m.repeat(count, fn)` | runs `fn(i)` for i = 0 .. count-1. Every round must lay down track of the same length (then the distances along the track carry no round-off drift); use a plain loop otherwise |
| `m.at(x, y)` | pins the pen to exactly (x, y), which must be within 0.01 of where it is (stops round-off drift; Switchback uses it to keep its original numbers) |
| `m.pos()` | `{ x, y, heading, s, hw }`: where the pen is, the distance along the track so far, and the half-width there |
| `m.size(H)` | the picture height, if `build` does not return `{ H }` (default: the lowest point of the track + hw + 28) |

`build` may return extra numbers (`{ H: 900, ramps: 4 }`); they are copied onto the board's geometry (`geo.ramps`) for the tests.

## 4. The rules (checked by `GS.marbleMaps.check(id, n, W)`)

`check` builds the map for n marbles on a canvas W px wide and returns a list of plain sentences (empty: nothing wrong).
`tests/maps.test.js` runs it for every registered map at n in 2, 8, 24, 100, 300, 500 and W in 320, 390, 640, 1000, 1200 (the canvas
is at most 720 px wide in the game). Run it at the tier edges as well when you write a map: n = 2, 8, 12, 13, 24, 30, 31, 56, 57, 100,
120, 121, 200, 300, 301, 500 and W = 320, 360, 390, 430, 640, 700, 720, 1000, 1200.

- The whole track, both rails (hw + 6 from the centre line) and the end wall, is inside the picture `W x H`.
- The page is at most 2.2 times as tall as it is wide (`H * k <= 2.2 * canvas width`); keep desktop heights sensible too.
- Every turn radius is at least `hw + 8` (`c.minTurn`) for the half-width of that turn.
- The corridor between the walls (`2 * (hw - 2)`) is at least 2.2 marble diameters everywhere, and no piece is wider than `1.6 * baseHw`.
- The track never runs over itself, rails included: no two parts of the track that are far apart along it may overlap out to the outside
  of their rails (`hw + 6`); the inside of a bend, which the whole bend reaches, does not count. (Keep a few units of air between rails
  that run side by side: Switchback keeps 8.)
- Every piece pulls the marbles on (`pull > 0`; the run-out past the line is the engine's own soft floor).
- The run-out (from the line to the end wall) is at least `c.runoutFor(its half-width)` (the FULL length: with less, a big pack on a wide
  run-out leaves marbles behind the line), does not change width, and the line is at least 4 units into the last piece. If the full
  run-out makes the page too tall, the engine draws the picture smaller (see below); do not shorten the run-out.
- Pegs: a clear gap of at least 2.2 marble diameters (surface to surface) from every other peg and from BOTH walls (a peg may not stand
  in or against a wall), no peg in the starting pack (before `gate`), and none on the finish line or in the run-out.

Also: `check(id, n, W, { pace: true, seed })` runs one pre-simulation and adds the PACE rules: the winner's simulated time `t1` divided by
the seconds a solo race shows it (8.5 s, +1.5 s above 24 marbles, +2.5 s above 48) must be at least 0.45 (below that the replay is slow
motion), and the last marble must cross within 2.5 x `t1`. `GS.marbleMaps.pace(id, n, W, seed)` gives the numbers
(`{ t1, tLast, seconds, ratio, tail, leads }`). The tests apply the pace rules at 8, 100 and 500 marbles on 390 and 700 px canvases;
check them at 320 and 360 px too. Aim well inside them: a tail of about 1.5 and a real round no longer than about 1.4 times a Switchback
round keep a race pleasant to watch.
Switchback is exempt from the run-out length and line-distance rules and from the pace rules: its numbers are held exactly as they were
before there were other tracks.

What the engine enforces by itself (a map cannot switch these off):
- `add()` never throws: a map it refuses is said in the console and `add` gives null. Refused at once: a field of the wrong kind, an id that
  is taken (the FIRST map with an id is kept, so no file can replace Switchback or another map), `wide` outside 1..1.6, `physics.pull`
  outside 0.2..3, `physics.bank` outside 0..3, `physics.pegBounce` outside 0..1.
- The pen refuses (the program fails): a number that is not finite, a length or radius not above 0, a per-piece `pull` outside 0.05..5 or
  `bank` outside 0..3, a track that does not start with a straight or end with `finish()`, a turn whose radius is under `hw + 2`, a piece
  whose corridor for a marble's centre (`hw - 2 - r`) is under `r + 1`, a finish line that is not on the last piece past the starting pack,
  and a picture height that is not a number above 0.
- A new map is tried at every tier edge (n = 2, 12, 13, 30, 31, 56, 57, 120, 121, 300, 301, 500 at 320 and 720 px) the first time the maps
  are asked for (not when the page loads). One that fails anywhere is withdrawn: it is not listed, `get` gives null, a saved choice of it
  means the default, `check` says why, and the console says it once. If a map still fails at some other size, that board is laid out on
  Switchback, the console says it once for that size, and `currentMap()` names Switchback (the map really drawn).
- `legacy` (Switchback's own physics, run-out and labels, exempt from the new-map rules) is not a field a map file can set: only the
  built-in Switchback has it.
- While a race runs, a resize lays the board out on that race's own track, only drawn at the new scale (so the marbles stay on it); the
  map is planned afresh for the new width at the first layout after the race.

A map whose page would be more than 2.2 x as tall as wide is built again for a wider, smaller picture (smaller k) until it fits (k at least
0.3), so the height rule holds by itself; but a smaller picture means smaller marbles on a phone, so design for the height.

How a marble moves on a new map (everything but Switchback):
- A marble's OWN speed is limited to 1.5 radii per physics step (3 radii per recorded frame), so nothing can pass through anything; pushes
  from other marbles come on top (the tests allow at most 4.4 radii between two recorded frames for a marble still racing).
- Pegs have no sliding friction, and no peg can hold a marble. One pressed on a peg by a pull (the track's pull plus the bank of a bend)
  that has less than 60 px/s^2 round the peg is nudged round it (60 px/s^2) the way that part points (by its number when there is none).
  One that leans on pegs for 1 s without getting a marble radius further along the track is pushed round (its own pull plus 60 px/s^2,
  one way, whenever it touches a peg) until it has been clear of pegs for a quarter of a second, which no pull can resist. (In a bend,
  as a marble goes round a stone the bank swings round with it, and a steep enough bank can hold it there: that is what the second rule
  is for.)
- Walls are another matter: a bend banked very steeply against a very weak pull presses marbles so hard on the inside rail that they
  crawl along it (seen in a test with no pegs: `physics.pull` 0.3 and a bend of 2.5 x minTurn banked 2 x 1300 px/s^2 or more ran into the
  60 s cut-off; with pull 1 every bank up to 9 x was fine). `check(..., { pace: true })` does not catch that, so if you pair a weak pull
  with a steep bank, watch the race.
- In the run-out the floor dips gently towards the middle right next to a side wall (60 px/s^2 within half a marble radius of the wall), so
  a marble that slides along a wall rolls off it instead of stopping nose to tail, and a finished marble may only come to rest against the
  end wall or against a marble that is already at rest (never in the open); together these keep the pack from growing back along a wall
  to the line.

How the engine follows a marble along any track: every piece knows its own start, direction (or centre and sweep for an arc) and walls;
a marble moves on to the next piece when its position projected on the piece passes the piece's end (for an arc: when it crosses the line
through the centre and the arc's end), and back when it passes the start. Nothing depends on x or y thresholds, so pieces may run in any
direction.

## 4b. What a map cannot do (yet)

- A curved finish: `finish()` is a straight; the run-out must be straight (a spiral has to end on a straight chord).
- A width change along an arc: change the width on a straight before or after the bend.
- Shading the floor along the track (a gradient that follows the course): the floor is one colour (`theme.floor`); decoration goes under
  the track (`theme.deco`).
- Gravity: there is none. The pull follows the track's own direction at a fixed strength, so a ramp that looks steep and one that looks
  gentle play the same (only `pull` changes that), and a piece that heads up the page pulls as hard as one heading down.

The START and FINISH words of a new map are placed by the engine, just outside the rail on whichever side has room (Switchback keeps its
own placement).

## 5. The theme

```js
theme: {
  sky: ['#2b1d5e', '#122a4a'],          // the background gradient, top to bottom
  edge: '#0b1830', rail: '#2f4f7d', railLit: 'rgba(160,205,255,0.35)', floor: '#1b3558',   // the track, outside in
  bankHi: 'rgba(150,200,255,0.11)', bankLo: 'rgba(2,8,26,0.3)',   // the light and shade of a banked turn
  dash: 'rgba(255,255,255,0.12)',       // the dashed middle line
  mat: 'rgba(255,255,255,0.06)', endWall: '#0f1f3a',              // the run-out floor and its end wall
  label: 'rgba(255,255,255,0.85)',      // START and FINISH
  peg: '#7f9cc4', pegRim: '#0b1830', pegLit: 'rgba(255,255,255,0.55)',
  accent: ['#ffc542', '#22f07a'],       // [0]: free for decoration, [1]: the start bar in the picker's thumbnail
  deco: function (ctx, d) { }           // optional decoration, painted once, under the track
}
```

`deco(ctx, d)` paints on the static layer (in track units, after the sky, before the track; it is never redrawn per frame), with
`d = { W, H, k, n, hw, r, rand, onTrack(x, y, pad), theme, reduced }`: `rand()` is a seeded random number (use it, never Math.random,
so the picture is the same every time), `onTrack(x, y, pad)` says whether a point is on the track (plus `pad`), `reduced` is the
reduced-motion preference. Stars, clouds, leaves, ripples, hills: keep it light (it is drawn once per board, but on a phone it is
a big canvas). An error in `deco` is caught and logged; the track is still drawn.

## 6. Physics a map may change

`physics: { pull: 1.0, bank: 0.8, pegBounce: 0.6 }` (each optional): `pull` multiplies how hard the track pulls a marble along (330 px/s^2 on
Switchback), `bank` how hard banked turns pull towards their inside (1300 px/s^2), `pegBounce` the bounciness of pegs (0 .. 1, default
0.7). Per piece: `o.pull` and `o.bank` of `straight` / `turn`. The map-wide and the per-piece numbers MULTIPLY: a bend with
`{ bank: 0.5 }` on a map with `physics: { bank: 0.8 }` is banked at 0.4 x 1300 px/s^2 (likewise for `pull`). Everything else (drag, rolling
resistance, marble-to-marble and wall bounciness, the run-out) is shared by every map. Keep in mind that the replay is time-scaled to the
length of a race on screen, so `pull` changes how the race plays out (bunching, collisions), not how long it lasts on screen; but a
stronger pull makes the winner arrive sooner in simulated time, which the replay then stretches into slow motion (see the pace rule): keep
`pull` near 1 and make the track long enough instead (on a 390 px phone about 1,300 to 1,500 track units for 100 marbles, which in practice
means folding the track back and forth across the page, as Switchback and Zigzag do).

## 7. The registry and the picker contract

```
GS.marbleMaps = {
  DEFAULT: 'switchback',
  add(def), list() -> [{ id, name, blurb, theme }] (picker order, the default first), get(id) -> { id, name, blurb, theme } | null,
  resolve(pref) -> id ('random' = the map rolled for the next round; unknown = the default), reroll() -> id (rolls at most once between two
  races, and never the map of the race just played),
  use(id | null)  (a live table forces the map of its round; null gives the player's choice back; lays nothing out, never writes prefs),
  current() -> the id the next layout uses (the forced one, else resolve(prefs().marbleMap)),
  thumb(id, ctx, w, h)  (draws a small picture of the map on w x h CSS px of a canvas context),
  check(id, n, W, opts) -> [problems], pace(id, n, W, seed) -> { t1, tLast, seconds, ratio, tail, leads }, build(id, n, W) -> the built map (tests)
}
GS.games.marble.variants = { pref: 'marbleMap', label: 'Track', items(), thumb(id, ctx, w, h), next(), onRoundEnd(), force(id | null), about }
GS.games.marble.currentMap() -> { id, name }   (the board on screen; during a race the map that race started on; never throws)
```

- `height(n, W)` and `layout(ents, W, H)` both read `current()`; while a race runs, a re-layout (a resize) keeps the race's map and,
  on a new map, the race's own track at the new scale.
- `onRoundEnd()` rerolls when the preference is `'random'` (Surprise me; called by crowd.js / ui/game.js between rounds; a live race never
  calls it).
- The layout memo and the pre-simulation cache are keyed by the map id (`simKey` starts with it).

## 8. The board geometry (`geo`, what `layout` returns; for the tests)

`geo.map` (id), `geo.name`, `geo.theme`, `geo.n`, `geo.r`, `geo.hw` (the map's usual half-width), `geo.hwMax`, `geo.lanes`, `geo.gap`,
`geo.gate`, `geo.finish`, `geo.total` (distances along the centre line), `geo.W`, `geo.H` (track units), `geo.k` (scale), `geo.cw`,
`geo.ch` (canvas px), `geo.pack` (`x`, `y`, `sg`: the starting slots; `s0`: where the front row stands), `geo.pegs` (`[{ x, y, r }]`),
`geo.segs` (the pieces as the pen laid them), `geo.track` (the same as flat arrays for the physics: `kind` 0 level straight / 1 arc /
2 straight at any angle, `len`, `base`, `hw0`, `hw1`, `pull`, `bank`, ...; `fx, fy` the finish point, `endx, endy` the end of the run-out),
and the helpers `geo.at(s)` -> `{ x, y, dx, dy }` (centre line and heading at distance s), `geo.hwAt(s)`, `geo.pullAt(s)`.
The same functions: `GS.games.marble._debug.pathAt(geo, s)`, `.hwAt(geo, s)`, `.segAt(geo.track, s)`.
Switchback's geo also keeps its original numbers (`rows`, `rowGap`, `rt`, `xA`, `xB`, `straight`, `y0`).

## 9. Trying a map

- `node --test givespin/tests/maps.test.js` runs every registered map through the rules above and through pre-simulated races: nothing
  leaves the track or passes through a wall, every marble crosses the line, the finished pack settles, the pace rules hold, and the drawn
  charity's marble is the one that crosses first, round after round. `MAPS_ONLY=id,id` limits it to some maps; `MAPS_FULL=1` runs the
  race checks over the whole matrix of sizes and widths (a long run). The test takes its scripts from `index.html` in order, so add your
  map file there (after `js/games/marble.js`) before running it.
- `tests/marble-maps.test.js` tests the registry and the pen. It has a complete test map (`TEST_MAP`: a vertical drop that widens into a
  field of pegs, a funnel and a run-out that runs downwards) that shows tapers, pegs and a sloped finish in use.
- `tests/e2e.mjs` sections 13zn to 13zq drive the Track picker, the record line, a round on every map, and live tables in a browser.
- Look at the track in the game too: the Track box shows a thumbnail of each map, and the sizes where the page is tallest (a phone, 8 and
  500 marbles) show the most.

## 10. Example: Zigzag Ramps (the whole program, shortened from `js/games/marble-map-zigzag.js`)

```js
build: function (m, c) {
  var p = plan(c), R = p.R;                      // the ramp angle and count that fit the page (see the file)
  var pull = c.W < 380 ? 0.9 : 1;                // a narrow page has short ramps: a gentler pull keeps the race as long to watch
  m.start(p.xL, p.y0, p.deg);
  for (var i = 0; i < p.nr; i++) {
    m.straight(p.len, { pull: pull });
    if (i < p.nr - 1) { m.turn(R, i % 2 === 0 ? 180 - 2 * p.deg : -(180 - 2 * p.deg), { bank: 0.55 }); }
  }
  var lastRight = (p.nr - 1) % 2 === 0;
  m.turn(R, lastRight ? 180 - p.deg : -(180 - p.deg), { bank: 0.6 });   // down to level
  var at = m.pos(), endX = lastRight ? c.pad + 8 : c.W - c.pad - 8, len = Math.abs(at.x - endX);
  m.finish(len, Math.min(c.runout, len - 2 * c.r - 40), { pull: 0.8 });
  return { H: Math.ceil(at.y + c.hw + 28) };
}
```

Switchback, for comparison: `start(xA, y0, 0)`, then `repeat(rows - 1, i => { straight(L); at(...); turn(rt, i % 2 ? -180 : 180); at(...) })`,
then `finish(L, min(c.runout, L - 4))`.
