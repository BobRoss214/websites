# Facts checked against the farm's live pages (3 October 2026)

**Result: the check could not be done.** From the helper's computer the network blocked the farm's own website, its Bookeo booking page, the Wise Pie order page on Square, Facebook, Instagram, Yelp and Tripadvisor (the exact message is in the first table). So not one fact below is marked "same" or "differs". Every fact is **cannot verify**.

The only tool that worked was a web search. It does not give the page; it gives a short written summary of what the search found. Those summaries are shown below as **hints**, with the exact words, and clearly labelled. Most hints agree with our site. A few point at things to look at first. A hint is not proof: a summary can be out of date, can mix years, and can repeat words from the question.

Nothing on the site was changed. The owner decides facts. The "we would change" column says what would be changed if the live page confirms the hint.

The quickest way to finish the check: a person opens the pages in the list "Pages to open" in a browser and compares them with the tables (about 15 minutes), or a helper repeats the check once the network allows the sites (see "How to repeat the check").

## What could be reached on 3 October 2026

| Source | Result |
| --- | --- |
| https://www.wiseacresorganic.com/ (the farm's own site) | Blocked: `EGRESS_BLOCKED ... Access to www.wiseacresorganic.com is blocked by the network egress proxy.` |
| https://bookeo.com/wiseacres (booking page) | Blocked: the same message for bookeo.com |
| https://wise-pie-wood-fired-at-wise-acres.square.site/ (pizza orders) | Blocked: the same message for that address |
| https://www.facebook.com/wiseacresnc/ | Blocked: the same message for www.facebook.com |
| https://www.instagram.com/wiseacresorganic/ | Blocked: the same message for www.instagram.com |
| https://www.yelp.com/biz/wise-acres-organic-farm-indian-trail-2 (a listing, not the farm's own words) | Blocked: the same message for www.yelp.com |
| https://www.tripadvisor.com/ (a listing, not the farm's own words) | Blocked: the same message for www.tripadvisor.com |
| Google Maps and the Google Business Profile | Not tried: the network refuses google.com addresses |
| Web search (19 searches, listed at the end) | Worked. It returns written summaries, not pages. These are the hints below. |

A blocked page is "cannot verify". It is never "differs".

## How to read the tables

- **Our site**: the file and words on our side. Search the file for the words in backticks (Ctrl+F).
- **Hint**: what a search summary said on 3 October 2026, in quotes, with the number of the search (S1 to S19, listed at the end). Search results named pages on the farm's own site, so the summary may come from them, but it is the search tool's wording, not a copy of the page.
- **Verdict**: always "cannot verify" today.
- Searches S10, S11, S13, S14 and S16 contained the fact they were asked about in their question words, so an "agree" from them is weak.

## Check these first (possible differences and new things)

Ordered by how soon a visitor could be affected.

| # | Fact | Our site | Hint | Verdict | If the live page confirms the hint, we would change |
| --- | --- | --- | --- | --- | --- |
| C1 | Closed on Sunday 4 October for rain | js/content.js at `closures: [],` is empty, and js/content.js at `notice: '',` is empty, so no notice shows | S17: "Wise Acres was closed on Sunday, October 4 due to rain." The date is tomorrow, so this may be a forecast notice or a mistake of the summary. | cannot verify | Put '2026-10-04' between the brackets of `closures: [],` and write the words in `notice: '',` (the file explains both in its comments). Remove them after the day. |
| C2 | Farm days and hours in fall | index.html at `data-t="t1c41eab2"` says 10 am – 4 pm at the farm; pages/pumpkin-patch.html at `Ages 3 and up. Thursday&ndash;Sunday.` says Thursday to Sunday; js/content.js at `reserved visits Thu-Sun in fall` | S11: "The farm is closed Monday-Wednesday, open Thursday-Saturday 10am-6pm, and Sunday 12pm-6pm." The same summary says the season runs "from September 13 through November 8, 2027", so it mixes years: weak. S16 says no-pizza packages are for "Thursday, Friday, Saturday, and Sunday", as on our site. | cannot verify | Only if the farm's page says 6 pm and a later Sunday start: the hours words at index.html at `data-t="t1c41eab2"` and everywhere else the pages say 10 am – 4 pm (search the files for `4 pm`), then the standard steps. |
| C3 | Pizza prices: Ricotta Pie and Halfzies | index.html at `data-t="te5f7594f"` (Ricotta Pie, $16 in the price after it) and index.html at `data-t="te2b6ab0c"` (Halfzies, $15 in the price after it) | S12 (words from the Square page): "Ricotta Pie ... - $15.00" and "Halvzies Cheese/Pepperoni ... - $15.50". The same summary gives Margherita $15 and Bee Keeper $16, as ours. But S3 says "Pizzas are priced $10-$14", which fits neither ours nor S12. | cannot verify | Ricotta Pie $16 to $15 and Halfzies $15 to $15.50 in the menu list of index.html (the price after each name), then the standard steps. |
| C4 | Spelling of the mozzarella maker | index.html at `data-t="t92529550"` says "Uno Alla Volta (UAV)"; the same name is in index.html at `data-t="t1e907c1b"` and pages/wise-pie.html at `Fresh mozzarella from Uno Alla Volta in Charlotte` | S12: "Una Alla Volta Mozz" and "Una Alla Volta Cheese" (two menu items) | cannot verify | If the maker spells it "Una": change "Uno" to "Una" in those three sentences and in the same three ids in lang/src/es.json, lang/src/hi.json, lang/src/zh.json and lang/src/vi.json, then the standard steps. If it is "Uno", nothing. |
| C5 | A main phone number | index.html at `data-t="teae7efc9"` shows only the day-of number 704-207-6347. No main number is shown anywhere (`python3 tools/check_facts.py --short`: "one day-of number and at most one main number"). | S1, S4, S7, S8 and S13 give "704-628-6232" or "(704) 628-6232" as the farm's phone. | cannot verify | Nothing unless the owner wants a main number shown. It would be a new fact (the owner's question), not a correction. |
| C6 | Exceptional Children Day: date | pages/school-field-trips.html at `<h3>Exceptional Children Day</h3>`: "A special day for exceptional children. Email Vanessa to join us." No date. | S6: "Exceptional Children Day is scheduled for Tuesday, October 6 from 10 am to 1 pm ... email vanessa@wiseacresorganic.com." | cannot verify | Add the date and time to that card. index.html at `data-t="t5efe64c3"` shows how Home School Day is written (date, time, and a `data-until` day so it hides itself afterwards). |
| C7 | When reservations without pizza open | index.html at `data-t="te6cbae6c"`: "reservations without pizza open a month or more at a time" (no dates) | S11: "Reservations without pizza for September open September 8 at 5:00pm, and reservations without pizza for October open September 29 at 5:00pm." | cannot verify | Nothing is wrong. Idea: say the next opening date. |
| C8 | What a school tour includes | pages/school-field-trips.html at `Educational farm talk tailored for students` starts the list "Your tour includes" (7 items, no scavenger hunt) | S4: "The tour includes an educational farm talk tailored for students, a small pumpkin to take home, access to a corn pit, a wagon ride through the woods, meeting and feeding farm animals, unlimited access to playground areas, an educational scavenger hunt, and picnic tables in the shaded Party Patch for lunch or snacks." | cannot verify | Add one item, "An educational scavenger hunt", to that list (before the picnic tables item), with its 4 translations, then the standard steps. |
| C9 | Exact start of the pumpkin season | pages/pumpkin-patch.html at `Mid-September through early November` (no exact date) | S1: "opens September 13, 2026." | cannot verify | Nothing is wrong. Idea: show the opening date. |

## Hints that agree with our site (still not verified)

| # | Fact | Our site | Hint |
| --- | --- | --- | --- |
| A1 | Pizza package: $31 base with 2 pizzas, plus $3 per person (ages 3+), Friday to Sunday | index.html at `data-t="t661d94cd"` and index.html at `data-t="te9a8e62d"` | S2: "The base reservation price is $31 and includes 2 Wise Pie pizzas (each serving approximately 2-3 adults or 3-4 children) plus $3 per person for ages 3 and up." S10: "YES PIZZA & fall fun packages are available Friday, Saturday & Sunday." |
| A2 | No-pizza visit: $3 per person ages 3+, ages 2 and under free | pages/pumpkin-patch.html at `Farm fun, no pizza` | S2: "There's also a no-pizza option with a $3 per person field fee for ages 3+." S16: "...$3 per person for ages 3 and up, with infants 2 and under free." |
| A3 | Corn pit $4, buy one get one free on Thursdays | pages/pumpkin-patch.html at `Buy one, get one free on Thursdays with reservations.` | S2: "Corn pit costs $4 per person (with a buy one/get one free offer on Thursdays with reservations)" |
| A4 | Wagon ride $4.50, ages 2 and younger free | index.html at `data-t="tb65a930a"` (2 places) | S2: "Wagon rides are $4.50 per person (with children 2 years and younger riding free)" |
| A5 | Barrel train: ages 12 and under | index.html at `data-t="t3a8eb034"` (2 places) | S15: "The barrel train is available for younger farmers 12 and under." (no price in the hint) |
| A6 | Pizza reservations open every Tuesday at 5:00 PM, after the forecast check | index.html at `data-t="t16a7a4ce"` | S10: "Reservations with YES pizza open every Tuesday at 5:00pm for the upcoming weekend (after we check the forecast)." (weak: the question had the time) |
| A7 | Pizzas are ready 1 hour after the reservation time | index.html at `data-t="td4abc72c"` | S10: "Pizzas will be ready for pick-up 1 hour after reservation time so please plan accordingly." |
| A8 | The GreenHouse Friday to Sunday 10 am – 8 pm; Wise Pie 4 – 8 pm | js/content.js at `Fri-Sun, 10 am-8 pm` and js/content.js at `Wise Pie at The GreenHouse, 4-8 pm` | S3: "The GreenHouse is open Friday-Sunday, 10:00am-8:00pm, with Wise Pie pizza available first come first serve from 4:00-8:00pm." |
| A9 | The GreenHouse needs no reservation; it is outdoors and may close suddenly | index.html at `data-t="t54bad66d"` | S14: "No reservations required at the GreenHouse" and "It is an outdoor venue and may close suddenly for inclement weather" |
| A10 | The GreenHouse sells beer, wine, cider, Waxhaw Creamery ice cream | index.html at `data-t="t3517c259"` | S14: "Outdoor dining, beer/wine/ciders, Waxhaw Creamery ice cream, & local goods" |
| A11 | Change a reservation free until 11:59 PM the night before; refund minus the 3% card fee; full refund for severe weather | pages/first-visit.html at `You can change your reservation at no charge until 11:59 PM the night before your visit` (2 places) and index.html at `data-t="t40668596"` | S5: "You may change your reservation at no charge until 11:59 PM the night before your scheduled visit." "we will refund your reservation minus the 3% credit card processing fee" "if severe weather requires us to close the farm, we will provide a full refund." |
| A12 | Change a booking with the "View Booking" button; a reservation can go to someone else | index.html at `data-t="t1d278ed3"` and pages/first-visit.html at `You can give your reservation to someone else.` | S5: "click the "View Booking" button at the bottom" and "Reservations are transferable. The person attending can simply check in under the reservation name." |
| A13 | School tours: $11 per student, at least 100 students, parents and siblings 3+ pay $11 | pages/school-field-trips.html at `<dd>$11 per student</dd>` and pages/school-field-trips.html at `<dd>Minimum 100 students</dd>` | S4: "The school tour pricing is $11 per student with a minimum group size of 100 students." "Accompanying parents and siblings ages 3 and older are required to pay the $11 admission fee if they attend the tour." |
| A14 | Private party: $300, 2.5 hours (2 hours plus 15 minutes each end), up to 50 guests, ages 2 and under free | index.html at `data-t="t241f1f9b"`, index.html at `data-t="tae3096fe"` and index.html at `data-t="tc38820e6"` | S9: "Private parties are $300 for 2.5 hours, which includes 2 hours of party time plus 15 minutes on each end for set-up and clean-up." "Parties may include up to 50 guests. Children 2 and under are free and do not count toward the total." |
| A15 | Home School Day: Tuesday 3 November, 9 am – 1 pm, sign-ups from 29 September | index.html at `data-t="t5efe64c3"` | S7: "Home School Days are scheduled for November 3 from 9:00am-1:00pm, with information and reservation sign-ups opening on 9/29." |
| A16 | Addresses and ZIP | 4701 Hartis Rd and 5503 Poplin Rd, 28079: `python3 tools/check_facts.py --short` says every place agrees (51, 71 and 21 places) | S3: "Wise Acres is located at 4701 Hartis Road, Indian Trail, NC 28079, and The GreenHouse is at 5503 Poplin Rd, Indian Trail, NC 28079." |
| A17 | E-mail addresses | cathy@ (15 places), vanessa@ (7), ava@ (2), pranee@ (2) | S8: "Email: cathy@wiseacresorganic.com". S3: "For Wise Pie Wood Fired Pizza questions, you can contact ava@wiseacresorganic.com." S6: "email vanessa@wiseacresorganic.com". Nothing for pranee@. |
| A18 | Christmas trees from the Friday after Thanksgiving to early December | index.html at `data-t="t8aea10f7"` | S18: "Wise Acres' NC Christmas tree season runs from Friday after Thanksgiving through early December." |
| A19 | Strawberries usually mid-April to early June | index.html at `data-t="t97654aca"` | S19: "Strawberry season typically runs mid-April through early June" |
| A20 | Pizza: 12 inches, sold whole; vegan cheese and gluten-free crust; 700-degree oven | pages/wise-pie.html at `12 inches each, sold whole only, not by the slice`; index.html at `data-t="t82b84514"` and index.html at `data-t="t2e4c72d1"` | S3: "Each pizza is 12 inches and sold as a whole pie only" "Vegan cheese and gluten-free crust options are available." "cooked in a 700-degree wood-fired oven" |

## Facts no hint covered

- Tomatoes $4.50 per pound and basil $1 per stem (index.html at `data-t="t1fccf389"`). S13 said: "the search results don't contain the specific pricing you mentioned ($4.50 per pound for tomatoes) or information about basil stems."
- The day-of number 704-207-6347 (index.html at `data-t="teae7efc9"`) and the e-mail pranee@wiseacresorganic.com.
- The other pizza prices: Cheese $15, The Farmer Cathy $16, Pepperoni $16, Nitrate Free Pepperoni $17, The Dill Pickle $15 (S12 gave no price for Pepperoni or Dill Pickle).
- The pizza weekend table (index.html at `data-release="2026-10-13"` and its neighbours), the barrel train price ($3 per child), and everything on the Bookeo and Square pages.

## Ideas (things the hints mention that our site does not say)

These are not changes. The owner decides.

- A main phone number: 704-628-6232 (C5).
- Exact opening dates: pumpkin season from 13 September (C9), and the dates when no-pizza reservations open (C7).
- Exceptional Children Day: Tuesday 6 October, 10 am – 1 pm (C6).
- A zip line, climbing and swings: S15 said "a corn maze, climbing activities, swings, and a zip line in their recycled tire playground and wooded park". That wording seems to come from review sites, not the farm. Our site says "a small sunn hemp maze" and the playgrounds, and no zip line.
- Busy-hour note for pizza reservations: S10 gave this text, which reads like the farm's own FAQ: "When reservations first open there is often excessive traffic that results in temporary "error" messages. This does not mean reservations are full." Our site has no such note.
- A scavenger hunt on the farm visit: S1 says a farm reservation includes "access to the pumpkin and flower fields, animals, playgrounds, a small maze, scavenger hunt and shaded picnic areas". Our site mentions a scavenger hunt nowhere (for school tours see C8).

## Pages to open (the search listed these on the farm's site)

https://www.wiseacresorganic.com/ , /wiseacres , /schooltours , /food , /the-greenhouse , /faq , /contact , /parties/ (all on www.wiseacresorganic.com), then https://bookeo.com/wiseacres, https://wise-pie-wood-fired-at-wise-acres.square.site/, https://www.facebook.com/wiseacresnc/ and https://www.instagram.com/wiseacresorganic/. The search results showed these addresses; this check could not open them.

## How to repeat the check

1. Let the network reach the sites. In Claude Code on the web: the cloud environment menu in the session's title bar, then Edit, then Network access. Choose Custom and add these under Allowed domains (keep the default list of package managers): wiseacresorganic.com, www.wiseacresorganic.com, bookeo.com, square.site, wise-pie-wood-fired-at-wise-acres.square.site, www.facebook.com, www.instagram.com. Steps: https://code.claude.com/docs/en/cloud-environments#network-access
2. Ask the helper: "Re-check every fact against the live pages and update docs/FACTS_CHECKED_AGAINST_LIVE_SITE.md."
3. The helper runs `python3 tools/check_facts.py --short` (the 21 key facts and where each appears), opens each page in "Pages to open", and copies the exact words with the page address and the day. For each fact it writes **same**, **differs** or **cannot verify**. A page that is blocked or gone is "cannot verify", never "differs". It never fills in a form and never logs in.
4. Differences are not fixed by the helper. Each goes to the owner as a question (docs/QUESTIONS_FOR_THE_FARM.md). After the owner answers, the standard steps apply: `docs/DECISION_PLAYBOOK.md`, section "The standard steps".
5. Without a helper: a person opens the pages, reads the tables above, and tells the helper which rows are wrong.

## The searches (exact words, all on 3 October 2026)

- S1: Wise Acres Organic Farm Indian Trail NC pumpkin patch 2026
- S2: wiseacresorganic.com fall 2026 pumpkin patch farm reservation price per person wagon ride corn pit
- S3: Wise Pie wood-fired pizza Wise Acres The GreenHouse Indian Trail hours menu prices
- S4: Wise Acres Organic Farm school field trips price per student Indian Trail NC
- S5: Wise Acres Organic Farm cancellation refund policy reservation Bookeo
- S6: Wise Acres Organic Farm Exceptional Children Day 2026 Indian Trail
- S7: Wise Acres Organic Farm Home School Day November 2026 hours reservation
- S8: Wise Acres Organic Farm contact phone email wiseacresorganic.com/contact
- S9: Wise Acres Organic Farm private party Party Patch price guests maximum
- S10: Wise Acres Organic Farm FAQ pizza reservations open Tuesday 5:00 PM upcoming weekend pre-purchased reservation package (the question holds the Tuesday time)
- S11: Wise Acres Organic Farm fall 2026 Thursday Friday Saturday Sunday 10 am 4 pm reservations pumpkin season opens September (the question holds days and hours; the answer disagreed with them)
- S12: Wise Pie menu Margherita Pepperoni Bee Keeper Dill Pickle Ricotta Pie Halfzies price Wise Acres Fall Menu 2026
- S13: Wise Acres Organic Farm tomatoes u-pick $4.50 per pound basil stem 2026 (the question holds the price)
- S14: The GreenHouse Wise Acres 5503 Poplin Rd hours Friday Saturday Sunday 10am 8pm no reservation needed (the question holds the hours)
- S15: Wise Acres Organic Farm Indian Trail 2026 new this year zip line barrel train playground tomatoes announcement
- S16: Wise Acres Organic Farm reservations October 2026 open September 29 5:00pm without pizza (the question holds the date)
- S17: Wise Acres Organic Farm closed this weekend weather facebook wiseacresnc October 2026
- S18: Wise Acres Organic Farm Christmas trees Winter Wonderland GreenHouse 2026 dates Friday after Thanksgiving
- S19: Wise Acres Organic Farm strawberry picking 2026 price per pound season dates April May reservations

Two searches gave numbers that fight each other, so they are not used: strawberries "$3.69/pound" (S13) against "$4.19/pound" (S19). Our site does not state a strawberry price.
