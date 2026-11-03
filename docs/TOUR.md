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

1. The button opens a **welcome card**. It says how long the tour takes (about 15 seconds for each step, a step with small buttons counting as three, to the nearest 5 minutes). It has three buttons: **Start the tour**, **Choose a part** and **Not now**.
2. Each **step** dims the page and lights one box. The card says "Step 23 of 78" and the name of the part, and under it "Chapter 4 of 11". It has **Back**, **Next**, **Contents** and a round **Close** button.
3. **Contents** lists every part with the number of steps in it. The part they are in is marked. A press on a part goes to its first step.
4. The last card has **Finish** and **Start again**.
5. They can stop at any time. The next time they press the button, the welcome card has a **Continue where I stopped** button and says at which step they stopped. This works after the page was closed, and on another day, on the same computer and browser.
6. Some steps are about parts of the site that change with the season (ten today: the strip, the first screen, the badges, the game, the countdown, This week, the two places, What's in season, What's on the farm, the trees at The GreenHouse). Their card has a row of four small buttons, **Spring, Summer, Fall and Winter** (the season walk, below). Pressing one switches the whole page to that season, the lit part stays lit, and the card says what the part shows now and what is different from the season before. **Next, Back, Contents and Close put the page back** as it was.

Keys: the Right arrow is Next, the Left arrow is Back, Enter is Next, Esc closes. Tab and Shift+Tab go round the card's buttons and, in a step that lights a part of the page, the things inside that lit part too (a question, a link); they never reach the rest of the page. A screen reader hears each step once, politely.
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

The steps are written in plain JavaScript files in the `js` folder: tour-steps.js (parts 1 to 5 and 11, and the helpers of the season walk), tour-steps-b.js (parts 6 to 9) and tour-steps-c.js (part 10, the pretend account). They are read only when the tour is opened. A file may be missing. The files are fetched together but run in this order (tour-steps.js, then -b, then -c), so when two files use the same id, the first one's step is the one that shows.

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
    // allowClicks (usually left out): without it the lit part can be used (a question opens, a tab changes), nothing else can, and a link that leaves the page is switched off.
    //   allowClicks: true   the whole page may be used while the card is up ("try it" steps, and any step whose lit part opens something outside its own box, such as a menu bar with drop-down lists)
    //   allowClicks: false  nothing can be clicked
    skipIfMissing: false,            // true: leave the step out when its target is not there (a card that only shows in some seasons)
    before: function (ctx) { /* runs before the card shows: open a menu, choose a tab ... may return a Promise */ },
    after: function (ctx) { /* runs when the step is left (and when the tour is closed on it) */ },
    choicesLabel: 'See it in:',      // optional: a few words above the row of small buttons below (also the name of that group for a screen reader)
    choices: [                       // optional: a row of small buttons on the card (see "A row of small buttons" below)
      { label: 'Spring', title: 'Spring', text: 'What shows now.', run: function (ctx) { /* change the page; may return a Promise */ } }
    ]
  }
);
```

The list of the parts, for Contents, is one more line (in the first file): `window.WA_TOUR_CHAPTERS = [{ n: 1, title: 'Welcome' }, { n: 2, title: 'The first screen' }]`.
Without it the parts are called "Part 2" and so on.

What to know:

- **The target** is the first box that matches the selector and can be seen (it is not hidden, not inside a hidden box, and has a size). If you need something to point at, add an invisible `data-tour="name"` to the page and use `[data-tour="name"]`. Do not put one inside the top bar (the menu is rebuilt from time to time).
- **Clicks.** A step with no `allowClicks` lets the owner use the lit part, but only inside its own box (the window cut in the dimmer is that box). A link that would take the visitor away does nothing but say so: another page, another website, an e-mail address, a phone number, or this same page loaded again (`index.html`, `index.html?x=1`, an empty address); only a link that differs after the `#` works, and so does the site's own photo link (`data-zoom`: it only opens the photo viewer). A form that would send something to another website is stopped the same way. **If the lit part has a button that opens something outside its own box** (a menu bar with drop-down lists), use `allowClicks: true`, or light the opened part itself (the language list step does): otherwise the list is dimmed and a click on it is lost. `tests/tour-targets.test.mjs` looks for this.
- **before and after** may do anything with plain page code (click a button, open a menu). The engine waits up to 8 seconds for a Promise from `before` and 3 seconds for `after`, and an error in either is caught. Make them safe to run twice (the owner can press Back). `ctx` has `step`, `page`, `$` and `$$` (find boxes), `wait(ms)`, `waitFor(selectorOrFunction, ms)` (waits until something is on the page, gives it back, or gives back nothing after `ms`) and `undo(fn)` (runs `fn` when the tour closes). A menu left open (`aria-expanded="true"` with `aria-controls`) is closed by the engine when the tour closes, but tabs and other choices are not: put them back in `after`.
- **Another page**: a step with another `page` makes the tour go there and carry on when it has loaded. Never move the page inside `before`. The next page continues from the tour's own place in the browser, so the switch must be on there too (see "How to show it").
- **The pretend account pages** (account, farm-desk, kitchen) only exist in demo mode. When demo mode is off (`WA_DEMO_MODE()` is false) their steps are left out completely: they are not counted and not in Contents.
- The same id twice: the first one wins. Two steps with the same order keep the order of the files and of the list.
- Pictures, prices and hours in a card must come from the site itself. Never invent one.

## A row of small buttons on a card (`choices`)

A step may put a row of small buttons on its card, between the words and Back / Next. Pressing one runs the button's own `run(ctx)` (a Promise is waited for, 8 seconds at most; one that throws does not stop the card),
and then the card shows that button's `title` and `text` instead of the step's own, and the lit box is measured again (the part may have grown, shrunk or moved).
The engine remembers nothing else: **what `run` changed on the page is put back by the step's `after()`** (or by `ctx.undo`), like everything else a step does. The tour waits for a press that is still being carried out
before it runs `after()`, and a press is ignored while the tour is moving to another step.

```
choices: [                                  // or a function(ctx) that gives the list when the card shows (so it can look at what before() did)
  { label: 'Spring',                        // the words on the button (required: an entry without a label is left out)
    title: 'Spring',                        // optional: the card's title while this button is pressed (the step's own title when left out)
    text: 'What the lit box shows now.',    // optional: the card's text while this button is pressed (the step's own text when left out). 45 words at most
    run: function (ctx) { /* change the page */ },   // optional
    pressed: false },                       // optional: true when this choice is already in effect when the card shows (because before() did it)
  ...
]
```

- A card shown anew starts with no button pressed (and the step's own words), unless a choice says `pressed: true`. Contents and Back from Contents show the same step again with the same button pressed.
- `choicesLabel` (on the step, 6 words at most) is shown in small capitals above the row, and is the name of the group for a screen reader (without it the group is called "Choose" and nothing is shown above the row).
- Every button is a real button: Tab reaches it, Enter or Space presses it, a screen reader hears "pressed". The new title and text are announced once.
- The step needs an `after()` that puts the page back. `tests/tour-targets.test.mjs` runs every `run` of every step, one after the other, and then `after()`, and checks the page is as it was.

### The season walk (`js/tour-steps.js`)

Every part of the site that changes with the season has a row of four buttons, Spring, Summer, Fall and Winter. Pressing one switches the **whole page** to that season, as a visitor would see it in the middle of it, while the lit box stays on that part,
and the card says what the lit part shows now and what is different from the season before. The step is written like this:

```
{ id: 'ch3-week', order: 302, chapter: 3, page: 'index', target: '#this-week', title: '...', text: 'What the box is. Press a season to see it.',
  choices: seasonWalk({ spring: 'What shows in spring.', summer: { title: 'Optional own title', text: 'What shows in summer.' }, fall: '...', winter: '...' }),
  before: seasonsBegin, after: seasonsEnd }
```

What a press does (the helpers are in `js/tour-steps.js`; `js/tour-steps-b.js` uses them as `window.WA_TOUR_SEASONS`):

1. The page's own season switch (`WISE_ACRES.hero.setSeason`, the same as the "See the farm in" buttons): the picture, the headline and buttons, the "What's in season" tabs, the farm cards, the menu link to Playgrounds.
2. The lines marked `data-in-season` (they show only while that season is really on) are shown, as they would be on those days.
3. The parts that follow the clock (the strip at the top, the countdown, "This week at the farm", the open-now badges, the "In season" fact, the "Happening now" and "Now" marks) draw themselves again, the way the page does it when the farm's day changes
   (`WISE_ACRES.live.refresh()`, then the `wa:day` event), for a **pretend day**: the Saturday on or before the middle of that season's dates (`js/season.js`), in the latest year when that day is not after today, at noon in New York.
   The clock is pretended only while they draw (an instant), then it is the real one again. A pretend day is never after today, so no line with a last day (`data-until`) is hidden by it.

`seasonsEnd` (in `after`) puts everything back: the season switch, every `data-only` line as it was, the open tabs, and the clock parts drawn again with the real date. It also runs when the owner presses Next, Back, a part in Contents or Close.
Changes and the putting back are made one after the other, so a quick Next never leaves the page half-changed.

Writing the words of a season: what the lit box shows in that season and what is new or gone compared with the season before. A phrase in double curly quotes (“...”) in the card of a button must be written in the lit box
when that button is pressed (`tests/tour-targets.test.mjs` presses every button and checks it). A phrase the page says on another day (for example what the strip says after a season ends) goes in single curly quotes (‘...’):
those are not checked against the lit box (the strip step's are checked against the page on the day after the season's last day). A "Month day" in the card of a season must be that season's first or last day in `js/season.js`
(also checked). A part that does **not** change with the season gets no buttons; its card says so (for example "This box stays all year").
On a phone the site's own style leaves out a few words (the “In season:” part of the strip, `css/extras.css`): the card of the strip says so, and at phone width the check only notes such a phrase.

## For the person who builds the preview

- Set `window.WA_TOUR = true` before `js/tour.js` runs, on every page.
- The engine asks for `css/tour.css` at once and for the steps files when the tour is first opened. They are found next to `js/tour.js`.
- If the style and the steps are put inside the page, also set `window.WA_TOUR_INLINE = true`: the engine then asks for no file at all. The steps scripts must come before `js/tour.js`; a step whose id is already known is ignored.
- Pages that the tour jumps to (`index`, `first-visit` and the others, `account`, `farm-desk`, `kitchen`) must sit side by side, so that `<page>.html` works from any of them.
- The engine uses no alert, no confirm, no new window, no download, and no IntersectionObserver (its `rootMargin` is ignored in that frame).

## Files and checks

| File | What it is |
| --- | --- |
| `js/tour.js` | the engine (one script, after the site's own scripts on every page; the three pretend-account pages add their own scripts after it) |
| `css/tour.css` | its look |
| `tests/tour.test.mjs` | the engine, with made-up steps: the button, the welcome card, a walk through the steps, the lit box and the card, keys, links that leave the page, other pages, stopping and continuing, the small buttons of a step (`choices`), calm mode, a phone |
| `tests/tour-off.test.mjs` | with the switch off nothing changes on any page (`js/tour.js` comes after the site's own scripts; a page's own scripts come after it) |
| `tests/tour-targets.test.mjs` | the real steps: their words, their targets on the real pages (1440 and 390 px, six days), and every small button of every step pressed in turn, the quoted words checked against the lit box, and no lit part that opens something outside its own box unless the step says `allowClicks: true` |
| `tests/tour-seasons.test.mjs` | the season walk with the real engine and the real steps, on a fall day and a spring day: the whole page changes, Next / Back / Contents / Esc / Finish put it back, a phone, the keyboard, the whole tour walked |

Run them with `node tests/run-all.mjs tour tour-off tour-targets tour-seasons`, as described in `tests/README.md`.
