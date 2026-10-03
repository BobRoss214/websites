# Search and sharing check (3 October 2026)

**Result: no errors.** The six pages, the sitemap, robots.txt, the share pictures and the structured data (JSON-LD) are valid. Nothing in the pages was changed by this check. Below are warnings, ideas and questions for the owner, and a picture of what search engines and share cards read. `node tests/run-all.mjs seo` pins what can be pinned (no browser, about a second).

## How it was checked

- Head tags, sitemap and robots.txt: `tests/seo.test.mjs` reads the files. Each of its checks was also tried on a deliberately broken copy of the pages (a wrong canonical, a short description, a wrong picture size, a rating added, an Event in the past, a missing sitemap page, a question not on the page, and more) and failed as it should.
- Structured data: every block was parsed, expanded with the `jsonld` library, and type-checked against the schema.org vocabulary with `schema-dts` and TypeScript. A misspelt property (`telephon`) fails that check; the real blocks pass. Google's own rich-result rules were applied from memory: their documentation could not be opened from here.
- The six share pictures were looked at one by one (see the table).
- To repeat the structured-data check: in an empty folder run `npm install jsonld schema-dts typescript`, write each block into a `.ts` file as `const d: Graph = {...}` (the home page's block as `WithContext<LocalBusiness>`), and run `tsc --noEmit`.

## The six pages

Title and description lengths are letters; search results show about 50 to 60 and 120 to 160. Every title and description is different, every page has one h1, one canonical address (the site's own) and `lang="en"`. Every share picture is a PNG of 1200 x 630 pixels, under 300 KB (WhatsApp skips bigger ones), with a description of it.

| Page | Title | Description | Share picture | og:title |
| --- | --- | --- | --- | --- |
| Home page | 57 | 141 | og-share.png (208 KB) | Wise Acres Organic Farm | Indian Trail, NC |
| First visit | 59 | 135 | og-first-visit.png (178 KB) | First Visit to Wise Acres | U-Pick Farm in Indian Trail, NC |
| Pumpkin patch | 59 | 144 | og-pumpkin-patch.png (222 KB) | Pumpkin Patch in Indian Trail, NC | Wise Acres Organic Farm |
| School field trips | 58 | 144 | og-school-field-trips.png (185 KB) | School Field Trips | Wise Acres Organic Farm, Indian Trail |
| Strawberry picking | 60 | 140 | og-strawberry-picking.png (206 KB) | U-Pick Organic Strawberries in Indian Trail, NC | Wise Acres |
| Wise Pie | 61 | 151 | og-wise-pie.png (112 KB) | Wood-Fired Pizza in Indian Trail, NC | Wise Pie at Wise Acres |

`404.html` and the four pages in `print/` are marked noindex. `sitemap.xml` lists exactly the six pages at their canonical addresses (no `lastmod`, which is fine: Google only uses it when it is always right). `robots.txt` names the sitemap and blocks none of its pages.

## Warnings and ideas (nothing is wrong enough to change)

| # | What | Where | Question or choice |
| --- | --- | --- | --- |
| W1 | The title of the Wise Pie page is 61 letters, one more than the others' longest (60). Search results may cut the end ("at Wise Acres"). | pages/wise-pie.html, line `title:` in its settings block | Words, so the owner decides. Shorter versions: "Wood-Fired Pizza in Indian Trail, NC \| Wise Pie" (47) or "Wise Pie Wood-Fired Pizza \| Wise Acres, Indian Trail, NC" (56). |
| W2 | Each extra page's WebPage says it is part of the LocalBusiness on the home page. schema.org expects a WebSite (or another page) there. Validators accept it. | JSON-LD path `@graph[0].isPartOf` in the 5 extra pages | Optional: give the home page a WebSite node with its own id and point `isPartOf` at it (tools/pages.py and the home page). |
| W3 | Two of the four `sameAs` addresses are the Instagram accounts of The GreenHouse and Wise Pie. `sameAs` lists the business's own profiles; these are sister accounts. | JSON-LD path `sameAs[2]` and `sameAs[3]` in index.html | Keep, or move them to separate nodes for The GreenHouse and Wise Pie. |
| W4 | Google lists these for a local business but they are not required: `telephone`, `openingHoursSpecification`, `geo`, `priceRange`, `logo`. | JSON-LD block of index.html | Each is a fact the owner must confirm and then keep in step with the page. The page shows no main phone number, and the hours change by season, so none was added. |
| W5 | FAQ markup is valid and matches the visible questions on the 5 extra pages. Since August 2023 Google shows FAQ rich results only for well-known government and health sites, so none should be expected. | JSON-LD path `@graph[1]` in the 5 extra pages | None. It is harmless and helps search engines read the page. |
| W6 | A date and prices in structured data go stale: the answer says "For fall 2026" with $3, $4.50 and $4. | JSON-LD path `@graph[1].mainEntity[3].acceptedAnswer.text` in pumpkin-patch.html | tools/pages.py builds it from the visible FAQ: change the question's answer in pages/pumpkin-patch.html and run `python3 tools/pages.py`. Visible headings with "2026" ("Fall 2026 prices", "Fall Menu 2026", "Fall 2026 special days") go stale on the same day. |
| W7 | No Event markup. Home School Day (3 November 2026), Exceptional Children Day and private parties are shown as text. | pages/school-field-trips.html and index.html | Optional. An Event needs a name, a start date, and a place with an address; it must be removed after the day. `tests/seo.test.mjs` already checks any Event for these and for a date in the past. |
| W8 | The home page's share picture shows a fall scene (pumpkins, tractor and wagon) all year. Its words are right and have no season or price. | assets/og-share.png | Owner's choice. |
| W9 | robots.txt blocks `/print/` and the print pages also say noindex. A page a search engine may not fetch cannot show its noindex, so it could be listed by its address if someone links to it. Nothing public links to print/. | robots.txt and print/*.html | None, low risk. |
| W10 | Home page headings: "Concessions & Local Goods" appears twice, and two other pairs read alike ("Playground & Goats" and "Playgrounds", "Wagon Ride & Barrel Train" and "Wagon, Corn Pit & Barrel Train"). For a reader who jumps from heading to heading they sound the same. | index.html | Words, so the owner decides. |

## What a search engine sees for a visitor in another language

The pages are English in the HTML. The visitor's language is chosen in the browser by a script (`?lang=` in the address, or the choice stored in the browser), so a search engine, WhatsApp, iMessage and Facebook, which read the HTML and do not pick a language, always get English: English title, English description, English share text, `lang="en"`, one address per page, no hreflang and no `og:locale:alternate` (the test fails if one is added without a per-language address). What that costs:

- A person who searches in Spanish, Hindi, Chinese or Vietnamese can find the pages only through English words or the farm's name; the result shows English.
- A link shared in a family chat shows English, even if the sender had the page in Hindi.
- The translations are still useful to every visitor who arrives, and to the screen readers: they just do not help the search results.
- A real fix is a separate address for each language (for example a folder per language) with hreflang tags and its own title and description. That is a large change; it is the owner's choice.

## Share previews as text

**Home page** (https://www.wiseacresorganic.com/)
- Picture: og-share.png, the farm logo and the words "Organic u-pick fun for the whole family" (checked by eye)
- Title: Wise Acres Organic Farm | Indian Trail, NC
- Text: U-pick organic strawberries, blueberries, sunflowers and pumpkins. Wood-fired pizza. School tours, parties and events. Family owned since 2013.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

**First visit** (https://www.wiseacresorganic.com/first-visit.html)
- Picture: og-first-visit.png, the farm logo and the words "Your first visit to Wise Acres" (checked by eye)
- Title: First Visit to Wise Acres | U-Pick Farm in Indian Trail, NC
- Text: Plan your first visit to Wise Acres in Indian Trail, NC: reservations, check-in, what to bring, bathrooms, payment and the rain policy.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

**Pumpkin patch** (https://www.wiseacresorganic.com/pumpkin-patch.html)
- Picture: og-pumpkin-patch.png, the farm logo and the words "Pumpkin patch at Wise Acres" (checked by eye)
- Title: Pumpkin Patch in Indian Trail, NC | Wise Acres Organic Farm
- Text: Pick pumpkins at Wise Acres, a USDA Certified Organic farm in Indian Trail, NC. Wagon rides, corn pit and a flower field. Reservations required.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

**School field trips** (https://www.wiseacresorganic.com/school-field-trips.html)
- Picture: og-school-field-trips.png, the farm logo and the words "School field trips to an organic farm" (checked by eye)
- Title: School Field Trips | Wise Acres Organic Farm, Indian Trail
- Text: Fall school tours at Wise Acres Organic Farm in Indian Trail, NC for preschool and elementary students. $11 per student, hands-on farm learning.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

**Strawberry picking** (https://www.wiseacresorganic.com/strawberry-picking.html)
- Picture: og-strawberry-picking.png, the farm logo and the words "U-pick organic strawberries" (checked by eye)
- Title: U-Pick Organic Strawberries in Indian Trail, NC | Wise Acres
- Text: U-pick USDA Certified Organic strawberries at Wise Acres in Indian Trail, NC. Season usually mid-April to early June. Reservations required.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

**Wise Pie** (https://www.wiseacresorganic.com/wise-pie.html)
- Picture: og-wise-pie.png, the farm logo and the words "Real pizza from a 700-degree oven" (checked by eye)
- Title: Wood-Fired Pizza in Indian Trail, NC | Wise Pie at Wise Acres
- Text: Wise Pie wood-fired pizza from a 700-degree oven at The GreenHouse in Indian Trail, NC. Get it Friday to Sunday, 4 to 8 pm, or with a farm reservation.
- Facebook and WhatsApp show the picture, the address (wiseacresorganic.com), the title and the start of the text (long text is cut after a line or two); iMessage shows the picture, the title and the address.

## Headings

Every page has one h1 and no skipped levels (`node tests/run-all.mjs validity`). The home page has a second h1 variant for winter, marked hidden, so a reader and a search engine see one. All in-page links (`#visit` and the rest) and all `index.html#...` links on the other pages point at an id that exists.
