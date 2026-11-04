# The account demo (pretend accounts)

**This is a demo for Mrs. Cathy and Rob. It is pretend.** It shows what customer accounts could do for the farm: a family signs in, sees its visits, asks to change a day or a pizza order, and gets an answer from Mrs. Cathy or the kitchen. Everything is kept in one browser on one computer. Nothing goes to a server and nothing is sent to anyone. There are no real people, no real phone numbers and no real addresses in it, except the farm's own address that is already on the site.

It is hidden from real visitors. Only the person who shows it sees it.

## How to show it

1. Open the home page with `?demo` at the end of the address, for example `index.html?demo` on your computer or `https://www.wiseacresorganic.com/?demo` once the site is online. The claude.ai preview of the site has the demo switched on by itself.
2. A round person button appears next to the language button in the top bar. It opens the family's account page (`account.html`).
3. A yellow strip under the top bar says "Demo: pretend accounts. Nothing is saved on a server or sent to anyone." It stays on every demo screen. It holds three links, **Family**, **Mrs. Cathy's desk** and **Kitchen**, a **Start over** button and, when the tour is on, **Take a tour**.
4. On the account page press **Create account** (or **Fill in sample details** and then **Create account**). The form asks one plain question: "Do you plan or manage a party, an event or a school trip?" It has four big buttons: **No**, **Yes: a party**, **Yes: a school trip** and **Yes: another event**. **No** is chosen to begin with, and **Fill in sample details** fills in the name and the email and chooses the school trip. The page loads a sample family: Alex, Jordan, Riley (8), Casey (6) and baby Sam (2), one visit next Saturday with pizza and two past visits. Only a yes adds an event of that kind. A green line says "We added a sample visit so you can try the buttons."
5. The password is pretend: any password works and it is never saved.
6. Try a change on the family side, for example **Request a different day**. The visit says "Waiting for a reply from Mrs. Cathy". Then open **Mrs. Cathy's desk** (it is the same browser, so it sees the request), press Yes, No or Suggest, and go back to **Family** to see the answer. Pizza changes go to the kitchen the same way.
7. The bell on the account page shows the newest notices (answers, alerts, weather) with a count. Each one leads to the right tab.
8. The **My event** tab is on the bar only for a family that has an event: one that said yes at sign-up, or one that added an event later. Without an event the tab is not there, and the address `account.html#event` opens the first tab. A family that said No can add one with the small link **I also plan an event** at the bottom of **My family**: it asks for the kind (a party, a school trip or another event), adds a sample one and opens the tab.

The three pages remember that the demo is on while you move between them in the same browser tab. A new tab needs `?demo` again.

## How to start over

Press **Start over** in the yellow strip, then **Yes, start over**. It clears the pretend account, visits, orders and requests in this browser. Nothing else on the site is touched. Closing the browser does not clear the demo: the next time you open it with `?demo`, the same family is still there.

## How to turn it on and off

It is **off** unless one of these is true:

- the address has `?demo` (the page then remembers it for that browser tab), or
- the page sets `window.WA_DEMO = true` before the scripts run. The claude.ai preview of the site does this.

Being on your own computer (`localhost`) does **not** turn it on, so the normal checks never see the demo. With the demo off:

- there is no round person button anywhere,
- the three demo pages show only a polite box ("This is a demo page. It is not open to visitors.") with a link to the home page,
- the pages are marked `noindex`, are not in `sitemap.xml`, are not in the menu, and the host is told not to list them (`_headers`),
- the demo scripts keep nothing in the browser: the one switch is `window.WA_DEMO_MODE()` in `js/demo-header.js`, and it reads no browser storage.

To remove the demo from the site completely, delete the three page files in `pages/` (`account.html`, `farm-desk.html`, `kitchen.html`), the `js/demo-*.js` and `css/demo*.css` files, the `js/demo-header.js` line in `index.html`, and run the three rebuild commands below.

## What is pretend, and what is real

| Pretend | Real |
|---|---|
| The family, the visits, the receipts, the pizza orders, the school trip, party or other event, the messages, the photos and reviews, the "people waiting" | The prices, the ages, the days and the pizza menu: they are copied from the site's own pages. The party price ($300 for the whole party, up to 50 guests) and the school tour price ($11 per student, at least 100 students) too. No price is shown for "another event": the site names none (its corporate prices are still a draft) |
| The accounts and the password | The farm's address (4701 Hartis Rd) on the Directions button. Two e-mail links the site already shows: **Questions? Email Vanessa** (school trips) and **Pizza questions? Email Ava** (My pizza), and Ava's address on the kitchen screen. No phone number is shown for them |
| The replies of Mrs. Cathy and the kitchen: whoever shows the demo presses the buttons | The "Add to calendar" file (a real calendar file, marked as pretend) |
| The sample times (on the hour from 10 am to 2 pm) | The rule that pizzas are ready 1 hour after the visit time |

A test (`tests/demo-data.test.mjs`) reads the home page and fails if a price, an age, a day or a pizza in the demo no longer matches it.

## What a real version would need

The demo does not answer these questions. They are for a later talk:

- A safe place for logins. The demo has none: it has no server.
- A link to the booking tool (Bookeo) so a visit change really changes the booking. The booking tool may already do part of this. It is worth asking.
- Alerts to Mrs. Cathy and the kitchen when a request arrives (email or text). In the demo they only see it when someone opens their screen.
- Care with children's information: names, ages and allergies are personal. A real version needs a rule for who sees them and how long they are kept.
- An updated privacy page (`docs/WHAT_THE_SITE_STORES.md` says today that the site keeps almost nothing).
- Someone to answer the requests every day.

## For whoever edits the site

### The files

| File | What it does |
|---|---|
| `js/demo-header.js` | On every page. The switch `window.WA_DEMO_MODE()`, the class `wa-demo` on `<html>`, the person button, and on the three demo pages the demo bar and the un-hiding of the page's screen. It does nothing when the demo is off. |
| `js/demo-pizza-data.js` | The pizza data and rules: the nine pizzas of the Fall Menu, the crust (+$9) and cheese (+$3), the price of an order, the difference between two orders, the pick-up time. No other file is needed to read it. Owner after the foundation: the pizza helper. |
| `js/demo-data.js` | The prices and rules from the site's pages, the sample family and its visits (`DemoData.sample(today)`), the days a package is offered (`DemoData.openDays`), the school-trip price, the calendar file. It uses `js/demo-pizza-data.js` for the pizza rules and keeps the same names. |
| `js/demo-store.js` | The one place that keeps the state. See "The store" below. |
| `js/demo-ui.js` | Small shared pieces: a DOM builder, the way dates, times and money are written, the modal, the toast, the status chip, the calendar download. |
| `js/demo-app.js` | The family's account page: sign-up, sign-in, the tabs, the bell and the view list. |
| `js/demo-view-*.js` | One file per family screen. `visits` is `js/demo-view-visits.js`. The kit `js/demo-view-kit.js` has helpers the other views share. |
| `js/demo-pizza-editor.js` | The pizza editor that My pizza and the kitchen share. |
| `js/demo-desk.js`, `js/demo-kitchen.js` | The screens of Mrs. Cathy and Rob's desk and of the pizza kitchen. |
| `css/demo.css` (and `css/demo-staff.css`, `css/demo-kitchen.css`, `css/demo-pizza.css`) | The look: the same style as the rest of the site. |
| `pages/account.html`, `pages/farm-desk.html`, `pages/kitchen.html` | The page sources. Their settings block says `robots: noindex`, and names the style sheets and scripts of that page in order (`styles:` and `scripts:`, see the top of `tools/pages.py`). The text inside is left out of the translations (`data-no-i18n`): the demo is English only. |

After a change, rebuild with the three commands, one after the other: `python3 tools/pages.py`, then `python3 tools/i18n.py extract`, then `python3 tools/i18n.py build`. Do not run the first one alone.

### Adding a screen to the account page

One call: `DemoApp.view('pizza', { label: 'My pizza', render: function (root, ctx) { ... } })`.

- `root` is an empty element inside the tab's panel. The shell has already printed the tab's heading (an `h2` with the label).
- `ctx` has `store`, `data`, `ui`, `app`, `account`, `today`, `params`, `go(name, params)` and `rerender()`.
- The shell clears `root` and calls `render` again after every change of the store, but not while a field of the view has the focus. A screen never subscribes itself and never writes to the store while it draws.
- The tabs are `#visits` (the first one), `#pizza`, `#family`, `#alerts`, `#messages`, `#photos` and `#event`. A tab shows only when its file registered it. A screen can also give `shownIf: function (store) { return true or false }` to say when its tab is on the bar: My event shows only when the family has an event. A `#hash` that is none of these, or the hash of a tab that is not shown, shows the first tab and is left alone. `go('photos', { visit: 'v2' })` opens a tab and hands over `params` in memory, so the address stays a plain `#photos`.
- Do not give an element the id of a tab (`pizza`, `event` ...): the browser would scroll to it.
- Use `DemoUI.toast(text)` for a short message and `DemoUI.modal(...)` or `DemoUI.confirm(...)` for a box. There is one toast place and one modal for the whole demo. `DemoUI.closeModals()` closes every dialog that is open (the top one first, each by its own close, so the focus goes back and a `confirm` answers no) and says how many there were; the tour uses it when the owner leaves a card with a dialog still open. `DemoUI.choices({ name, legend, options, value })` draws a question with big buttons (real radio buttons; the sign-up question is one). Every field is built in JavaScript: no page file holds an `<input>`, a `<textarea>` or a `<select>`.

### The store (`js/demo-store.js`)

All methods are synchronous and return plain copies. The state lives in the browser's storage under the one key `wa-demo-v1`. If the storage is blocked or full the store carries on in memory (`saveStatus()` says `ok` or `memory`). Other tabs update live. `DemoStore.create(storage, { now })` makes a store on any storage with `getItem`, `setItem` and `removeItem` and a clock you give it: the tests use that.

| Area | Names |
|---|---|
| Account | `createAccount({ name, email, eventKind })` (no argument: the sample account Alex), `signIn(email)`, `signOut()`, `current()`, `hasAccount(email)`, `reset()`, `seedSample()`, `addEvent(kind)` |
| Lists | `list(coll)`, `get(coll, id)`, `add(coll, obj)`, `update(coll, id, patch)`, `remove(coll, id)`. Lists: `visits`, `orders`, `requests`, `messages`, `notices`, `reviews`, `photos`, `events`, `waitlist`. |
| Single objects | `get('family')`, `update('family', patch)` or `update('family', null, patch)`; the same for `alerts`; `getFamily()`, `setFamily(patch)`; `list('closedDays')`; `flag(key)`, `setFlag(key, bool)` |
| Requests | `ask({ kind, to, target: { coll, id }, patch, from, summary, note, weather })`, `reply(id, { answer: 'yes'/'no'/'suggest', note, suggestion: { patch, summary } })`, `respond(id, 'ok'/'decline')`, `cancel(id)`, `openRequestFor(coll, id)`, `requestsFor(coll, id)`, `openRequests(to)` |
| Messages and notices | `post(thread, 'family'/'cathy', text)`, `thread(id)`, `threadsWaiting()`, `postNotice(text, link, to)`, `noticesFor(to)`, `markRead(id)`, `markAllRead(to)` |
| Weather | `closeDay(date, reason)`, `openDay(date)`, `isClosed(date)`, `openDays(from, package, n)` |
| Tell me when | `setAlert(key, bool)`, `alertCounts()`, `fireAlert(key, day)`; where to send the messages: `getNotify()`, `setNotify({ text, email })` |
| Reviews and photos | `submitReview({ visitId, stars, text, photoName, thumb })`, `decideReview(id, bool)`, `submitPhoto({ visitId, name, thumb })`, `decidePhoto(id, bool)` |
| Other | `subscribe(fn)` (returns the function that stops it), `now()`, `today()`, `snapshot()`, `saveStatus()` |

**The sign-up question and My event.** `createAccount({ name, email, eventKind })` takes the answer to "Do you plan or manage a party, an event or a school trip?": `'none'` (the button **No**), `'party'`, `'school'` or `'other'`. The account keeps it as `eventKind` (read it with `current().eventKind`), and the sample it loads has an event of that kind: with `'none'` it has none. Leaving `eventKind` out gives the ready-made sample, which has the school trip (so does `createAccount()` with no argument, and `DemoData.SAMPLE_ACCOUNT` says `eventKind: 'school'`); anything that is not one of the four is read as `'none'`. `seedSample()` always loads the ready-made sample, with the school trip, and the account keeps `'school'`: the tour starts from it. `addEvent(kind)` is "I also plan an event": it adds the sample event of that kind (`'party'`, `'school'` or `'other'`) with Mrs. Cathy's first message in its thread, and the account keeps the kind; it does nothing (the answer is `null`) when the family already has an event or the kind is not one of those three. The My event tab is shown exactly when `list('events')` is not empty.

**One pattern for every change: a request.** Ask, waiting, reply, the family says OK, done. Nothing changes until the farm says yes. The statuses are `waiting`, `yes`, `no`, `suggested`, `accepted`, `declined` and `cancelled`. A visit and an order have at most one open request (`waiting` or `suggested`): `ask` gives `null` when there is one. A reply of yes applies the `patch` to the target. A suggestion keeps its own patch until the family answers OK (it is applied) or No thanks (nothing changes). Every step is written into the request's `history` with a time and a plain sentence, and makes a notice for the other side.

Two rules are built in. When a visit moves to another time, the pizza pick-up moves with it (1 hour after the visit) unless the family chose its own pick-up time. When a visit moves, its `closed` mark is worked out again for the new day.

### The shapes

- **Request kinds:** `visit-change` (goes to Mrs. Cathy; a weather move has `weather: true`), `pizza-change` (goes to the kitchen), `event-change` (goes to Mrs. Cathy).
- **visit:** `{ id, date, time, package: 'pizza' or 'farm', party: { adults, kids: [{ name, age }] }, addons: [{ id: 'wagon' / 'barrel' / 'corn', qty }], paid: { receipt, on, lines: [{ id, label, qty, unit, amount }], total }, closed, closedReason }`. There is no status: a visit is past when its date is before today.
- **order:** `{ id, visitId, pickup: 'HH:MM', pizzas: [{ type, count, toppings: [...], glutenFree, vegan }], notes, status: 'new' or 'confirmed' }`. `type` is an id from `DemoData.PIZZAS`.
- **request:** `{ id, kind, to, from, target, patch, before, summary, note, weather, status, suggestion, reply, history: [{ at, who, text }], created, updated }`. `before` holds the target's values for the patch keys when the request was made, so a screen can show before and after.
- **family:** `{ name, adults: [{ name }], kids: [{ name, age }], allergies, glutenFree, vegan, phone, notifyBy }`. `phone` and `notifyBy` belong to Tell me when (see "The Tell me when screen" below).
- **account:** `{ id, name, email, created, eventKind }` with `eventKind` one of `'none'`, `'party'`, `'school'`, `'other'`.
- **event:** one per family. A school trip is `{ id, kind: 'school', title, date, students, guests, slipsReceived, thread }`: $11 for each student, and $11 for each parent or sibling age 3 or older who comes; the minimum is 100 students. A party is `{ id, kind: 'party', title, date, guests, thread }`: one price for the whole party ($300, the farm entry fee included), up to 50 guests; children age 2 and younger are free and do not count. Another event is `{ id, kind: 'other', title, date, guests, thread }`: no price, because the site names none. `DemoData.priceEvent(event)` gives `{ lines, total }` (`total` is `null` for another event) and `DemoData.eventProblem(event)` the page's rule in plain words (or an empty text). The numbers of a sample (the head counts, the permission slips, the dates) are made up; no start time or deposit is shown, because the site gives none. A head-count request changes `{ students, guests }` for a school trip and `{ guests }` for the others.
- **contacts:** `DemoData.CONTACTS` holds the two e-mail addresses the pretend account shows, both already on the site: `vanessa` (school tours: **Questions? Email Vanessa**) and `ava` (pizza: **Pizza questions? Email Ava**). Each has `name`, `email`, `href` (the mailto link, with the subject line the site uses) and `text` (the words of the link). Nothing else about them is shown.
- **notice:** `{ id, to: 'family' / 'cathy' / 'kitchen', text, link, at, read }`. **message:** `{ id, thread, from: 'family' / 'cathy', text, at }`; threads are `farm` and `event-<id>`. **review:** `{ id, visitId, stars, text, photoName, thumb, status: 'waiting' / 'approved' / 'declined', at }`. **photo:** `{ id, visitId, name, thumb, status, at }`. **waitlist:** `{ id, day, party }`. **alerts:** `{ spot, reservations, strawberries, blueberries, pumpkins, trees }` with true or false (see "The Tell me when screen" below).
- **Dates and times** are `YYYY-MM-DD` and `HH:MM` (24 hours), the farm's own clock. `DemoData` writes them as "Saturday, Nov 14" and "2:00 pm".

### The Tell me when screen

`js/demo-view-alerts.js` draws it. From top to bottom:

1. **Where should we send these messages?** Two big switches: **Text message** (it shows the pretend phone number) and **Email** (it shows the account's email). One or both can be on. The last one cannot be turned off: it stays on, and a short note says "Keep at least one on, so we can reach you." Nothing is sent. The choice is only kept in the pretend account.
2. **A spot opens on a full day**, with a day to choose. It puts the family on the waitlist for that day. This is the first choice.
3. **Reservations open**, a plain switch. Its line says only what the site says: reservations with pizza open every Tuesday at 5:00 PM for the upcoming weekend.
4. The farm's seasons, in the site's order: strawberries, blueberries and sunflowers, pumpkins and tomatoes, Christmas trees.
5. **Alerts you got**: the alerts that the desk sent, newest first.

How it is kept:

- The choices come from `DemoData.alertKinds`: for each one a `key`, a `label` (the title), a `note` (the line under it) and a `notice` (what the bell says when the farm sends it). The order of that list is the order on the screen, and the desk reads the same list. To add a choice, add one entry there and a picture and a colour in `js/demo-view-alerts.js`.
- A switch is `alerts[key]`, set with `setAlert(key, bool)`. The key `spot` also has one waitlist entry for the chosen day (`{ id, day, party, active }`). Choosing another day, or switching off, sets the old entry to `active: false`. The desk's "Send the alert" for that day makes the notice "A spot opened on Saturday, Nov 14." (`fireAlert('spot', day)`).
- Where to send is `family.notifyBy`, `{ text: bool, email: bool }`. Both are on until the family changes it. `getNotify()` reads it. `setNotify({ text, email })` changes one or both and answers with the new choice. When the change would turn both off it answers `null` and saves nothing. It tells the page with the same `wa-demo-change` event as every other change. It lives in the family record, so Start over and a new sample put both back on, and a state saved before it existed reads as both on.
- The pretend phone number is `family.phone`. The sample family has `DemoData.SAMPLE_PHONE`. It is a made-up number: never put a real one there. The screen shows the sample number when a family has none, and the account's own email next to **Email**.
- The desk's "People waiting" box lists the seasons and reservations from `DemoData.alertKinds` (one row each) and then a row for each day somebody waits for.

### Hooks for the tour

These invisible `data-tour` names are put on the key controls so the tour can point at them. The shell and the header have: `demo-bar`, `demo-switch`, `demo-reset`, `acct-signup`, `acct-sample-note`, `acct-bell`. The family screens have `acct-visit-card`, `acct-paid`, `acct-request-day`, `acct-request-status`, `acct-reply` (the box with Mrs. Cathy's answer, in every state: her suggestion with its two buttons, or what is left once the family has answered, so it is also there after yes, no, OK or "No thanks"), `acct-pizza-card`, `acct-pizza-edit`, `acct-pizza-time`, `acct-family`, `acct-alerts`, `acct-messages`, `acct-photos`, `acct-event` and `acct-closed-banner`. The desk has `desk-waiting`, `desk-card`, `desk-yes`, `desk-no`, `desk-suggest`, `desk-week`, `desk-weather`, `desk-people`, `desk-approvals` and `desk-groups`. The kitchen has `kit-queue`, `kit-card`, `kit-yes`, `kit-no`, `kit-change` and `kit-notes`. The tour drives the demo with the store functions above, so their names must stay as they are.

### The checks

- `tests/demo-store.test.mjs`: the store and the rules, with a fake storage and a fake clock (no browser, about a second).
- `tests/demo-data.test.mjs`: every price, age, day and pizza of the demo against the site's own pages (no browser).
- `tests/demo-alerts.test.mjs`: the Tell me when screen in a real browser, on a computer window and on a phone: the order, the two switches for text message and email, the rule that one stays on, the full-day choice and reservations with the desk, and axe-core.
- `tests/account-event.test.mjs`: the family's screens in a real browser: the sign-up question and each answer, My event shown only to a family that has an event, "I also plan an event", no My year, the contact links (Vanessa, Ava, the kitchen line), Mrs. Cathy's answer box on My visits in every state, a closed day with its reason (banner, new-day box and the desk's own promise), `DemoUI.closeModals()`, the tour's cards for those dialogs run on the real screen, and an accessibility check (axe) of the new boxes.
- `tests/tour-demo-script.test.mjs`: the tour's chapter on the demo, card by card, against the real store (no browser): going Back and forth never answers a request twice or piles up notices, a family made by hand is kept, and the seven cards with a dialog close it when they are left.
- `tests/seo.test.mjs`: the three pages are `noindex`, have no canonical address, no share picture and no line in the sitemap.
- `tests/privacy.test.mjs`: the demo files may use browser storage only in `js/demo-store.js` (one key) and `js/demo-header.js` (one hint for the tab), and may build their own form, text box and list. Everything else stays refused.
