# Menu plan: grouped drop-downs (started 3 Nov 2026)

The owner (the site builder, not the farm owner; not technical) asked for this. Her words, short: the top bar should be general
categories, each one a drop-down list like the existing "More" list; no catch-all "More" (people will not click it); a click on a line
scrolls the page to that place; the bar stays at the top while you scroll (it already does). She said: "do the fix" for the width
problem below, and "save it as its own step" (one commit, so it can be undone cleanly). Computer first; the phone version comes later,
only when she says. Do not redesign anything else, and do not change any page text except the menu.

## The new menu (English words are exact; "Reserve" and the language button stay as they are)

Top level, in this order: Visit, Things to Do, GreenHouse, Store, Groups & Parties, About Us, Contact. Each is a button that opens a list.
The "target" is on the home page (`index.html#id`). On the five inner pages the same links point to `index.html#id`, as the current menu links do
(`tools/pages.py` copies the header from index.html; read how it rewrites the links).

| Category | Line | Target (add an invisible `id` where none exists) |
|---|---|---|
| Visit | The two places & hours | `#visit` |
| Visit | Reserve a time | `#steps` ("Three steps to a farm day") |
| Visit | Choose your package | `#options` |
| Visit | First-visit guide | `#first-visit` |
| Visit | Farm map | `#farm-map` |
| Visit | Directions | `#contact` (the drive-time box is there; add an id on the box if it is better) |
| Things to Do | What's in season | `#seasons` |
| Things to Do | U-pick | `#farm` ("What's on the farm" cards; they show the season's u-pick) |
| Things to Do | Tomatoes & basil | `#tomatoes` (ADDED by the builder so this section keeps a menu link) |
| Things to Do | U-cut flowers | `#flowers` |
| Things to Do | Rides & add-ons | the "Optional add-ons" list (`.addon-list`, under `#options`): add an id |
| Things to Do | Meet the animals | the "Meet the Animals" card in `#farm-cards`: add an id (if it is only shown in some seasons, fall back to `#farm`) |
| Things to Do | Playgrounds | the Playground card(s) in `#farm-cards`: add an id (same rule) |
| Things to Do | Photography | `#photography` |
| GreenHouse | About The GreenHouse | `#greenhouse` |
| GreenHouse | Wise Pie pizza | `#pizza` (if `link-names` complains because the Shop button of the same name goes to `#shop-greenhouse`, rename THIS new line, e.g. "Wise Pie pizza menu"; never change the page's existing words) |
| GreenHouse | Ice cream | `#shop-icecream` |
| GreenHouse | Drinks | `#shop-drinks` |
| GreenHouse | Meet the goats | the "Meet the goats" block in `#greenhouse`: add an id |
| GreenHouse | Christmas trees | `#shop-pumpkins` (the Store's "Fall & holidays" group; it is always shown, in every season) |
| Store | Everything in the store | `#shop` (ADDED by the builder so the top of the Shop, with the price note and buttons, keeps a link) |
| Store | Snacks | `#shop-snacks` |
| Store | Ice cream | `#shop-icecream` |
| Store | Pizza | `#shop-greenhouse` |
| Store | Drinks | `#shop-drinks` |
| Store | Pantry & bakery | `#shop-pantry` |
| Store | Gifts & merchandise | `#shop-gifts` |
| Store | Plants & seasonal | `#shop-plants` |
| Groups & Parties | School tours | `#school-tours` |
| Groups & Parties | Parties at the farm | `#parties` |
| Groups & Parties | Corporate events | `#corporate` |
| About Us | Our story | `#about` |
| About Us | Reviews | `#reviews` |
| About Us | Photos | `#gallery` |
| Contact | Contact us | `#contact` |
| Contact | Questions (FAQ) | `#faq` |
| Contact | Email sign-up | `#follow-signup` |

Two lines (Things to Do > Tomatoes & basil, Store > Everything in the store) are not in what the owner saw; she will be told. Every place the
old menu linked to must stay reachable: #visit, #first-visit, #farm, #seasons, #tomatoes, #pizza, #greenhouse, #shop, #flowers, #groups (its
three lines), #about, #faq, #contact.

Watch for targets inside tabs: the season tabs of "What's on the farm" and the group tabs (`#group-tabs`: school tours / parties /
corporate). A link to a tab panel that is hidden must also pick that tab (see how the page treats a `#hash` today: `keepHashTarget` in
`js/features.js`, `tests/hash-open.test.mjs`, `tests/anchor-landing.test.mjs`). The `.reveal` boxes slide in from 26 px lower: the `:target`
rule in `css/styles.css` already deals with that for ids.

## How it must behave (computer view)
- Click a category button: its list opens under it (`aria-expanded="true"`). Click it again, press Escape (focus goes back to the button),
  click anywhere else, or tab out: it closes. Only one list is open at a time. Click a line: the list closes and the page goes there.
- Same look as the current "More" list (`css/sections.css`, `.nav-more*`): white panel, ink border, rounded, small shadow, 44 px tall lines.
  No pictures in the lists for now. The bar stays `position: sticky` at the top.
- Keyboard: Tab goes button to button; Enter or Space opens; Tab goes into the list; Escape closes. Buttons have `aria-controls`.
- The category whose section is in the middle of the screen is lit (`aria-current="true"` on its button), as "More" is today
  (scroll-spy in `initNav`, `js/main.js`). Keep `root: document` and the try/catch in the observer (the claude.ai preview needs it). Sections
  per category: Visit = visit, this-week, farm-map, first-visit, reserve; Things to Do = farm, farm-cards, seasons, tomatoes, flowers;
  GreenHouse = greenhouse, pizza; Store = shop; Groups & Parties = groups; About Us = about, reviews, gallery; Contact = faq, contact.
  A line inside an open list whose href is exactly the lit section is lit too (as links are today).
- The little red "new" dot (`.nav-tomato`, fall only, `css/sections.css`) moves to the "Things to Do" button (same rule: fall only).
- Without JavaScript (`html.js-failed`, `tests/no-js.test.mjs`), in print, in forced-colors and in calm mode, the lines must still be plain
  visible links, as the More list is today (`css/features.css` ~lines 338-369 and 454, `css/extras.css`).
- The phone menu (the full-screen one, `#menu-toggle`) must keep working: in the simplest way (each category name as a small heading, its
  lines as chips under it, like the flattened More list now). Do NOT build the nicer tap-to-open phone version.

## The width problem: fix it
Seven words with longer labels need more room than the old eight short ones. Today the wide bar shows from 73.75em (English) and from
83.125em (Spanish, Vietnamese) (`css/sections.css`); below that the phone menu shows. Measure, then fix, in this order:
1. Set the switch points from real measurements, per language (en, es, hi, zh, vi): the wide bar only where it fits on one line with no
   overlap, never a half-broken state. Wide bar wanted on 1280 and 1366 px laptops in English if it truly fits.
2. If it does not fit at 1366 in English, tighten gaps and padding a little (touch targets stay 44 px tall).
3. Only if it still does not fit: join "About Us" and "Contact" into one "About Us" list (Our story, Reviews, Photos, Questions (FAQ),
   Contact us, Email sign-up). Report that you did it.
Test window widths: 1180, 1280, 1366, 1440, 1536, 1920, and the same with the big-font and 200% zoom checks that exist.

## Translations
New visible words get `data-t` like the rest; aria-labels use `data-ta-aria-label`. Pipeline (always all three, never `tools/pages.py` alone):
`python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py build`. Write the es, hi, zh, vi texts only in
`lang/src/<code>.json` ("ui" section). Reuse the existing translated words for Visit, GreenHouse, Shop, Seasons, Pizza, Flowers, Our Story,
FAQ, Contact so the same thing keeps the same name. Check with `python3 tools/i18n.py missing <code> --list`. "Store" is the English word for
what the old menu called "Shop"; the Shop section and its buttons keep their texts.

## Tests (one at a time, in the background with a log; see "HOW TO CONTINUE" in work-notes/HANDOFF.md for the setup)
Update these to the new menu (keep them as strict as before; never loosen a check to hide a failure): anchor-landing, axe-wide, big-font,
first-visit-guide, hash-open, i18n-a11y, i18n-early, i18n, interference, keyboard, layout-sweep, live, monkey, nav-highlight, no-js, smoke,
sprite, touch (and `tools/slow_phone.mjs` if it names the menu). Also run: link-names, calendar-doc (regenerate the doc with
`node tools/season_calendar.mjs` if it is stale), plain-lint, option-patches (rebase any optional patch under `patches/optional/` that
the new header made stale), apply-answers, browser-support, owner-cheat-sheet, shop, plus `node tools/i18n_facts.mjs` and
`python3 tools/check_facts.py`. Search README.md and docs/ for mentions of the "More" menu and fix them (plain-lint: 40 words a sentence).
Add a test for the new menu if nothing covers it: open, close, Escape, outside click, one open at a time, every line lands on its place.

## Rules
- Work only in your own clone (`git clone /home/user/websites /tmp/menu-clone`); never edit or push `/home/user/websites` or origin.
  ONE commit for the whole menu change (so it can be undone cleanly). Trailers, exactly:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_016TmrCsikkBKpN9HzniSTFT`.
  No model names anywhere else.
- Never invent prices, hours or facts. Do not change any page text except the menu words. Added ids must be invisible.
- No `pkill -f`, `pgrep -f`, `pkill -x node` (use PID files). Tests one at a time (4 cores). Foreground commands stop at 600 s: run slow
  ones with a background script and wait with an until-loop on a log. Setup:
  `export NODE_PATH=/opt/node22/lib/node_modules AXE_PATH=/tmp/claude-0/axe-core/axe.min.js PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers; unset WA_URL`.
- The repo is PUBLIC: nothing private in it. Do not touch the old "Terminal" work. Do not open a pull request.

## Report back (plain words, short)
What changed (files), the commit hash, each test run with its result, what widths show the wide bar in each language and which fix from
"The width problem" you used, anything you changed that this file did not say, and anything left undone. Save screenshots (not in the repo)
in `/tmp/menu-shots/`: the closed bar in en, es and vi at 1280, 1366 and 1440 px, and the Store list open at 1440 px.
