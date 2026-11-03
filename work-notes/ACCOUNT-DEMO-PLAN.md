# Account demo plan (started 3 Nov 2026)

WHAT: a pretend "account" feature for the website, to show the farm owners (Mrs. Cathy and Rob) what accounts could do for them.
It must FEEL fully working (create an account, sign in, change things, see the replies) but everything is pretend: it lives in the
browser's own storage (`localStorage`) on one device. Nothing goes to a server and nothing is sent to anyone. The site builder (the user,
not the farm owner, not technical) will show it to the owners. English only for now.
Names on screen: "Mrs. Cathy" (spelled Cathy, like the farm's email) and "Rob" for the farm side; "the kitchen" (Wise Pie) for pizza.
Family screens say "Waiting for a reply from Mrs. Cathy" and "Waiting for the kitchen".
The owner approved everything below EXCEPT the stamp card (do not build any stamp card, points or reward idea).

## Guardrails (read twice)
- DEMO label on every demo screen, always visible: "Demo: pretend accounts. Nothing is saved on a server or sent to anyone."
- Demo mode switch (one function, `WA_DEMO_MODE()` in `js/demo-header.js`): true when `window.WA_DEMO === true` (the preview build sets it), or the
  address has `?demo` (then remember it for the browser tab in `sessionStorage` so links between pages keep it). Never true by default. No
  "localhost means demo": the normal checks run on localhost and must not see any demo item.
- Without demo mode: no "Sign in" button anywhere, and the three demo pages show only a polite box ("This is a demo page. It is not open to
  visitors.", link to the home page). The demo pages have `<meta name="robots" content="noindex">`, are NOT in `sitemap.xml`, NOT in the menu,
  NOT in `print/`. Add a test for all of this (`tests/demo-off.test.mjs`): the normal site is unchanged when the flag is off.
- No real data anywhere. The sample family is obviously made up (first names only, e.g. Alex, Jordan, Riley 8, Casey 6, baby Sam 2;
  email `alex@example.com`). No phone numbers, no real people, no real addresses except the farm's own that are already on the site.
- Passwords are pretend: never stored, never checked. Say so on the form ("Demo: any password works. It is not saved.").
- Prices: ONLY amounts that appear on this website (see "Prices and rules"). Never invent one. If the page has no number for something, show
  no number ("The kitchen confirms the price").
- The repo is PUBLIC. No external libraries, no network calls, no tracking.
- Look: same style as the rest of the site (fonts and colors from the CSS variables in `css/styles.css`, ink borders, rounded cards,
  buttons like `.btn`, `.btn-red`). Look at the Visit cards and the Shop cards and match them. Works at 1440 px first, then 390 px.
  Real `<button>`s, labels on every field, visible focus, 44 px touch targets, `prefers-reduced-motion` and the site's calm mode respected.

## The one pattern: every change is a request
Ask -> Waiting -> Reply -> (the family says OK) -> Done. Nothing changes until the farm says yes. If the farm answers with a different
suggestion, the family must say OK (or "No thanks, keep mine"). The same engine serves visit changes, pizza changes and any later kind.
Request statuses: `waiting`, `yes`, `no`, `suggested`, `accepted`, `declined`, `cancelled`. Only one open request per visit and per order.

## Pages and files (who owns what; do not edit another owner's file, ask the main session)
Three new pages, built by `tools/pages.py` like `first-visit.html` (same header and footer; add them to its page list; the demo content sits
inside `data-no-i18n` so the translation extractor leaves it alone; text made by JavaScript is not seen by the extractor anyway):
- `account.html`: the family's account. Owner: helper A (customer app) and helper B (extra views).
- `farm-desk.html`: Mrs. Cathy and Rob's desk. Owner: helper C.
- `kitchen.html`: the pizza kitchen's screen. Owner: helper C.
Shared files:
- `js/demo-header.js` (tiny, loaded by every page, does nothing unless demo mode): the flag function, the "Sign in" / "My account" button in the header
  (icon + word on wide windows, icon only when tight, `aria-label="Sign in (demo)"`), and the thin demo bar on demo pages (see below). Owner: A.
- `js/demo-store.js`: the one place that keeps the state in `localStorage` key `wa-demo-v1`. Owner: A (first deliverable, see "Order of work").
- `js/demo-data.js`: sample family, prices, slots, pizza menu (read from the page, see below), `sample(todayDate)`. Owner: A.
- `js/demo-app.js` (the family shell: tabs, sign-in state, notices bell, view registry `DemoApp.view(name, {label, render(root, ctx)})`), `js/demo-ui.js`
  (formatters: "Saturday, Nov 14", "2:00 pm", money; a modal; a toast), `css/demo.css` (shared look). Owner: A.
- `js/demo-view-visits.js`, `js/demo-view-pizza.js`: A. `js/demo-view-family.js`, `-alerts.js`, `-year.js`: B (who also owns `js/demo-view-kit.js`, a small shared helper for the
  family views: DOM builder, fields, switch, chip, toast, redraw-on-change; load it before the view files; it should use `DemoUI` from A where that exists, one toast
  only). `js/demo-view-messages.js`, `-photos.js`, `-event.js`: B2.
- `js/demo-desk.js`, `js/demo-kitchen.js`, `css/demo-staff.css`: C.
- `docs/ACCOUNT_DEMO.md`: plain words for the builder: what it is, how to show it, how to start over, how to turn it on and off, what is pretend, what a
  real version would need (a place for logins, a link to the booking tool, alerts to Mrs. Cathy and the kitchen, care with kids' info, an updated
  privacy page). Owner: A. Keep README.md and docs consistent (`python3 tools/plain_lint.py`: 40 words a sentence).
- Tests: `tests/account-demo.test.mjs` and `tests/demo-off.test.mjs` are written by an independent helper from this file, not by the builders.
  The builders still add small checks for their own parts where the existing tests need them.

## Demo bar (top of every demo page, under the header)
A thin strip: DEMO label, a switch "Family | Mrs. Cathy's desk | Kitchen" (links between the three pages, current one marked), "Start over"
(clears the demo state after a plain "Are you sure?" box made with HTML, not `confirm()`), and a "Take a tour" link when the tour exists
(`window.WA_TOUR_MODE` from `work-notes/TOUR-PLAN.md`).

## The store (`js/demo-store.js`): contract
Plain JavaScript, no libraries, loadable by the browser and by Node (`module.exports` when `module` exists; a factory `DemoStore.create(storage)` so tests
can pass a fake storage). State in `localStorage['wa-demo-v1']`; falls back to memory if storage is blocked. Other tabs update live (listen to the
`storage` event). Every change calls the subscribers: `DemoStore.subscribe(fn) -> unsubscribe`. All methods are synchronous and return plain objects.
- Account: `createAccount({name, email})`, `signIn(email)` (ok if that email was created in this browser), `signOut()`, `current()` (account or null), `reset()`,
  `seedSample()` (fills the sample family, visits, orders, event from `DemoData.sample(today)`; called by `createAccount`).
- Generic lists: `list(coll)`, `get(coll, id)`, `add(coll, obj)` (adds an `id`), `update(coll, id, patch)`. Collections: `visits`, `orders`, `requests`,
  `messages`, `notices`, `reviews`, `photos`, `events`, `waitlist`; plus `family` (one object), `alerts` (map key -> bool), `closedDays` (list of dates), `badges`.
- Requests: `ask({kind, to: 'cathy'|'kitchen', target: {coll, id}, patch, from, summary})` -> request with status `waiting`;
  `reply(id, {answer: 'yes'|'no'|'suggest', note, suggestion: {patch, summary}})`: yes applies `patch` to the target, no changes nothing,
  suggest keeps the suggestion and sets `suggested`; `respond(id, 'ok'|'decline')`: ok applies `suggestion.patch` (status `accepted`), decline keeps the old
  (status `declined`); `cancel(id)`. Every step is added to `request.history` with a time and a plain sentence, and makes a notice for the other side.
- Messages: `post(threadId, from: 'family'|'cathy', text)`, `thread(threadId)`. Notices: `notify(text, link)`, `markRead(id)`.
- Weather: `closeDay(date, reason)` (marks every visit on that date `closed: true`, makes a notice for the family), `openDay(date)`.
- Alerts: `setAlert(key, bool)`, `alertCounts()`, `fireAlert(key)` (notice for the family if subscribed).
- Reviews and photos: `submitReview({visitId, stars, text, photoName})` (status `waiting`), `decideReview(id, true|false)`.
- Dates are `YYYY-MM-DD` and times `HH:MM` (24 h), the farm's own clock, no time zones. `DemoData.openDays(fromDate, package, n)` gives the next allowed days
  (Thursday to Sunday for farm-only, Friday to Sunday with pizza, skipping `closedDays`).
Write a small Node test for the store with a fake storage (`tests/demo-store.test.mjs`): a request yes, no, suggest then ok, suggest then decline, cancel,
closeDay, alerts, reset, and that two stores on the same storage see each other's changes.

## Prices and rules (all from this website; check them against `index.html` before you use them, and add a test that the numbers in `demo-data.js` still appear on the page)
- Visit with pizza (Friday, Saturday, Sunday): $31 base price, includes 2 Wise Pie pizzas, plus $3 per person ages 3 and up. Children 2 and younger are free.
- Farm fun only (Thursday to Sunday): $3 per person ages 3 and up; 2 and younger free.
- Add-ons: wagon ride $4.50 per person (2 and younger free); barrel train $3 per child (ages 12 and under only); corn pit $4 per person (on Thursdays buy one,
  get one free with a reservation: keep the sample visit off Thursdays, or compute it). Tomatoes and basil are paid by weight at pick-up, not in the visit.
- THE PIZZA RULE: pizzas are ready 1 hour after the reservation time (a 2:00 pm visit means pizza at 3:00 pm). That is the default pizza time. The family can
  ask for earlier or later; the kitchen decides.
- Extra pizzas, crust and cheese: read the Fall Menu (`#pizza` in `index.html`, the picture `assets/photos/wise-pie-fall-menu-2026.webp`: open it and read it) and the
  Shop card (Wise Pie pizza $15-$17; gluten-free crust +$9; vegan cheese +$3, from the farm's older page). Use only prices that appear there. Lowering the
  number of pizzas shows no price change ("The kitchen confirms any price change"); never invent a refund rule.
- Sample visit (computed by code from these rules, not typed in): the next Saturday, 2:00 pm, with pizza, 2 adults, 2 kids (8 and 6), 1 baby (2); wagon ride for
  the 4 people ages 3+... use the page's own rules for who is charged; barrel train for the 2 kids. Show an itemized "Paid" list and the total.
- School tours and parties: read the Groups section. Use amounts only if the page has them; otherwise show the status only ("Deposit: paid").
- Time slots are pretend: on the hour from 10 am to 2 pm (the farm side of the day is 10 am to 4 pm on the pizza page). Say "sample times" near them.

## Family screens (`account.html`; one page, tabs by `#hash`: `#visits` (default), `#pizza`, `#family`, `#alerts`, `#year`, `#messages`, `#photos`, `#event`)
1. Create account (name, email, pretend password) and Sign in (email, any password). Creating one loads the sample family and says so: "We added a sample
   visit so you can try the buttons." Sign-out in the header menu. Not signed in: the tabs show the sign-in box.
2. My visits: the upcoming visit card (date, time, party, package, add-ons, "Paid" with the itemized lines and total, receipt number), buttons "Request a
   different day", "Add to calendar" (a real .ics download is fine), "Directions" (link to the farm's map link already on the site), "What to bring" (link
   to the first-visit guide). Past visits below, each with "View receipt", "Leave a review", "Add photos".
   REQUEST A DIFFERENT DAY: pick one of the next open days (from `DemoData.openDays`) and a sample time, optional note, Send. The card shows a chip
   "Waiting for a reply from Mrs. Cathy" with the time sent and a "Cancel my request" link. When she answers: yes -> the visit moves, with a green note;
   no -> her note and the visit stays; suggest -> "Mrs. Cathy suggests Sunday, Nov 15 at 1:00 pm" with [OK, move my visit] [No thanks, keep mine].
   WEATHER: when a day is closed (from the desk), the visit shows "The farm is closed that day because of weather." and a one-tap "Pick a new day"
   that starts the same request, marked as a weather move.
3. My pizza: the order for the visit: each pizza (type, toppings, gluten-free or vegan, count), the pick-up time (default visit time + 1 hour), the price
   lines. "Change my pizza order": the family can change EVERYTHING: how many pizzas, the toppings, the type of pizza, gluten-free or not, vegan cheese or not,
   and the pick-up time (earlier or later in 15 minute steps; earlier than the default is the main case). Show a plain summary "You asked: ... Now: ..."
   and the price change for additions. Send -> "Waiting for the kitchen". The kitchen answers Yes, No, or "Change it" (its own edits or time) -> the family
   sees "The kitchen suggests this instead" with the difference and [OK] [No thanks, keep mine]. The family's saved allergies show next to the order.
4. My family: adults, kids (names, ages), allergies, gluten-free / vegan flags; saved. A line says the kitchen sees them on pizza orders.
5. Tell me when: switches for "Strawberries open", "Blueberries and sunflowers open", "Pumpkins and tomatoes open", "Christmas trees arrive", and
   "A spot opens on a full day" (pick a day). Saved. (The site already has a waitlist and an email list; this shows them in one place.)
6. My year: the kids' badges and the pumpkin basket count (reuse the achievements the hero game already keeps: find where in `js/` it stores them and read
   the same keys; do not change that code), visits so far, "Visits this year". A line: "On a real account this would follow you to any phone."
7. Receipts and questions: receipts list with itemized lines; "Ask the farm" box (a message thread with Mrs. Cathy; her reply shows here).
8. Photos and reviews: after a past visit: pick ONE OF THREE SAMPLE PICTURES (from `assets/photos`; there is NO file picker anywhere: the site's privacy rule and
   `tests/privacy.test.mjs` forbid it; a real version would let families add their own) and give 1-5 stars and a sentence. Status "Waiting for Mrs. Cathy to
   approve" -> approved shows under "Shared with the farm (demo)". It never touches the real gallery or the real reviews.
9. My event (groups and schools): a sample school trip ("Sample Elementary, 2nd grade") that follows the page's own rules (Groups section and
   `school-field-trips.html`: $11 per student, minimum group size 100 students, parents and siblings ages 3 and up who come also pay $11): a head count of
   100 students or more (editable as a request), a checklist (permission slips received so far, sample), the amount computed from those page prices, and a
   message thread with Mrs. Cathy. Show a deposit only if the page mentions one.
10. A bell with the latest notices (replies, alerts, weather) and a count; each links to the right tab.

## Farm desk (`farm-desk.html`, for Mrs. Cathy and Rob; no login, a line says "Demo: you are Mrs. Cathy / Rob")
- Waiting for you (a count badge in the title): one card per open request or message: the family's name, what they ask ("Move Saturday, Nov 14, 2:00 pm to
  Sunday, Nov 15, 1:00 pm"), their note, and [Yes] [No] [Suggest another day or time] with a note box. After answering, the card shows what was sent.
- Also here: review and photo approvals ([Approve] [Not now]), messages to answer, group-trip changes.
- This week: the visits by day with head counts (people, not capacity: never invent a capacity number), pizza counts per pick-up time.
- Weather: close or open a day (picks from the next open days). Closing a day marks every visit that day and sends the family a notice.
- People waiting: counts for each "Tell me when" switch and the day waitlist, with a "Send the alert" button that makes the family notice (pretend).
- Groups and schools: the sample event and its thread. Keep it plain and uncluttered: big type, big buttons, works on a tablet.

## Kitchen (`kitchen.html`)
- A queue by pick-up time. Each order card: the family name, pick-up time, the pizzas (type, toppings, gluten-free, vegan), the family's allergy note, and a
  status: New, Change waiting for you, Waiting for the family's OK, Confirmed.
- A change request shows the difference (before -> after) with big [Yes] [No] [Change it]. "Change it" opens the same pizza editor with the kitchen's edits
  and a time, then sends it back to the family for their OK. Tablet-first, large buttons, high contrast.

## Hooks for the tour
Put `data-tour="<name>"` on the key controls so the tour can point at them (they are invisible). Required names: demo bar `demo-bar`, `demo-switch`, `demo-reset`;
family `acct-signup`, `acct-sample-note`, `acct-visit-card`, `acct-paid`, `acct-request-day`, `acct-request-status`, `acct-reply`, `acct-pizza-card`,
`acct-pizza-edit`, `acct-pizza-time`, `acct-family`, `acct-alerts`, `acct-year`, `acct-messages`, `acct-photos`, `acct-event`, `acct-closed-banner`, `acct-bell`;
desk `desk-waiting`, `desk-card`, `desk-yes`, `desk-no`, `desk-suggest`, `desk-week`, `desk-weather`, `desk-people`, `desk-approvals`, `desk-groups`;
kitchen `kit-queue`, `kit-card`, `kit-yes`, `kit-no`, `kit-change`, `kit-notes`. The tour drives the demo through the store functions above, so keep
their names exactly as in the contract and keep them in `docs/ACCOUNT_DEMO.md`.

## Order of work
1. Helper A first builds and reports the FOUNDATION as its own commit (store with its Node test, data, the flag, header button, demo bar, shell, the three page
   shells added to `tools/pages.py`, sign-up and sign-in) and tells the main session by `SendMessage` to `main`: "foundation ready: <clone> <hash>". The main session
   cherry-picks it so B and C can start from it. Then A goes on with My visits and My pizza, one commit each.
2. B (extra views) and C (desk and kitchen) start from the foundation; they only add their own files and the one `<script>` line each in the page shells
   (A leaves a commented slot for every file listed above).
3. When all are in, the independent test helper runs its test and the main session runs the checks, republishes the preview and tells the owner.

## Checks to run (one at a time, see HANDOFF.md for the setup)
smoke, no-js (the demo pages show the guard box), axe-wide (add the three pages with `?demo`), big-font, layout-sweep, touch, keyboard, link-names, sitecheck-values,
calendar-doc, plain-lint, option-patches, browser-support (new CSS or SVG features), `node tools/i18n_facts.mjs`, `python3 tools/check_facts.py`, and the new demo tests.

## Rules for helpers
Own clone (`git clone /home/user/websites /tmp/<name>-clone`), never edit or push `/home/user/websites` or origin. Commits end with exactly the two lines
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_016TmrCsikkBKpN9HzniSTFT`; no other model names.
Always the full pipeline `python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build` (never `tools/pages.py` alone). No
`pkill -f`, `pgrep -f`, `pkill -x node`; tests one at a time, slow ones in the background with a log. Public repo: nothing private. No pull request.
Never invent a price, hour or fact. Report in plain words, short: commit hash, files, checks and results, what the spec did not say, what is left.
