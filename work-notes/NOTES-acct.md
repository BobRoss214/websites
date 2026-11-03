# Notes of helper A (the account demo foundation): text for the files A may not edit

The main session applies these once. Nothing here is a plan: each block is the text to paste, and where.

## 1. docs/WHAT_THE_SITE_STORES.md: a new short section, placed after section 8 and before "How to check again"

(Plain words. `tests/privacy-static.test.mjs` reads section 1 only, so this section does not change its lists. `tools/plain_lint.py` reads the whole file: the sentences below are under 40 words and use no jargon word.)

```
## 9. Only in the demo (not on the real site)

The website has a pretend account demo for the farm owners (`docs/ACCOUNT_DEMO.md`). It is hidden from visitors: it switches on only when the address ends in `?demo`, or when the preview page switches it on. With the demo off, its scripts keep nothing in the browser and read nothing from it.

When the demo is on, it keeps two things, and only in this browser:

| Name | Kind | What is in it | Personal? |
|---|---|---|---|
| `wa-demo-v1` | localStorage | The pretend family, visits, pizza orders, requests, messages, notices and the "Tell me when" switches. Made up. Any name and email typed into the demo account form are in it too. | Only what the person types (a made-up name and email in the demo) |
| `wa-demo-user` | sessionStorage | The number `1` while somebody is signed in to the pretend account, so the button in the top bar can say "My account". It ends when the tab closes. | No |

The demo also writes a short word into the browser tab's own name (`window.name`), so the three demo pages know the demo is on. That is not browser storage, and it ends when the tab closes. The password field is pretend: it is never read or kept. Nothing is sent to any server and no other site is contacted. The "Start over" button in the demo clears `wa-demo-v1`.
```

## 2. README.md: one line in the list of docs, after the line about `docs/WHAT_THE_SITE_STORES.md` (README line about "What the website keeps in visitors' browsers ...")

```
The pretend account demo for the farm owners (what it is, how to show it with `?demo`, how to start over, what a real version would need, and the names of the store, the data and the screens for whoever edits): [docs/ACCOUNT_DEMO.md](docs/ACCOUNT_DEMO.md)
```

Also in the README folder list (the `pages/` line, if any) and the `js/` list: `js/demo-*.js` and `css/demo*.css` belong to the demo; the three demo pages are built from `pages/` like the other extra pages but are marked `robots: noindex`.

## 3. tests/README.md: rows for the table "What each test covers" (any place in the table)

```
| `demo-store` | the pretend account demo's store and rules (`js/demo-store.js`, `js/demo-data.js`, `js/demo-pizza-data.js`), no browser, about a second, with a fake storage and a fake clock: loading the scripts touches no browser storage and the page's store is made on first use; the account (create, sign out, sign in, a wrong email, one family per browser); the sample family and its visit (Paid worked out from the page prices, the pizza ready 1 hour after the visit); a request with yes, no, a suggestion then OK, a suggestion then "No thanks" and cancel (history, notices for the other side, one open request per visit or order, nothing changes before the farm says yes); a weather closing and the "new day" request; "Tell me when" (the five switches, the day waitlist, counts, firing an alert); messages, reviews and photos; the pizza following the visit time; Start over; two stores on one storage seeing each other; storage that is blocked or full; that what the store hands out is a copy |
| `demo-data` | the numbers of the account demo against the site's own pages, no browser: the package prices, ages and days, the add-ons, the nine pizzas of the Fall Menu with their words, the crust and cheese extras, the school-tour price and minimum, the sentences about changes and rain, the Directions link, and that no dollar amount is written in the other demo scripts |
```

(Add `demo-store`, `demo-data` to the `--quick` description only if the list of quick tests is written out there; they are quick and need no browser.)

## 4. Facts for the `tests/seo.test.mjs` row of tests/README.md

Add at the end of its text: "The three pages of the account demo (`account.html`, `farm-desk.html`, `kitchen.html`) are the only pages marked noindex: no canonical address, no share picture, no structured data, not in `sitemap.xml`, `X-Robots-Tag: noindex` in `_headers`, and `robots.txt` does not block them."

Also the `pipeline` row: `tools/test_pages.py` now has 18 checks (two new ones for the page settings `robots: noindex`, `styles:` and `scripts:`).

## 5. browser-support (the names the table does not have yet)

`node tests/browser-support.test.mjs` is red only for one name that is "not in the table": `js-name:notify` (js/demo-store.js: `DemoStore.notify`, the store's own method for the family's notices; the name is the plan's, it is not a browser feature). Put it in the table as one of "our own names" when the table is rebuilt. Nothing else is missing: the other names (`lang` on a `div`, `overflow-wrap` with its fallback, no `resize`) were changed to ones the table already has.

## 6. Decisions A made that the plan did not say

- The tab remembers that demo mode is on by writing the word `wa-demo-on` into `window.name` (not browser storage), so with the demo off nothing is read or kept. The one hint kept in sessionStorage (`wa-demo-user`) only says whether somebody is signed in, so the top bar button can say "My account".
- The person button in the top bar is icon only (as decided). Its few CSS rules are written by `js/demo-header.js` into one `<style>` (the other pages do not load `css/demo.css`).
- The demo bar sticks under the top bar from 48em up; on phones it scrolls away with the page (the hello line of the account page says it is pretend).
- `tools/check_facts.py` and `tools/i18n.py` leave `js/demo-*.js` and `js/tour*.js` alone (they copy facts from the pages on purpose and are English only; `tests/demo-data.test.mjs` checks the numbers).
