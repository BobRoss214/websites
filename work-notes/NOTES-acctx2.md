# Notes from helper B2: Receipts and questions, Photos and reviews, My event

Files: `js/demo-view-messages.js`, `js/demo-view-photos.js`, `js/demo-view-event.js`. They need `js/demo-view-kit.js` (helper B) loaded before them
and register with `DemoApp.view('messages' | 'photos' | 'event', ...)`. Each file is one function that runs at once, has no top-level names, and
touches storage only through `DemoStore` (the shell hands it over as `ctx.store`). Nothing is sent anywhere.

## What each screen reads and writes (for docs/ACCOUNT_DEMO.md)
- Receipts and questions (`#messages`, hook `acct-messages` on the "Ask the farm" card). Reads `visits[].paid` (`receipt`, `on`, `lines`, `total`) and the
  thread `farm`. Writes `post('farm', 'family', text)`. `#messages?visit=<id>` (or `go('messages', {visit})`) opens and marks that receipt.
- Photos and reviews (`#photos`, hook `acct-photos` on the whole area: the form and the three lists). The family picks one of THREE SAMPLE PICTURES of the
  site (`assets/photos/goat-with-pumpkins.webp`, `sunflowers-and-pumpkins-by-the-fire.webp`, `strawberries-in-pink-bucket.webp`; there is no file picker).
  With stars: `submitReview({visitId, stars, text, photoName, thumb})`, where `thumb` is the picture's address and `photoName` its name.
  Without stars: `submitPhoto({visitId, name, thumb})` (a caption goes in `text` with `update('photos', id, {text})`).
  Statuses `waiting` | `approved` | `declined`, answered by `decideReview` / `decidePhoto`. `#photos?visit=<id>` picks the visit; the form starts on
  the latest past visit.
- My event (`#event`, hook `acct-event` on the trip card). Reads `events[0]` (`title`, `date`, `students`, `guests`, `slipsReceived`, `thread`, `checks`,
  `closed`), the requests whose target is that event, `DemoData.priceEvent`, `DemoData.eventProblem` and `DemoData.PRICES.schoolPerStudent` / `schoolMinStudents`.
  Head count change: `ask({kind: 'event-change', to: 'cathy', target: {coll: 'events', id}, patch: {students, guests}, from: 'family', summary, note})`.
  The family answers a suggestion with `respond(id, 'ok' | 'decline')` and can `cancel(id)`. The two tick boxes are saved with
  `update('events', id, {checks: {tell: bool, lunch: bool}})`. Messages: thread `event-<id>` (the record's `thread`).

## What to add elsewhere (main applies it)
- `docs/WHAT_THE_SITE_STORES.md`: nothing from these three files. They keep nothing themselves. The Photos tab shows three photos that are already on the
  site (same address, no other site is contacted); no file is read from the visitor's device and nothing is uploaded.
- `tests/README.md`: no new test file from this helper, so no row.
- `tests/browser-support.table.json`: the test passes as it is with these files.
- `tests/code-rules.test.mjs` / `tests/no-js.test.mjs`: the home page does not load the three view files (nor the kit): the `demo-*` pattern of the
  foundation commit covers them.

## Checked
`code-rules` (only the "home page loads every script in js/" line, until the foundation's `demo-*` pattern is in), `validity`, `browser-support`,
`privacy-static` (with the kit that has no storage words) and `seo` pass. In a browser, against the real shell and store: every button of the three
screens (receipt open and close, the question and her reply, a review and a photo sent and approved or not, the head count asked and answered with yes,
no, a suggestion followed by OK or No thanks, cancel, the tick boxes), 1440 px and 390 px, no sideways scroll, axe (WCAG A and AA, best practice) with
no violations, the keyboard order, and no page error.

## Where the plan was silent
- No deposit, balance or time is shown for the school trip (the page names none). The admission amount is `(students + guests) x $11` from `priceEvent`.
- A head count below 100 students is refused on the screen with the page's own rule sentence (`DemoData.eventProblem`) and nothing is asked.
- A review needs stars (the store's rule). A picture without stars is kept as a photo of its own, so "Add photos" works without a review.
- After a message is sent the focus goes to the "Waiting for a reply" line, not back into the empty box (the shell holds the screen back while a box has
  the focus, so the farm desk's answer would not show).
