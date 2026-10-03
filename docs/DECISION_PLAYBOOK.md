# Decision playbook

What to change when the farm owner answers one of the open questions on the dashboard: d01 to d42 and the 14 new ones d46 to d59 (see "Dashboard ids and doc question numbers").
Written on 3 October 2026 for commit b54427b, extended for e02b95e. Nothing here decides anything for the owner, and no optional patch has been applied.
d43 to d45 (added later on the dashboard) have no entry here yet.

## How to use it

1. Find the question by its number (d01 to d59) or in the topic list below.
2. Read the option she chose. It lists the files and the exact setting or text, how many strings must be written in the four translations, and which tests may need an update.
3. Make the change. Rebuild and test as in "The standard steps".
4. If the entry names a patch, apply it only after her answer. Patches are listed in "Patches on disk".
5. Delete the matching row in the README table "Content status" when a question is closed.

Entries d01 to d42 cite line numbers of commit b54427b. Entries d46 to d59 cite e02b95e directly.
Where a file has changed since the old list in QUESTIONS_FOR_THE_FARM.md, use the line numbers here, not the ones in that file.

Commit e02b95e also holds the messages feature (f45d6d9), which moved lines, and the plain-English rewrite (7d917e6), which changed the wording and the ids of 77 sentences. For the entries d01 to d42, add these numbers to the b54427b lines cited:

| File | Lines in b54427b | Add for e02b95e |
|---|---|---|
| index.html | 1 to 307 | 0 |
| index.html | 308 to 2112 | +1 |
| index.html | 2113 and later | +2 |
| js/content.js | 1 to 101 | 0 |
| js/content.js | 102 to 130 | +2 |
| js/content.js | 131 and later | +5 |
| js/features.js | 1 to 23 | 0 |
| js/features.js | 129 to 510 | +12 (+13 from 511, +20 from 526, +22 from 532, +28 from 604) |
| js/features.js | 630 to 826 | +29 |
| js/features.js | 827 and later | +44 |
| README.md | 1 to 137 | 0 |
| README.md | 138 to 163 | +2 |
| README.md | 164 to 175 | +3 |
| README.md | 176 to 314 | +10 |
| README.md | 315 and later | +12 |
| tests/consistency.test.mjs | 1 to 411 | 0 |
| tests/consistency.test.mjs | 412 and later | +1 |

The commit after e02b95e (66c8272, layout jumps) shifts the e02b95e numbers again: index.html +1 from line 39, js/features.js -14 from line 259. Other cited files are not moved by it.

Other files keep their line numbers. If a line looks wrong by a few, or an id is not in lang/en.json (the plain-English rewrite renamed some), search for the quoted text instead.
"Strings" counts English sentences or words whose id changes. Each needs 4 translations (es, hi, zh, vi) in lang/src/<code>.json.
"scratchpad/" means /tmp/claude-0/-home-user-websites/0370289f-5c48-5314-b3f5-bb8be7afd39d/scratchpad/ on the helper's computer. Those files are outside the repo.

## The standard steps

After a change to index.html, pages/*.html, js/*.js, lang/src/*.json or tools/qr_links.json:

```
python3 tools/pages.py
python3 tools/i18n.py extract
python3 tools/i18n.py jsstrings
python3 tools/i18n.py build
python3 tools/i18n.py missing es     # also hi, zh, vi: each must say 0 missing
python3 tools/make_qr.py             # only after tools/qr_links.json changed
python3 tools/farm_map.py tools/saved-map.json   # only after a new saved map
```

Changing an English sentence changes its id (data-t). The old translations no longer match and show as missing.
Add the 4 new translations, rebuild, and the check above must say 0 missing.
How to find the texts to translate (`python3 tools/i18n.py missing es --list`) and where to put them is in the README, "Change one sentence and its translations, step by step".

Tests (needs Playwright; see tests/README.md). One word picks every test whose name contains it:

```
node tests/run-all.mjs consistency dated farm-seasons hero live
node tests/run-all.mjs --list        # all test names
```

Test names: public-site, pipeline, consistency, live, dated, drive, pause, gallery, analytics, print-qr, farm-seasons, npc, i18n, i18n-early, languages, axe, map, features, hero.
Always run consistency after a change to a price, time, day, age, size, phone number or address. It reads every page in all five languages.

Apply a patch from the repo root, then rebuild:

```
patch -p1 --dry-run < scratchpad/agents/<folder>/<file>.patch    # a line "checking file ..." per file and no word FAILED = it applies
patch -p1 < scratchpad/agents/<folder>/<file>.patch
```

## The 10 topics, most urgent first

| # | Topic | Urgency | Questions |
|---|---|---|---|
| 1 | Put the site online | blocks launch | d05, d30, d38, d15 |
| 2 | Wrong links and placeholder content | blocks launch | d02, d03, d46, d47, d04, d54, d06 |
| 3 | People and photos (permission) | blocks launch | d13, d31, d32, d33, d12, d34 |
| 4 | Pizza and food facts | wrong or risky information | d17, d16, d18, d19, d20, d21, d22, d49, d53, d08, d57 |
| 5 | Dates, seasons and winter | wrong or risky information | d01, d09, d23, d50, d51, d24, d25, d26, d27 |
| 6 | Rules and promises to visitors | wrong or risky information | d41, d42, d52, d55, d35, d36 |
| 7 | Names, address and listings | wrong or risky information | d07, d28, d29, d39, d40 |
| 10 | What the site says the farm offers | wrong or risky information | d48, d56, d58, d59 |
| 8 | Drive time box and map tools | nice to have | d10, d11, d14 |
| 9 | Translations | nice to have | d37 |

Urgency: "blocks launch" = answer before the site goes public. "wrong or risky information" = the site says something that may be false or unsafe. "nice to have" = can follow launch.
Inside a topic every question has its own urgency (1, 2 or 3 in the heading). The line "Checklist says" in each entry repeats what docs/LAUNCH_CHECKLIST.md section 4 says about the matching old question.

## Which answers change other answers

| Answer | Changes | Why |
|---|---|---|
| d05 host | d30, d15, page-address style, cache time, d10 option C | Cloudflare Pages and Netlify read _headers and _redirects. GitHub Pages reads neither. Only Cloudflare redirects /x.html to /x, which is the reason for the clean-URL patch OPT-C. A header line (d15) needs a host that sets headers. |
| d38 web address | share cards, QR signs, sitemap, structured data, d10 option C, d30 | One setting (tools/pages.py SITE) plus the home page tags and tools/qr_links.json "site". A new address after launch means new link previews: a changed picture needs a new file name (checklist 3.11). Old-address redirects only make sense if the new site takes over the old address. |
| d30 redirects | d05 (which patch), d38 | OPT-A needs _redirects (Cloudflare, Netlify). OPT-B (13 small redirect pages) is for hosts without it. |
| d15 header | d10, d05, analytics, Mailchimp | The line names the two map services (connect-src). Switch it on last, after d10 is final. |
| d01 winter, d24, d25, d27, d23, d09 | each other | d24 option B is the same patch as d01 option A. d25 (Reserve window) and d27 (school banner) use the same data-only switch. d23 (fall end date) decides the November gap and overlaps winter if fall ends Nov 30. d09 (GreenHouse hours) is the same code change as d08 (Thursday). Christmas trees are sold at The GreenHouse. |
| d16 $31 package | tests/consistency.test.mjs, d17, d20, d21, d19 | The price and the sentence "Includes 2 Wise Pie pizzas, plus $3 per person" are pinned in 3 places and 5 languages. Extras (+$9, +$3) and the pizza card (index.html:432-434) are shared with d17, d20 and d21. |
| d18 oven | share picture og-wise-pie.png, tests, d37 | The heading is drawn into assets/og-wise-pie.png. consistency pins "N-degree oven" (:153) and the Celsius figure in Chinese (:400). |
| d17 allergen, d41, d42, d19 | d37 | Sentences about allergies, refunds and drinks should be read by a native speaker in each language. |
| d39 Rd or Road | d40, d11, tests | The listing (d40) shows which spelling is "right". consistency and drive pin "Rd". The QR directions sign carries the address. |
| d04 phone | tests/consistency.test.mjs | The phone test expects exactly ONE number on all pages. The day-of number already counts. |
| d06, d28, d29 | tests/print-qr.test.mjs | The QR sign test needs at least 9 signs: 9 now (no review sign), 10 with a review link, 8 without the hashtag sign. |
| d31, d13, d32, d12, d33 | each other | Removing a photo removes it from d12 (do not ask for the original), d33 and d34. d13 and d32 name the same four photos. |
| d10, d11, d15 | each other | farmPoint (d11) halves the requests to the free service. A Mapbox switch (d10 C) changes the header line (d15) and 5 docs. |
| d46 booking page, d47 pre-order page | tests/consistency.test.mjs, QR signs, calendar files | One booking page and one pre-order page are pinned on every page (:349-350) and in the QR signs (:446). A new address changes 29 and 6 places. |
| d48 haunted trail and tomatoes | d13, d32, d14, tests | A removal also removes the map mark, the tomato price-sign photo and the tests that look for "Haunted" in fall (farm-seasons:36) and the tomato prices (consistency:108-109). |
| d50 tree dates, d51 hours | d01, d09, tests | Tree season words and hours are read from js/season.js and js/content.js by the facts test (:284-317, :118-138). |
| d52 Cathy's email | d55, d03, messages tests | The accessibility card and the waitlist/messages feature name this address. |
| d53 pre-order timing, d57 eat there | each other | They share the sentence index.html:1142 (id t60509a07). |
| d02, d36, d03 | each other | Groups prices, school tour rules and the sign-up form are all on the School tours and Groups tabs. |

## Tests that can need an update

| Test and line | Pins | Touched by |
|---|---|---|
| consistency :325-326 | exactly one phone number | d04 |
| consistency :338 | streetAddress is "4701 Hartis Rd"; 4701 goes with Hartis, 5503 with Poplin | d39, d40 |
| consistency :100-106 | base price $31, per-person prices, regex "Includes N Wise Pie pizzas, plus $N per person" (:103, :134) | d16 |
| consistency :114 | refund fee 3% (at least 3 places) | d41 |
| consistency :118-137 | GreenHouse hours and days (text and js/content.js) | d08, d09, d51 |
| consistency :144-145 | Up to N guests (2 places), minimum N students (4 places) | d02, d36 |
| consistency :148-153 | pizza size, serves, ready time, pre-order days, oven degrees | d18, d20, d21, d53, d57 |
| consistency :157 | the year of the fall prices (9 places) | d24 |
| consistency :212 | pets stay home, service animals welcome (8 places) | d42 |
| consistency :314 | season words from js/season.js ("Mid-September through early November") | d23 |
| consistency :400 | ALLOWED_EXTRA: Celsius 370 beside "700-degree" | d18, d37 |
| dated (whole file) | the 2026 pizza rows, special days, "No pizza" block until Nov 30, Nov 8/9, Dec 1 | d23, d24 |
| farm-seasons :36 | /Maze/ in fall text only | d07 |
| print-qr :13 | at least 9 signs | d06, d28, d29 |
| public-site | one address everywhere, sitemap, robots, clean-URL checks, extra pages | d05, d30, d38 |
| drive (whole file) | the two map services are mocked by host name; "Rd" in labels (:234, :263, :353, :361) | d10, d39 |
| features :77 | flowers in season in the auto "This week" box | d26 |
| gallery | photo count (at least 5) and tags | d13, d31, d32 |
| consistency :108-109 | tomato price per pound and basil per stem (5 places each) | d48 |
| consistency :226-230 | the pizza price range is the cheapest and dearest of the nine menu prices | d47 |
| consistency :284-286, :317 | tree season words ("Friday after Thanksgiving to early December") against js/season.js | d50 |
| consistency :349-350, :446 | one booking page, one pre-order page, one signup address; the three QR signs use them | d46, d47 |
| farm-seasons :36-37 | "Haunted" and /Maze/ only in fall; "Christmas" only in winter | d07, d48, d50 |
| features :171 | exactly two Axios links in the press list | d56 |
| messages :82, :116, :120 | the waitlist mailto goes to cathy@wiseacresorganic.com | d52 |
| i18n, languages | every id has 4 translations; plain checks of each language | any change of English text |

## Patches on disk

Nothing has been applied. All were dry-run on e02b95e (the winter patches were rebased for it).

| Patch | For | Status |
|---|---|---|
| scratchpad/agents/gap/patches/winter-A-on-e02b95e.patch | d01 A, d24 B | Applies to e02b95e. Rebuilt (0 missing) and tested: consistency, dated, farm-seasons, hero, live, messages. |
| scratchpad/agents/gap/patches/winter-B-on-e02b95e.patch | d01 B | Applies to e02b95e. Rebuilt (0 missing) and tested like A. |
| scratchpad/agents/playbook/patches/winter-A-on-b54427b.patch, scratchpad/agents/playbook/patches/winter-B-on-b54427b.patch | d01 (old) | Do not apply on e02b95e: the translation files and three sentences changed in the plain-English rewrite. |
| scratchpad/agents/winter/winter-A.patch | d01 A (old) | Does not apply to b54427b (2 hunks fail). Use the "on-b54427b" copy. |
| scratchpad/agents/winter/winter-C.patch | d01 C (old) | Stale: the tree wording is already in-season-only in the code (commit e081393). Do not apply. |
| scratchpad/agents/leftovers/reserve-window-OPTIONAL-ff5965d.patch | d25 A | Applies. Hides spring Reserve buttons outside the booking window. Not re-run in this job. |
| scratchpad/agents/launch2/opt/OPT-A-redirects-file.patch | d30 A, d05 A/B | Applies. Adds _redirects (22 lines) for Cloudflare Pages and Netlify. |
| scratchpad/agents/launch2/opt/OPT-B-redirect-pages.patch | d30 A, d05 C | Applies. 13 small redirect pages, for hosts with no _redirects. |
| scratchpad/agents/launch2/opt/OPT-C-clean-urls.patch | d05 A | Applies to e02b95e. On 66c8272 one hunk in each generated page fails (those lines changed): apply with patch -f, delete the .rej files, run python3 tools/pages.py (tested: canonical tags lose .html, public-site passes). Page addresses without .html: tools/pages.py, 5 pages, sitemap, public-site test, README, checklist. |
| scratchpad/agents/seo-audit/patches/2-OPTIONAL-cloudflare-no-html-addresses.patch | d05 A | Applies. The small version of OPT-C: tools/pages.py only, then rebuild. The public-site test then needs the OPT-C edit. Prefer OPT-C. |
| scratchpad/agents/launch2/opt/OPT-D-shorter-code-cache.patch | d05 (any host) | Applies. css, js and lang cached 5 minutes instead of 1 hour. |
| scratchpad/agents/launch2/opt/MAPPING-for-owner.txt | d30 | Old address to new page table. /summer/ and /posts/ left out on purpose (launch decision D3). |
| scratchpad/agents/es/out/es-OPTIONAL-clock-12h.patch, scratchpad/agents/vi/out/vi-OPTIONAL-clock-words.patch | d37 | Stale: do not apply on b54427b or HEAD. Ask for a redo. |

The patches zh-C, es-C, vi-C and hi-C (translation decisions) and the photo, share-image and checklist patches are already merged.

## Dashboard ids and doc question numbers

The doc is docs/QUESTIONS_FOR_THE_FARM.md (and .es.md, same 54 numbers). Each question there now has a "Dashboard id" line under the question.
Rule used to close the gap between the two lists: a doc question becomes a dashboard question only if it is an owner decision or a fact only she has, and nothing in the repo or on the live pages answers it already. Otherwise it is dropped (with the reason) or put on a later list. The public sites of the farm could not be opened from the test computer.

### Every doc question, and where it went

| Doc | Dashboard | What happened |
|---|---|---|
| Q1 | d02 | asked |
| Q2 | d03 | asked |
| Q3 | d04 | asked |
| Q4 | d08 | asked |
| Q5 | d48 | asked |
| Q6 | d48 | asked |
| Q7 | d48, d32 (the tomato price-sign photo) | asked |
| Q8 | none | dropped: The site already says "more than a dozen tomato varieties" (README row "Tomatoes & basil"). A safe default; ask only if she wants a number. |
| Q9 | none | later (ask with d48): The sentence is part of the tomato text she asked for (index.html:1013, id t1cb33277). Ask only if the farm manager objects. |
| Q10 | none | dropped: The scavenger hunt was taken off the site on 1 October (commit 2b09373). If she wants it back, the doc notes say where it was. |
| Q11 | d07 | asked |
| Q12 | d50, d01 | asked |
| Q13 | none | dropped: The site says "mid- to late June through early July", her own old page says "June - early July" and js/season.js uses June 15 to July 10. Same meaning. |
| Q14 | d59 | asked |
| Q15 | d58 | asked |
| Q16 | none | later (ask with d14): A task in the Farm Map Marker, not a choice. Until then the wagon route bends along the edge of the map. |
| Q17 | d51, d09 | asked |
| Q18 | none | dropped: The nine pizzas and their prices were copied from her printed menu and match it in all five languages (README row "Wise Pie facts", checked 3 October). Only the Square page can differ: that is d47. |
| Q19 | d54, d19 | asked |
| Q20 | none | dropped: It is the farm's own FAQ wording, added from her pasted content on 30 September (commit ccd629c, "the full FAQ"; index.html:1914). She published that claim herself. |
| Q21 | none | dropped: The waitlist button only shows when she marks a day "full" in js/content.js, and the "Spots left" box is hidden until the week is filled in. The README already says not to use "full" unless someone answers. Ask when she starts the weekly box. |
| Q22 | d46 | asked |
| Q23 | d47 | asked |
| Q24 | d28 | asked |
| Q25 | none | later (ask with d29): The hashtag lines are index.html:1476, 1854 and 1872. Ask with the hashtag sign. |
| Q26 | none | later: The plain "Join the email list" button works today. The form needs her Mailchimp account. The checklist says it can follow launch. |
| Q27 | d06 | asked |
| Q28 | d56 | asked |
| Q29 | d55 | asked |
| Q30 | d52 | asked |
| Q31 | d55 | asked |
| Q32 | none | later (ask with d10, d11): The page already says "Rough times with light traffic" and the Drive time box shows the real time from the visitor's address. |
| Q33 | none | later: The quote cards stay hidden until she sends real quotes. The Google, Tripadvisor and Yelp buttons are there. |
| Q34 | none | later (ask with d35): Same page and same place as d35: suggest adding "a photo of the gate" to its answer. |
| Q35 | d11 | asked |
| Q36 | d10 | asked |
| Q37 | d01, d09 | asked |
| Q38 | d12 | asked |
| Q39 | d31, d33 | asked |
| Q40 | d13, d32 | asked |
| Q41 | none | later: Depends on the sign-up form (old Q26). Ask after it. |
| Q42 | d35 | asked |
| Q43 | none | later (ask with d10): Part of d10. The page already shows a notice about the address and docs/WHAT_THE_SITE_STORES.md lists what is sent. |
| Q44 | d16 | asked |
| Q45 | d17 | asked |
| Q46 | d49, d17 | asked |
| Q47 | d18 | asked |
| Q48 | d47 | asked |
| Q49 | d53 | asked |
| Q50 | d20 | asked |
| Q51 | d21 | asked |
| Q52 | d22 | asked |
| Q53 | d19 | asked |
| Q54 | d57 | asked |

Doc questions that are on the dashboard in more than one card: Q37 (d01, d09, d50), Q39 (d31, d33, d13), Q40 (d13, d32). Merged into one card: Q5, Q6 and Q7 (d48); Q23 and Q48 (d47); Q29 and Q31 (d55).

### Every dashboard question, and its doc number

| Dashboard | Title | Doc |
|---|---|---|
| d01 | What visitors see in winter | Q37 (also Q12) |
| d02 | Prices for company events | Q1 |
| d03 | School tour form link | Q2 |
| d04 | Main phone number | Q3 |
| d05 | Where to put the website online | none |
| d06 | Google review link | Q27 |
| d07 | Name of the maze | Q11 |
| d08 | Thai night | Q4 |
| d09 | The GreenHouse winter hours | Q37 (also Q17) |
| d10 | Free routing server behind Drive time | Q36 (also Q43) |
| d11 | The farm's exact spot on the map | Q35 |
| d12 | Photo originals | Q38 |
| d13 | Photos with words or people | Q40 (also Q39) |
| d14 | Try the Farm Map Marker swipe on a real phone | none |
| d15 | Security header for the new host | none |
| d16 | The $31 pizza package | Q44 |
| d17 | Allergen note on the pizza page | Q45 (also Q46) |
| d18 | Oven temperature on the site | Q47 |
| d19 | Drinks and ice cream at The GreenHouse | Q53 (also Q19) |
| d20 | Pizza ready time | Q50 |
| d21 | Pizza size | Q51 |
| d22 | Mozzarella wording | Q52 |
| d23 | Is the farm open after November 8? | none |
| d24 | Fall 2027 prices, schedule and menu | none |
| d25 | Reserve buttons when nothing can be booked | none |
| d26 | When are cut flowers available? | none |
| d27 | School tours banner | none |
| d28 | Which Facebook page is the real one | Q24 |
| d29 | Instagram hashtag sign | related: Q25 |
| d30 | Keep the old farm web addresses working | none |
| d31 | People's faces in three photos | Q39 |
| d32 | Photos that have dated words on them | Q40 (also Q7/7) |
| d33 | What animal is wearing the frog hat | Q39 |
| d34 | Sunflower photos in the Fall section | none |
| d35 | Parking and entrance | Q42 (also Q34) |
| d36 | School tours for smaller classes | none |
| d37 | Native speakers for the translations | none |
| d38 | Which web address will the site live on | none |
| d39 | How your address is written | none |
| d40 | Does The GreenHouse have its own Google listing | none |
| d41 | Cancel fee on the strawberry page | none |
| d42 | Service animals | none |
| d46 | Is this the right booking page? | Q22 |
| d47 | Is the pizza pre-order page right? | Q23, Q48 |
| d48 | Haunted trail and u-pick tomatoes this fall | Q5, Q6, Q7 |
| d49 | Does The Dill Pickle pizza have cheese? | Q46 |
| d50 | Christmas tree dates at The GreenHouse | Q12 (also Q37) |
| d51 | Are the fall opening hours right? | Q17 |
| d52 | Does Cathy's email get answered? | Q30 |
| d53 | When and where is the pre-order link posted? | Q49 |
| d54 | Prices for pumpkins, berries, flowers and trees | Q19 |
| d55 | Strollers, wheelchairs and farm paths | Q29, Q31 |
| d56 | Two Axios news links | Q28 |
| d57 | Can people sit and eat at The GreenHouse? | Q54 |
| d58 | Snacks and drinks in spring and summer? | Q15 |
| d59 | Do you still run summer programs? | Q14 |

### Dashboard questions with no number in the doc

| Question | Title |
|---|---|
| d05 | Where to put the website online |
| d14 | Try the Farm Map Marker swipe on a real phone |
| d15 | Security header for the new host |
| d23 | Is the farm open after November 8? |
| d24 | Fall 2027 prices, schedule and menu |
| d25 | Reserve buttons when nothing can be booked |
| d26 | When are cut flowers available? |
| d27 | School tours banner |
| d29 | Instagram hashtag sign |
| d30 | Keep the old farm web addresses working |
| d34 | Sunflower photos in the Fall section |
| d36 | School tours for smaller classes |
| d37 | Native speakers for the translations |
| d38 | Which web address will the site live on |
| d39 | How your address is written |
| d40 | Does The GreenHouse have its own Google listing |
| d41 | Cancel fee on the strawberry page |
| d42 | Service animals |

Only a note exists for d37 (the doc has a "Translation notes" section, but no question). d29 is the printed sign for the hashtag asked in Q25. d43 to d45 (farm words, the corn pit offer, free entry for ages 2 and under) were added to the dashboard later and have no doc number and no entry here.

## Topic 1. Put the site online

Urgency: blocks launch.
Nothing can go live until the host and the web address are chosen. The files already assume Cloudflare Pages and https://www.wiseacresorganic.com/.

### d05. Where to put the website online

- In plain words: Which company keeps the site files and serves them to visitors.
- Doc question: none (not in the doc; launch checklist section 1, steps 3.1 to 3.7, D1 and D10)
- Urgency: 1 (blocks launch). Checklist says: launch decisions D1, D10.
- Owner fact (no sensible default): no
- Default: A. Free, static traffic unlimited, headers and redirects tested on its own test server (checklist section 1).
- Depends on: d30 (which redirect patch), d15 (headers need a host that sets them), d38 (domain and DNS), page-address style (OPT-C only on Cloudflare), cache time (OPT-D).

**A. Cloudflare Pages**

- No site file changes to host it: upload the folder without docs/, tests/, tools/, pages/, README.md (checklist section 2).
- Clean page addresses (no .html): apply scratchpad/agents/launch2/opt/OPT-C-clean-urls.patch (tools/pages.py PAGE_EXT = '', 5 generated pages, sitemap.xml, tests/public-site.test.mjs, README and checklist wording). Do this before submitting the sitemap (checklist 3.7).
- Old addresses: d30 option A with scratchpad/agents/launch2/opt/OPT-A-redirects-file.patch (a _redirects file).
- _headers already works there (4 security notes and the cache rules). Content-Security-Policy: see d15.
- Optional, any host: scratchpad/agents/launch2/opt/OPT-D-shorter-code-cache.patch (css/js/lang cached 5 minutes instead of 1 hour: _headers, js/content.js text, README, checklist).
- Strings: 0
- Tests: public-site (after OPT-C)
- Patch: scratchpad/agents/launch2/opt/OPT-C-clean-urls.patch

**B. Netlify**

- No site file changes to host it. Keep page addresses with .html (the current state): do NOT apply OPT-C. Leave Netlify "Pretty URLs" off.
- Old addresses: d30 option A with scratchpad/agents/launch2/opt/OPT-A-redirects-file.patch (Netlify reads _redirects).
- _headers works if it is in the published folder. Content-Security-Policy: see d15.
- Free plan stops the site when its monthly credits run out (checklist section 1: roughly 5,000 first visits a month, an estimate from unopened pages).
- Strings: 0
- Tests: none

**C. Another host**

- Ask the host two things: does it read a _headers file, and does it read a _redirects file?
- Reads both: same as Cloudflare or Netlify (above).
- Reads no _headers: copy the four notes and the cache rules of _headers into the host settings; no Content-Security-Policy possible if it cannot set headers (d15 then = skip).
- Reads no _redirects (GitHub Pages is one): old addresses (d30 option A) use scratchpad/agents/launch2/opt/OPT-B-redirect-pages.patch (13 small redirect pages: about/, contact/, faq/ ...). GitHub Pages also has a business-use rule (checklist section 1, last row).
- Keep .html page addresses unless the host redirects them like Cloudflare does.
- Strings: 0
- Tests: public-site (OPT-B adds plain pages)
- Patch: scratchpad/agents/launch2/opt/OPT-B-redirect-pages.patch

### d30. Keep the old farm web addresses working

- In plain words: Google lists old pages such as /wiseacres, /faq, /food. After launch they would show "page not found".
- Doc question: none (launch checklist 3.6 and D3; the doc has no question for it)
- Urgency: 1 (blocks launch). Checklist says: launch decision D3 (3.6).
- Owner fact (no sensible default): no
- Default: A, only if the new site takes over the address of the current wiseacresorganic.com; use OPT-A on Cloudflare or Netlify.
- Depends on: d05 decides which patch (OPT-A or OPT-B). d38: if the site lives on another address, redirects on the old one are done at the old host, not in these files.

**A. Yes, send old addresses to the new pages**

- Cloudflare Pages or Netlify: apply scratchpad/agents/launch2/opt/OPT-A-redirects-file.patch. It adds _redirects (22 lines, all 301) and notes in README and the checklist.
- Host with no _redirects (GitHub Pages): apply scratchpad/agents/launch2/opt/OPT-B-redirect-pages.patch instead (13 folders with a small redirect page).
- Where each old address goes: scratchpad/agents/launch2/opt/MAPPING-for-owner.txt. /summer/ and /posts/ are left out on purpose (checklist D3: the owner decides what happens to them; today they show 404.html).
- Test after upload: open all 13 old addresses (checklist section 5).
- Strings: 0
- Tests: public-site (OPT-B only: it scans the extra pages)
- Patch: scratchpad/agents/launch2/opt/OPT-A-redirects-file.patch

**B. No, start fresh**

- No change. Old addresses show 404.html (the friendly page) and Google drops them over time.
- Strings: 0
- Tests: none

### d38. Which web address will the site live on

- In plain words: The address that goes into Google, share previews and the printed QR signs.
- Doc question: none (launch checklist D2, README "Putting it online" item 2)
- Urgency: 1 (blocks launch). Checklist says: launch decision D2.
- Owner fact (no sensible default): yes
- Default: A. Everything is written for it, and the www name is what Cloudflare and Netlify recommend.
- Depends on: d05 (DNS and host), d30 (redirects only make sense if the new site takes over the OLD address), d15 (Content-Security-Policy does not name the site), d10 option C (a Mapbox token is limited to this address), share cards and QR signs carry it.

**A. Use www.wiseacresorganic.com**

- No change. Every file already uses https://www.wiseacresorganic.com/.
- Outside the files: DNS record for www (checklist 3.3), Search Console property, Business Profile website field (3.10, 3.12).
- Strings: 0
- Tests: public-site already checks that one address is used everywhere

**B. Use a different address**

- tools/pages.py:29 SITE = 'https://NEW/' (ends with a slash), then rebuild (writes the 5 pages, sitemap.xml, robots.txt).
- index.html: home page tags at lines 12, 13, 14, 21 (canonical, og:url, og:image, twitter:image) and structured data at 43, 46, 48 (@id, url, image). Search and replace the old address.
- tools/qr_links.json:2 "site", then python3 tools/make_qr.py (rewrites print/qr-signs.html and assets/qr/*.svg; reprint the signs).
- README "Putting it online" item 2 and docs/LAUNCH_CHECKLIST.md mention the old address; js/analytics.js:6 is only an example comment (change it only if analytics is switched on).
- Share pictures: after launch a new address means new link previews; a changed picture needs a new file name (checklist 3.11).
- Outside the files: DNS, Search Console, Business Profile, Facebook and Instagram profile links.
- Strings: 0
- Tests: public-site (reads SITE, canonical tags, sitemap, robots.txt, QR file); python3 tools/test_pages.py has 3 fixture lines with the old address

### d15. Security header for the new host

- In plain words: A safety rule that tells browsers where scripts may load from. Written, tested only on a test computer, not switched on.
- Doc question: none (launch checklist 3.5 and section 6)
- Urgency: 3 (nice to have). Checklist says: launch step 3.5.
- Owner fact (no sensible default): no
- Default: A, a few weeks after launch, in Report-Only first (checklist 3.5).
- Depends on: d05 (needs a host that sets headers: not GitHub Pages), d10 (if the Drive time services change, connect-src changes: Mapbox = https://api.mapbox.com), d38 (none: the policy names no site). Analytics or a Mailchimp form change the line.

**A. Turn on after the launch test**

- _headers: under the line "  Permissions-Policy: camera=(), microphone=(), geolocation=()" add the one line given in docs/LAUNCH_CHECKLIST.md 3.5 (374 characters). First as Content-Security-Policy-Report-Only for a trial, then delete "-Report-Only" and upload again.
- Trial: open the 6 pages with F12 console open; any "[Report Only] Refused to ..." goes to Claude. Press Print on /print/qr-signs once.
- Switch on only after the answers that change the policy are final: analytics (not on the dashboard; off by default), Mailchimp form, the Drive time services (d10).
- Strings: 0
- Tests: none (a header test is not in tests/; public-site only checks the files exist)

**B. Skip it**

- No change. The other four security notes stay on. Checklist 3.5 says skipping this at launch is fine.
- Strings: 0
- Tests: none

## Topic 2. Wrong links and placeholder content

Urgency: blocks launch.
A visitor can hit these on day one: a form that asks for a sign-in, made-up prices, a missing phone number, a review button that only opens a map.

### d02. Prices for company events

- In plain words: The $750 and $1,400 on the Groups page are placeholders. The tab carries a "Draft pricing" tag.
- Doc question: Q1
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. The real prices are an owner fact. If they cannot come before launch, B (Custom quote) removes the made-up numbers.
- Depends on: none

**A. Send me the real prices**

- Type the real prices over the two tier-price spans: index.html:1736 ($750, up to 50 guests) and 1737 ($1,400, 51-100 guests). They carry no translation id, so no strings change.
- Delete the draft comment (index.html:1712-1713), the tag line 1714 ("Draft pricing - confirm before publishing", id t10886e34) and class price-card-draft on the price card (about line 1733).
- If the 3-hour block or guest counts change: tier-guests lines 1736-1738, price-note 1740 (id t4048b101).
- README: delete the row "Corporate events prices".
- Strings: 0 for prices; 1 per sentence if the 3-hour rule or guest counts change
- Tests: consistency (fact "Up to N guests" needs 2 places; keep the wording)

**B. Say Custom quote instead**

- Replace the two prices with "Custom quote" (the words already exist, id t1a9346f9, so no new translation). Delete the tag line 1714, the draft comment, the price-note sentence 1740 and class price-card-draft.
- Guest-count lines can stay or go (index.html:1736-1738).
- README: delete the row "Corporate events prices".
- Strings: 0 new (orphan ids t4048b101, t10886e34 can be cleaned: python3 tools/i18n.py orphans)
- Tests: consistency: fact "size: most guests at a private party and at the first corporate package" needs min 2 places; if "Up to 50 guests" goes, lower min to 1 at tests/consistency.test.mjs:144

**C. Remove the Corporate events tab**

- Delete the tab button (index.html:1617-1620), the panel (1707-1747) with its comment, and the sentence "Planning a company event? See corporate events." in the Parties side note (index.html:1702, id t4a984489 changes).
- pages/school-field-trips.html:75: the fact card "Parties & corporate events ... a team day or a picnic?" loses the word corporate (id changes), then rebuild.
- README: delete the row "Corporate events prices". Old translations of the removed block become unused (orphans).
- Strings: about 2 changed sentences x 4 translations (about 18 ids become unused)
- Tests: consistency (lower min of "Up to N guests" to 1 at line 144); hero/farm-seasons not affected

### d03. School tour form link

- In plain words: The sign-up link ends in /edit, the form editor. Teachers may be asked to sign in.
- Doc question: Q2
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A. Try /viewform in a private window first; it needs no owner.
- Depends on: none

**A. Send me the form's viewform link**

- Replace the address ending /edit with the /viewform one (Google Forms: Send, link icon) in 4 places: index.html:1632, pages/school-field-trips.html:15, 49, 115. Then rebuild (the generated school-field-trips.html follows).
- Quick self-test first: the same form id with /viewform instead of /edit, opened in a private window. If it opens with no sign-in, use it.
- Check afterwards in a private window (checklist section 5). Delete the README row "School tour form link".
- Strings: 0 (an address, not words)
- Tests: none

**B. Use a different way to book**

- Another way to book (for example an email to vanessa@wiseacresorganic.com, already used at index.html:1633): change the button href at the same 4 places and the labels "School tour sign-up form" (index.html:1632), "Sign up for a tour" and "Fill out the sign-up form" (pages/school-field-trips.html:15, 49, 115).
- css/extras.css:170-171 prints the link under Google Forms buttons; harmless when the link is not a form.
- Strings: about 3 changed labels x 4 translations
- Tests: none

**C. Leave it**

- No change. Visitors may be asked to sign in or request access.
- Strings: 0
- Tests: none

### d46. Is this the right booking page?

- In plain words: Every Reserve button opens one Bookeo page, and we could not open it. If it is the wrong page, or does not cover visits with and without pizza, visitors cannot book.
- Doc question: Q22
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only she can see what the Bookeo page books. The address came with the farm's own wording (commit ccd629c, "real booking, pizza pre-order and email-signup links").
- Depends on: d47 (the same check for the pizza page), d02 (parties and company events are booked by email, not here), d25 (Reserve buttons in the gaps between seasons).
- Note: Old Q22.

**A. Yes, it is the right page**

- No change. The same address sits behind every Reserve button, the Reserve QR sign and the calendar files.
- After launch press each Reserve button once (docs/LAUNCH_CHECKLIST.md section 5).
- Strings: 0
- Tests: none

**B. It is the wrong page (I will send the right one)**

- Replace https://bookeo.com/wiseacres?category=41576YNUUTJ173F2927356 in all 29 places (7 source files): index.html:75, 109, 215, 254, 356, 400, 436, 448, 503, 782, 800, 820, 893, 1135, 1384, 1677, 2000, 2031, 2179; pages/first-visit.html:16, 47, 277; pages/pumpkin-patch.html:16, 136; pages/strawberry-picking.html:15, 125; pages/wise-pie.html:37; js/features.js:46 (BOOK, used by the calendar files and the messages); tools/qr_links.json:38.
- Then python3 tools/pages.py (the 5 generated pages follow) and python3 tools/make_qr.py (print/qr-signs.html, assets/qr/reserve.svg; reprint the Reserve sign). README.md also names the address.
- Strings: 0 (an address, not words)
- Tests: consistency passes if every place is replaced (tests/consistency.test.mjs:349-350 one booking page, :446 the Reserve sign). features.test.mjs:66 and :95 and messages.test.mjs:163 and :167 look for "bookeo.com/wiseacres?category=4...": change them if the new address is not on bookeo.com/wiseacres

**C. Pizza visits or parties need a different page**

- A second address is a small code change (ask Claude, no patch on disk): the pizza-visit or party buttons point to the second page; js/features.js:46 (BOOK) stays the one used in calendar files and messages.
- tests/consistency.test.mjs:349-350 allows only one booking page and :446 checks the Reserve QR sign: both need to allow two.
- Strings: 0 to 2 labels x 4 (if a button must say which visit it books)
- Tests: consistency :349-350, :446; features :66, :95; messages :163, :167

### d47. Is the pizza pre-order page right?

- In plain words: The Pre-order pizza buttons open one Square page. We could not open it, so we do not know if it is yours or if it shows the same nine pizzas and prices as your printed menu.
- Doc question: Q23, Q48
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only she can open the Square page and compare it with the menu. (Old Q18, "are the nine pizzas and their prices right", is dropped: they were copied from her printed menu and checked in all five languages on 3 October.)
- Depends on: d46 (same kind of check), d53 (when the link is posted), d16 (the $31 package), d17 and d49 (menu facts), d19 (drinks and ice cream prices on the same page).
- Note: Old Q23 and Q48.

**A. Right page, same prices as the menu**

- No change. README.md: delete the Square part of the row "Pre-order page, drinks and ice cream" (and "Wise Pie facts" if d53 is also answered).
- Strings: 0
- Tests: none

**B. Right page, but some prices differ (I will say which)**

- First decide which is right. If the printed menu is out of date: change the nine pizzas (index.html:1166-1174, one name and one description each), the extras (index.html:1177 "+$9", 1190 "Also available ... (+$3) ... (+$9)") and the price range (index.html:1447 "$15-$17 ..."), and replace the printed menu picture assets/photos/wise-pie-fall-menu-2026.webp (opened from index.html:1163). The numbers are also in the translations.
- If the Square page is out of date: she fixes it in Square. No file changes.
- Strings: 0 if only Square changes; otherwise 1 id per changed line x 4 translations
- Tests: consistency: tests/consistency.test.mjs:226-230 checks that the price range on the page is the cheapest and dearest of the nine menu prices

**C. Wrong page (I will send the right link)**

- Replace https://wise-pie-wood-fired-at-wise-acres.square.site/?location=CVJNFDQTZCA3B in 6 places: index.html:1145, 1247; pages/wise-pie.html:16, 45, 114; tools/qr_links.json:46 (the pizza sign: then python3 tools/make_qr.py and reprint). Rebuild the pages (python3 tools/pages.py).
- README.md names the address in the Wise Pie facts row.
- Strings: 0
- Tests: consistency: tests/consistency.test.mjs:349-350 (one pre-order page on every page) and :446 (the pizza QR sign)

### d04. Main phone number

- In plain words: (704) 628-6232 is listed in public directories but not on the site. Only the day-of number for photographers is shown.
- Doc question: Q3
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner choice. The number is already public in directories (BBB, YellowPages, Yelp), so showing it adds little risk; only do it if someone answers.
- Depends on: consistency test (phone check). Business Profile hours and phone should match the site (checklist 3.12).

**A. Show it**

- index.html footer contact block (address.footer-contact, lines 2166-2170, id t37c5399a): add the number as <a href="tel:+17046286232">. The 5 other pages copy the footer after rebuild.
- Contact cards: farm card (index.html:2026 area) and the "Questions?" fact (index.html:261-265). Structured data: add "telephone": "+1-704-628-6232", after the "email" line (index.html:47).
- Keep the photographers' number (index.html:1562, 704-207-6347) as it is.
- README: delete the row "Phone number". Rebuild.
- Strings: about 3 changed strings x 4 translations (footer id t37c5399a, plus any label you add)
- Tests: consistency MUST be updated: tests/consistency.test.mjs:325-326 requires exactly ONE phone number on all pages ("phones.size === 1"); the day-of number already counts, so a second number fails it. Allow the two known numbers there.

**B. Keep it hidden**

- No change.
- Strings: 0
- Tests: none

**C. Show it on some pages only**

- Add it only where she names (for example Contact card and footer): same edits as option A in those places only; leave structured data out if unsure.
- Strings: 1 to 3 x 4 translations
- Tests: consistency phone check, as in A

### d54. Prices for pumpkins, berries, flowers and trees

- In plain words: The Shop section shows a red "Prices coming soon" tag next to pumpkins, strawberries, blueberries, flowers, snacks, drinks, local goods, ice cream and Christmas trees. Visitors cannot see what these cost.
- Doc question: Q19
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. The prices are owner facts. If they cannot come before launch, B removes the empty tags.
- Depends on: d19 (drinks and ice cream: rows 1448-1449 are in both), d16 (the $31 package), d50 (tree dates share row 1451), d02 (draft prices).
- Note: Old Q19 asked the same list in one question; d19 already covers the two drinks rows.

**A. I will send the price list**

- Type the prices over the tag "Prices coming soon" and remove class="soon" (the red pill goes too): index.html:1370, 1371 (pumpkins), 1391 (strawberries), 1392 (blueberries), 1393 (flowers), 1419 (concessions), 1420 (beer, hard cider and wine), 1421 (local goods), 1448 (ice cream), 1449 (beer, wine and cider), 1450 (local goods), 1451 (Christmas trees). Prices carry no translation id.
- Then change the note index.html:1350 ("We're adding every product and price ... Anything marked Prices coming soon is on the way", id teeb109de) x 4, and README.md: delete the row "Shop section".
- Strings: 0 for prices; 1 id x 4 for the note (and the row labels if she renames a product)
- Tests: none pinned (these prices are in no facts test); consistency passes unless a number appears twice

**B. Remove the lines with no price**

- Delete the rows with no price (the <div><dt>..</dt><dd class="soon">..</dd></div> lines above) and rewrite the note index.html:1350 (id teeb109de) so it no longer promises prices. Ask Claude if a whole price card ends up empty (pumpkins at index.html:1368-1372).
- Strings: 1 id x 4 translations (the note); the row labels become unused
- Tests: none

**C. Keep "coming soon" for now**

- No change. The red "coming soon" tags stay.
- Strings: 0
- Tests: none

### d06. Google review link

- In plain words: The "Leave a Google review" buttons only open Google Maps until the real review link is pasted in.
- Doc question: Q27
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A when she has it (can follow launch, checklist 3.12).
- Depends on: d40 (if The GreenHouse has its own listing it has its own review link).

**A. I will send the link**

- js/content.js:190 reviewUrl: '' -> reviewUrl: 'https://g.page/r/.../review', (steps in the comment at js/content.js:134-140).
- Then python3 tools/make_qr.py: the review QR sign (tools/qr_links.json:6 "{reviewUrl}") appears in print/qr-signs.html and assets/qr/review.svg (until now it is skipped).
- Check on a phone: the button opens a box with stars. README: delete the row "Google review link".
- Strings: 0
- Tests: print-qr (counts signs: 9 now, 10 after)

**B. Leave as is**

- No change. Buttons open the farm on Google Maps (index.html:1831 and the Reviews section).
- Strings: 0
- Tests: none

## Topic 3. People and photos (permission)

Urgency: blocks launch.
Faces and organisation names need a yes before launch. Words printed inside pictures cannot be translated and go out of date.

### d13. Photos with words or people

- In plain words: Easter, Father's Day, "waiting all summer" have words printed on them (a fourth says strawberries and blueberries are available now); one photo shows four people at a Foster Village table. All are in the gallery.
- Doc question: Q40 (words) and Q39 (the people photo)
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: B for the four word photos (cannot be translated, go stale); the people photo follows d31.
- Depends on: d32 is the same question for the dated words; d31 for the faces; d12 if she sends new versions; the Easter and Father's Day photos only make sense in their season.
- Note: B and C are not exclusive: apply both if both answers are "remove".

**A. Keep them all**

- No change. They are the last 5 entries of photos in js/content.js (lines 294-314), marked "// words on the picture". The words are not translated; the alt text repeats them.
- Strings: 0
- Tests: none

**B. Remove the ones with words**

- Delete the four entries in js/content.js: goats-on-platform-waiting-all-summer (294), baby-goat-bunny-hoodie-happy-easter (298), sunflowers-with-strawberry-and-blueberry-baskets (302), blueberries-sunflowers-happy-fathers-day (306), each 4 lines.
- Delete their 4 files in assets/photos/ (about 0.07 MB) or replace with versions without words under the same names (then change each alt so it no longer talks about words).
- css/extras.css:228 object-position rule for two of them can go.
- Same as d32 option C.
- Strings: 0 (alt text of gallery entries is JS text: 4 JS strings x 4 translations become unused)
- Tests: gallery (counts photos: still above 5)

**C. Remove the people photo**

- Delete the entry js/content.js:310-314 (foster-village-table), the file assets/photos/foster-village-table.webp and css/extras.css:229. Same as d31 option B for that photo.
- Strings: 0
- Tests: gallery

### d31. People's faces in three photos

- In plain words: Clear faces in the spring top picture (3 girls and 2 adults), on the About section (5 adults) and the Foster Village table (4 adults).
- Doc question: Q39
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Consent is an owner fact. Until a yes, treat as B (remove).
- Depends on: d13 (Foster Village is in both), d12 (originals), d33 (frog-hat photo is separate).
- Note: Related older question: Q39 also asks who took the Foster Village photo and whether Foster Village agrees to its name.

**A. They agreed, keep the photos**

- No change. Optional credit: js/content.js:310 Foster Village entry caption -> "Photo: <name>" (the gallery shows the caption); one JS string x 4 translations if you translate it.
- Strings: 0 to 1
- Tests: none

**B. Remove those photos**

- Spring top picture: delete the <li> that holds assets/photos/family-strawberry-field-red-barn.webp at index.html:769 (its alt id t4f6c5f3e) and the gallery entry js/content.js:199-202.
- About section: index.html:1757-1760 (family-sunflower-field.webp, alt id t1db4d8e4); decide a replacement picture or remove the <figure>; gallery entry js/content.js:195-198.
- Foster Village table: delete the entry js/content.js:310-314, the file assets/photos/foster-village-table.webp and the rule css/extras.css:229. Details: option C of d13.
- Delete each unused file in assets/photos/. Rebuild; the alt ids become orphans.
- Strings: 0 new (orphans: 2 alt ids per removed photo)
- Tests: gallery (counts photos: fine), i18n

**C. I will ask them first**

- Until she hears back, the safe state is option B. Reversible: the files stay in git.
- Strings: 0
- Tests: none

### d32. Photos that have dated words on them

- In plain words: Happy Easter, Happy Father's Day, "waiting all summer", and a sign saying berries are available now are visible all year. The tomato price sign is cut off after 4.50.
- Doc question: Q40 (and Q7 for the tomato prices)
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: C (remove the four) for launch; A later if she wants them back each season.
- Depends on: d13 (same photos), d34 (fall photos), d12 (new versions without words).

**A. Show them only in their season**

- Needs a small code change (ask Claude), none exists today: add an optional months field to entries of photos (js/content.js) and skip entries outside their months in the gallery builder (js/main.js:100, photos.map). Document it in the PHOTOS comment at the top of js/content.js.
- Easter: March-April; Father's Day: May-June; "waiting all summer": June-August; "berries available now": May-July (ask for the real months).
- Alternative with no code: delete the entries now and put them back each year (js/content.js:294-314).
- Strings: 0
- Tests: gallery (add a case for the month filter); i18n unaffected

**B. Keep them all year**

- No change. (tomato sign: leave index.html:1014 and js/content.js:266 as they are.)
- Strings: 0
- Tests: none

**C. Remove them**

- Delete the four word photos: same changes as d13 option B.
- Tomato price sign (organic-tomatoes-and-basil-u-pick-signs.webp): keep it only if the prices are right and the farm grows u-pick tomatoes this year (doc Q6, Q7 are not on the dashboard). To remove: the tile at index.html:1014 (alt id tf8f8a118) and the entry js/content.js:266-269 and the file.
- Strings: 0
- Tests: gallery

### d33. What animal is wearing the frog hat

- In plain words: The file name says goat; it could be a guinea pig. The caption says "small animal" for now.
- Doc question: Q39 (second half)
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The wording today ("a small animal") is safe; leave it until known.
- Depends on: d13 and d31 (other people photos), d12 (original).

**A. A baby goat**

- js/content.js:290-293 alt -> "A baby goat wearing a green knitted frog hat" (and caption if wanted) and the same alt at index.html:1331 (goat strip tile, alt id ted43ffcd).
- Add the translations: the alt text is 1 UI string (id ted43ffcd after extract gets a new id) and 1 JS string (the English text is the key under "js" in lang/src/<code>.json).
- Strings: 2 x 4 (alt as UI string + as JS string); caption "Frog hat" stays
- Tests: i18n, languages (rebuild first)

**B. A guinea pig**

- Keep the picture out of "Meet the goats": delete its <li> at index.html:1331 (the goat strip). Gallery entry js/content.js:290 stays; change its alt to "A guinea pig wearing a green knitted frog hat" and add the JS string x 4. Rename the file if you like (both places).
- Strings: 1 JS string x 4 (alt); the strip tile string becomes unused
- Tests: gallery

**C. Something else**

- Same as B with the real animal name: take it out of the goat strip, rewrite the alt, add the JS string x 4.
- Strings: 1 JS string x 4
- Tests: gallery

### d12. Photo originals

- In plain words: Photos sent in chat are 206 px wide and look soft. Originals would look sharp.
- Doc question: Q38
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A (free to ask, nothing to decide).
- Depends on: d13, d31, d32 (do not ask for files that will be removed), d33, d34.

**A. I will send the originals**

- She sends 13 originals with the same names: baby-goat-bunny-hoodie-happy-easter, blueberries-in-bowl-in-sunflower-field-dusk, blueberries-sunflowers-happy-fathers-day, foster-village-table, goat-in-green-frog-hat, goats-on-platform-waiting-all-summer, mums-field-with-red-shed-and-palm, organic-tomatoes-and-basil-u-pick-signs, pink-clouds-sky-over-field, school-bus-on-farm-path, strawberries-and-blueberries-in-white-bowl, sunflower-field-golden-light, sunflowers-with-strawberry-and-blueberry-baskets (.webp in assets/photos/).
- Resize and convert to WebP with python3 tools/add_photo.py (README "Adding a photo"; it removes camera and location data). Then change width="206" height="206" on the tiles: index.html:798, 817, 1014, 1331, 1492, 1646, pages/school-field-trips.html:39, pages/strawberry-picking.html:86, and rebuild. The viewer rule css/extras.css:231 can stay.
- Do not send originals of photos that d13/d31/d32 remove.
- README: the row "13 new photos" shrinks.
- Strings: 0
- Tests: gallery, axe (image sizes)

**B. Keep them small**

- No change. They stay small tiles.
- Strings: 0
- Tests: none

### d34. Sunflower photos in the Fall section

- In plain words: The Fall panel and the pumpkin page lead with a sunflower photo, but the farm's own dates put sunflowers in summer.
- Doc question: none (doc Q34 is a different question: the gate photo)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: B until she sends fall photos (the photo shows pumpkins too).
- Depends on: d12 (originals), d32.

**A. Swap in fall photos, I will send some**

- Fall panel lead photo: index.html:805 (sunflowers-and-pumpkins-by-the-fire.webp, alt id taf7baeae) and its caption. Pumpkin page: pages/pumpkin-patch.html:97, first figure. Gallery entry js/content.js:254.
- Send fall photos, add them with python3 tools/add_photo.py, swap the <img> src, alt and caption in those two places; add the alt and caption translations x 4. Rebuild.
- Strings: 2 to 4 per photo x 4 translations (alt and caption)
- Tests: gallery, i18n

**B. Keep them as they are**

- No change.
- Strings: 0
- Tests: none

## Topic 4. Pizza and food facts

Urgency: wrong or risky information.
Claims about food, allergies and prices that nothing from the farm backs up yet. Allergen and oven wording are the risky ones.

### d17. Allergen note on the pizza page

- In plain words: Neither the menu nor the site says anything about allergens or cross-contact. "Gluten-free crust available" can be read as safe for celiac guests.
- Doc question: Q45 (and Q46: does The Dill Pickle have cheese, which pizzas can be vegan; Q46 is not on the dashboard)
- Urgency: 1 (blocks launch). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A (a short line she writes herself); it is the one food item that can hurt a guest.
- Depends on: d16 (same card and extras), d37 (a person should read the allergen sentence in each language), d18/d22 (same pizza section, rebuilt together).

**A. Add an allergen line (I will give the facts)**

- She gives the words. Put them under the cheese note (index.html:1179), in the "Ingredients & sources" box (index.html:1184-1189) and in the answer "Is there a vegan or gluten-free option?" (pages/wise-pie.html:96; the rebuild copies the answer into the page data).
- Point to them from "Vegan cheese and gluten-free crust available" (index.html:1153 and pages/wise-pie.html:66).
- Write nothing she has not said. A new printed menu picture is her choice (assets/photos/wise-pie-fall-menu-2026.webp, opened from index.html:1161).
- README: delete the row "Fall pizza package and allergens" once d16 is answered too.
- Strings: 2 to 4 new or changed sentences x 4 translations. Ask a native speaker to check an allergen sentence (d37)
- Tests: none (the facts test does not pin allergens); i18n and languages after the rebuild

**B. Leave it as is**

- No change. Risk stays: the site says "gluten-free crust available" and nothing about cross-contact.
- Only with her OK: one neutral sentence ("Please tell us about any allergy before you order") in the same places as option A.
- Strings: 0
- Tests: none

### d16. The $31 pizza package

- In plain words: Which pizzas can a family pick in the "Yes pizza" package ($31 base, 2 pizzas, plus $3 per person)? Two menu pizzas cost $30 to $34 together.
- Doc question: Q44
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. The rule and the price are owner facts. If A ("any two") is true, no file change is needed.
- Depends on: d17 (allergen wording sits next to the extras), d19 (prices), d20/d21 (same card, index.html:434), d36 is not related.

**A. Any two pizzas**

- The site already says "Includes 2 Wise Pie pizzas". If "any two" is what she means, no change is needed.
- To say it in words ("any 2 pizzas"): index.html:433 (id tf7203efa) and index.html:1414 (id te9a8e62d, same sentence on pages/pumpkin-patch.html:45). Gluten-free crust (+$9) and vegan cheese (+$3): say if they cost extra on top of the $31 (same three places).
- Check the booking page (Bookeo) says the same. README: delete the row "Fall pizza package and allergens" once d17 is answered too.
- Strings: 0 if the wording stays; 2 ids x 4 translations if "any" or "extras cost more" is added
- Tests: consistency: the regex "Includes \d+ Wise Pie pizzas, plus $N per person" (tests/consistency.test.mjs:103 and :134) must still match the new sentence, or be changed with it

**B. Only some pizzas (I will say which)**

- Add the list of allowed pizzas to the same three places: index.html:433 (id tf7203efa), index.html:1414 (id te9a8e62d), pages/pumpkin-patch.html:45 (same id). Names must match the menu list at index.html:1164-1173.
- Extras (gluten-free +$9, vegan cheese +$3): say if they cost extra on top.
- Check the booking page says the same.
- Strings: 2 ids x 4 translations (a longer sentence)
- Tests: consistency: same two regexes (:103, :134)

**C. Change the package price**

- Change "$31" at index.html:432 (id t661d94cd), index.html:1414 (id te0ae7737) and pages/pumpkin-patch.html:45 (id t041b0712 holds the whole line). The number is inside the translations, so the ids change: 3 ids x 4.
- Also change the booking page and the Bookeo price, outside the repo.
- Strings: 3 ids x 4 translations
- Tests: consistency: fact "price: farm fun with pizza, base" (tests/consistency.test.mjs:100) needs the new number to be the same in all 3 places (it reads the pages, no edit if all places agree); the $3 farm fee facts (:102-104) only if $3 changes

### d18. Oven temperature on the site

- In plain words: The heading says "700-degree oven" with no unit. In other languages that reads as Celsius. The pizza share picture says it too.
- Doc question: Q47
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: A if the oven really is 700 degrees F (the figure everyone quotes for wood-fired ovens); the unit matters more than the number.
- Depends on: Share picture (docs/LAUNCH_CHECKLIST.md 3.11, d38 for the address on it), d37 (zh adds the Celsius figure).

**A. It is Fahrenheit: add the F**

- Change "700-degree" to "700°F" at: index.html:1118 and pages/wise-pie.html:12 (one id, t52ee3965); the description pages/wise-pie.html:3 (a JS string, shown in search and shares); pages/wise-pie.html:6 (share picture description, English only).
- The share picture assets/og-wise-pie.png has the heading drawn in it: a new picture is needed (drawn artwork, ask Claude). Before launch the same file name is fine; after launch use a new file name (docs/LAUNCH_CHECKLIST.md 3.11, and the table row "Wise Pie").
- Translations: Chinese adds a Celsius figure (about 370); keep it.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency MUST be updated: tests/consistency.test.mjs:153 (fact "oven temperature", regex (\d+)-degree oven, min 4) and :400 (ALLOWED_EXTRA /700-degree/ -> 370). Change both regexes to the new wording

**B. Remove the number**

- Take the number out: heading id t52ee3965 (index.html:1118, pages/wise-pie.html:12), description pages/wise-pie.html:3, image description :6, for example "Real pizza from a wood-fired oven".
- New share picture without the number (assets/og-wise-pie.png), as in A.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency MUST be updated: delete the fact at tests/consistency.test.mjs:153 and the ALLOWED_EXTRA entry at :400

**C. A different number**

- Same places as A with her number and unit. Chinese adds the Celsius figure for the new number.
- New share picture, as in A.
- Strings: 1 UI id + 1 JS string = 2 x 4 translations
- Tests: consistency: if the wording stays "N-degree oven" the fact at :153 still works; update ALLOWED_EXTRA (:400) to the new Celsius figure

### d19. Drinks and ice cream at The GreenHouse

- In plain words: The site names beer, wine, cider and Waxhaw Creamery ice cream, but prices say "coming soon". Names and prices are not confirmed.
- Doc question: Q53 (prices also in Q19; Q19 is not on the dashboard)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Names and prices are owner facts. Alcohol claims are the risky ones: remove a name she does not confirm.
- Depends on: d40 (does The GreenHouse have its own listing), d37 (translation of "cider").

**A. I will send names and prices**

- Type the prices over "Prices coming soon": index.html:1447 (Waxhaw Creamery ice cream) and 1448 (Beer, wine & cider). Remove class="soon" from those dd tags. Prices carry no translation id.
- Names that change (if she corrects them): index.html:652, 1214, 1218-1219, 2039 and pages/pumpkin-patch.html:89, pages/wise-pie.html:75. The GreenHouse side says "cider", the farm side says "hard cider" (index.html:486, 642, 647, 1405, 1419, 1686, 1727): make the wording agree.
- README: delete the part about drinks in the row "Pre-order page, drinks and ice cream".
- Strings: 0 for prices only; up to 23 ids x 4 if names change (ids containing ice cream, drinks or cider)
- Tests: none (prices of drinks are not in the facts test); consistency "price:" facts only if you add a pinned price

**B. Remove the drinks line**

- Delete the drinks mentions on The GreenHouse side: index.html:1219 (list item "Beer, wine & cider"), 1448 (price line), the sentences at 652 and 1214, and 2039 if it names drinks.
- The farm side (hard cider, beer and wine at the farm: index.html:486, 642, 647, 1405, 1419, 1686, 1727) is a separate claim: not asked on the dashboard (doc Q15 covers spring and summer snacks); leave or ask.
- Strings: 2 to 6 changed sentences x 4 translations
- Tests: none

### d20. Pizza ready time

- In plain words: The site says pizzas are ready 1 hour after the reservation time. A late reservation would be after the farm closes at 4.
- Doc question: Q50
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A only if she says "always 1 hour". A late slot that promises pizza after closing is a wrong promise.
- Depends on: d21 (same sentence index.html:434), d23 (farm closing dates).

**A. Correct**

- No change.
- Strings: 0
- Tests: none

**B. Not correct (I will give the rule)**

- Change the sentence at index.html:434 (id td4abc72c, shared with the "serves" sentence of d21) and pages/wise-pie.html:36 (id tb150c178).
- Rewrite for late reservations (for example a time cap) in her words.
- Strings: 2 ids x 4 translations
- Tests: consistency: fact "pizza: ready for pick-up after (hours)" (tests/consistency.test.mjs:151, regex (\d+) hour after your reservation time, min 2): keep that phrase or change the regex

### d21. Pizza size

- In plain words: The site says every pizza is 12 inches, whole pie only, and serves 2 to 3 adults or 3 to 4 children. The menu picture has no sizes.
- Doc question: Q51
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A only if she confirms. These numbers appear in 6 sentences; one wrong number is a complaint at the oven.
- Depends on: d20 (same sentence index.html:434), d16.

**A. Correct**

- No change.
- Strings: 0
- Tests: none

**B. Not correct (I will give the facts)**

- Change: index.html:434 (id td4abc72c), 1151 (id td97bf746, "12 inches"), 1152 (id t2f74e9c3, "serves"), pages/wise-pie.html:64, 65 and the FAQ answer :100 (ids tc3127d1f, t202bb680, t5cc8a292). The rebuild copies the answer into the page data.
- Strings: 6 ids x 4 translations
- Tests: consistency: facts at tests/consistency.test.mjs:148-150 (size in inches, feeds adults, feeds children, regexes need "N inches", "about N-N adults", "or N-N children")

### d22. Mozzarella wording

- In plain words: The site says "local mozzarella" (and "locally sourced" on the pumpkin page). The menu only says Uno Alla Volta in Charlotte, milk from an Amish farm northeast of Charlotte.
- Doc question: Q52
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: B if she does not confirm "local"; the exact menu words cannot be wrong.
- Depends on: None. Share picture and descriptions do not use the word.

**A. Keep locally sourced**

- No change.
- Strings: 0
- Tests: none

**B. Use the menu's exact words**

- Replace "local mozzarella" in index.html:1119 (id t6daebcdd) and pages/wise-pie.html:13 (id t063c32e4), and "locally sourced mozzarella" in pages/pumpkin-patch.html:74 (id t26f2daf9), with the menu words, for example "fresh mozzarella from Uno Alla Volta in Charlotte". The detailed note already uses them (index.html:1179, 1186; pages/wise-pie.html:67).
- Strings: 3 ids x 4 translations
- Tests: none

### d49. Does The Dill Pickle pizza have cheese?

- In plain words: The printed menu lists no cheese on The Dill Pickle. A guest who avoids dairy, or wants a vegan pizza, would read it as cheese-free, and the site says nothing either way.
- Doc question: Q46
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Only the kitchen knows. Do not guess about cheese.
- Depends on: d17 (the allergen line sits next to this), d16 (extras), d47 (the menu picture must match the Square page).
- Note: Old Q46.

**A. Yes, it has cheese**

- Put "cheese" in the description of The Dill Pickle: index.html:1173 (id t9e44b097) x 4 translations, and replace the printed menu picture (assets/photos/wise-pie-fall-menu-2026.webp, opened from index.html:1163) so both agree.
- If she also lists which pizzas can be made vegan: one sentence next to "Vegan cheese and gluten-free crust available" (index.html:1154, pages/wise-pie.html:66) and in the answer pages/wise-pie.html:96.
- Strings: 1 id x 4 (+ 1 to 2 for a vegan sentence)
- Tests: none

**B. No, it has no cheese**

- No change. Do not add "dairy-free" or "vegan" to the pizza unless she says so.
- Strings: 0
- Tests: none

**C. Not sure, I will check**

- No change until she answers.
- Strings: 0
- Tests: none

### d53. When and where is the pre-order link posted?

- In plain words: The site says the pizza pre-order link is posted 5 days ahead. It does not say 5 days before what, or where people will find it.
- Doc question: Q49
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Only the kitchen knows its posting routine.
- Depends on: d57 (shares the sentence index.html:1142), d47 (the link itself), d16 and d20 (other pizza promises).
- Note: Old Q49.

**A. 5 days before each pizza day**

- No change.
- Strings: 0
- Tests: none

**B. 5 days before the weekend**

- Change "the link we post 5 days ahead" to say the weekend: index.html:1142 and pages/wise-pie.html:42 (one id, t60509a07, shared with the "eat there" sentence of d57); index.html:1230 (id t86f09bf0); tools/qr_links.json:49-50 (the pizza sign in English and Spanish; then python3 tools/make_qr.py and reprint).
- Strings: 2 UI ids x 4 translations + the Spanish sign text in tools/qr_links.json by hand
- Tests: consistency: "pizza: pre-order link posted (days ahead), also on the QR sign" (tests/consistency.test.mjs:152, at least 3 places): keep the phrase "we post the pre-order link N days ahead/before" or change the regex

**C. Different: I will explain when and where**

- Same places as B with her rule and, if she says, where the link is posted (the Wise Pie Instagram page, the website, a message). The pre-order button itself already goes to the Square page (index.html:1145, 1247).
- Strings: 2 UI ids x 4 translations + the sign text
- Tests: consistency :152, as in B

### d08. Thai night

- In plain words: Is there a Thursday-evening Thai dinner at The GreenHouse? It could not be confirmed and it is not on the site.
- Doc question: Q4
- Urgency: 3 (nice to have). Checklist says: before launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. B and C are the same: leave it off.
- Depends on: d09 (GreenHouse hours; a Thursday window is the same code change).
- Note: Nothing wrong is on the site today, so urgency 3, although the checklist lists Q4 before launch.

**A. It is real: I will send details**

- The GreenHouse is one Friday to Sunday window today (js/content.js:184-185). A Thursday evening needs a small code change (ask Claude; no patch on disk): hours with a Thursday window, and the "Closed today. Opens Friday at 10 am" line.
- New text on the GreenHouse card (index.html:1214, 1225, 1434) and the First-visit and Wise Pie pages: days, hours, what is served.
- Strings: 2 to 4 new sentences x 4 translations
- Tests: consistency: GreenHouse days and hours facts (tests/consistency.test.mjs:118-137) add Thursday; live/dated if the hours code changes

**B. It is not real**

- No change (it is not on the site).
- Strings: 0
- Tests: none

**C. Not sure yet**

- No change. Do not add it until she says yes.
- Strings: 0
- Tests: none

### d57. Can people sit and eat at The GreenHouse?

- In plain words: The Wise Pie page says "eat there or take your pizza with you". We do not know if there are tables, so a family may arrive expecting a seat.
- Doc question: Q54
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The current words promise "eat there".
- Depends on: d53 (same sentence), d19 (what The GreenHouse sells), d55 (comfort and shade).
- Note: Old Q54.

**A. Yes, there are tables**

- Say where, in the same sentence or in the GreenHouse section (index.html:1215-1227). The sentence "eat there or take your pizza with you" (id t60509a07) is index.html:1142 and pages/wise-pie.html:42.
- Strings: 0 to 1 new sentence x 4
- Tests: consistency :152 only if the "we post the pre-order link 5 days ahead" words change (d53 shares the sentence)

**B. No, take-away only**

- Change the sentence to "First come, first served: take your pizza with you. Or pre-order with the link we post 5 days ahead." (id t60509a07 changes) at index.html:1142 and pages/wise-pie.html:42. Check pages/first-visit.html:75 ("welcomes drop-ins": fine) and the GreenHouse intro (index.html:1214 area) for "eat" or "dine".
- Strings: 1 id x 4 translations
- Tests: consistency :152 (keep the "pre-order link N days ahead" words)

**C. Some seating (I will say where)**

- Same sentence as A with the real seating (for example "a few picnic tables") and where they are.
- Strings: 1 id x 4 translations
- Tests: consistency :152, as above

## Topic 5. Dates, seasons and winter

Urgency: wrong or risky information.
The site shows fall wording all year. The three winter patches, the fall end date, new-year content and the Reserve buttons belong together.

### d01. What visitors see in winter

- In plain words: From January to March the site still shows fall booking buttons and fall 2026 prices. Three ready-made fixes exist.
- Doc question: Q37 (and Q12 for the Christmas tree dates; Q12 is not on the dashboard)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A, if the u-pick farm is really closed in winter (its own dates say it is). Needs her yes on Q37 first. C is what you already have.
- Depends on: d24 (hide fall content = the same patch as A), d25 (Reserve buttons), d27 (school tours banner), d09 (GreenHouse winter hours), d23 (fall end date); the Christmas tree dates (doc Q12) are not on the dashboard.
- Note: A and B are alternatives. C is the current state.

**A. Hide fall booking and prices out of season**

- Apply scratchpad/agents/gap/patches/winter-A-on-e02b95e.patch (source files only; it is winter-A.patch rebased onto e02b95e. scratchpad/agents/winter/winter-A.patch and the b54427b copy no longer apply: the plain-English rewrite changed the sentences next to three of their hunks).
- What it does: the "Reserve now" button in the Visit area, the "Choose your package" header, packages, included, add-ons, the "See prices" and "See packages" buttons, the "At the farm" shop block with its jump link and the "Fall:" paragraph get data-only="fall" (or "spring summer fall"). A new off-season line ("Fall at the farm usually starts again in mid-September...") with the existing "Tell me when it opens" button shows in winter, spring and summer. First-visit page: "See packages & add-ons" button hidden out of fall. css/sections.css +2 lines.
- Then rebuild (python3 tools/pages.py && python3 tools/i18n.py extract && python3 tools/i18n.py jsstrings && python3 tools/i18n.py build) and python3 tools/i18n.py missing es hi zh vi (0 each).
- The pumpkin page (pages/pumpkin-patch.html:42-50, 122) keeps "fall 2026" prices all year: not covered.
- Applies cleanly to e02b95e and to 66c8272 (dry run).
- The fall blocks come back about August 12 (the site then treats fall as the nearest season): answer d24 before that.
- Strings: 1 new UI sentence (id t48ba72e7) x 4 translations, already written in the patch
- Tests: Run on the patched e02b95e tree: consistency 66, live 20, dated 24, farm-seasons 24, hero 74, messages 173: all pass. Page-clock check: packages, shop block and Reserve now show on 2026-10-10 only; the off-season line shows from 2026-11-20 to 2027-03-01; the tree headline shows on 2026-12-01 only (same as unpatched). No test needs a change
- Patch: scratchpad/agents/gap/patches/winter-A-on-e02b95e.patch

**B. Keep them with a note: these are fall prices**

- Apply scratchpad/agents/gap/patches/winter-B-on-e02b95e.patch (it is scratchpad/agents/winter/winter-B.patch rebased onto e02b95e: only the four translation lines needed a new place).
- What it does: one note line before "Reservation packages" (shown in winter, spring and summer): "These are the fall 2026 prices and times. New ones come later." Nothing is hidden.
- Rebuild and check translations as in A.
- The sentence says "2026": it must change when d24 gets the 2027 details.
- Strings: 1 new UI sentence (id t8e365ded) x 4 translations, already written in the patch
- Tests: Run on the patched e02b95e tree: consistency 66, live 20, dated 24, farm-seasons 24, hero 74, messages 173: all pass. Page-clock check: the note shows from 2026-11-20 to 2027-03-01, not on 2026-10-10. No test needs a change
- Patch: scratchpad/agents/gap/patches/winter-B-on-e02b95e.patch

**C. Only fix the Christmas tree wording**

- Nothing left to apply. The tree wording is already in-season-only at b54427b (commit e081393): the headline "Wise Acres Christmas trees", the "Trees" chip and "Christmas trees are here." show only from the Friday after Thanksgiving to December 8 (data-in-season; js/hero.js:1149-1151 and :1193). Checked with a page clock on the unpatched tree: tree headline on 2026-12-01 only; 2026-11-20, 2026-12-20, 2027-01-20 and 2027-03-01 show "Organic u-pick fun for the whole family".
- Do NOT apply scratchpad/agents/winter/winter-C.patch (it is stale). A naive rebase (tree headline first in the h1) is wrong: js/hero.js:1193 shows the FIRST title between seasons, so the tree headline would show all winter. Tested and rejected.
- What stays wrong with C alone: from the Nov 9 gap to March the Visit and Shop areas still show "Fall 2026" prices and "Reserve now" (see A and B).
- Strings: 0
- Tests: none to run: no file changes

### d09. The GreenHouse winter hours

- In plain words: The site shows Friday to Sunday, 10 to 8, all year.
- Doc question: Q37 (second part) and Q17 (hours)
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. A until she says otherwise.
- Depends on: d01 (C: trees are sold at The GreenHouse in winter), d08 (Thursday window is the same code), d23.

**A. Same all year**

- No change.
- Strings: 0
- Tests: none

**B. Different hours: I will send them**

- Code change (ask Claude, no patch on disk): js/content.js:184-185 has one Friday-Sunday window all year; separate winter hours need a second window and the "Closed today. Opens Friday at 10 am" line.
- Text: index.html:369 (id tb55a6fd9), 1225 (tfb71e468), 1434 (tb4c1e6ac), 2039 (ta38e4092), "Fall hours:" index.html:1124, pages/wise-pie.html:29 and the description :3 (JS string).
- Strings: 4 to 6 ids + 1 JS string x 4 translations
- Tests: consistency MUST follow: "time: The GreenHouse open hours" and "days: The GreenHouse and Wise Pie there" (tests/consistency.test.mjs:118-137 read the text and js/content.js); live

**C. Closed some months: I will say which**

- Same code and text changes as B, with a "closed from ... to ..." window and wording. Christmas trees are sold at The GreenHouse from the Friday after Thanksgiving to December 8 (js/season.js:23): say what shows when it is closed.
- Strings: 4 to 8 ids x 4 translations
- Tests: consistency (as B), live, dated

### d23. Is the farm open after November 8?

- In plain words: The "No pizza" box says open all of October and November, but the rest of the site says fall ends November 8. One of them is wrong.
- Doc question: none (doc Q17 is about weekly hours, not the fall end date)
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. If she cannot say by Nov 1, B (it promises less).
- Depends on: d01/d25 (the gap after fall: November 9 onward), d24 (2027 dates), d27 (school tours banner). The Reserve window and "Tell me when it opens" follow js/season.js.

**A. Open until Nov 30: I will change the end date**

- js/season.js:22 fall end: new Date(y, 10, 8) -> new Date(y, 10, 30). Warning: winter starts the Friday after Thanksgiving (Nov 27, 2026, js/season.js:23), so the two seasons overlap for 4 days. Decide what shows then (ask Claude).
- Words "early November" become "end of November": index.html:574, 808, 856, 1360, 1900 and pages/pumpkin-patch.html:11, 110 (7 ids: t21bf1cf8, t38bfb02d, t6fa474da, t7ad569b7, t86e21495, t9f9dedc8, tebb43b26).
- Last pizza weekend row index.html:530 "Oct 30-Nov 8" (data-until="2026-11-08") if more weekends follow; the "No pizza" block (index.html:516-518, data-until="2026-11-30") already says November.
- The year bar (index.html:856) and the README rows follow the same text.
- Strings: about 7 to 9 ids x 4 translations
- Tests: consistency: tests/consistency.test.mjs:314 builds the fall words from js/season.js, so it expects the new text (change the regex "Mid-September through early November"); dated: tests/dated.test.mjs hard-codes Nov 8/9 and Nov 30 (lines 6-10, 58-76): redo those dates; farm-seasons and hero may react to the new end date, run them

**B. Fall ends Nov 8: fix the pizza box**

- Fix the "No pizza" box: index.html:516 data-until="2026-11-30" -> "2026-11-08" and the sentence at index.html:518 (id tb848cce7, "Open for all of October and November.") -> for example "Open through November 8".
- js/season.js stays as is.
- Strings: 1 id x 4 translations
- Tests: dated: tests/dated.test.mjs:8 (selector data-until="2026-11-30"), :67 (Nov 9 line) and :75 (Dec 1 line) must follow the new date

### d50. Christmas tree dates at The GreenHouse

- In plain words: The site says trees are sold at The GreenHouse from the Friday after Thanksgiving (November 27) to early December, and the page switches the tree wording off on December 8. We have not heard the end date from you.
- Doc question: Q12
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. The tree wording is already in-season-only (commit e081393). The end date ("early December", December 8 in the code) is the one part nobody confirmed in writing.
- Depends on: d01 (what winter shows), d09 (GreenHouse hours in winter), d54 (tree price), d51 (hours).
- Note: Old Q37 asked this as its third part ("when do you stop selling Christmas trees?"); the dashboard had no question for it.

**A. Those dates are right**

- No change.
- Strings: 0
- Tests: none

**B. Different dates (I will send them)**

- js/season.js:20-23 winter: the start (thanksgivingFriday) and the end (line 23, new Date(y, 11, 8)).
- The words "Friday after Thanksgiving to early December" in 8 sentences: index.html:580, 829, 831, 865, 1235, 1451, 1903, 1945 (ids t0e76cb0a, t28844e2e, t4503c39b, t493369ae, t53cf41e8, t5ecd6fe5, t8f55ff30, tf0d0193a) x 4 translations. README.md row "Christmas trees".
- Strings: 8 UI ids x 4 translations
- Tests: consistency MUST follow: tests/consistency.test.mjs:284-286 and :317 read "early December" and "Friday after Thanksgiving to early December" against js/season.js; hero :40 (the switch to winter); dated

**C. No trees this year**

- Remove the tree wording: 19 UI ids mention Christmas trees (x 4), the winter hero headline "Wise Acres Christmas trees" (index.html:207), the "Trees" chip (353-354), the winter season panel, the calendar bar (865), the Shop row (1451), the crop "trees" in js/features.js, and the tree FAQ (1945). Ask Claude. Check d01 (what winter shows then).
- Strings: about 19 UI ids (unused after removal)
- Tests: farm-seasons MUST change: tests/farm-seasons.test.mjs:37 ("Christmas trees only in winter"); consistency :284-317; hero (winter checks); dated

### d51. Are the fall opening hours right?

- In plain words: The open-now badges and many lines say: farm visits Thursday to Sunday, Wise Pie at The GreenHouse 4 to 8 pm, and pizza at the farm 10 am to 4 pm. If one is wrong, visitors arrive at a closed door.
- Doc question: Q17
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. The hours came with the farm's wording; the README only asks her to check them against real life.
- Depends on: d09 (the GreenHouse's own hours, all year), d08 (Thursday night), d23 (fall end date), d50 (tree season).
- Note: Old Q17 had four hours in one question: three are here, the GreenHouse's 10 am to 8 pm is d09.

**A. All of these are right**

- No change. README.md: delete the row "Open-now badges".
- Strings: 0
- Tests: none

**B. Some are wrong (I will send the right hours)**

- Hours and days are set in js/content.js:189-191 (greenhouse, pizza, farm; these are b54427b lines 184-186 plus the offset). The text follows: about 25 sentences, for example index.html:370, 1130, 1226, 1230, 1435, 2040; pages/pumpkin-patch.html:74; pages/wise-pie.html:3, 33, 92, and the week strips (data-days at index.html:432, 444). The regexes in tests/consistency.test.mjs:118-138 find every place.
- Same code change as d09 if the hours differ by season.
- Strings: up to 25 UI ids x 4 translations
- Tests: consistency MUST follow: the hours and days facts (tests/consistency.test.mjs:118-138) read the text and js/content.js; live (open-now badges); dated

### d24. Fall 2027 prices, schedule and menu

- In plain words: The Fall 2026 prices, schedule and menu stay on the site all year. From August 2027 they would look like this year's.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: B now (it is d01 A), but A before about August 12, 2027: that is when the site switches back to fall and the 2026 prices show again.
- Depends on: d01 (B = winter A), d23 (end date), d02 (corporate prices have no year), d16 (package price).

**A. I will send the 2027 details**

- When she sends the 2027 details, replace the 2026 data. Places: header "Fall 2026" index.html:418, 420, 492, 1403, 1422, 1660; the packages and add-ons 416-486; the schedule and pizza table index.html:489-535 (data-release and data-until dates); special days index.html:1659-1665; the Shop index.html:1403-1422; pumpkin page pages/pumpkin-patch.html:42-50, 122; the printed menu picture assets/photos/wise-pie-fall-menu-2026.webp (index.html:1161).
- README: update the content rows and the "year of the fall prices" wording.
- Strings: about 7 ids with "Fall 2026" + every changed price/date line, x 4 translations
- Tests: consistency: the fact "year of the fall prices, menu and schedule" (tests/consistency.test.mjs:157, min 9) and the price facts; dated: tests/dated.test.mjs hard-codes the 2026 rows and special days: rewrite for 2027

**B. Hide fall content between seasons**

- Same as d01 option A: apply scratchpad/agents/gap/patches/winter-A-on-e02b95e.patch. Fall blocks are hidden while another season is on screen: the 2026 prices stop showing from Nov 9 until the site switches back to fall, about August 12 (checked with a page clock: hidden on 2027-08-11, shown on 2027-08-13). Then the 2026 prices show again, so send the 2027 details (option A) before that date.
- Not covered: the pumpkin page (pages/pumpkin-patch.html:42-50, 122).
- Strings: 1 new sentence x 4 (see d01)
- Tests: as d01 A
- Patch: scratchpad/agents/gap/patches/winter-A-on-e02b95e.patch

**C. Keep as is**

- No change. The site keeps showing Fall 2026 until August 2027.
- Strings: 0
- Tests: none

### d25. Reserve buttons when nothing can be booked

- In plain words: Reserve buttons show in the gaps between seasons (for example November 9 to 17 and February 10 to April 14).
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A, but it only fixes the spring gap. With d01 A the winter buttons are hidden anyway.
- Depends on: d01 (A hides the Visit-area button in winter), d23 (the fall end date decides the November gap).

**A. Hide them out of season**

- Apply scratchpad/agents/leftovers/reserve-window-OPTIONAL-ff5965d.patch (optional patch; applies to b54427b and to HEAD). Files: css/styles.css, index.html, js/hero.js, pages/strawberry-picking.html (then python3 tools/pages.py).
- What it does: the buttons marked data-book show only inside the booking window the site's own words give: strawberry (spring) buttons from 3 weeks before the season starts (about March 25) to its end. Summer and fall state no window, so their buttons are never hidden by it (the November 9 to 17 gap stays).
- Phone bar keeps its buttons evenly spaced (data-count).
- Strings: 0
- Tests: hero, farm-seasons (run them)
- Patch: scratchpad/agents/leftovers/reserve-window-OPTIONAL-ff5965d.patch

**B. Keep them**

- No change.
- Strings: 0
- Tests: none

### d26. When are cut flowers available?

- In plain words: The text says April to July and September to first frost. The "This week" box drops flowers June 8 to 14 and July 11 to August 31.
- Doc question: none (doc Q19 asks flower prices and Q13 the blueberry and sunflower season, not the flower months)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. A is the cheap one (no words change) if April to July is right.
- Depends on: d23 (fall end 11/8 is the end of the September window), d24.

**A. The text is right**

- js/features.js:410 (crop "flowers", wins): make it one window April to July: [[new Date(y, 3, 15), new Date(y, 6, 31)], [new Date(y, 8, 1), new Date(y, 10, 8)]]. Today it follows spring (4/15-6/7) and summer (6/15-7/10), so there are holes.
- The text stays: index.html:868, 1392, 1467, 1903 and pages/pumpkin-patch.html:69 (ids t4c712247, ta7a386b9, tad408a60, tb15f8314, tc5aa3586).
- Strings: 0
- Tests: features (auto in-season case at tests/features.test.mjs:77), farm-seasons

**B. The This week box is right**

- Change the 5 sentences (same lines as A) to what the box shows (flowers only during spring and summer picking and from September).
- Strings: 5 ids x 4 translations
- Tests: none (not pinned)

**C. Neither: I will say the months**

- Both: she gives the months; js/features.js:410 and the 5 sentences change to them.
- Strings: 5 ids x 4 translations
- Tests: features (auto case), farm-seasons

### d27. School tours banner

- In plain words: "Traditional Fall School Tours - Now booking" shows all year.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A (the banner says "now booking" in the months when nobody can).
- Depends on: d23/d24 (the real fall dates), d36 (school tour rules).

**A. Hide it out of season**

- index.html:1611 (tab text "Now booking", id td727517c) and index.html:1627 (badge "Traditional Fall School Tours - NOW BOOKING", id t61e401ae): add data-only="fall" (add data-in-season to hide it also before September 13 and after November 8). The mechanism is js/hero.js:1146-1151.
- pages/school-field-trips.html:11 says "Traditional fall school tours" (no booking word): leave it.
- Strings: 0
- Tests: none (no test names the banner)

**B. Keep it all year**

- No change.
- Strings: 0
- Tests: none

## Topic 6. Rules and promises to visitors

Urgency: wrong or risky information.
Cancel fee, service animals, school-tour minimum, parking: what visitors will hold the farm to.

### d41. Cancel fee on the strawberry page

- In plain words: The home and first-visit pages say there is a 3 percent fee when you cancel. The strawberry page rain policy does not mention it.
- Doc question: none
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A (same booking system, same fee; two pages promise it and the third is silent).
- Depends on: d42 is a similar policy sentence. The text exists at index.html:1961 and pages/first-visit.html:256.

**A. Add the 3 percent fee line**

- pages/strawberry-picking.html:114-115 (FAQ "What is your rain policy?"): add the sentence "If you cancel by then, we refund the cost of your reservation, minus the 3% credit card processing fee" (the wording of index.html:1961, id t40668596). The answer is id t0e3c1f6e. The rebuild copies the answer into the page data.
- Strings: 1 changed answer x 4 translations (the 3% stays in each)
- Tests: consistency: "price: refund fee" (tests/consistency.test.mjs:114, min 3) stays satisfied; its translation check pins the 3%

**B. Leave it out there**

- No change.
- Strings: 0
- Tests: none

### d42. Service animals

- In plain words: The FAQ says service animals are welcome. The photography section says animals are not permitted but registered service dogs should contact you in advance. The Chinese and Vietnamese say "service dogs", which is narrower.
- Doc question: none
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: A. In the US a business may not require advance notice for a service dog (ADA); confirm with her or a lawyer.
- Depends on: d10 (the lawyer question in the doc, Q43, could cover this), d37 (zh and vi wording).

**A. Service animals welcome, no notice needed**

- Photography line: index.html:1582 ("Animals are not permitted on the farm. If you have a registered service dog, please contact us in advance") -> same wording as the FAQ without the notice. 1 English sentence x 4 translations.
- Chinese and Vietnamese: all 8 ids that mention service animals or dogs say "service dog" (zh 服务犬, vi chó phục vụ): t02ff16ba, t168a0beb, t29a8b135, t775b3737, ta2d4eb0f, tbb0c8591, tf13be67c (index.html:1238, 1949; pages/first-visit.html:126, 142, 186-187, 263; pages/pumpkin-patch.html:126) and te75a4809 (the photography line). Change the zh and vi values to "service animal" in lang/src/zh.json and lang/src/vi.json (English unchanged), then python3 tools/i18n.py build.
- Strings: 1 English sentence (id te75a4809) x 4, plus 14 zh and vi values reworded in the 7 other ids (no new English)
- Tests: consistency: policy fact "pets stay home, service animals are welcome" (tests/consistency.test.mjs:212) still holds

**B. Ask for notice in advance**

- Keep "ask for notice" and say it everywhere: add "please contact us in advance" to the 5 "welcome" sentences: index.html:1949 and pages/first-visit.html:263 (one id, ta2d4eb0f), pages/first-visit.html:126 (tbb0c8591), :142 (tf13be67c), :187 (t775b3737), pages/pumpkin-patch.html:126 (t168a0beb). The short labels "No dogs / Service animals only" (index.html:1238) and "Service animals" (first-visit:186) can stay. Make the photography line (te75a4809) say "service animal" not "registered service dog".
- The zh and vi wording fix of option A applies here too.
- Strings: 5 to 6 English ids x 4 translations
- Tests: consistency :212 (keep the phrases "pets stay home" / "No dogs"; the regex looks for them)

### d52. Does Cathy's email get answered?

- In plain words: The site tells visitors to email cathy@wiseacresorganic.com with questions, for waitlists and for help with strollers or wheelchairs, in more than a dozen places. If nobody reads it, visitors wait for an answer that never comes.
- Doc question: Q30
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: none. Only she knows who reads that mailbox.
- Depends on: d55 (accessibility text says "email Cathy"), d03 (the school tour email is vanessa@), d04 (a phone number could be the other way to ask).
- Note: Old Q21 (waitlist) is dropped: the "Spots left" box is hidden until she fills in the week, and the README already says not to mark a day full unless someone answers.

**A. Yes, it is read and answered**

- No change.
- Strings: 0
- Tests: none

**B. Use a different email (I will send it)**

- Replace cathy@wiseacresorganic.com: index.html:47 (structured data), 264, 1350, 1678, 1703, 1718, 1745, 1890, 2001, 2052, 2171, 2183; pages/first-visit.html:161, 167; js/features.js:442 (waitlistEmail default, also used by the messages feature); js/content.js:101 (comment); README.md. Rebuild (python3 tools/pages.py).
- 9 UI ids contain it (t37c5399a, t4a984489, t716fd5fb, t7c90f595, t9777fabc, td03021c9, td6a5d444, teeb109de, tf8daf32f) x 4 translations.
- Other addresses are separate: vanessa@ (school tours, index.html:1634) and ava@ (pizza questions, index.html:1204).
- Strings: 9 UI ids x 4 translations
- Tests: messages: tests/messages.test.mjs:82, :116, :120 name cathy@; features :94 (waitlist mailto); consistency (emails in the translation check)

### d55. Strollers, wheelchairs and farm paths

- In plain words: The First visit page only says the fields may have irrigation lines, stakes and equipment, and asks people to email. A visitor with a stroller or wheelchair gets no real answer about the paths, quiet times or baby changing.
- Doc question: Q29, Q31
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner facts, and accessibility facts must not be guessed.
- Depends on: d52 (the card says "email Cathy"), d35 (parking and entrance are in the same planning cards), d42 (service animals are on the same page).
- Note: Old Q29 and Q31 are merged into this one.

**A. Strollers and wheelchairs are fine in the fields**

- pages/first-visit.html:166 (the "Strollers & wheelchairs" card, id t7af61a2b): add the sentence in her words, for example that strollers and wheelchairs can use the fields, then rebuild (python3 tools/pages.py). The intro index at :161 (id td03021c9, "Email Cathy") can stay.
- Strings: 1 id x 4 translations
- Tests: none pinned; i18n and languages after the rebuild

**B. Not suitable in the fields (I will explain)**

- Same card (pages/first-visit.html:166): say what is not suitable and what visitors can do instead (for example the shaded picnic patch and the accessible toilet, pages/first-visit.html near :170-190).
- Strings: 1 to 2 ids x 4 translations
- Tests: none pinned

**C. I will describe the paths and facilities**

- Add a card "Paths and quiet times" next to it (pages/first-visit.html after :166): path surface and slope, when the farm is quieter, baby changing. Update the README row "Accessibility & comfort".
- Strings: 3 to 5 new ids x 4 translations (title and sentences)
- Tests: none pinned; i18n and languages

### d35. Parking and entrance

- In plain words: The site only says limited parking and shows the map. Visitors ask where to park and which entrance to use.
- Doc question: Q42 (the photo is Q34, not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: can follow launch.
- Owner fact (no sensible default): yes
- Default: A (one sentence from her; the most common visitor question).
- Depends on: d11 (the farm's exact spot should be where cars turn in), d39 (address wording in the same sentences), d12.

**A. I will send the parking and entrance details**

- She describes it. Add it to the Parking card (pages/first-visit.html:175), the lead sentence (pages/first-visit.html:72) and step 2 on the home page (index.html:404). Photo and caption: js/content.js:193 entrancePhoto (steps in the comment at :155-157).
- Farm map marks (parking, entrance): re-mark in the Farm Map Marker, then python3 tools/farm_map.py tools/saved-map.json (never edit js/farm-map-data.js by hand).
- README: delete the row "Entrance and parking".
- Strings: 3 changed sentences x 4 translations (+ caption x 4 if a photo is added)
- Tests: none pinned; gallery/i18n after the rebuild

**B. Keep it as is**

- No change.
- Strings: 0
- Tests: none

### d36. School tours for smaller classes

- In plain words: The page says minimum 100 students and nothing about one class of 25. A teacher with one class has no answer.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (price and rule). If no answer, B.
- Depends on: d02 (groups pricing), d27 (school tours banner), d03 (sign-up form).

**A. Smaller classes are welcome, send the price**

- Replace "Minimum group size: 100 students" in index.html:1653, pages/school-field-trips.html:45 ("Minimum 100 students") and :97 (FAQ answer, copied into the page data on rebuild). 4 ids contain "minimum": t1a6c99a0, t1b505e0c, t53653138, ta6c9295e.
- Add the price for a small class next to "$11 per student" (index.html:1652; pages/school-field-trips.html:3, 44, 93).
- Strings: 4 to 8 ids x 4 translations
- Tests: consistency MUST follow: fact "size: smallest school group (students)" (tests/consistency.test.mjs:145, min 4, regexes "Minimum group size: N students", "Minimum N students", "minimum group size ... is N students"), and the school tour price fact "$N per student" (:110, min 7)

**B. Minimum stays 100 students**

- No change.
- Strings: 0
- Tests: none

## Topic 7. Names, address and listings

Urgency: wrong or risky information.
One spelling and one name everywhere, matching Google and Facebook.

### d07. Name of the maze

- In plain words: The site says "Corn maze" in some places and "Small Sunn Hemp Maze" in others.
- Doc question: Q11
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (what the maze is made of this year).
- Depends on: d14 (the Farm Map Marker makes the map label), d13 and d32 are not related.

**A. Corn maze**

- Everywhere "Corn maze". The farm map already says "Corn maze" (js/farm-map-data.js:302, written from tools/saved-map.json:359). Change the text that says sunn hemp: index.html:343, 457, 630 (heading id t8c64d6c3), 690 (table row id t39573dd5), 814 and pages/pumpkin-patch.html:36. Line 631 ("Wander through our little maze", id tcc37b939) can stay.
- README rows "Farm map" and the maze mention (README.md:331, 403).
- Strings: 5 ids x 4 translations (t0b5eaa9e, t39573dd5, t447b4ee9, t8c64d6c3, tc2132019); the JS strings "Corn maze" and "Corn maze sign" stay
- Tests: farm-seasons: tests/farm-seasons.test.mjs:36 looks for /Maze/ (capital M) in the fall text: change it to /maze/i if the heading becomes "Corn maze"

**B. Small Sunn Hemp Maze**

- Everywhere "Small sunn hemp maze". The text already says it (5 ids). Change the map: in the Farm Map Marker (or by hand in tools/saved-map.json:359) change the label "Corn maze" to "Small sunn hemp maze", then python3 tools/farm_map.py tools/saved-map.json (rewrites js/farm-map-data.js:302). Check that the legend and the map sign (js/features.js:889, "Corn maze sign") say it too.
- The picture of the maze on the map (js/map-art.js cornMaze) is a drawing: no change.
- Strings: 1 to 2 JS strings x 4 translations (new "Small sunn hemp maze"; "Corn maze sign" if you rename it); the 5 UI ids stay
- Tests: map (legend text), i18n; farm-seasons unchanged

**C. A different name**

- Her name replaces both: the 5 ids of option A (7 places) and the map label of option B (tools/saved-map.json:359, then python3 tools/farm_map.py tools/saved-map.json).
- Strings: 5 ids + 1 to 2 JS strings x 4 translations
- Tests: farm-seasons: /Maze/ at tests/farm-seasons.test.mjs:36 if the new name has no capital M

### d28. Which Facebook page is the real one

- In plain words: Two pages show the same address: "Wise Acres" (wiseacresnc, about 20K followers) and "Wise Acres Organic Farm". The site links only wiseacresnc.
- Doc question: Q24
- Urgency: 2 (wrong or risky information). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact (only she knows which page she runs). Do not print the Facebook sign until it is answered.
- Depends on: d29 (the QR signs are printed together).

**A. Link only wiseacresnc**

- No change. https://www.facebook.com/wiseacresnc/ stays in index.html:60 (structured data), 834, 2118, 2142 and tools/qr_links.json:30 (the Facebook QR sign).
- Strings: 0
- Tests: none

**B. Link both pages**

- Add the second page next to the first: structured data sameAs (index.html:60), the links at index.html:834, 2118, 2142 with a label that tells them apart, and a second QR sign if wanted (tools/qr_links.json, then python3 tools/make_qr.py).
- Strings: 1 to 3 labels x 4 translations (new link text)
- Tests: print-qr only if a second sign is added (it counts signs, minimum 9); public-site allows any facebook.com link

**C. Link only Wise Acres Organic Farm**

- Replace the address in the same five places (index.html:60, 834, 2118, 2142, tools/qr_links.json:30) and run python3 tools/make_qr.py (new assets/qr/facebook.svg; reprint the sign).
- Strings: 0
- Tests: public-site (accepts any facebook.com address)

### d29. Instagram hashtag sign

- In plain words: Instagram usually hides hashtag pages from people who are not logged in. The sign says "Scan to see photos other families shared".
- Doc question: Q25 (partly: Q25 asks about the hashtag on the site itself, index.html:1475, 1853, 1871; that is not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): no
- Default: B until the Instagram hashtag page shows photos to a person who is not logged in (README says the same).
- Depends on: d06 (the review sign adds one sign: the count in the test), d28 (signs printed together).

**A. Print the hashtag sign**

- No change to the files. Print print/qr-signs.html as it is (README.md:225 says: print it only when the hashtag page shows photos).
- Strings: 0
- Tests: none

**B. Skip that sign**

- Delete the "hashtag" block from tools/qr_links.json (lines 20-27), run python3 tools/make_qr.py (rewrites print/qr-signs.html, deletes nothing: remove assets/qr/hashtag.svg by hand).
- README lines about the hashtag sign (README.md:219, 225).
- Strings: 0
- Tests: print-qr MUST be updated: tests/print-qr.test.mjs:13 needs at least 9 signs; there are 9 now (no review sign), so 8 fails. Lower the number to 8 (or 9 if d06 adds the review sign)

### d39. How your address is written

- In plain words: The site writes "4701 Hartis Road" in some places and "4701 Hartis Rd" in others. It should match your Google Business Profile exactly.
- Doc question: none (the doc only uses "Hartis Rd" inside question 35)
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: Whichever spelling her Google Business Profile shows. The files mostly use "Rd" (the structured data and the Drive time box do), so A touches fewer tests.
- Depends on: d40 (listing), d35 (same sentences), d11 (Drive time box address search).

**A. Rd**

- Change "Hartis Road" to "Hartis Rd": index.html:404, 2026, 2168; pages/first-visit.html:72, 175; pages/school-field-trips.html:105; tools/qr_links.json:83-84 (the directions sign, then python3 tools/make_qr.py and reprint). 6 ids: t183fef9f, tf1ab0489, t37c5399a, t65ba07a6, tae0016c1, tb405649d.
- The GreenHouse has the same split: "5503 Poplin Road" at index.html:1325 and 2038, "Poplin Rd" in 13 other places (and js/features.js:656, 711). Pick one with the farm's Google listing (d40).
- Strings: 6 ids x 4 translations (+ Poplin ids)
- Tests: none (the tests use "Rd": consistency.test.mjs:338 reads 4701 Hartis Rd; drive.test.mjs:234, 263, 353, 361 use "Rd")

**B. Road**

- Change "Hartis Rd" to "Hartis Road": index.html:249, 330, 2074; pages/first-visit.html:102; pages/strawberry-picking.html:43 (4 ids: t19a4db7d, t60ba1e75, ta15d314e, tff7999ae); the structured data streetAddress at index.html:53 (no translation); the Drive time notes in js/features.js:710-711 and the address strings at :655-656 (1 + 1 JS strings x 4: "To the farm at 4701 Hartis Rd. ..." and the GreenHouse one).
- The structured data, the Google Maps link in the Drive time box and the address search use the address as typed: keep them equal to the Business Profile.
- Strings: 4 ids + 2 JS strings x 4 translations
- Tests: consistency MUST be updated: tests/consistency.test.mjs:338 (ld.streetAddress === '4701 Hartis Rd'); drive: tests/drive.test.mjs:234, 263, 353, 361 (labels and the note text use Rd)

### d40. Does The GreenHouse have its own Google listing

- In plain words: If it does, the site can describe it separately with the same name and address wording.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact.
- Depends on: d39 (address wording), d06 (review links), d19 (what The GreenHouse sells).

**A. Yes, it has its own listing**

- Add a second business block to the structured data in index.html (lines 41-66 hold the farm's LocalBusiness; add one for "The GreenHouse", 5503 Poplin Rd, Indian Trail, NC 28079, hours Fri-Sun 10 am-8 pm, sameAs the Instagram pages index.html:61-63). No translation.
- A review button for The GreenHouse needs a second link: js/content.js has one reviewUrl (d06); a second field is a small code change (ask Claude).
- Directions and map links for The GreenHouse already exist (Drive time list, index.html Contact section).
- Name and address wording must match that listing (d39).
- Strings: 0 (data only); 1 to 2 labels x 4 if a review button is added
- Tests: consistency (address test reads JSON-LD: tests/consistency.test.mjs:338 also checks the farm block only); public-site

**B. No, one listing for both**

- No change. One listing for both: the farm's.
- Strings: 0
- Tests: none

## Topic 10. What the site says the farm offers

Urgency: wrong or risky information.
Features, prices and claims the site states as fact. They came from the farm's own wording or requests, so these are quick checks, not new decisions.

### d48. Haunted trail and u-pick tomatoes this fall

- In plain words: The home page says visitors can walk a haunted trail and u-pick tomatoes and basil every weekend until the end of October ($4.50 a pound, $1 a stem). Your farm map shows both, but we could not find them on the farm's public pages.
- Doc question: Q5, Q6, Q7
- Urgency: 2 (wrong or risky information). Checklist says: before launch.
- Owner fact (no sensible default): no
- Default: A. As far as the commit history shows, both were added from the farm side's own instructions (30 September and 1 October), and both are on her own map. Only the two prices ($4.50, $1) have no second source. (Old Q8, the number of varieties, is dropped: the site already says "more than a dozen".)
- Depends on: d13 and d32 (the tomato price-sign photo), d07 (maze name, same fall panel), d14 (the map tool), d51 (fall hours).
- Note: Old Q5, Q6 and Q7 in one card. Old Q10 (scavenger hunt) is dropped: its mentions were removed on 1 October (commit 2b09373).

**A. Both are real and the prices are right**

- No change. Both were added from the farm side's instructions (commits be1a7e7 and 9da04ae) and are drawn on her own farm map (tools/saved-map.json:548-549 "Haunted trail", and the tomato field), saved on 1 October.
- Strings: 0
- Tests: none

**B. No haunted trail this fall**

- Take the haunted trail out: index.html:212 (hero line), 345 (farm card), 624-626 (the "Haunted Trail" card in the fall panel), 690 (row in the "Season by season" table), 815 (fall tab line); pages/first-visit.html:209; pages/pumpkin-patch.html:37. 7 UI ids x 4 translations (t0b5eaa9e, t46f6aa3b, t49c35609, t4b6d3990, tb2ff1037, tb89adc3c, td6ecd1d8).
- Map: delete the "Haunted trail" mark in the Farm Map Marker (tools/saved-map.json:548-549) and run python3 tools/farm_map.py tools/saved-map.json (rewrites js/farm-map-data.js:477-478). The legend label (js/features.js:938) can stay.
- Strings: 7 UI ids x 4 translations
- Tests: farm-seasons MUST change: tests/farm-seasons.test.mjs:36 requires "Haunted" in the fall text (keep only /Maze/); map (legend and marks)

**C. No u-pick tomatoes and basil this fall**

- Remove the whole "Tomatoes & basil" section index.html:880-1112 and every link to it: hero line (index.html:212) and chip (224), the chooser card (353-354), the add-on (468), the calendar bar (862), the Shop rows (1389-1390), the FAQ answer (1938), pages/pumpkin-patch.html:64, the "tomatoes" crop in js/features.js (This week box) and the farm map mark. Ask Claude: the largest removal on this list.
- 46 UI ids and 5 JS strings mention tomatoes or basil. The photo with the price signs goes too (d13, d32).
- Strings: about 46 UI ids + 5 JS strings (unused after removal)
- Tests: consistency: tests/consistency.test.mjs:108-109 (prices) and :308-319 (tomato dates); features :77, :81, :90; hero :67, :82; farm-seasons

**D. The tomato or basil prices are different**

- Change the price in 7 sentences: index.html:468, 889, 890, 1389, 1390, 1938 and pages/pumpkin-patch.html:64. 7 UI ids x 4 translations (t1fccf389, t398007b0, t48324abe, t6b47c02f, tbbaa09ab, tcc1be24a, te71161d2).
- Strings: 7 UI ids x 4 translations
- Tests: consistency: facts "price: tomatoes, per pound" and "price: basil, per stem" (tests/consistency.test.mjs:108-109, at least 5 places each): all places must agree, no edit if they do

### d56. Two Axios news links

- In plain words: "In the news" shows two Axios Charlotte articles, from 2018 and 2017. We found them by searching and could not open them, so the headlines or years may be wrong.
- Doc question: Q28
- Urgency: 2 (wrong or risky information). Checklist says: can follow launch.
- Owner fact (no sensible default): no
- Default: A, after she opens both links once; C (hide) if she cannot before launch, because a wrong headline attributed to a newspaper is hers to defend.
- Depends on: d06 (the review buttons sit in the same Reviews section).
- Note: Old Q28.

**A. Both links are right**

- No change. README.md: delete the row "In the news".
- Strings: 0
- Tests: none

**B. One is wrong (I will say which)**

- Fix the headline, year or address of the wrong one: index.html:1837 (2018 article) or :1838 (2017 article). They carry no translation id.
- Strings: 0
- Tests: features: tests/features.test.mjs:171 expects exactly 2 Axios links in the press list

**C. Hide the news list**

- Delete the block <div class="press reveal"> index.html:1834-1839 (heading "In the news", id t94fe8b18, then unused). The comment about award badges that follows (index.html:1840) can stay.
- Strings: 0 (1 id unused)
- Tests: features MUST change: tests/features.test.mjs:171 ("press: two Axios Charlotte links open in a new tab")

### d58. Snacks and drinks in spring and summer?

- In plain words: The Season by season table says concessions and local goods are sold at the farm in spring and summer too. We ticked that ourselves; it did not come from you.
- Doc question: Q15
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact. The ticks were our plan, not her words.
- Depends on: d19 (the farm side says "hard cider", the GreenHouse side "cider"), d09 and d51 (hours).
- Note: Old Q15.

**A. Yes, also in spring and summer**

- No change. README.md: delete "The ticks for Concessions & local goods ..." from the row "Season by season".
- Strings: 0
- Tests: none

**B. Fall only**

- index.html:686 (row "Concessions & local goods"): change the spring and summer cells from the tick to a dash, like the other rows. Delete the spring and summer cards "Concessions & Local Goods / Snacks, beer, hard cider and wine, and local goods." (index.html:642-643 and :647-648).
- Strings: 0 new; 2 to 3 ids become unused
- Tests: farm-seasons (run it: it checks which cards show in each season, but names no concessions card)

**C. Only some (I will say which)**

- Change the card sentences (index.html:643 and :648) and the table cells (index.html:686) to her list.
- Strings: 2 ids x 4 translations
- Tests: farm-seasons

### d59. Do you still run summer programs?

- In plain words: Your current website has a Summer Programs page. The new site says nothing about it, and the old address /summer/ will show "page not found".
- Doc question: Q14
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Owner fact.
- Depends on: d30 (the old address /summer/), d36 (school and group rules), d27 (banners), d05.
- Note: Old Q14. Launch decision D3 in docs/LAUNCH_CHECKLIST.md asks what happens to /summer/ and /posts/.

**A. Yes, I will send the details**

- Add a page or a card for summer programs (ask Claude): a new source pages/summer-programs.html built by tools/pages.py, a link in the menu and the footer, then a redirect from the old /summer/ address (scratchpad/agents/launch2/opt/MAPPING-for-owner.txt leaves /summer/ out on purpose; add it to _redirects from OPT-A or to a redirect page from OPT-B).
- Page text, dates, ages, prices: from her.
- Strings: about 10 to 20 new ids x 4 translations
- Tests: public-site (the list of extra pages and the sitemap), consistency (new ages or prices), languages, axe

**B. No, we stopped them**

- No change. /summer/ stays "page not found" (launch decision D3, d30).
- Strings: 0
- Tests: none

**C. Not sure yet**

- No change until she answers.
- Strings: 0
- Tests: none

## Topic 8. Drive time box and map tools

Urgency: nice to have.
Works today with free outside services. The decisions are about risk, not about launch.

### d10. Free routing server behind Drive time

- In plain words: It asks for non-business use and may refuse one day. The box would then say "not working right now" and still offer the Google Maps button.
- Doc question: Q36 (and Q43, the lawyer question; Q43 is not on the dashboard)
- Urgency: 3 (nice to have). Checklist says: can follow launch; launch decision D11 (3.13).
- Owner fact (no sensible default): no
- Default: A at launch (the box fails soft to Google Maps); B if she wants it in writing. Move on only if it breaks.
- Depends on: d11 (farmPoint halves requests), d15 (connect-src names the two hosts), d38 (Mapbox token is limited to the site address).

**A. Launch as is**

- No change. Keep the weekly test (docs/LAUNCH_CHECKLIST.md section 5). If the box fails two weeks running, choose again.
- Strings: 0
- Tests: none

**B. Email the operators to ask**

- No file change. She (or Claude drafts it) writes to fossgis-routing-server@openstreetmap.de: small farm website, a visitor presses a button, one routing request per press. Keep the reply and note it under decision D11 (docs/LAUNCH_CHECKLIST.md:371).
- If they say no: option C or D.
- Strings: 0
- Tests: none

**C. Switch to Mapbox later**

- She makes a Mapbox account and a public token limited to the site address. Then (ask Claude, no patch on disk): js/features.js:658-659 (GEO_URL, ROUTE_URL), the two request functions geocode (:678) and driveBetween (:684), the three credit links (js/features.js:740), the notice "free OpenStreetMap services" (index.html:2083, id tc8c80880), _headers connect-src (only if d15 is on: https://api.mapbox.com instead of the two hosts), docs/LAUNCH_CHECKLIST.md:160 and :259-266, docs/WHAT_THE_SITE_STORES.md:49, 62, 76-84, 134-135, 172, README.md:204, 249, 340, 434.
- Strings: 1 UI id (tc8c80880) x 4 translations; credits are English only
- Tests: drive MUST be updated: tests/drive.test.mjs mocks the two current hosts (nominatim.openstreetmap.org and router.project-osrm.org); features and languages mention the box

**D. Turn the Drive time box off**

- Remove initDriveForm from the list at js/features.js:1128. The form (index.html:2070) carries hidden, so it stays hidden; the town list above the form stays.
- Update README.md:204, 249, 340, 434, docs/WHAT_THE_SITE_STORES.md:49, 62, 76-84; _headers connect-src no longer needs the two hosts (d15).
- Strings: 0
- Tests: drive: remove it from the run order (tests/run-all.mjs:18) or it fails; features and languages tests that open the box need the same

### d11. The farm's exact spot on the map

- In plain words: With the exact spot the Drive time box is faster and more exact. Right-click the farm on Google Maps and copy the two numbers.
- Doc question: Q35
- Urgency: 3 (nice to have). Checklist says: before launch; also launch item 3.13.
- Owner fact (no sensible default): yes
- Default: A (two minutes for her; halves the requests and makes the answer a second faster).
- Depends on: d10 (fewer requests to the free service), d39 (the address search text), d35 (where cars turn in).

**A. I will send the two numbers**

- js/content.js:192: farmPoint: null, -> farmPoint: { lat: 00.0000, lon: -00.0000 }, with her two numbers (steps in the comment above it, js/content.js:164-167; the code that reads it is js/features.js:655).
- No rebuild. Open the home page, press "Get drive time" with a nearby address and check the miles.
- README: delete "set farmPoint" from the Drive time row (README.md:340) and the launch list (README.md:434); docs/LAUNCH_CHECKLIST.md:333.
- If the spot is not where cars turn in, ask again (d35).
- Strings: 0
- Tests: none (the drive test sets farmPoint itself)

**B. Keep using the address search**

- No change. The box searches for the address on the first press after each page load.
- Strings: 0
- Tests: none

### d14. Try the Farm Map Marker swipe on a real phone

- In plain words: Swiping and scrolling on phones is fixed and tested here, but only a real phone can confirm it.
- Doc question: none
- Urgency: 3 (nice to have). Checklist says: not listed.
- Owner fact (no sensible default): yes
- Default: none. Only a real phone can answer it.
- Depends on: d07, d35 (the map marks come from the same tool).

**A. It works**

- No change.
- Strings: 0
- Tests: none

**B. There is a problem: I will describe it**

- No repo change. The Farm Map Marker is a private page outside the repo; the repo only receives its saved map (tools/saved-map.json, then python3 tools/farm_map.py tools/saved-map.json; README.md:92). Send the description of the problem to Claude to fix the tool.
- Strings: 0
- Tests: map (only if the saved-map format changes)

## Topic 9. Translations

Urgency: nice to have.
Four AI-written translations that no native speaker has read.

### d37. Native speakers for the translations

- In plain words: All four translations are written by AI. A person should check word choices: Vietnamese uses Southern words, Spanish says "para recoger" and "botana", Chinese says 700 degrees Fahrenheit about 370 Celsius, Hindi and Vietnamese date and clock words.
- Doc question: none (only a note in the doc: "Translation notes", and the AI note at the top of docs/QUESTIONS_FOR_THE_FARM.es.md)
- Urgency: 3 (nice to have). Checklist says: launch decision D8.
- Owner fact (no sensible default): no
- Default: A for the sentences that carry a promise (allergens, refund, prices, hours); the rest can follow.
- Depends on: d17, d18, d41, d42 (zh and vi say "service dog"), d09, d19.

**A. A native speaker checks them**

- No change now. When a speaker answers, edit the value of each id in lang/src/<code>.json (key = id of the English text; JS strings are keyed by the English text), then python3 tools/i18n.py build and python3 tools/i18n.py missing <code> (0). English never changes.
- Two optional patches on disk no longer apply (stale: es/out/es-OPTIONAL-clock-12h.patch and vi/out/vi-OPTIONAL-clock-words.patch fail on b54427b and on HEAD); ask Claude to redo them from the speaker's answer. The other translation patches (zh-C, es-C, vi-C, hi-C) are already merged in HEAD.
- Send the speaker first: the allergen line (d17), refund and cancel lines (d41, 3% fee), prices, hours and days, "700 degrees" (d18).
- Strings: 0 English; only the translation values that the speaker changes
- Tests: i18n, languages; consistency if a number, price or day changes (it compares each translation to the English)

**B. Keep the wording as is**

- No change. The AI notes stay (README.md:278 and the top of docs/QUESTIONS_FOR_THE_FARM.es.md).
- Strings: 0
- Tests: none

## What this page does not cover

- The dropped and later doc questions (table "Every doc question"). Their notes are in QUESTIONS_FOR_THE_FARM.md, section "For whoever edits the site"; its line numbers are older than these.
- Decisions D4 to D7 and D9 of the launch checklist (DNS switch date, analytics, seasonPicker, share-image style, who updates the site).
- The dashboard itself.
