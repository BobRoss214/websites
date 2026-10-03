# What the website stores, and which other sites it contacts

**This is a fact sheet, not a privacy policy.** It lists facts about what the website's own code does. It is not consent text and not legal advice.

**Checked:** 2 October 2026, website version `4d80383`. The Drive time box was added later and checked on 3 October 2026, website version `2996b9f`: sections 2, 3, 5, 6, 7 and 8 and the events table were updated for it. If the code changes, these facts can change too. Ask Claude to run the checks again (see the end of this page).

**How it was checked**

1. **The site as it is today.** Every page was opened in a brand-new browser profile, with the browser set to Spanish so the "Would you like this in Spanish?" question appears. Every feature was then used:
   - the language question and the language menu;
   - the season switcher, the season tabs and the "What's on the farm" buttons;
   - the picking game, until the 100-pumpkin badge appeared;
   - the goat and the bouquet builder;
   - the map and its list;
   - the photo viewer;
   - both "Remind me" choices;
   - the checklist and print button on the First-visit page, and the print button on the QR sign page.
2. **Every optional feature switched on.** The same visit was repeated with analytics, the Mailchimp signup, the live week feed, visitor photos, the entrance photo and the review link all on. The test computer cannot reach those outside services, so the test answered for them and recorded exactly what the website sent.
3. **The Drive time box (3 October 2026).** The box was used in a real browser with stand-ins for the two map services, because the test computer cannot reach them. The test recorded every request the box made, with its headers, and compared the browser's storage and cookies before and after a lookup. What the two services themselves do with the data was read from their own documentation and program code, not tested live (section 8).

## 1. What the website keeps in a visitor's browser

| Name | Kind | Written when | What is in it | How long it lasts | Personal? |
|---|---|---|---|---|---|
| `wa.lang` | localStorage | Only when the visitor picks a language in the menu, or answers "yes" to the language question. Opening a link that ends in `?lang=es` does **not** write it. | A two-letter language code: `en`, `es`, `hi`, `zh` or `vi` | Until the visitor clears this site's data in their browser (it has no end date) | No |
| `wa.offer` | localStorage | When the visitor answers "No, thanks" to the language question | The number `1`, so the question is not asked again | Same as above | No |
| `wa.checklist` | localStorage | When the visitor ticks a box in the "What to bring" list on the First-visit page | One true/false per line of the list, for example `[true,false,true,false,false,false,false]` | Same as above | No |

**Nothing else is kept.** In the test:
- **Cookies:** none. The page itself had none (`document.cookie` was empty), the browser profile had 0 after the whole visit, and the website never sent a "Set-Cookie" header.
- **Other browser storage:** sessionStorage was empty. There was no IndexedDB, no Cache Storage and no service worker.

**A visitor who only reads pages leaves nothing behind**, even after scrolling through all of them.

These are kept only in memory and disappear when the page is closed or reloaded:
- picking-game counts and badges;
- the open map place;
- the email typed into the signup box.

**The website never reads these three values and sends them anywhere.** There is one exception: with analytics switched on, the language in use is counted (see section 3).

## 2. Which other sites the website contacts, as it is today

| What the visitor does | Other sites contacted |
|---|---|
| Opens any page (all 8 pages, in all 5 languages) and scrolls through it | **None.** Pages, pictures, fonts, scripts, translations and the map all come from the website itself. |
| Uses every feature listed above, except the Drive time box | **None.** |
| Presses "Join the email list" | Nothing is sent by the page. The button is a link to Mailchimp's own signup page (`eepurl.com`), so the visitor leaves the site. |
| Presses "Get drive time" in the Drive time box (Contact section), after typing an address | **Two sites, only at that moment:** `nominatim.openstreetmap.org` (OpenStreetMap's address search) and `router.project-osrm.org` (the OSRM routing server). What is sent is in section 3. |
| Adds a reminder with the calendar-file button | **None.** The `.ics` file is made inside the visitor's browser. It holds only the reservation opening times and the Bookeo link. |

## 3. What each optional feature adds when it is switched on

| Feature (setting in `js/content.js`) | Other site contacted | When | What the website sends | Stored in the browser by the website |
|---|---|---|---|---|
| Analytics: Plausible | `plausible.io` | On every page view, before the visitor does anything; then on the events listed below | The event names and details in the next table | Nothing |
| Analytics: GoatCounter | `gc.zgo.at` (its script) and `YOURCODE.goatcounter.com` (counting) | Same | The same event names. Of the details, only "where on the page" is sent, as part of an address like `event/Reserve click/contact`. | Nothing |
| Analytics: Umami | The Umami address you set | Same | The same events and details | Nothing |
| Analytics: Cloudflare Web Analytics | `static.cloudflareinsights.com` (its script) and `cloudflareinsights.com` (counting) | On every page view | Page views only. The website sends Cloudflare no button events. | Nothing |
| Email signup (`signup.action`, Mailchimp) | Your Mailchimp address, for example `NAME.us21.list-manage.com` | Only when the visitor presses "Join the email list" after typing an email address that looks valid. Nothing is sent while typing. | The details are in the list just below this table. | Nothing |
| Live week feed (`week.feed`) | The feed's address, if it is on another site | Every time the home page is opened. The answer is never reused from an earlier visit. | A plain request, with no cookies and no information about which page asked | Nothing |
| Drive time box (the "Get drive time" button; optional setting `farmPoint` in `js/content.js`) | `nominatim.openstreetmap.org` (OpenStreetMap's address search) and `router.project-osrm.org` (the OSRM routing server) | Only when the visitor presses the button after typing at least 5 characters. Nothing is sent while typing, and nothing when the page opens. | The details are in the list just below this table. | Nothing |
| Visitor photos (`community`) and entrance photo (`entrancePhoto`) | **None.** The code only accepts picture files that are on the website itself. A photo pointing at another site is refused, and the Site check box says so. | – | – | Nothing |
| Review link (`reviewUrl`) | None until tapped. It is a link to Google. | – | – | Nothing |

**What goes to Mailchimp when the visitor presses "Join the email list":**
- the email address;
- one code for each ticked interest box that has a matching Mailchimp group (ticked boxes with no group are not sent);
- the tags, if set;
- the two list codes from your Mailchimp address (`u` and `id`);
- an empty field that Mailchimp uses to catch robots;
- a one-time reply name.

Everything travels inside the request's web address; that is how this kind of Mailchimp connection works. The page shows nothing from Mailchimp's reply except whether the signup went through, or whether the person is already on the list.

**What goes to the two map services when the visitor presses "Get drive time":**
- **To `nominatim.openstreetmap.org`** (the address search run by the OpenStreetMap Foundation): the address exactly as typed (at most 200 characters), and fixed words: `format=jsonv2`, `limit=1`, `countrycodes=us`, `accept-language=en`. A second search, for the farm's address (`4701 Hartis Rd, Indian Trail, NC 28079`), follows about 1.1 seconds later, unless `farmPoint` is set in `js/content.js`; its answer is kept in memory until the page is closed or reloaded, so later presses send only the first search.
- **To `router.project-osrm.org`** (the routing demo server run by FOSSGIS e.V., a German non-profit): not the typed words but two pairs of map coordinates: the spot the search found for the visitor's address (six decimals, which is accurate to about a house) and the farm's spot, plus fixed options (`overview=false`, `alternatives=false`, `steps=false`).
- **What comes back and is shown:** the name of the place found (up to 140 characters, shown in English as "We looked up: ..."), the distance and the time. Nothing is stored by the website: the browser's local storage, session storage and cookies were identical before and after a lookup (tested).
- **A link, only if tapped:** under every answer there is a button "Open these directions in Google Maps". Google receives the typed address in that link's web address only if the visitor taps it.
- **The browser's own autofill:** the box is marked as a street-address field, so a browser may offer the visitor's saved addresses and may offer to remember what is typed. That is the browser's feature, not this website's.
- **With analytics on:** the event `drive_time` is sent after an answer is shown, with no details (table below).

**What every outside site sees on any of these requests:**
- the visitor's internet (IP) address and browser type, as with any web request;
- **no cookies** from the website;
- when the analytics script is fetched, on the Mailchimp request, and on the two map-service requests, the site name only (`https://www.wiseacresorganic.com/`), never which page (tested for the map services: the browser sent the site name as Referer and Origin, and no cookie);
- for the week feed, not even the site name.

**Analytics events the website sends** (only when analytics is on, and never to a visitor who has Do Not Track or Global Privacy Control switched on):

| Event | Sent when | Extra detail sent |
|---|---|---|
| Section view | A main section scrolls into view (once per section each time a page is opened) | The section's name, for example `this-week`, `reserve`, `contact` |
| Reserve click, Pizza pre-order click, Directions click, Email click, Phone click, Email signup click, Instagram click, Facebook click, School tour form click | The visitor taps that kind of link | Where on the page it was (the section's name) |
| Review click, Press click, Waitlist click | The visitor taps those buttons | Where on the page it was |
| Signup submit | "Join the email list" is pressed in the signup form | How many interest boxes were ticked (a number) |
| Map select | A place on the map is opened | The kind of place, for example `checkin`, not its name or note |
| Reminder added | A calendar reminder is added | `ics` or `google` |
| Season preview | The season switcher is used | The season |
| Language change | The language is changed, or a page opens in a language other than English | The language code |
| Hero played | First tap in the game at the top of the home page (picking, the tractor, the fire) | Nothing |
| `drive_time` | A drive-time answer is shown in the Drive time box | Nothing. Not the address, not the place, not the distance. |

**Never sent to the analytics service:** email addresses, names, anything typed (including the Drive time address), map names or notes, which photo was opened.

The test recorded these events and their details exactly as they were handed to the analytics service. Each service's own script also records page views, which includes which page was viewed. What it collects on top, and whether it stores anything in the browser, is decided by that service: read its documentation before switching it on. The scripts themselves could not be loaded on the test computer.

## 4. Do Not Track and Global Privacy Control

| Visitor's browser | Analytics script loaded? | Events handed to it |
|---|---|---|
| No signal | Yes (when analytics is on) | Yes |
| Do Not Track on | **No** | None |
| Global Privacy Control on | **No** | None |
| Either signal, plus `?track=debug` in the address | **No** | None. The events are only listed in that visitor's own browser console, for testing. |

All four were tested with Plausible switched on.

## 5. Links out: nothing is contacted until the visitor taps

| Goes to | Address | Used for |
|---|---|---|
| Bookeo | `bookeo.com` | Reservations: farm visits, pizza visits, parties |
| Square | `wise-pie-wood-fired-at-wise-acres.square.site` | Wise Pie pizza pre-orders |
| Google Maps | `www.google.com/maps` | Directions and "Google reviews". "Leave a Google review" goes here too until `reviewUrl` is set. The Drive time answer also has "Open these directions in Google Maps", which carries the address the visitor typed (see section 3). |
| Apple Maps, Waze | `maps.apple.com`, `waze.com` | Directions |
| Instagram | `www.instagram.com` | Four farm accounts, the hashtag page, and credit links on visitor photos |
| Facebook | `www.facebook.com` | The farm's page |
| Mailchimp signup page | `eepurl.com` | "Join the email list", while the signup form is not connected |
| Google Forms | `docs.google.com/forms` | School tour sign-up. What it asks for is set in Google Forms, not in this website. |
| Google Calendar | `calendar.google.com` | "Add to Google Calendar". The link carries only the opening times and the Bookeo link. |
| Yelp, Tripadvisor | `www.yelp.com`, `www.tripadvisor.com` | Reviews |
| OpenStreetMap | `www.openstreetmap.org/copyright` | The "© OpenStreetMap contributors" credit shown under a Drive time answer |
| Axios | `www.axios.com` | "In the news" |
| Email links (`mailto:`) | The visitor's own email program | Questions and the waitlist. The website sends nothing: the visitor writes and sends the email themselves. The waitlist email is pre-filled with the day and empty lines for a name and group size. |
| Phone link (`tel:`) | The visitor's phone | Calling the farm |

**What the other site learns when a visitor taps a link out:** only that the visitor came from `www.wiseacresorganic.com`, not which page. This comes from the `Referrer-Policy` line in `_headers`, which Netlify and Cloudflare Pages apply.

**Links that open a new tab** have `rel="noopener"` on every page.

## 6. What the website does not do (each one tested)

| Not done | How it was checked |
|---|---|
| No cookies | 0 cookies in the browser after every page and every feature, both as shipped and with everything switched on. The website sent no "Set-Cookie" header. |
| No tracking pixels or hidden pictures from other sites | 0 requests to any other site, with the website as shipped, until a visitor presses "Get drive time" |
| No fonts from other sites | The four fonts are files in `assets/fonts/`. Hindi and Chinese text uses the visitor's own fonts. No outside requests. |
| No embedded maps, videos or social-media posts | No `iframe`, `video`, `audio`, `embed` or `object` on any page or made by any script. The farm map is drawn by the website's own code from its own points. |
| No analytics as shipped | `analytics: { provider: 'none' }` in `js/content.js`, and no analytics script is loaded |
| No location, camera or microphone | The website never asks for them, and `_headers` switches them off (`Permissions-Policy`) |
| Nothing sent to the website itself | The website has no server program. The email signup talks to Mailchimp, and only when it is connected. The Drive time box talks to the two map services, and only when its button is pressed. |
| Nothing from a Drive time lookup is kept | Local storage, session storage and cookies were identical before and after a lookup (3 October 2026, with stand-ins for the two services) |

## 7. Children

| Question | What the code shows |
|---|---|
| Is there a form for children? | **No form is meant for children.** There are two. The email signup on the home page asks for one email address and 8 interest boxes. The Drive time box asks for one typed address, which is free text and, if the visitor types their own, a home address that goes to the two map services (section 3). Neither asks for a name, age, birthday, phone number or photo. The email signup stays hidden until Mailchimp is connected. The only other controls are the photo viewer's close button (it sends nothing) and the First-visit checklist (it stays in the browser). |
| Can anyone upload a photo? | **No.** There is no file picker anywhere (no `input type="file"`), and no code that sends anything to the website. Visitor photos appear only when the person who edits the site adds the picture file, plus a line in `js/content.js`, by hand. |
| Picking game, goat, bouquet, map | Nothing is typed, stored or sent. The counts live in memory only. |
| School tour sign-up | A link to a Google Form on Google's site. What it asks for is set in Google Forms. |

## 8. Outside this website's code

- **The hosting company** (for example Netlify or Cloudflare Pages) receives every request and keeps its own records. Some hosts can add their own cookies when certain options are on; for example, Cloudflare's bot protection can. After publishing, check once:
  1. Open the live site in a private window.
  2. Press F12.
  3. Look under Application, then Cookies (Chrome), or Storage, then Cookies (Firefox).
- **The two map services** keep their own records. FOSSGIS says of the routing server: "Your request for a route is sent to our server ... and is saved in the server log file." The current code of its server program also writes, for every request (unless the operator switches that off), the IP address, the referring site, the browser and the whole request, which includes both coordinate pairs. These come from the routing server's own about page and program code, read on 3 October 2026. The OpenStreetMap Foundation's privacy policy, which covers the address search, says its services record the IP address, browser, operating system and referring page; that comes from a search-engine summary of the policy and was not opened. How long either keeps its records was not found. Neither service was called from the test computer.
- **The sites in the links-out table** follow their own rules once a visitor is there.

## How to check again

- **Ask Claude:** "re-run the storage and outside-sites check" after any change to `js/`, `index.html` or `js/content.js`.
- **By hand:**
  1. Open the site in a private window.
  2. Press F12.
  3. The **Network** tab lists every address the page contacts.
  4. **Application → Local storage** and **Application → Cookies** show what is kept.
