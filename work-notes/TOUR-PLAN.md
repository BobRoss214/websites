# Tour plan: "Take a tour" for Mrs. Cathy and Rob (started 3 Nov 2026)

WHAT: an optional, step-by-step guided tour of the whole website (and of the account demo, see `work-notes/ACCOUNT-DEMO-PLAN.md`), written for the two
farm owners, Mrs. Cathy and Rob (not technical). The site builder (the user) will show them the site and does not want to skip the good parts.
Each step dims the page, lights up one thing, and a small card says what it is, why it helps them, and (when it applies) what they need to do.
Next, Back, Contents and Close on every card. English only. It NEVER starts by itself. It is made for them only: real visitors never see it.
The owner's words: "an option, a button where I click 'take a tour' and it shows step by step everything Rob and Cathy would want to know about the website,
how it works, how it is useful and good."

## Guardrails
- Tour mode switch (one function, `WA_TOUR_MODE()`, in `js/tour.js`): true when `window.WA_TOUR === true` (the preview build sets it) or the address has `?tour`
  (remembered in `sessionStorage` for the tab), or the address ends in `#tour`. Never true by default. Not true on localhost by itself (the normal checks run
  there and must see nothing new).
- Flag off: no button, no overlay, nothing visible, no layout change, no extra DOM; the script only does the flag check. `tests/tour-off.test.mjs` proves it on
  all 6 pages (and on the demo pages when they exist).
- The tour changes nothing for real: no data written except its own place in `sessionStorage` / `localStorage['wa-tour']`; when it closes it puts back what it
  touched (a menu it opened, a season tab it chose, the scroll place).
- Plain words in every card: short sentences (about 25 words at most), "you", no jargon, no hype. Every fact about the farm comes from the site's own pages. Benefits
  are worded as "can" and "may", never as promises or numbers nobody measured. Say clearly what is REAL on the site today and what is a PRETEND demo.
  Never invent a price, hour or fact. Unconfirmed prices stay "Prices coming soon" (the tour lists them as things the owners can help with).
- Spelling: Cathy (not Kathy). Say "Mrs. Cathy and Rob", "your site builder" (never a name).

## Where the button is
- A floating pill "Take a tour" in tour mode, placed where it covers nothing: not on the hero basket box (bottom left), not on the back-to-top button (bottom right).
  Check at 1440 x 900 and 390 x 844, at the top of the page and while scrolled. Same pill on the demo pages (and a link in the demo bar).
- It opens a WELCOME card first (never starts the tour by itself): "This is a short tour of your new website. It takes about 15 minutes. You can stop any time
  and come back. Use Next and Back. Contents lets you jump to a part." Buttons: Start the tour, Choose a part, Not now. If a tour was stopped part-way,
  also "Continue where I stopped".

## The engine (`js/tour.js`, `css/tour.css`; load the CSS and `js/tour-steps.js` only when the tour is first opened, so the page costs nothing otherwise)
- Spotlight: a dimmer over the page with a rounded hole around the target (for example a huge `box-shadow` on a positioned box), clicks on the page behind are blocked
  unless the step says `allowClicks`. The hole follows the target if it moves (scroll, resize, the animated hero), re-measured only while a step is showing.
- Card: title, text, "Step 7 of 52 - The first screen", Back, Next (Finish on the last), Contents, Close (X). Placed beside the target, flips to stay inside the window; on
  a phone it is a sheet at the bottom. It never hides the target when it can avoid it.
- Scrolling: bring the target to a comfortable place under the sticky header (the header is about 75 px tall; the `.reveal` boxes slide in 26 px: wait for them to settle
  before measuring), then show the spotlight.
- A step is `{id, chapter, page, target, title, text, before, after, allowClicks, skipIfMissing}`: `page` is `index`, `first-visit`, `account`, `farm-desk`, `kitchen`...;
  `target` is a CSS selector (or null for a centered card); `before(ctx)` / `after(ctx)` may open the Store menu, choose a season tab, scroll, or DRIVE THE DEMO
  through `DemoStore` (create the sample account, send a request, reply as Mrs. Cathy...); `skipIfMissing` skips a step whose target does not exist (a season-only card).
  A step on another page makes the tour go there (`account.html#tour`, using `sessionStorage['wa-tour']` for the step and chapter; no query strings, the claude.ai
  preview does not pass them) and carry on when that page loads.
- Keyboard and screen readers: the card is a dialog with a title and a focus trap; focus moves to Next after each step; Right/Enter = Next, Left = Back, Esc = Close; each step is
  announced through a polite live region; contrast AA; works with big text; `prefers-reduced-motion` and the site's calm mode: no sliding or fading, the spotlight just appears.
- Phone: works at 390 px (computer first; keep the phone usable, not fancy).
- End: a last card with "What we need from you" (see chapter 11) and buttons Close and Start again. Closing puts the page back as it was.

## The content (`js/tour-steps.js`): chapters and steps (about 45 to 55 steps; each card 45 words at most)
Selectors are hints: check them in the built pages; add an invisible `data-tour="..."` only where there is no good selector, and not inside the header (the menu is being
rebuilt: pull the menu commit before writing chapter 3; see `work-notes/MENU-PLAN.md`).
1. Welcome (centered): what this is, how to use it, real vs pretend.
2. The first screen (home page): the strip at the very top (changes by date, e.g. "reservation-only"); the Spring / Summer / Fall / Winter buttons (the page dresses for the real
   season by itself; visitors can peek at the others); the headline and the line under it (change with the season); the "Closed today / Open now" badges (worked out from the real hours;
   a closure can be switched on in `js/content.js`: your site builder does that); the Reserve buttons (go to your booking tool); the pumpkin basket game and the kids' badges.
3. This week and the menu: the "This week at the farm" box (who changes it, how often); the new top menu: open Store and show a list (7 drop-downs; click a line and the page
   goes there; the bar stays on top); the Reserve button and the language button (5 languages).
4. Planning a visit: Visit (the two places, hours, "no reservation" at The GreenHouse); Three steps to a farm day; Choose your package (the real prices on the page; pizza is ready 1 hour
   after the reservation time); Optional add-ons; the Farm map; the First-visit guide (the questions visitors ask most: parking, bathrooms, dogs, strollers).
5. What is in season: What's in season (tabs; the page changes by the calendar); What's on the farm cards; Tomatoes & basil (the "new" tags hide themselves on their date); U-cut flowers
   and Photography.
6. The GreenHouse and Wise Pie pizza (hours, no reservation, the menu).
7. The Store: 12 groups, each product with a price and a small drawing; the jump buttons; the price note; THE LIST of items still showing "Prices coming soon" (Jam, Elderberry
   shrub, Trucker cap, Bucket hat, T-shirt, Sweatshirt, Canvas & linen bags, Christmas trees) and the pizza prices that came from the farm's older page: "these are the ones we need you
   to confirm".
8. Groups and parties, Our story, Reviews, Photos, FAQ, Contact (the drive-time box), the email sign-up (what it collects: the interests).
9. Works for everyone: the language menu (open it); comfort and calm settings (find them); phone-friendly; the page changes with the calendar on its own, so it does not go stale.
10. The account demo (pretend): create an account (sample family loads); My visits and the paid details; Request a different day -> "Waiting for a reply from Mrs. Cathy"; switch to
    Mrs. Cathy's desk: the request waits with Yes / No / Suggest (the tour sends a reply for you); back on the family side the answer arrives; My pizza: the family can change everything,
    the 1 hour rule, asking for an earlier time; the kitchen screen: Yes / No / Change it, and the family's OK; family details and allergies; Tell me when (and the desk's counts of who is
    waiting); My year (badges); Receipts and questions for the farm; Photos and reviews and the approvals on the desk; My event (groups and schools); closing a day for weather and every
    booked family seeing it with one tap to pick a new day. Say plainly what a real version needs (a place for logins, a link to the booking tool, alerts to you and the kitchen, care with
    kids' info, an updated privacy page) and that the booking tool may already do some of it: "worth asking".
11. What we need from you (last card, as a short list): the prices above; full-size original photos straight from the phone (many of ours are tiny, about 200 px); who changes the weekly box
    and closures; the Christmas tree dates (two different dates on file); what the booking tool can already do (customer logins, changing a booking); and the go-live decision. Then thanks.

## Files and who owns them
- Helper D1 (engine): `js/tour.js`, `css/tour.css`, the one `<script>` tag on every page (via the pipeline: `index.html` and the page sources in `pages/`, the shared footer), `docs/TOUR.md`
  (plain words: how to turn it on and off, how to add a step), `tests/tour.test.mjs`, `tests/tour-off.test.mjs`.
- Helper D2 (content): `js/tour-steps.js` (the steps, written for the owners), `tests/tour-targets.test.mjs` (every step's target exists and is visible on its page at 1440 and 390 px, in English,
  `skipIfMissing` steps listed; the demo steps run with the demo flag). D2 writes chapters 1 to 9 and 11 now, and chapter 10 when the demo pages exist (the main session will say so).
- The preview build (`work-notes/preview/build-artifact.py`) is the main session's job: it sets `window.WA_TOUR = true` and `window.WA_DEMO = true` and adds the new pages.
- An independent tester writes a second test from this file later.

## Rules for helpers
Own clone (`git clone /home/user/websites /tmp/<name>-clone`), never edit or push `/home/user/websites` or origin. Commits end with exactly the two lines
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_016TmrCsikkBKpN9HzniSTFT`; no other model names. Always the full pipeline
`python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build` (never `tools/pages.py` alone). No `pkill -f`, `pgrep -f`, `pkill -x node`; tests one at a time, slow ones in the
background with a log (setup in `work-notes/HANDOFF.md`). Public repo: nothing private. No pull request. Never invent a price, hour or fact.
Report in plain words, short: commit hash, files, checks and results, what the spec did not say, what is left.
