# What the website stores, and which other sites it contacts

**This is a fact sheet, not a privacy policy.** It lists facts about what the website's own code does. It is not consent text and not legal advice.

**Checked:** 2 October 2026, website version `4d80383`. If the code changes, these facts can change too. Ask Claude to run the checks again (see the end of this page).

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
| Uses every feature listed above | **None.** |
| Presses "Join the email list" | Nothing is sent by the page. The button is a link to Mailchimp's own signup page (`eepurl.com`), so the visitor leaves the site. |
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

**What every outside site sees on any of these requests:**
- the visitor's internet (IP) address and browser type, as with any web request;
- **no cookies** from the website;
- when the analytics script is fetched, and on the Mailchimp request, the site name only (`https://www.wiseacresorganic.com/`), never which page;
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

**Never sent by the website:** email addresses, names, anything typed, map names or notes, which photo was opened.

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
| Google Maps | `www.google.com/maps` | Directions and "Google reviews". "Leave a Google review" goes here too until `reviewUrl` is set. |
| Apple Maps, Waze | `maps.apple.com`, `waze.com` | Directions |
| Instagram | `www.instagram.com` | Four farm accounts, the hashtag page, and credit links on visitor photos |
| Facebook | `www.facebook.com` | The farm's page |
| Mailchimp signup page | `eepurl.com` | "Join the email list", while the signup form is not connected |
| Google Forms | `docs.google.com/forms` | School tour sign-up. What it asks for is set in Google Forms, not in this website. |
| Google Calendar | `calendar.google.com` | "Add to Google Calendar". The link carries only the opening times and the Bookeo link. |
| Yelp, Tripadvisor | `www.yelp.com`, `www.tripadvisor.com` | Reviews |
| Axios | `www.axios.com` | "In the news" |
| Email links (`mailto:`) | The visitor's own email program | Questions and the waitlist. The website sends nothing: the visitor writes and sends the email themselves. The waitlist email is pre-filled with the day and empty lines for a name and group size. |
| Phone link (`tel:`) | The visitor's phone | Calling the farm |

**What the other site learns when a visitor taps a link out:** only that the visitor came from `www.wiseacresorganic.com`, not which page. This comes from the `Referrer-Policy` line in `_headers`, which Netlify and Cloudflare Pages apply.

**Links that open a new tab** have `rel="noopener"` on every page.

## 6. What the website does not do (each one tested)

| Not done | How it was checked |
|---|---|
| No cookies | 0 cookies in the browser after every page and every feature, both as shipped and with everything switched on. The website sent no "Set-Cookie" header. |
| No tracking pixels or hidden pictures from other sites | 0 requests to any other site, with the website as shipped |
| No fonts from other sites | The four fonts are files in `assets/fonts/`. Hindi and Chinese text uses the visitor's own fonts. No outside requests. |
| No embedded maps, videos or social-media posts | No `iframe`, `video`, `audio`, `embed` or `object` on any page or made by any script. The farm map is drawn by the website's own code from its own points. |
| No analytics as shipped | `analytics: { provider: 'none' }` in `js/content.js`, and no analytics script is loaded |
| No location, camera or microphone | The website never asks for them, and `_headers` switches them off (`Permissions-Policy`) |
| Nothing sent to the website itself | The website has no server program. The only form (the email signup) talks to Mailchimp, and only when it is connected. |

## 7. Children

| Question | What the code shows |
|---|---|
| Is there a form for children? | **No.** The only form is the email signup on the home page: one email address and 8 interest boxes. It asks for no name, age, birthday, address, phone number, photo or free text. It stays hidden until Mailchimp is connected. The only other controls are the photo viewer's close button (it sends nothing) and the First-visit checklist (it stays in the browser). |
| Can anyone upload a photo? | **No.** There is no file picker anywhere (no `input type="file"`), and no code that sends anything to the website. Visitor photos appear only when the person who edits the site adds the picture file, plus a line in `js/content.js`, by hand. |
| Picking game, goat, bouquet, map | Nothing is typed, stored or sent. The counts live in memory only. |
| School tour sign-up | A link to a Google Form on Google's site. What it asks for is set in Google Forms. |

## 8. Outside this website's code

- **The hosting company** (for example Netlify or Cloudflare Pages) receives every request and keeps its own records. Some hosts can add their own cookies when certain options are on; for example, Cloudflare's bot protection can. After publishing, check once:
  1. Open the live site in a private window.
  2. Press F12.
  3. Look under Application, then Cookies (Chrome), or Storage, then Cookies (Firefox).
- **The sites in the links-out table** follow their own rules once a visitor is there.

## How to check again

- **Ask Claude:** "re-run the storage and outside-sites check" after any change to `js/`, `index.html` or `js/content.js`.
- **By hand:**
  1. Open the site in a private window.
  2. Press F12.
  3. The **Network** tab lists every address the page contacts.
  4. **Application → Local storage** and **Application → Cookies** show what is kept.
