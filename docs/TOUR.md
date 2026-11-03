# The tour for Mrs. Cathy and Rob ("Take a tour")

This is a guided tour of the whole website, made for the two farm owners. It lights up one thing at a time and a small card says what it is, why it helps, and what they need to do.
**Real visitors never see it.** It is switched off on the real site, and with it off the pages are exactly as they were.

## How to show it

The tour has a small switch. It is on in only three cases:

1. **The preview** (the claude.ai page) sets the switch on every page. Nothing to do there.
2. **On your own computer**: add `?tour` to the end of the page address, for example `http://localhost:8000/index.html?tour`.
3. **An address that ends in `#tour`**, for example `index.html#tour`. This one also opens the welcome card at once.

If the page was already open, press the reload button after you change the address.
With the switch on, a yellow button "Take a tour" sits at the bottom right of every page, above the round "back to top" button.
It never starts by itself: Mrs. Cathy and Rob press it.

To go to other pages the tour keeps the switch on for itself. With `?tour` it takes `?tour` along to the next page. In the preview the switch is on everywhere anyway.

## What the owners see

1. The button opens a **welcome card**. It says how long the tour takes (about 15 seconds for each step, to the nearest 5 minutes). It has three buttons: **Start the tour**, **Choose a part** and **Not now**.
2. Each **step** dims the page and lights one box. The card says "Step 23 of 78" and the name of the part, and under it "Chapter 4 of 11". It has **Back**, **Next**, **Contents** and a round **Close** button.
3. **Contents** lists every part with the number of steps in it. The part they are in is marked. A press on a part goes to its first step.
4. The last card has **Finish** and **Start again**.
5. They can stop at any time. The next time they press the button, the welcome card has a **Continue where I stopped** button and says at which step they stopped. This works after the page was closed, and on another day, on the same computer and browser.

Keys: the Right arrow is Next, the Left arrow is Back, Enter is Next, Esc closes. Tab and Shift+Tab stay inside the card. A screen reader hears each step once, politely.
On a phone the card is a sheet at the bottom of the screen and the lit box is moved above it.

## What it does to the page

- It changes nothing for real. Nothing is sent anywhere. It only keeps its own place in the browser, under the name `wa-tour`: one note for this tab and one for the next day. Finishing the tour deletes both.
- When the tour closes it puts back what it touched: a menu a step opened is closed, and the page goes back to where it was when the tour was opened.
- With "Pause animations" on, or when the visitor's system asks for reduced motion, nothing slides or fades: the lit box just appears.
- If something is missing the tour does not stop. A step whose target is not on the page shows its card in the middle (or is skipped, when the step says so). A step that fails is shown anyway. A missing steps file is ignored.

## Turning it off, and taking it out

**Off** is how the site is now. There is nothing to do: with the switch off, the script defines one name (`WA_TOUR_MODE`) and stops. It asks for no other file, shows nothing, and stores nothing. `tests/tour-off.test.mjs` proves this on every page.

**Taking it out for good** (only if you want to): delete the line `<script src="js/tour.js"></script>` from `index.html`, run the three commands `python3 tools/pages.py`, `python3 tools/i18n.py extract` and `python3 tools/i18n.py build` (always all three, one after the other), and delete the tour files.

## How to add or change a step

The steps are written in plain JavaScript files in the `js` folder: tour-steps.js (parts 1 to 5 and 11), tour-steps-b.js (parts 6 to 9) and tour-steps-c.js (part 10, the pretend account). They are read only when the tour is opened. A file may be missing.

Each file adds its steps to one list:

```
(window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []).push(
  {
    id: 'reserve-button',            // a name nobody else uses
    order: 203,                      // chapter x 100 + the place in the chapter; the steps are sorted by this number
    chapter: 2,                      // the number of the chapter (see WA_TOUR_CHAPTERS below)
    page: 'index',                   // index, first-visit, pumpkin-patch, strawberry-picking, school-field-trips, wise-pie, account, farm-desk or kitchen
    target: '.hero-cta .btn-red',    // ONE CSS selector, or null for a card in the middle
    title: 'The Reserve button',
    text: 'It goes to your booking tool.\nA visitor can reserve in one tap.',   // plain text: \n is a line break, a line that starts with "- " is a bullet. 45 words at most
    allowClicks: false,              // true: the owner may click the page while the card is up ("try it" steps)
    skipIfMissing: false,            // true: leave the step out when its target is not there (a card that only shows in some seasons)
    before: function (ctx) { /* runs before the card shows: open a menu, choose a tab ... may return a Promise */ },
    after: function (ctx) { /* runs when the step is left (and when the tour is closed on it) */ }
  }
);
```

The list of the parts, for Contents, is one more line (in the first file): `window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Welcome' }, { n: 2, title: 'The first screen' }]`.
Without it the parts are called "Part 2" and so on.

What to know:

- **The target** is the first box that matches the selector and can be seen (it is not hidden, not inside a hidden box, and has a size). If you need something to point at, add an invisible `data-tour="name"` to the page and use `[data-tour="name"]`. Do not put one inside the top bar (the menu is rebuilt from time to time).
- **before and after** may do anything with plain page code (click a button, open a menu). The engine waits up to 8 seconds for a Promise from `before` and 3 seconds for `after`, and an error in either is caught. Make them safe to run twice (the owner can press Back). `ctx` has `step`, `page`, `$` and `$$` (find boxes), `wait(ms)`, `waitFor(selectorOrFunction, ms)` (waits until something is on the page, gives it back, or gives back nothing after `ms`) and `undo(fn)` (runs `fn` when the tour closes). A menu left open (`aria-expanded="true"` with `aria-controls`) is closed by the engine when the tour closes, but tabs and other choices are not: put them back in `after`.
- **Another page**: a step with another `page` makes the tour go there and carry on when it has loaded. Never move the page inside `before`. The next page continues from the tour's own place in the browser, so the switch must be on there too (see "How to show it").
- **The pretend account pages** (account, farm-desk, kitchen) only exist in demo mode. When demo mode is off (`WA_DEMO_MODE()` is false) their steps are left out completely: they are not counted and not in Contents.
- The same id twice: the first one wins. Two steps with the same order keep the order of the files and of the list.
- Pictures, prices and hours in a card must come from the site itself. Never invent one.

## For the person who builds the preview

- Set `window.WA_TOUR = true` before `js/tour.js` runs, on every page.
- The engine asks for `css/tour.css` at once and for the steps files when the tour is first opened. They are found next to `js/tour.js`.
- If the style and the steps are put inside the page, also set `window.WA_TOUR_INLINE = true`: the engine then asks for no file at all. The steps scripts must come before `js/tour.js`; a step whose id is already known is ignored.
- Pages that the tour jumps to (`index`, `first-visit` and the others, `account`, `farm-desk`, `kitchen`) must sit side by side, so that `<page>.html` works from any of them.
- The engine uses no alert, no confirm, no new window, no download, and no IntersectionObserver (its `rootMargin` is ignored in that frame).

## Files and checks

| File | What it is |
| --- | --- |
| `js/tour.js` | the engine (one script, the last one on every page) |
| `css/tour.css` | its look |
| `tests/tour.test.mjs` | the engine, with made-up steps: the button, the welcome card, a walk through the steps, the lit box and the card, keys, other pages, stopping and continuing, calm mode, a phone |
| `tests/tour-off.test.mjs` | with the switch off nothing changes on any page |

Run them with `node tests/run-all.mjs tour` (both), as described in `tests/README.md`.
