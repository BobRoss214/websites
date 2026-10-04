# Credits and licences: who made what the site uses

**Checked:** 3 October 2026, against website version `3396be7`. Everything below was read from the files themselves (the fonts' own name tables, the icons' drawings, the pictures' hidden data, the code). The web pages of the services were not opened again; where the table says so, it quotes `docs/LAUNCH_CHECKLIST.md`.

## In short

- **Fonts, icons and the map credit are done.** Each font has its licence text next to it in `assets/fonts/`, the two icon sets have theirs in `assets/`, and `assets/CREDITS.txt` names them all. They are uploaded with the site: `tools/make_deploy_folder.py` copies them, and it stops with a plain message if a font ever lacks its licence file.
- **No new words are needed on any page.** The licences ask for a notice that travels with the files, not for a line on the page. The one credit that must be on the page, "© OpenStreetMap contributors" under a Drive time answer, is already there.
- **Two things only the farm can answer.** Who took the photos (row L9, question 56, decision d61, already asked), and where the map's outline of the land came from (row L8, a new owner question).
- **Keep it true.** If you ask Claude to add a font, an icon set, a script or a picture made by someone else, ask for it to be written in the table below. `tests/licences.test.mjs` fails when a font has no licence file or a row has no evidence.

## The table

"Done" says whether what the licence asks for is in place: yes, no (a step is missing), or n/a (nothing is asked).

| # | What | Where in the project | Who made it | Licence | What the licence asks | Done | Evidence |
|---|---|---|---|---|---|---|---|
| L1 | Fredoka (headings), one font file with every weight | `assets/fonts/fredoka-latin-wght-normal.woff2` | The Fredoka Project Authors (Hafontia) | SIL Open Font License 1.1 | Keep the copyright line and the licence text with every copy. Do not sell the font by itself. | yes: `assets/fonts/LICENSE-OFL-Fredoka.txt` | The font's own name table says "Copyright 2016 The Fredoka Project Authors" and names the licence. The file is identical to the one in the npm package `@fontsource-variable/fredoka` 5.3.0 (fingerprint `99d6c78e`). |
| L2 | Nunito (text), two font files: Latin and Vietnamese letters | `assets/fonts/nunito-latin-wght-normal.woff2` and `assets/fonts/nunito-vietnamese-wght-normal.woff2` | The Nunito Project Authors | SIL Open Font License 1.1 | The same as L1 | yes: `assets/fonts/LICENSE-OFL-Nunito.txt` | Name table: "Copyright 2014 The Nunito Project Authors". Both files are identical to those in `@fontsource-variable/nunito` 5.3.0 (`ba344451`, `61e5958c`). |
| L3 | Caveat (hand lettering), bold | `assets/fonts/caveat-latin-700-normal.woff2` | The Caveat Project Authors | SIL Open Font License 1.1 | The same as L1 | yes: `assets/fonts/LICENSE-OFL-Caveat.txt` | Name table: "Copyright 2014 The Caveat Project Authors". The file is identical to the one in `@fontsource/caveat` 5.3.0 (`15f96380`). |
| L4 | Small interface icons: phone, mail, map pin, calendar, bell, Facebook, Instagram, clock, info, cash, leaf, "opens in a new tab" | `index.html` at `UI ICONS (stroke, currentColor)` (the drawings called `i-...`), and a copy of the ones each other page uses | Feather (Cole Bemis) and Lucide (Lucide Icons and Contributors); some drawings adjusted | MIT (Feather) and ISC (Lucide) | Keep the copyright notice and the permission text with every copy. | yes: `assets/LICENSE-icons-Feather-MIT.txt` and `assets/LICENSE-icons-Lucide-ISC.txt`, and a note in the page's icon comment | The drawings match the real icons (see "How the icons were matched" below): phone, Facebook and clock letter for letter, the others with small changes. Versions compared: `feather-icons` 4.29.2, `lucide-static` 1.51.0. |
| L5 | A random-number routine (the same trees and plants every visit) | `js/map-art.js` at `0x6D2B79F5` | "mulberry32" by Tommy Ettinger | Published as free to use (public domain, as its author says; not checked again) | Nothing | n/a. Named as a courtesy in `assets/CREDITS.txt`. | The routine in `js/map-art.js` is the well-known one: the same constant `0x6D2B79F5` and the same steps. |
| L6 | A test for "is this point inside this shape" | `js/map-art.js` at `const pip` | The method of W. Randolph Franklin (PNPOLY) | A method, written out again here in our own words | Nothing for a method. His own code asks for his notice if copied. | n/a. Named as a courtesy in `assets/CREDITS.txt`. | The routine `pip` in `js/map-art.js` has the same steps as PNPOLY, with other names. It was not copied from his page. |
| L7 | Drive time: address search and routes, and the map data behind both | `js/features.js` at `Routing: OSRM` (the credit links) and at `const GEO_URL =` | OpenStreetMap contributors; Nominatim (OpenStreetMap Foundation); OSRM (FOSSGIS e.V.) | OpenStreetMap data: Open Database Licence (ODbL). Each service also has a usage policy. | Show "© OpenStreetMap contributors" with the data, one request a second at most, a link to "fix the map". The routing demo server calls itself "non-commercial". | yes for the credit: it is in `js/features.js`. The business-use question is open: decision d10. | Under every answer the box shows "© OpenStreetMap contributors", "Routing: OSRM" and "Fix the map" (tested by `drive`). The policies are summed up in `docs/LAUNCH_CHECKLIST.md`, section 3.13. |
| L8 | The land around the farm on the Farm map: roads, neighbours' houses, lawns, dirt lanes | `js/map-art.js` at `traced from the aerial photo`; the points are in `tools/saved-map.json` and `js/farm-map-data.js` | Drawn by hand from the farm's aerial picture. The picture is Google's. | Google's terms for its maps and satellite pictures (not opened here) | Such terms usually do not allow tracing or copying from the pictures. This must be read by someone who can judge it. | **no**: open (owner question: the map's outline of the land) | `tools/farm_map.py` says "the satellite photo itself is never published (it is Google's picture)". `tools/saved-map.json` names the file the points were marked on: `"source": "farm-aerial.png"`. That file is not in the project and is not uploaded. |
| L9 | The farm's 32 photos | `assets/photos/` (listed in `js/content.js`, in `photos`) | Not written down anywhere | Not known | Permission from whoever took each photo and from the people in it | **no**: open, question 56 (decision d61) | No photo carries a photographer or copyright line: the 17 that carry any hidden data hold only size, resolution, direction or a colour profile. `tests/files-audit.test.mjs` refuses names, places and camera makes. |
| L10 | Colour profiles inside 14 photos (they say how to show the colours) | `assets/photos/` | The International Color Consortium, Google and Apple | Meant to travel inside pictures | Nothing is asked of the farm | n/a | The profile names read from the files: "sRGB IEC61966-2-1 black scaled", "sRGB" (Google, 2016) and "Display P3" (Apple, 2017 and 2022). |
| L11 | Share pictures, the phone-screen icons and the tab icon | `assets/og-share.png`, the other `assets/og-*.png`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/apple-touch-icon.png`, `assets/favicon.svg` | Drawn for the site from its own scene and lettering | The pictures show letters set in L1 to L3. The font licence does not cover pictures made with a font. | Nothing | n/a. Who owns the logo drawing is an owner question. | The files hold no hidden data. `assets/og-share.png` shows the same drawings as the home page scene. |
| L12 | The scene, the crops, the animals and the map symbols | `index.html` (the drawings called `strawberry`, `pumpkin` and so on), `js/hero.js`, `js/footer-art.js`, `js/map-art.js` | Written for this site | Not applicable | Nothing | n/a. Who owns the artwork is an owner question. | Searched `js/`, `css/` and the pages for copyright and licence lines, "MIT", "Creative Commons", other sites' addresses for scripts or styles, and shrunk code: nothing else was found. `tests/licences.test.mjs` repeats this search. |
| L13 | QR codes | `assets/qr/` and `print/qr-signs.html` (and the three other language sheets) | Made by `tools/make_qr.py` with the `segno` package | The codes themselves carry no licence (the tool is in L15) | Nothing | n/a | `tools/make_qr.py` imports `segno`. |
| L14 | Links to other businesses: Bookeo, Square, Mailchimp, Google Maps, Apple Maps, Waze, Google Calendar, Instagram, Facebook, Tripadvisor, Yelp, Axios | The pages and `js/content.js` | Those businesses | None needed to link. Each has terms for the farm's own account. | Nothing for the site | n/a | The addresses were counted in the pages: bookeo.com, square.site, eepurl.com and the others. The analytics providers are off (`js/analytics.js`, setting `provider`). |
| L15 | Helper programs that build the pages (never uploaded) | `tools/*.py` | `beautifulsoup4` (and `soupsieve`), `Pillow`, `segno`; optional: `pillow-heif`, `zxing-cpp` | MIT (`beautifulsoup4`, `soupsieve`), MIT-CMU (`Pillow`), BSD (`segno`), Apache-2.0 (`zxing-cpp`), BSD (`pillow-heif`, from memory: not installed on the test computer) | Nothing for the farm: they are not in the site | n/a | The imports in `tools/*.py`. The licence names were read from the installed packages: beautifulsoup4 4.15.0 MIT, Pillow 12.3.0 MIT-CMU, segno 1.6.6 BSD, zxing-cpp 3.1.1 Apache-2.0. |
| L16 | Helper programs that test the site (never uploaded) | `tests/package.json` | `playwright` (and the Chromium browser it uses), `axe-core` | Apache-2.0 (Playwright), MPL-2.0 (axe-core) | Nothing for the farm | n/a | `tests/package.json` lists both. Licences read from the npm registry: playwright 1.63.0, axe-core 4.13.0. |
| L17 | Photos and reviews sent in by visitors | `js/content.js` at `community: [],` and `reviews: [],` | None today: both lists are empty | Each sender's permission | A written yes from the sender before a photo or a review goes in | n/a: nothing is shown | Both lists are empty in `js/content.js`. |

## How the fonts were matched

The three families come from Google's open font collection through Fontsource. The font files carry their copyright line and the web address of the licence inside them (the "name table"), but not the licence text, which the licence says must travel with the files. So the text was copied, word for word, from the same packages: each package's `LICENSE` file starts with the font's copyright line and then holds the whole SIL Open Font License 1.1. To repeat the check: `npm pack @fontsource-variable/fredoka @fontsource-variable/nunito @fontsource/caveat`, unpack, and compare the sha256 of each `files/*.woff2` with the file in `assets/fonts/`. All four match. None of the three names a "Reserved Font Name", so the files may be used as they are.

## How the icons were matched

For every drawing called `i-...` in `index.html`, the numbers of its paths were compared with every icon in the Feather and Lucide packages. These match their source:

| Drawing | Source icon | Match |
|---|---|---|
| `i-phone` | Feather `phone` | the same path |
| `i-facebook` | Feather `facebook` | the same path |
| `i-clock` | Lucide `clock` | the same drawing |
| `i-mail` | Feather `mail` | the same shapes, one line written as a path |
| `i-pin` | Feather `map-pin` | the same shapes |
| `i-bell` | Feather `bell` | the same shapes, numbers rounded |
| `i-calendar` | Feather `calendar` | the same shapes, lines joined |
| `i-instagram` | Feather `instagram` | the same shapes |
| `i-external` | Lucide `external-link` | the same paths, a thicker line |
| `i-info` | Lucide `info` | the same shapes |
| `i-cash` | Lucide `banknote` | the same shapes, a bigger circle |
| `i-leaf` | Lucide `leaf` | the same first path |

The other drawings (an arrow, the menu bars, a cross, a tick, a chevron, a star, the drink and the no-dogs sign) are plain shapes in the same line style. They are covered by the same two licence files, to be safe.

## What the farm should keep

- The files `assets/fonts/LICENSE-OFL-Fredoka.txt`, `assets/fonts/LICENSE-OFL-Nunito.txt`, `assets/fonts/LICENSE-OFL-Caveat.txt`, `assets/LICENSE-icons-Feather-MIT.txt`, `assets/LICENSE-icons-Lucide-ISC.txt` and `assets/CREDITS.txt`. Upload them with the site. Do not shorten them: they are legal texts.
- The three small links under every Drive time answer ("© OpenStreetMap contributors", "Routing: OSRM", "Fix the map").
- If the farm changes a font, an icon or a map service, ask Claude to update this table and the licence files in the same change.

## What could not be checked

- **Who took the photos, and who drew the logo and the scene.** Only the farm knows. Question 56 and the owner question about the logo and the drawings.
- **Whether tracing the land from the aerial picture is allowed (L8).** Google's terms were not opened. The owner question gives the options.
- **The two routing and search services' current rules.** They were summed up from their own pages on an earlier day (`docs/LAUNCH_CHECKLIST.md`, section 3.13). Check them again before launch.
- **The licences of the two small routines (L5, L6).** Stated from what their authors publish; the pages were not opened.
