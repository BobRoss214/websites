# When something else gets in the way of the website

Visitors do not use a clean browser. A phone may have an ad blocker. Chrome may offer to translate the page. An extension may turn the page dark. A coffee-shop Wi-Fi may add a banner. The connection may drop. Cookies may be switched off. This note says what the website does in each case, what was found, what was fixed, and what is left for you to decide.

Each case was tried in a real Chromium browser, with the thing that interferes switched on. "Tried" means the page was opened and used (language change, menu, questions, photo viewer, Drive time box, email signup), and the browser's error log was watched. The checks that are quick and stable are in `node tests/run-all.mjs interference` (about 40 seconds on a quiet computer).

What I could **not** use here: a real Safari or Firefox, a real Dark Reader, a real Chrome Translate (I copied by hand the way it rewrites the page), and the real Instagram or Facebook app. Where that matters, the line says so.

## The answers in one table

| # | What gets in the way | Result | In short |
|---|---|---|---|
| 1 | Ad and content blockers | **OK**, one note | Only `js/analytics.js` has a name the filter lists look for. Nothing breaks without it. |
| 2 | Chrome or Edge translating the page | **Fixed**, one note | The farm's names were being translated. Now the logo and every marked name say `translate="no"`. |
| 3 | Dark mode, dark extensions, high contrast | **OK** | The page tells the browser to stay light. High contrast has its own test. |
| 4 | Reader mode, print, save the page | **OK** | The real text is in the page itself, with one top heading and a main part. |
| 5 | Cookies and storage switched off, or full | **OK** | Everything works. The language and the checklist ticks are just not remembered. |
| 6 | The connection drops, slow 2G, a hotspot that changes the page | **OK**, three notes | Plain messages, nothing stuck. A very slow line takes long. |
| 7 | Browser settings (no drawing or sound, no fonts, big text, zoom) | **Fixed** at 500% zoom | At 400% zoom (a screen 320 px wide) all was fine. At 500% a few boxes ran past the edge; fixed. |
| 8 | Links that need a program (phone, email, maps) | **Note** | 16 of 34 email links show only words, not the address. Without a mail program nothing visible happens. |
| 9 | Touch and mouse together, the Back button | **OK**, one note | The Back button leaves the page. It does not close the photo viewer. |
| 10 | In-app browsers (Instagram, Facebook), old Android, television | **OK** | The page checks before it uses a newer feature. Tried with the newer features taken away. |

## 1. Ad and content blockers

What was tried:

- Every file the page asks for was checked against the kinds of names the big filter lists use (analytics, track, ads, banner, promo, popup, share, social, pixel, beacon, stats, counter, facebook, instagram, mailchimp, bookeo, google). Only one file the visitor's page asks for matches: `js/analytics.js`. Three other files match a word (`assets/qr/instagram.svg`, `assets/qr/facebook.svg`, `assets/og-share.png`), but only the print signs and the share tag use them. No visitor's page asks for them.
- `js/analytics.js` was blocked. The page works the same: no error, no hole. (With the default setting `provider: 'none'` the file does nothing anyway.)
- Each of the other scripts was blocked, one at a time. No filter list has those names, so this is only a "what if". The page stays readable every time. Without `js/season.js` the other scripts print errors in the console and several boxes do not appear.
- Every other web site was made unreachable. A page load, scrolling and a language change contact no other site at all. The site contacts others only after a button press: OpenStreetMap for the Drive time box, Mailchimp for the email signup.
- Boxes were hidden by the names the "annoyance" lists use (signup, social, banner, notice, newsletter, popup, promo, share). The page loses those boxes and nothing else: no gap, no error.
- Some privacy lists block the Mailchimp address. Then the email box says "Sorry, that did not go through" in under a second and shows the "Join the email list" button.

The "Site check" box does not shout at visitors. It only shows on your own computer or when the address ends in `?check`.

**Note for you (question 2 in the questions file):** if you switch analytics on, a blocker that blocks `js/analytics.js` stops the counting for those visitors. The provider's own script (Plausible and others) is on most lists anyway, so renaming the file would help only a little. The name is written in 16 places in 14 files (the pages, `README.md`, two docs, two tests, two tools, and a comment in `js/content.js`). Nothing in the code reads the file name. I tried the rename in a copy: the static tests (consistency, validity, files-audit, public-site, review-sheet) pass with it. The browser tests were not run on the copy. It is not renamed now.

## 2. Chrome or Edge translating the page

Chrome's own Translate changes every piece of text in the page and sets the page language. This was copied by hand and the page was used on top of it.

- The page's own live texts (the pizza countdown, "Open now") keep updating. Our language switch still works, and the page language ends up right.
- **Found:** the farm's names carry no `translate="no"`, so Chrome could turn "Wise Pie" into a translated phrase. **Fixed:** the logo name and every name the page marks when it is in another language (162 on the home page) now say `translate="no"` (`js/i18n.js`, and the logo in `index.html`, which the other pages copy).
- **Not covered:** names in the running English text of the English page. They are plain text. The only way to protect them is to wrap each one, as the page already does for the other four languages. That means a little extra work in every visitor's browser. Question 5 asks.

## 3. Dark mode, dark extensions, high contrast

- The page says `color-scheme: only light`, so Chrome's automatic dark mode leaves it light. `node tests/run-all.mjs auto-dark` checks this.
- Windows high contrast and forced colours have their own checks: `node tests/run-all.mjs forced-colors`.
- An extension such as Dark Reader works by inverting colours. It was not tried here. An inversion keeps the contrast between text and background, and pictures are the part the extension has to handle.

## 4. Reader mode, print, "save page as"

With scripts off, every page has a `<main>` part with its text, exactly one top heading, no hidden heading, a title and `lang="en"`. This is what reader mode and "save as" work from. The home page also carries 15 `<article>` blocks, which reader modes like. `node tests/run-all.mjs no-js` checks the rest.

## 5. Cookies and storage

I tried three ways. Storage that refuses every use is what "block all cookies" does in Chrome. Storage can be full. Or there is no storage at all and cookies fail, as in an old in-app browser. The language changed, the checklist could be ticked, there was no error. What a visitor loses: the language and the ticks are forgotten on the next visit. The site keeps only those two things, in `localStorage`; see `docs/WHAT_THE_SITE_STORES.md`.

## 6. The connection, slow lines, hotspots

- **Connection dropped after the page was open.** A language that is not loaded yet cannot be fetched, so the page stays as it was, in the old language, and the language list closes. It says nothing (question 3 asks). Questions open and the photo viewer opens. The Drive time box says "The lookup is not working right now. Try the Google Maps button instead." and the button is not left busy. The email signup says "Sorry, that did not go through" and shows the other button. A mail host that never answers gives the same message after about 9 seconds.
- **Nothing is loaded from another web site** (no outside delivery network, no outside fonts, no outside scripts). I checked every page.
- **Slow 2G with "Save-Data" on:** the page does not look at `Save-Data`. On a test line of 50 kbit/s and 2 seconds delay, first-visit drew its first text after about 75 seconds. That test server does not compress; the real host does (text is 3 to 4 times smaller), so about 20 to 25 seconds is the guess. A page for such visitors would be a separate piece of work (question 6).
- **A hotspot or proxy that adds a banner and a script, and squeezes the spaces out:** the page still starts; menu and language work. The Content-Security-Policy in `docs/LAUNCH_CHECKLIST.md` is not in `_headers` yet. Once it is, a script added on the way is simply not run.

## 7. Browser settings

- **No drawing surface, no sound** (canvas, WebGL, audio switched off): no error, nothing missing.
- **Web fonts blocked:** the system font takes over. On a screen 320 px wide nothing runs past the edge.
- **Pictures blocked:** every picture has its text description; `node tests/run-all.mjs no-js` checks it.
- **Big text:** `node tests/run-all.mjs big-font` checks 150% and 200%.
- **Zoom to 400%** (a screen 320 px wide, the usual rule): nothing runs past the edge, on every page.
- **Zoom to 500%** (a screen 256 px wide): I **found** that some boxes ran 20 to 35 px past the right edge. They were the "fact" cards on First visit and Pumpkin patch, and the pass cards and one email button on the home page. I **fixed** this in `css/extras.css` and `css/sections.css`. The change only works on a screen narrower than about 270 px, so nothing else looks different.
- **A colour sheet the visitor set** (a "user style sheet"): not tried on its own.

## 8. Links that need a program

- Links that open in a new tab are ordinary links. The page never opens a window by script, so a pop-up blocker has nothing to block.
- The phone number is written out as text next to its link, so it can be copied on a computer with no phone program.
- There are 34 email links on the six pages. **16 of them show only words** ("Email Vanessa", "Ask a question", "Request a quote", "Email us", "Email"); the rest show the address. A visitor with no mail program on the computer (webmail is common) sees nothing happen and may never see the address. Question 1 asks.
- Apple Maps and Waze links are ordinary web links. They open the maps web page on Android and on a computer.

## 9. Touch and mouse together, the Back button

- Pinch zoom is allowed everywhere (the page does not forbid it). The photo viewer does not block the long-press menu, so a visitor can save a picture.
- On a laptop with a touch screen both work; `node tests/run-all.mjs touch` checks the touch side.
- **The Back button** leaves the page, even with the photo viewer, the menu or the language list open. They close with the Escape key, the close button or a tap outside. A reload closes them. Many sites make Back close the viewer first. Question 4 asks.

## 10. In-app browsers, old Android, television

Before the page uses a newer browser feature it checks that the feature is there, and it has a plan B for each. The features are the scroll and size watchers, the pop-up box and the idle timer. The page was tried in Chromium with those features taken away. It was also tried with the browser name text of the Facebook app on Android 10 (a Chrome 80 engine) and of a smart television. The menu, the photo viewer and the language switch work, with no error. This checks the page's own code. It is not a test inside the real apps.

## What was changed

- `js/i18n.js`: the marked names get `translate="no"`.
- `index.html`: the logo name gets `translate="no"` (twice). The other pages, `first-visit.html` and the rest, are made from it by `python3 tools/pages.py`, which was run.
- `css/extras.css`, `css/sections.css`: the 500% zoom changes above.
- `tests/interference.test.mjs`: the checks above that are quick and stable.

## Questions for you

These are small choices. None of them is urgent.

1. **Show the email address next to the buttons that show only words?** (16 of 34 email links.) You can show the address in small type beside each button. Or, when no mail program opens, the page can show a short note with the address and a "Copy" button. That needs new words in five languages. Or you can leave it.
2. **Rename `js/analytics.js`?** Matters only if you switch analytics on. A neutral name, such as "visits" instead of "analytics", would avoid the name filters. It is a one-time change in 14 files; I would do it and run every test.
3. **Say something when a language cannot be loaded because the connection dropped?** Today nothing happens when a visitor taps a language and the line is gone. A one-line note would need words in five languages.
4. **Should the Back button close the photo viewer (and the menu) first?** Today Back leaves the page.
5. **Protect the farm's names in the running English text from Chrome's Translate?** You can leave it. Or the page can wrap each name, as it already does in the other four languages. That is a little extra work in every English visitor's browser. Or the page can tell Chrome never to translate it. That would also take the translate help away from visitors who read none of our five languages.
6. **A lighter page for visitors on "Save-Data" or a very slow line?** It would skip the web fonts and the moving farm picture. It is a real piece of work, not a quick fix.
