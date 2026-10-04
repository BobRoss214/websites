# Mystery visitors, round 2: people who do not use the site the way most people do

Dated 3 October 2026. Reading, clicking and key pressing only: nothing on the live farm site was touched. Run on the working copy that already has the first round's fixes. What this round fixed is marked **Fixed** and listed at the end.

## The short answer

- Five kinds of visitor, 61 tries: **45 found, 13 partly, 3 not on the site.** (Round 1 had 60 tries: 21 found, 23 partly, 14 not.) The site is in good shape for people who use a screen reader, a keyboard or a big font. The gaps are small.
- **A blind visitor** hears a sensible page: one main part, 26 landmarks, 106 headings without a skipped level, every control named, no drawing read aloud, the countdown silent, every pop-up named and closed with one key, focus put back where it was. Two things were noisy and are **Fixed**: five link names that were used for two different places ("Directions" for the farm and for The GreenHouse, and the same for "Get directions", "Apple Maps", "Waze", "Instagram") and a bare "0" (the game score) read out after the highlights.
- **A keyboard-only visitor** reaches Reserve in 3 key presses and any section through the menu in 5 to 20. There is no keyboard trap. The one hard thing: the home page has **245 to 253 Tab stops** (39 in the photo gallery, 25 on the farm map), so the FAQ costs about 190 presses by Tab alone. The menu avoids it.
- **A low-vision visitor** can zoom to 200% and 400% with no sideways scrolling and no overlap, use text spacing and Windows high contrast, and set a "very large" system font. Three edge cases were found and are **Fixed**: a small phone (320 px) with a 200% font ran the three bottom buttons off the right edge and scrolled sideways; the language list ran off the bottom of a 400%-zoom window; the drive-time chips ran past the edge. At 300% font a phone still scrolls sideways (about 100 px): beyond what the rules ask for, left alone.
- **Chinese, Vietnamese and Hindi:** all 15 tries found, with the same effort as English. The scan of every page and every pop-up found almost nothing in English: the Hindi month names (12 short words), the 404 page (English for everyone), the share-picture descriptions in the page header, and one hidden preview line. Nothing in the photo viewer, farm map, drive-time box, signup box, reminder box or calendar file.
- **Arriving from a search at an extra page** works: the target lands under the sticky header every time (60 of 60 menu jumps too), Reserve, the language button and the way home are on the first screen. The pages do not repeat the facts of the home page: the First-visit guide has no price, day or hour; the strawberry page has no price and no "not in season now" line.
- Nothing needs a new fact from the farm. The open questions are design decisions for the lead (a pause button, skip links, the 404 page): they are written as owner questions at the end.

## How it was done

- The same method as round 1: a real browser (Playwright, Chromium), a phone 390 x 844 and a desktop 1280 x 800, the clock pinned to Saturday 3 October 2026, 10:30 am, New York time; counted taps, scrolls, key presses and searches; "the site does not say" is a valid result. Seconds are estimates, as before.
- **Screen reader:** the page's accessibility tree (what a screen reader is given: roles, names, landmarks, headings, links, form fields, in reading order) from Playwright's `ariaSnapshot` and Chrome's full accessibility tree. Steps are counted the way a screen-reader user moves: jumps by heading, by landmark, by link, and Tab presses. No real screen reader (NVDA, JAWS, VoiceOver) was run: what they say can differ in small ways.
- **Keyboard only:** real key presses (Tab, Shift+Tab, Enter, Escape) on a phone-sized and a desktop window, no mouse. Every Tab stop of each page was recorded once round.
- **Low vision:** browser zoom 200% and 400% (a 1280 x 800 window becomes 640 x 400 and 320 x 200 CSS pixels), a "very large" system font set the way a person sets it (the browser's own default font size, so the media queries that follow the font size behave as they do for a real visitor), WCAG text spacing, Windows high contrast (forced colours, light and dark). Each view was checked for sideways scrolling, text cut off, text on text, buttons broken across lines, bars covering the screen.
- **Other languages:** five jobs in Chinese, Vietnamese and Hindi at both sizes (book for 4, cost with pizza, pizza without a reservation, where to park, rain and refund), found by their translation ids so the words did not matter. Then a scan of every text, label, picture description, tab title and page description on all six pages and the 404 page, plus what each pop-up shows. Text is flagged when it is English in a language where the same text is translated in the others (names that stay English everywhere are not flagged).
- **Arriving from a search:** each extra page opened straight at its address (some with an `#anchor`), after the jump to the anchor had finished: what is on the first screen.
- Not tested: a real screen reader, a real phone, a braille display, voice control, Chinese or Vietnamese on a phone with its own accessibility settings, the booking site and other websites.
- The walks are kept as `tools/visitor_walk.mjs` (key presses, English left over, arrival from a search). It is slow, so it is a tool and not a test; two quick tests keep the fixes in place: `tests/link-names.test.mjs` and `tests/big-font.test.mjs`.

## Results: tries by visitor

| Visitor | Tries | Found | Partly | Not on the site |
|---|---|---|---|---|
| A. Blind, with a screen reader | 13 | 8 | 4 | 1 |
| B. Keyboard only | 11 | 10 | 0 | 1 |
| C. Low vision (zoom, big font, contrast) | 12 | 8 | 4 | 0 |
| D. Chinese, Vietnamese, Hindi (5 jobs each) | 15 | 15 | 0 | 0 |
| E. Arriving from a search at an extra page | 10 | 4 | 5 | 1 |
| **All** | **61** | **45** | **13** | **3** |

"Partly" includes the tries that were partly broken before a fix and are marked **Fixed**.

## A. A blind visitor with a screen reader (13 tries)

What the page gives a screen reader on the home page: 1212 lines of tree, 26 landmarks (banner, main, contentinfo, the footer menu, the quick-actions bar and 21 labelled regions), 106 headings (one level 1, no skipped level), 119 links, 100 buttons, 3 form fields. No link is called "click here" or "more", and no link, button or field is without a name. On a phone the main menu is not in the tree until the menu button is pressed (then focus moves into it).

| Job | Result | Steps | What the visitor finds |
|---|---|---|---|
| A1 Opening hours | P | "Open now, until 8 pm" chip: the 21st item in reading order; The GreenHouse hours heading: the 67th heading of 106 | The GreenHouse "Friday–Sunday, 10 am–8 pm". The farm's own hours of the day are not on the site (round 1; dashboard d51). |
| A2 Reserve | Y | the 2nd link on the page: Tab 2 and Enter = 3 keys | "Reserve your time" in the announcement, then "Reserve your visit" |
| A3 Parking | P | the heading "Head to the farm" is the 8th heading; the FAQ question "Where do I park?" | "limited parking" (the missing facts are round 1, d35) |
| A4 Price | Y | the heading "Choose your package" is the 10th heading; "$31 base price" is the 5th line after it | the prices read in order, each card is an "article" with its own heading |
| A5 Pizza | Y | the heading "Real pizza from a 700-degree oven" is the 62nd heading; or the menu item "Pizza" | the two ways to get pizza and the menu |
| A6 Contact | P | its heading "Directions & contact" is the 101st of 106 | four e-mail addresses; no phone number (round 1; d04) |
| A7 Language switch | Y | the first button on the page: Tab 4 on a phone, Tab 13 on a desktop | "Language: English"; after choosing Español focus stays on the button and its name is now "Idioma: Español", so the change is heard |
| A8 Pause the animation | N | none | there is no pause button. About 80 looping movements run (the farm scene, the tractor, the sun). They stop only when the phone or computer is set to "reduce motion": then 0 run. The scene is hidden from screen readers, so a blind visitor is not affected; the gap is for people who can see it |
| A9 Close every pop-up | Y | one key each | photo viewer (a dialog named "Photo viewer", button "Close photo", Escape), phone menu (Escape), language menu (Escape), "Remind me" menu (Escape). Focus returns to the control that opened each one |
| A10 Live badges and the countdown | Y | none | the countdown is a timer (silent): its text changes 59 times in a minute and a screen reader says none of it, but its label gives days, hours and minutes. 10 other "status" areas speak politely and none changed by itself in 60 seconds. No alert and nothing assertive |
| A11 Drawings hidden | Y | none | no drawing is exposed (0 of them); 38 pictures, all with a description. Five photos appear twice (in the story and in the gallery) so their description is heard twice |
| A12 Hero buttons named | Y | none | "Pick a pumpkin" and "Say hi to a farm friend" |
| A13 The list of links | P, **Fixed** | the links list | five names were used for two different places each: "Directions", "Get directions", "Apple Maps", "Waze" (farm or GreenHouse) and "Instagram"; three FAQ buttons named "First-visit guide" that go to different parts of the guide; and the game score read as a bare "0". They now carry the card's own heading in their name ("Directions The u-pick farm"), in every language, with no new words |

Left as they are: the two footer links both named "Wise Pie pizza" (one to the home page section, one to the separate page) and "See the varieties" (twice, two lists): the page around them says which.

## B. A keyboard-only visitor (11 tries)

The skip link is the first stop, shows when focused (a 4 px ring) and lands in the main part. Every one of the 245 stops (phone) and 253 stops (desktop) on the home page was on screen, with a visible ring, in reading order; no trap. The floating Reserve / Directions / Email bar of a phone is last in the Tab order (stop 241 of 245) which is normal for a bar at the end of the page.

| Job | Result | Key presses: phone / desktop | Notes |
|---|---|---|---|
| B1 Reserve | Y | 3 / 3 | Tab, Tab, Enter on "Reserve your time" |
| B2 Skip link, then the first button | Y | 3 / 3 | Tab, Enter, Tab to "Reserve your visit" |
| B3 Hours: the GreenHouse section | Y | 13 / 10 | on a phone: menu button (5 Tabs), Enter (focus goes into the menu), 6 Tabs, Enter |
| B4 Price: the Visit section | Y | 7 / 5 | |
| B5 Pizza section | Y | 12 / 9 | |
| B6 Parking: the FAQ "Where do I park?" | Y | 33 / 33 | menu, FAQ, then 14 Tabs through the questions. By Tab alone the same question is stop 190 (phone) or 201 (desktop) |
| B7 Contact section | Y | 19 / 19 | |
| B8 Switch to Spanish | Y | 7 / 16 | focus returns to the language button, now "Idioma: Español" |
| B9 Pause the animation | N | none | no pause button (see A8) |
| B10 Close pop-ups, focus, traps | Y | 1 | Escape closes the menu, language list, reminder menu and photo viewer and puts focus back; the photo viewer keeps focus inside itself (Previous, Next, Close) |
| B11 The school page from the Groups area | Y | 20 / 20 | the new "About school field trips" button |

Where the Tab stops are on the home page (one pass): photo gallery 39, farm map 25, the Visit section 24 to 27, flowers 19, contact 21, the FAQ 16. The menu jumps (an Enter on a menu item moves the next Tab to that part of the page) are what make the page usable by keyboard. Menu jumps land with the section 13 px below the sticky header in 60 of 60 tries (English, Spanish, Vietnamese; phone and desktop).

## C. A low-vision visitor (12 tries)

| Job | Result | What was found |
|---|---|---|
| C1 Browser zoom 200% (640 x 400 CSS px): home, First-visit, school, pumpkin pages | Y | no sideways scroll, nothing cut off, no text on text, no broken button; the sticky header covers 16% of the window |
| C2 Browser zoom 400% (320 x 200 CSS px): the same four pages | Y | the same: nothing overflows. The first screen is the announcement bar and the header (the Reserve link is in the announcement); the header covers 30% of the window; the bottom bar sits in the page when the window is short |
| C3 400% zoom: the menu and the photo viewer | Y | the menu panel scrolls inside itself (14 items, the last one reachable); the viewer fits (the Close button is inside the window) |
| C4 400% zoom: the language list | P, **Fixed** | the five languages ran off the bottom of a 200 px window (the list was 110 px longer than the screen). It now scrolls inside itself. With the page scrolled to the very top the announcement bar still takes the first 100 px, so a visitor scrolls a little; the footer also has the language list |
| C5 Big system font 150% (phone 390 and 320) | Y | nothing overflows |
| C6 Big system font 200%, phone 390 | Y | the bottom buttons and the text fit; a few labels wrap onto 2 or 3 lines |
| C7 Big system font 200%, small phone 320 | P, **Fixed** | the page scrolled sideways by 16 px because the drive-time chips ("about 30 minutes" could not wrap), and the three bottom buttons ran off the right edge (the Email button was cut off). Now both fit |
| C8 Big system font 300%, phone 390 and 320 | P | the page scrolls sideways (95 to 164 px); "Show names" and a few labels break out of their box; a small "Now" badge overlaps "Fall" in the season buttons. Beyond the 200% the rules ask for: left alone |
| C9 WCAG text spacing (line height 1.5, letters 0.12 em, words 0.16 em, paragraphs 2 em), phone and desktop | Y | nothing cut off or overlapping |
| C10 Windows high contrast (forced colours), light and dark, phone and desktop | Y | buttons keep their borders, the chosen tab looks different, the focus ring shows, the pictures stay |
| C11 Phone with page zoom 200% (195 px wide) | P | the page scrolls sideways by 57 to 81 px (the "this week" list, the cards of the First-visit guide). 195 px is narrower than the 320 px the reflow rule asks for |
| C12 Reading and finding Reserve at 400% zoom | Y | the Reserve link is in the announcement on the first screen |

Note: the layout checker also reports "Directions runs over 5 lines" for the bottom bar at 200% font. That comes from looking at a window as tall as the whole page; in the real window (short) the bar uses its compact version and the words stay whole. It was checked on screen.

## D. Chinese, Vietnamese and Hindi (15 tries, plus the scan)

Five jobs in each language at phone and desktop width. All 15 were found. Taps / scrolls / estimated seconds, phone then desktop:

| Job | Chinese | Vietnamese | Hindi |
|---|---|---|---|
| D1 Book a visit for 4 (hero button) | 1 / 0 / 2 s; 1 / 0 / 2 s | 1 / 0 / 14 s; 1 / 0 / 14 s | 1 / 0 / 11 s; 1 / 0 / 11 s |
| D2 Cost with pizza (menu, Visit) | 2 / 5 / 14 s; 1 / 3 / 10 s | 2 / 5 / 24 s; 2 / 3 / 21 s | 2 / 5 / 25 s; 1 / 3 / 21 s |
| D3 Pizza without a reservation (menu, Pizza) | 2 / 1 / 6 s; 1 / 1 / 4 s | 2 / 2 / 18 s; 2 / 1 / 17 s | 2 / 1 / 17 s; 1 / 1 / 15 s |
| D4 Where do I park (FAQ) | 3 / 4 / 10 s; 3 / 2 / 8 s | 3 / 4 / 16 s; 3 / 4 / 16 s | 3 / 4 / 16 s; 3 / 2 / 13 s |
| D5 Rain and refund (FAQ) | 3 / 3 / 9 s; 3 / 1 / 6 s | 3 / 3 / 14 s; 3 / 3 / 14 s | 3 / 4 / 15 s; 3 / 4 / 15 s |

Seconds differ because the Vietnamese and Hindi sentences are longer (the estimate counts words read). One Hindi desktop run showed 13 scrolls for the FAQ pizza route (31 s): it did not repeat in the scripts' second look and is not counted as a finding. Chinese and Vietnamese at 1280 px: Vietnamese uses the menu button at that width (Spanish does too), Chinese and Hindi use the full row (one tap less).

### What is still in English in the other languages

Every text, label, picture description, tab title and page description of all six pages, the 404 page and every pop-up, in Spanish, Chinese, Vietnamese and Hindi:

| What | Where | Languages | What to do |
|---|---|---|---|
| Month names "Jan Feb Mar ... Dec" in the "farm year at a glance" row | home page | Hindi only (the other four languages translate them) | a native reader decides: Hindi short month names, or keep the Latin letters many Hindi readers use. 12 short words |
| The "page not found" page | the 404 page: title, headline, three buttons | all four languages (English only by design: it is a plain page with no scripts) | owner question below |
| The description of each share picture ("Illustration of a fall farm ...") | the page header (the picture that shows when a link is shared) | all four languages | nobody sees it on the page; a crawler reads the English page anyway. Left alone |
| "Preview example only. These spots are not real." | the hidden "Spots left" table | all four languages | hidden at launch; shows only if that box is switched on |
| "Send" in the waitlist note | home page, hidden e-mail note | Hindi | looks like a leftover; a native reader decides |
| "View Booking" in quotes | the sentence about the confirmation e-mail | Chinese, Hindi | on purpose: that is the button in the English booking e-mail |
| English words quoted from a photo ("Happy Easter!", "Plenty of organic strawberries ...") | the photo descriptions | Chinese, Vietnamese, Hindi | on purpose: the words are printed in the picture; the description says so in the visitor's language |
| Place names (Stallings, Matthews, Mint Hill, Monroe, Waxhaw), "Environmental Working Group", "Standard Course of Study" | drive times, the story, the school text | Chinese, Hindi | names: fine |

Nothing was English in the photo viewer, the farm map, the drive-time box (empty, found, address not found, service down), the signup box (empty, bad address, good address), the reminder menu, the calendar file's title and description, the games and the season picker.

## E. Arriving from a search at an extra page (10 tries)

The visitor opens the page straight at its address, never sees the home page, and wants one thing. Phone / desktop.

| Arrival | Job | Result | What they see |
|---|---|---|---|
| E1 First-visit guide, `#parking` | the parking answer | Y | the Parking card sits 93 px (phone) or 101 px (desktop) below the sticky header, no scroll; Reserve, language and the way home are on the first screen. The page title is "First Visit to Wise Acres" |
| E2 First-visit guide, `#strollers` | stroller and wheelchair | P | the card is on screen; it says "email us before you come" (round 1; d55) |
| E3 First-visit guide | what does it cost? | P | no price on the page: one tap on "See packages & add-ons" goes to the home page |
| E4 First-visit guide | which days, what hours? | P | no day or hour on the page; the home page has them |
| E5 Pumpkin patch page | the price | Y | "Fall 2026 prices" 1.1 screens down (desktop) or 1.7 (phone) |
| E6 Pumpkin patch page | the days and the hours | P | "Thursday–Sunday" and "Friday–Sunday" are there; the farm's hours of the day are not (d51) |
| E7 Strawberry page, in October | is it in season now? | P | "Usually mid-April to early June" in small writing above the title; the page's big red button says "Reserve your time" and goes to the fall booking page; no line says "not in season now". A "Tell me when it opens" button is next to it (dashboard d25) |
| E8 Strawberry page | the price | N | no price on the page (round 1: strawberries "Prices coming soon") |
| E9 School page | price, minimum group size, sign up | Y | "Tour details" with "$11 per student" and "Minimum 100 students" starts just below the first screen; "Sign up for a tour" is on the first screen. The top-right "Reserve" and the announcement still go to the general farm booking |
| E10 Pizza page | the pizza hours | Y | "Fall hours are Friday through Sunday", the 10 am to 4 pm and 4 pm to 8 pm times, the pre-order button. The menu prices are on the home page ("See the current menu") |

On every extra page: Reserve, the language button, the menu and the link to the home page are on the first screen; the page's e-mail address is in the footer, 1 to 5 screens down; no page shows a phone number (d04). The sticky header never hides the target of an `#anchor`: in all 12 landings the target is clear of it (a card 93 px below the header on a phone and 101 px on a desktop, a section 13 px).

## The top gaps of this round, most visitors first

1. **Nothing pauses the looping animations** (A8, B9; 2 of 5 kinds of visitor, and everyone who finds moving pictures tiring). About 80 movements run until the phone is set to reduce motion. A "Pause animations" button needs new words in five languages and a place in the header: a decision. Owner question 1.
2. **The first-visit and strawberry pages repeat none of the home page's facts** (E3, E4, E7, E8). A first-visit reader has to go to the home page for the price, the days and the hours; a strawberry reader in October is not told it is the off season. The words exist on the home page: the lead can copy them. The out-of-season Reserve button is dashboard question d25.
3. **The home page has about 250 Tab stops** (B6). The menu jumps work well; a skip link over the photo gallery (39 stops) and the farm map (25) would still help a visitor who tabs on. Owner question 2.
4. **The "page not found" page is English for everyone** (D). Owner question 3.
5. **Hindi month names are Latin letters** (D). Owner question 4 (the translation reviewers).
6. **At 400% zoom the first screen is the announcement bar and the header** (C2): the visitor scrolls past 150 px to reach the title. It works; it is only slow. Nothing to fix without changing the look.
7. **A big system font above 200%** scrolls a phone sideways (C8). Beyond the rules; not planned.
8. **Two footer links with the same name** ("Wise Pie pizza") and six photos described twice (A11, A13). Minor.

## What this round fixed

All of it needs no new fact and no new visible word.

- **Link names** (`index.html`): "Directions", "Get directions", "Apple Maps", "Waze" and the GreenHouse's "Instagram" now include the card's own heading in their accessible name ("Directions The u-pick farm", "Directions The GreenHouse"), and the three new FAQ buttons include their question. The words are taken from the page, so all five languages follow by themselves. 16 links changed. Visible text is unchanged. A quick test, `tests/link-names.test.mjs`, fails on the old page and passes now.
- **The game score** (`index.html`): the "0" next to the basket in the hero is hidden from screen readers; the message line beside it says what happened.
- **A small phone with a big font** (`css/extras.css`, `css/features.css`): the three bottom buttons wrap to a second row instead of running off the screen; the drive-time chips may wrap their time. A quick test, `tests/big-font.test.mjs`, uses the browser's real font-size setting at 320 px (150% and 200%) and 390 px (200%): it fails on the old page and passes now.
- **The language list in a short window** (`css/extras.css`): it scrolls inside itself when the window is shorter than the list (a browser zoomed to 400%).
- One optional patch (`patches/optional/reserve-window.patch`) quotes the line that was changed: its context was updated so the optional patches still apply.

## Ask the farm

Nothing new this round: every gap that needs a fact is one the first round already found and the dashboard already asks. **Skipped because the dashboard asks it** (d01 to d73 were checked; d74 to d78 were not visible to this round, so a repeat there is possible): the phone number for the day (d04), where to park (d35), strollers and wheelchairs (d55), the farm's hours of the day (d51), school tours for smaller classes and what the school page says (d36), Reserve buttons when nothing can be booked, which covers the strawberry page in October (d25), and native speakers for the translations (d37).

## Owner questions

Written in the dashboard format (`title`, `why`, `options`, `urgency`, `topic`). None of them needs a fact the farm does not already have: they are choices.

1. Add a "Pause animations" button? (urgency 3)
2. Add "skip" links over the photo gallery and the farm map? (urgency 3)
3. Should the "page not found" page speak all five languages? (urgency 3)
4. Hindi month names or the Latin letters? (urgency 3; a native reader writes them. Related to d37, which asks for native readers in general)

## What was not done

- No real screen reader, phone or voice control was used; the screen-reader results come from the accessibility tree.
- The Hindi desktop FAQ run that showed 13 scrolls was run twice more and did not repeat (see D); it is not counted.
- Seconds and steps are estimates. Real visitors are slower.
