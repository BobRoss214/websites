# Mystery visitors: can real people find what they need on this site?

Dated 3 October 2026. The test itself was reading and clicking only. Updated the same day after the first round of fixes: what was fixed is marked **Fixed** and listed in "Fixed after the first run" below.
Tested on the site at commit f176745, with the page clock set to Saturday 3 October 2026, 10:30 am, New York time. The fixed routes were measured again on the tree with the fixes.

## The short answer

- Six pretend visitors tried 10 jobs each on the English site (60 tries): **21 found, 23 partly, 14 not on the site, 2 found but the site says two different things.**
- The easy jobs are easy: the Reserve button (1 tap), dogs, paying by card, what to bring, the pizza menu and prices, the party price, finding Spanish.
- The questions that decide whether a family comes at all are the weakest ones: where to park, what happens in the rain on the day, strollers and wheelchairs, how long a visit takes, and how to reach a person on the day.
- A teacher with 40 children reads "Minimum group size: 100 students" and finds nothing else for a class that size.
- A birthday-party host finds the price and the rules but not the days, the start time, a deposit, a rain plan or whether pizza can be added.
- Spanish and Hindi: the same three jobs (book for 4, cost with pizza, pizza without a reservation) work with the same effort as in English. Only names are left in English. One difference: at desktop width the Spanish menu collapses into the menu button, so each menu use costs one more tap.
- Fixed since (using only words the site already had): the home FAQ now answers parking, strollers and wheelchairs, and what to bring; the first-visit rain box now says what happens when you cancel; the Groups area links to the school page. The rest needs a decision from the lead or a fact from the farm. The "ask the farm" lists say which.

## How the test was done

- A real browser (Playwright, Chromium) at two sizes: a phone, 390 x 844 with touch, and a desktop, 1280 x 800. Each job starts on the home page (`index.html`). The season preview buttons were off, as on launch day.
- The visitor may only do what a person can: scroll, read, tap the menu, a tab, a FAQ box or a link, and use the browser's find-in-page (Ctrl+F). The script uses nothing a visitor cannot see: a closed FAQ box is opened first, a tab is tapped first, and a link is tapped, not followed off the site.
- What is counted: **taps** (the menu button counts, each menu item counts), **scrolls** (one swipe is 85% of the screen height; a long scroll counts every screen), **page loads**, and **searches**.
- Seconds are an estimate, not a stopwatch: 1.5 s per tap, 1.2 s per scroll, 2 s per page load, 6 s to open and use find-in-page plus 1 s for each extra match, and 0.25 s per word read. A real visitor is slower. Use the numbers to compare tasks, not as promises.
- Find-in-page is imitated like this: it finds words on screen and inside closed FAQ boxes (a browser opens those), and it does not find words inside a tab that is not selected.
- Results: **Y** = found; **P** = partly (some of the answer, or only by guessing); **N** = the site does not say; **C** = found, but the site gives two different answers.
- The "exact words" columns are copied from the page. "The site does not say" is a valid result and is written as such.
- Not tested: the pages on other websites (the booking site, the school sign-up form, the maps), screen readers, real phones, and Chinese and Vietnamese.
- The pages used: `index.html`, `first-visit.html`, `strawberry-picking.html`, `pumpkin-patch.html`, `wise-pie.html` and `school-field-trips.html`.

Two facts about the pages that shape every result:

- The home page is **66 screens long on a phone** (44 on a desktop). The phone menu has 13 items and a Reserve button, and needs scrolling.
- The top menu has no link to the pumpkin-patch, strawberry, Wise Pie or school pages. The strawberry page is linked only from the footer (the school page was too, until the fix below); the pumpkin-patch page from the footer and one button on the home page; the Wise Pie page from the footer and the pumpkin-patch page. On a phone the footer is about 66 screens down, so reaching the school page through the footer cost about 76 scrolls (51 on a desktop) before the fix.

## The six visitors

- P1: parent with a toddler and a stroller.
- P2: grandparent with a wheelchair.
- P3: teacher booking a school trip for 40 children.
- P4: someone planning a birthday party for 20.
- P5: tourist from another state, no car seat, no cash.
- P6: Spanish-speaking family (on the English site first; the same three jobs in Spanish and Hindi are in their own section).

## Results: task by visitor

A letter means that visitor tried that task and got that result. A dot means that visitor did not try it. Task numbers are only labels.

| Task | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| T01 Book a visit for 4 | Y | . | . | . | Y | Y |
| T02 Cost for 2 adults + 2 kids (one is 2) + pizza | P | . | . | . | . | P |
| T03 Are dogs allowed? | . | . | . | . | . | Y |
| T04 Where do we park? Is it free? | P | P | . | P | P | . |
| T05 Restrooms (and a baby-changing place)? | P | Y | Y | . | . | . |
| T06 Can I take a stroller? | P | . | . | . | . | . |
| T07 Is the farm wheelchair accessible? | . | P | . | . | . | . |
| T08 What if it rains? Money back? | . | . | N | N | . | P |
| T09 Can I pay by card (no cash)? | . | . | . | . | Y | Y |
| T10 What to wear and bring? | Y | . | . | . | . | . |
| T11 When are you open this week? | . | P | . | . | P | . |
| T12 Pizza without a reservation? | . | . | . | C | . | C |
| T13 How long does a visit take? | N | N | . | . | . | . |
| T14 Gluten-free, vegan, allergies? | . | . | . | P | . | . |
| T15 Where is the farm, where is The GreenHouse, how far from Charlotte? | . | . | . | . | Y | . |
| T16 How do I reach someone today? | . | P | P | . | . | P |
| T17 How do I book a school tour? | . | . | Y | . | . | . |
| T18 School tour price; do teachers and parents pay? | . | . | P | . | . | . |
| T19 School tour for 40 children? | . | . | P | . | . | . |
| T20 School tour: grades, how long, time, dates? | . | . | P | . | . | . |
| T21 Where can the children eat lunch? | . | . | Y | . | . | . |
| T22 How do I book a birthday party? | . | . | . | Y | . | . |
| T23 Party price; what is included? | . | . | . | Y | . | . |
| T24 Party rules: guests, time, cake, decorations, alcohol | . | . | . | Y | . | . |
| T25 Party: days, start times, deposit, rain, add pizza? | . | . | . | N | . | . |
| T26 What happens in winter? | . | . | . | . | P | . |
| T27 Wheelchair on the wagon ride? What are the paths like? | . | N | . | . | . | . |
| T28 Shade and somewhere to sit and rest? | Y | Y | . | . | . | . |
| T29 Can we bring our own food and drinks? | . | . | . | P | . | . |
| T30 Find the site in Spanish | . | . | . | . | . | Y |
| T31 Is the booking page itself in Spanish? | . | . | . | . | . | N |
| T32 Getting there without a rental car (rideshare, bus) | . | . | . | . | N | . |
| T33 Is it OK for a 2-year-old? What do little ones do? | Y | . | . | . | . | . |
| T34 Change or cancel my booking | . | . | . | . | Y | . |
| T35 How much is a pumpkin? | N | . | . | . | . | . |
| T36 See the pizza menu and prices first | . | . | . | Y | . | . |
| T37 Car seat for a child (we fly in) | . | . | . | . | N | . |
| T38 Where does a school bus park and drop the children? | . | . | N | . | . | . |
| T39 Can the school pay by invoice, purchase order or check? | . | . | N | . | . | . |
| T40 Can I write or call in Spanish? | . | . | . | . | . | N |
| T41 Paths for a wheelchair or stroller (gravel, grass, mud, hills) | . | N | . | . | . | . |
| T42 A place to buy water, a snack or lunch (not pizza) | . | . | . | . | P | . |
| T43 How early do we arrive? When is check-in? | . | P | . | . | . | . |

### Count per visitor

| Visitor | Found (Y) | Partly (P) | Not on the site (N) | Two answers (C) |
|---|---|---|---|---|
| P1 Parent with a toddler and a stroller | 4 | 4 | 2 | 0 |
| P2 Grandparent with a wheelchair | 2 | 5 | 3 | 0 |
| P3 Teacher booking a trip for 40 children | 3 | 4 | 3 | 0 |
| P4 Birthday party for 20 | 4 | 3 | 2 | 1 |
| P5 Tourist from another state, no car seat, no cash | 4 | 4 | 2 | 0 |
| P6 Spanish-speaking family | 4 | 3 | 2 | 1 |
| All six (60 tries) | 21 | 23 | 14 | 2 |

P2 (the wheelchair) fares worst: 3 not on the site and 5 partly. P3 (the school) has the most dead ends for a single purpose. P1 and P5 are served by what exists, but the answers that matter to them are partial.

## Task by task

Taps / scrolls / seconds are for the best route that found the answer. A "first-visit" route means: menu button, "First-visit guide" (a page load) and the shortcut. For N results the numbers are the effort spent looking (a search, or a page) and the words in the "exact words" cell say "nothing".

| Task | Result | Where (page > section) | Phone: taps / scrolls / seconds | Desktop: taps / scrolls / seconds | The exact words on the page |
|---|---|---|---|---|---|
| T01 Book a visit for 4 | Y | Home page: top bar and the first button under the logo | 1 / 0 / 9 s | 1 / 0 / 9 s | Reserve your visit (button) / Reserve your time (top bar) |
| T02 Cost for 2 adults + 2 kids (one is 2) + pizza | P | Home page: Visit > Choose your package > "Yes pizza" | 2 / 5 / 22 s | 1 / 3 / 18 s | $31 base price / Includes 2 Wise Pie pizzas, plus $3 per person (ages 3+). / Children age 2 and younger are free. |
| T03 Are dogs allowed? | Y | First-visit guide > Dogs; Home page > FAQ > "Are dogs allowed?" | 3 / 0 / 11 s | 3 / 0 / 11 s | Unfortunately, pets must stay home because of liability and food-safety regulations. We love dogs! Service animals are welcome. |
| T04 Where do we park? Is it free? | P | First-visit guide > Parking; Home page > "Head to the farm" | 3 / 0 / 12 s | 3 / 0 / 12 s | We are in a neighborhood on Hartis Road with limited parking. Vehicles are not allowed in the fields, barn or garden areas. |
| T05 Restrooms (and a baby-changing place)? | P | First-visit guide > Bathrooms; Home page > FAQ (closed) | 3 / 0 / 17 s | 3 / 0 / 17 s | We offer portable toilets (porta-johns) and portable hand-washing stations with foot pumps throughout the farm. One toilet is accessible for people with disabilities. |
| T06 Can I take a stroller? | P | First-visit guide only > Accessibility & comfort > Strollers & wheelchairs | 3 / 0 / 16 s | 3 / 0 / 16 s | If you have questions about getting around with a stroller or wheelchair, please email us before you come. |
| T07 Is the farm wheelchair accessible? | P | First-visit guide only > Strollers & wheelchairs, and Porta-johns | 3 / 0 / 21 s | 3 / 0 / 21 s | If you have questions about getting around with a stroller or wheelchair, please email us before you come. / One toilet is accessible for people with disabilities. |
| T08 What if it rains? Money back? | P | First-visit guide > Changes and rain; Home page > FAQ > "What is your rain policy?" (closed) | 2 / 1 / 16 s | 2 / 1 / 16 s | We’re farmers, so a little rain doesn’t close the farm. / You can change your reservation at no charge until 11:59 PM the night before your visit / If you cancel by then, we refund the cost of your reservation, minus the 3% credit card processing fee / If severe weather forces us to close, we’ll email you and give a full refund |
| T09 Can I pay by card (no cash)? | Y | First-visit guide > Paying; Home page > FAQ (closed); GreenHouse card | 2 / 2 / 11 s | 2 / 1 / 10 s | Cash is preferred. We also accept all major credit cards, Apple Pay and Google Pay. |
| T10 What to wear and bring? | Y | First-visit guide > What to bring (a tick list) | 2 / 5 / 16 s | 2 / 2 / 12 s | Shoes that can get dirty / Sunscreen and a hat / Water and a snack for the shady picnic spots / Cash, a card, Apple Pay or Google Pay |
| T11 When are you open this week? | P | Home page: top chips; Visit > package days; GreenHouse > hours | 2 / 7 / 14 s | 1 / 3 / 7 s | Friday–Sunday, 10 am–8 pm (The GreenHouse) / Thursday, Friday, Saturday & Sunday (No pizza) / Friday, Saturday & Sunday (Yes pizza) |
| T12 Pizza without a reservation? | C | Home page: Pizza > At The GreenHouse; FAQ > "How can I enjoy Wise Pie pizza?" | 2 / 1 / 15 s | 1 / 3 / 16 s | First come, first served: eat there or take your pizza with you. / No reservation and no farm access. / At The GreenHouse, Friday–Sunday, 4:00–8:00 PM: no reservation is required |
| T13 How long does a visit take? | N | Not on the site | 2 / 0 / 16 s | 2 / 0 / 16 s | (nothing) |
| T14 Gluten-free, vegan, allergies? | P | Home page: Pizza (line under the oven) and Fall Menu 2026; Ingredients & sources (closed) | 2 / 2 / 7 s | 1 / 1 / 4 s | Vegan cheese and gluten-free crust available / Wholly Wholesome gluten-free crust +$9 / Follow Your Heart vegan cheese +$3 |
| T15 Where is the farm, where is The GreenHouse, how far from Charlotte? | Y | Home page: Visit > Two places, one family; Contact > Drive time | 2 / 0 / 7 s | 1 / 0 / 5 s | Wise Acres has two spots side by side. / 4701 Hartis Rd / 5503 Poplin Rd / Uptown Charlotte about 30 minutes |
| T16 How do I reach someone today? | P | Home page: Contact (email only). The only phone number is under Flowers & photos > Buy a pass | 2 / 3 / 9 s | 2 / 0 / 6 s | General questions & to reach Cathy cathy@wiseacresorganic.com / Day-of emergencies: call or text 704-207-6347 |
| T17 How do I book a school tour? | Y | Home page: Groups > School tours | 3 / 2 / 10 s | 3 / 1 / 9 s | To reserve a tour, fill out the sign-up form and we’ll contact you shortly. |
| T18 School tour price; do teachers and parents pay? | P | Home page: Groups > School tours (the price card) | 2 / 4 / 15 s | 2 / 1 / 12 s | $11 per student / If parents and siblings ages 3 and older come on the tour, they pay the $11 admission fee. |
| T19 School tour for 40 children? | P | Home page: Groups > School tours; School field trips page | 2 / 3 / 8 s | 2 / 0 / 4 s | Minimum group size: 100 students |
| T20 School tour: grades, how long, time, dates? | P | Home page: Groups > School tours | 2 / 6 / 26 s | 2 / 1 / 20 s | preschool and elementary school students / Traditional Fall School Tours — NOW BOOKING / Exceptional Children Day Tuesday, Oct 6, 10 am–1 pm |
| T21 Where can the children eat lunch? | Y | Home page: Groups > Your tour includes | 2 / 3 / 9 s | 2 / 1 / 7 s | Picnic tables in the shaded Party Patch for lunch or snacks |
| T22 How do I book a birthday party? | Y | Home page: Groups > Parties tab (not the tab shown first) | 4 / 2 / 19 s | 4 / 1 / 18 s | Thank you for thinking of the farm for your special celebration! Your party takes place in our private party patch, with picnic tables and plenty of shade. (Book a party / Ask a question) |
| T23 Party price; what is included? | Y | Home page: Groups > Parties tab > How it works | 3 / 4 / 13 s | 3 / 1 / 9 s | $300 per party / The per-person farm entry fee is included in the party cost |
| T24 Party rules: guests, time, cake, decorations, alcohol | Y | Home page: Groups > Parties tab > How it works | 3 / 4 / 27 s | 3 / 1 / 23 s | Up to 50 guests. / 2.5 hours: 2 hours of party time, plus 15 minutes before for set-up and 15 minutes after for clean-up / Bring cake and snacks for your guests / Decorate your party space however you like / Please do not bring your own alcohol |
| T25 Party: days, start times, deposit, rain, add pizza? | N | Parties tab says none of this | 3 / 1 / 13 s | 3 / 0 / 12 s | (nothing; the tab has no word about days, times, deposit, rain or pizza) |
| T26 What happens in winter? | P | Home page: Seasons > Winter tab; On the Farm > Winter | 3 / 1 / 9 s | 2 / 1 / 7 s | Friday after Thanksgiving to early December / No reservation needed at The GreenHouse |
| T27 Wheelchair on the wagon ride? What are the paths like? | N | Not on the site | 2 / 2 / 8 s | 1 / 1 / 5 s | (nothing; the wagon card says only: Extra fun you can add to your fall visit.) |
| T28 Shade and somewhere to sit and rest? | Y | First-visit guide > Shade & a snack break | 2 / 8 / 19 s | 2 / 5 / 16 s | Every reservation includes the shaded picnic patch, so you can cool off, have a snack and take a break. |
| T29 Can we bring our own food and drinks? | P | First-visit guide > What to bring; Home page > On the Farm | 2 / 5 / 15 s | 2 / 2 / 12 s | Water and a snack for the shady picnic spots / Bring cake and snacks for your guests (parties) |
| T30 Find the site in Spanish | Y | Header: the globe button (reads "EN"); footer language list; a Spanish phone gets an offer bar | 2 / 0 / 5 s | 2 / 0 / 5 s | Language: English > Español. A phone set to Spanish shows: ¿Prefieres ver este sitio en español? Sí, en español / No, gracias |
| T31 Is the booking page itself in Spanish? | N | Not on the site (the booking site is another website) | 1 / 0 / 2 s | 1 / 0 / 2 s | (nothing) |
| T32 Getting there without a rental car (rideshare, bus) | N | Not on the site | 2 / 1 / 5 s | 2 / 2 / 6 s | (nothing; only a Get directions button and Apple Maps / Waze links) |
| T33 Is it OK for a 2-year-old? What do little ones do? | Y | First-visit guide > Little ones | 2 / 9 / 22 s | 2 / 5 / 17 s | There are playgrounds and animals to visit. Children age 2 and younger are free. Wagon rides cost extra, and ages 2 and younger ride free. |
| T34 Change or cancel my booking | Y | Home page > FAQ > "How do I change or cancel my reservation?" (closed) | 3 / 3 / 15 s | 3 / 1 / 13 s | Open your confirmation or reminder email and click the “View Booking” button at the bottom. |
| T35 How much is a pumpkin? | N | Home page: Shop > Pumpkin prices | 2 / 1 / 5 s | 1 / 0 / 3 s | U-pick pumpkins: Prices coming soon / NC pumpkins: Prices coming soon |
| T36 See the pizza menu and prices first | Y | Home page: Pizza > Fall Menu 2026 | 2 / 3 / 10 s | 1 / 2 / 7 s | Margherita $15 homemade dough, tomato sauce, cheese, fresh basil |
| T37 Car seat for a child (we fly in) | N | Not on the site | 2 / 0 / 11 s | 2 / 0 / 11 s | (nothing) |
| T38 Where does a school bus park and drop the children? | N | Not on the site | 3 / 0 / 12 s | 3 / 0 / 12 s | (nothing; only a photo caption: School bus at the farm) |
| T39 Can the school pay by invoice, purchase order or check? | N | Not on the site | 0 / 0 / 6 s | 0 / 0 / 6 s | (nothing) |
| T40 Can I write or call in Spanish? | N | Not on the site (a hidden note on the email-list form says it notes the page language) | 2 / 2 / 7 s | 2 / 0 / 5 s | (nothing visible) |
| T41 Paths for a wheelchair or stroller (gravel, grass, mud, hills) | N | Not on the site | 2 / 0 / 11 s | 2 / 0 / 11 s | (nothing) |
| T42 A place to buy water, a snack or lunch (not pizza) | P | Home page: On the Farm > Concessions & Local Goods | 2 / 1 / 7 s | 1 / 1 / 5 s | Snacks, beer, hard cider and wine, local goods and NC pumpkins. / Prices coming soon |
| T43 How early do we arrive? When is check-in? | P | Home page: Head to the farm; First-visit guide > When you arrive | 2 / 0 / 12 s | 2 / 0 / 12 s | Check in under the name on your reservation. |

### Notes on the tasks

What is missing, what was odd, and the words a visitor would look for when the answer is not there.

- **T01 Book a visit for 4** (Y): The button opens the booking site (a different website, not opened in this test). Nothing here says how many people fit in one booking or where you type "4".
- **T02 Cost for 2 adults + 2 kids (one is 2) + pizza** (P): No total and no worked example. The visitor works out $31 + 3 people x $3 = $40, but the site does not say whether the $31 already covers anyone.
- **T03 Are dogs allowed?** (Y): Same answer in 6 places. One closed section says something different about service dogs (contradiction 3).
- **T04 Where do we park? Is it free?** (P): Does not say where to park, whether it is free, or how many cars fit. Searching "free" finds nothing about parking. **Fixed in part:** the home FAQ now has "Where do I park?" (same words); the facts are still missing.
- **T05 Restrooms (and a baby-changing place)?** (P): Toilets: yes. Baby changing: the site does not say (searching diaper, changing, nappy, baby finds only "Baby goat").
- **T06 Can I take a stroller?** (P): No yes or no. The word "stroller" is not on the home page at all (Ctrl+F finds 0). **Fixed in part:** the home FAQ now has "Can I bring a stroller or wheelchair?" (Ctrl+F finds 2 matches); the answer is still "email us".
- **T07 Is the farm wheelchair accessible?** (P): No statement about paths, ramps, the wagon or the GreenHouse. The word "wheelchair" is not on the home page. **Fixed in part:** the home FAQ now carries the word and the same sentence.
- **T08 What if it rains? Money back?** (P): Does not say what happens if you do not want to go in light rain on the day itself. The 3% fee is only in the closed home-page FAQ. Nothing at all for school tours or parties. **Fixed in part:** the First-visit guide now shows the refund and 3% line too.
- **T09 Can I pay by card (no cash)?** (Y): Clear and the same in 4 places. "Cash is preferred" comes first, which may worry a no-cash visitor for a second.
- **T10 What to wear and bring?** (Y): Only on the First-visit guide. Searching the home page for "wear" or "boots" finds nothing useful. **Fixed:** the home FAQ now has "What should we bring?" with the six checklist lines (Ctrl+F "shoes" finds it).
- **T11 When are you open this week?** (P): Days: yes. The hours of the u-pick farm itself are not stated (10 am to 4 pm shows up only as the pizza time at the farm). Seats left this week: not shown (the table is hidden).
- **T12 Pizza without a reservation?** (C): Answer found, but two other cards say the GreenHouse has pizza from 10 am (contradiction 2).
- **T13 How long does a visit take?** (N): Words a visitor would look for: how long, hours, duration, "plan on". Ctrl+F for those finds only drive times.
- **T14 Gluten-free, vegan, allergies?** (P): Vegan and gluten-free: yes. No allergen words at all (nut, dairy, wheat, cross-contact). The ingredient list is inside a closed box.
- **T15 Where is the farm, where is The GreenHouse, how far from Charlotte?** (Y): The drive-time list does not say which of the two places it is measured to (they are side by side).
- **T16 How do I reach someone today?** (P): Contact has email addresses and no phone. The number is in the photographer-pass box. A phone visitor’s bottom bar says Reserve, Directions, Email: no Call.
- **T17 How do I book a school tour?** (Y): Form link and "Email Vanessa" are both there. The form is another website (not opened).
- **T18 School tour price; do teachers and parents pay?** (P): Teachers, aides and bus drivers: the site does not say.
- **T19 School tour for 40 children?** (P): The site says no (minimum 100) and offers nothing for a class of 40. **Fixed in part:** the School tours tab now links to the school page (3 taps, 15 s, instead of the footer).
- **T20 School tour: grades, how long, time, dates?** (P): Grades: yes. Tour length, start time and open dates: not there. Home School Day: "sign-ups opened on Sep 29" with no link (the School field trips page sends you back to the home page).
- **T21 Where can the children eat lunch?** (Y): Not said: what happens with 100 children in the rain.
- **T22 How do I book a birthday party?** (Y): "Book a party" opens the same booking page as a normal visit. The Parties tab is closed until you tap it, so Ctrl+F for "birthday" misses most of it (14 of 19 matches are in hidden tabs).
- **T25 Party: days, start times, deposit, rain, add pizza?** (N): Only "Fall party overview · September – November". The Corporate tab says "ask us about adding Wise Pie pizza"; the Parties tab does not.
- **T26 What happens in winter?** (P): Covers the tree season only. January to April is not mentioned (the GreenHouse hours then are unknown).
- **T27 Wheelchair on the wagon ride? What are the paths like?** (N): Words a visitor would look for: wheelchair, accessible, ramp, gravel, paved, flat, grass, mud.
- **T29 Can we bring our own food and drinks?** (P): Implied yes. No rule is written for lunches, coolers or outside food.
- **T30 Find the site in Spanish** (Y): 1 tap with a Spanish phone, 2 taps otherwise. The button shows only a globe and "EN", not the word Language.
- **T31 Is the booking page itself in Spanish?** (N): The site does not say. Not opened in this test.
- **T32 Getting there without a rental car (rideshare, bus)** (N): Words a visitor would look for: Uber, Lyft, taxi, rideshare, bus, shuttle, airport. Ctrl+F finds only "Barrel train".
- **T33 Is it OK for a 2-year-old? What do little ones do?** (Y): Also says the farm is "not childproof" and children must be supervised.
- **T35 How much is a pumpkin?** (N): The site says so itself. The pumpkin-patch page has the visit prices, not pumpkin prices.
- **T36 See the pizza menu and prices first** (Y): Nine pizzas, $15 to $17; gluten-free +$9, vegan cheese +$3.
- **T37 Car seat for a child (we fly in)** (N): Words a visitor would look for: car seat, booster, child seat. Zero matches on the home page and the First-visit guide.
- **T38 Where does a school bus park and drop the children?** (N): "Parking" says limited parking in a neighborhood. Nothing for buses.
- **T39 Can the school pay by invoice, purchase order or check?** (N): Words a visitor would look for: invoice, purchase order, check, pay.
- **T40 Can I write or call in Spanish?** (N): Contact shows English-only email names. The only Spanish words are the language buttons.
- **T41 Paths for a wheelchair or stroller (gravel, grass, mud, hills)** (N): Ctrl+F finds only false hits ("playground", "ground", "Mint Hill").
- **T42 A place to buy water, a snack or lunch (not pizza)** (P): Water and lunch are not mentioned; prices are "coming soon".
- **T43 How early do we arrive? When is check-in?** (P): No arrival window, no word about being late.

## What find-in-page (Ctrl+F) gives

The words typed are on the home page. A visitor who does not know the farm's own words ("Shoes that can get dirty", "porta-johns") has to guess. Some counts include false hits ("ground" matches "playground", "train" matches "Barrel train").

| Task | Words typed in the search box (home page) | Matches | on screen | in a closed FAQ box | in a hidden tab | The answer is match no. |
|---|---|---|---|---|---|---|
| T02 Cost for 2 adults + 2 kids (one is 2) + pizza | $31 | 2 | 1 | 0 | 1 | 1 (the visible $31) |
| T03 Are dogs allowed? | dog | 4 | 2 | 2 | 0 | 4 |
| T04 Where do we park? Is it free? | parking | 6 | 3 | 3 | 0 | 1 |
| T05 Restrooms (and a baby-changing place)? | changing, diaper, nappy, baby | 1 | 1 | 0 | 0 | none of them |
| T06 Can I take a stroller? | stroller | 0 | 0 | 0 | 0 | no matches |
| T07 Is the farm wheelchair accessible? | wheelchair, accessible, disab, ADA | 2 | 0 | 2 | 0 | partly: 1 and 2 (the accessible toilet only, in a closed FAQ box) |
| T08 What if it rains? Money back? | refund | 2 | 0 | 2 | 0 | 1 |
| T09 Can I pay by card (no cash)? | card, cash | 7 | 4 | 3 | 0 | 5 |
| T10 What to wear and bring? | shoes, wear, bring | 10 | 6 | 0 | 4 | none of them |
| T11 When are you open this week? | hours, open at/from, am | 20 | 11 | 5 | 4 | 2 |
| T13 How long does a visit take? | how long, duration, takes about, minutes | 12 | 9 | 0 | 3 | none of them |
| T14 Gluten-free, vegan, allergies? | allerg, nut, dairy, wheat, celiac, cross | 14 | 11 | 0 | 3 | none of them |
| T16 How do I reach someone today? | phone, call, text us, 704 | 2 | 2 | 0 | 0 | 1 and 2 (the day-of number) |
| T18 School tour price; do teachers and parents pay? | teacher, chaperone, adult, staff | 3 | 2 | 1 | 0 | none of them |
| T19 School tour for 40 children? | minimum, smaller, small group, one class | 1 | 1 | 0 | 0 | 1 |
| T20 School tour: grades, how long, time, dates? | how long, length, duration, arrive, depart, 9 am, schedule | 6 | 3 | 2 | 1 | none of them |
| T22 How do I book a birthday party? | birthday, party, parties | 19 | 5 | 0 | 14 | only in a hidden tab |
| T26 What happens in winter? | winter, January, February, December | 15 | 8 | 1 | 6 | 5 |
| T27 Wheelchair on the wagon ride? What are the paths like? | wagon ... wheelchair/stroller/accessible, path | 0 | 0 | 0 | 0 | no matches |
| T29 Can we bring our own food and drinks? | outside food, own food, bring, picnic | 24 | 12 | 0 | 12 | 6 |
| T32 Getting there without a rental car (rideshare, bus) | uber, lyft, taxi, rideshare, bus, transit, shuttle, airport, train | 7 | 6 | 0 | 1 | none of them |
| T37 Car seat for a child (we fly in) | car seat, booster, child seat | 0 | 0 | 0 | 0 | no matches |
| T38 Where does a school bus park and drop the children? | bus, drop-off, coach | 1 | 1 | 0 | 0 | none (a photo caption only) |
| T39 Can the school pay by invoice, purchase order or check? | invoice, purchase order, PO, check, school pay, deposit | 11 | 7 | 2 | 2 | none of them |
| T40 Can I write or call in Spanish? | Spanish, español, bilingual | 3 | 1 | 0 | 2 | none visible (2 hidden lines mention Spanish) |
| T41 Paths for a wheelchair or stroller (gravel, grass, mud, hills) | gravel, paved, grass, mud, uneven, hill, slope, flat, surface, terrain, ground | 24 | 16 | 1 | 7 | none of them |
| T42 A place to buy water, a snack or lunch (not pizza) | snack, concession, water, drink, lunch, food | 39 | 30 | 3 | 6 | 6 |
| T43 How early do we arrive? When is check-in? | arrive, minutes before, on time, late | 6 | 6 | 0 | 0 | 2 |

What this says:

- "stroller" and "wheelchair" are **not on the home page at all**. They exist only on the First-visit guide.
- "refund" has 2 matches and both are inside a closed FAQ box. A visitor who only looks sees the question "What is your rain policy?" and may not open it.
- "dog": 2 of 4 matches are inside closed boxes, and one of those says something different from the rest (contradiction 3).
- The phone number is found by searching "phone", "call" or "704" (2 matches) but not by reading the Contact section.
- Words that give nothing: car seat, booster, diaper, changing table, how long, gravel, paved, ramp, uber, taxi, shuttle, invoice, purchase order.

## Spanish and Hindi: the same three jobs

The jobs: L1 book a pumpkin patch visit for 4; L2 what 2 adults and 2 children (one is 2) cost with pizza; L3 how to get pizza without a reservation. Each route was run on a phone and a desktop with the site switched to the language. Elements were found by their translation id, so the words did not matter.

| Language | Task | Route | Phone: taps / scrolls / seconds | Desktop: taps / scrolls / seconds |
|---|---|---|---|---|
| Spanish | L1 Book a visit for 4 | hero button | 1 / 0 / 11 s | 1 / 0 / 11 s |
| Spanish | L1 Book a visit for 4 | announcement bar | 1 / 0 / 6 s | 1 / 0 / 7 s |
| Spanish | L2 Cost: 2 adults + 2 kids (one is 2) + pizza | menu: Visit, package cards | 2 / 6 / 25 s | 2 / 3 / 22 s |
| Spanish | L3 Pizza without a reservation | menu: Pizza, "At The GreenHouse" | 2 / 2 / 17 s | 2 / 1 / 15 s |
| Spanish | L3 Pizza without a reservation | FAQ on the home page | 3 / 4 / 22 s | 3 / 3 / 21 s |
| Hindi | L1 Book a visit for 4 | hero button | 1 / 0 / 11 s | 1 / 0 / 11 s |
| Hindi | L1 Book a visit for 4 | announcement bar | 1 / 0 / 7 s | 1 / 0 / 9 s |
| Hindi | L2 Cost: 2 adults + 2 kids (one is 2) + pizza | menu: Visit, package cards | 2 / 5 / 25 s | 1 / 3 / 21 s |
| Hindi | L3 Pizza without a reservation | menu: Pizza, "At The GreenHouse" | 2 / 1 / 17 s | 1 / 1 / 15 s |
| Hindi | L3 Pizza without a reservation | FAQ on the home page | 3 / 2 / 18 s | 3 / 2 / 18 s |

The answers a Spanish reader finds:

- L2: "$31 de precio base. Incluye 2 pizzas Wise Pie, más $3 por persona (a partir de los 3 años). Los niños de 2 años o menos entran gratis."
- L3: "Por orden de llegada: come allí o llévate tu pizza. O haz un pedido anticipado con el enlace que publicamos 5 días antes."

The answers a Hindi reader finds:

- L2: "$31 बेस कीमत. इसमें 2 Wise Pie पिज़्ज़ा शामिल हैं, साथ में प्रति व्यक्ति $3 (3 साल और उससे ऊपर)।"
- L3: "पहले आओ, पहले पाओ के आधार पर वहीं खाएँ या ले जाएँ, या 5 दिन पहले पोस्ट होने वाले लिंक से पहले से ऑर्डर करें।"

What this shows:

- The effort is the same as in English. L1 is 1 tap. L2 and L3 cost 2 to 3 taps and 1 to 6 scrolls.
- **Spanish at desktop width (1280): the menu is the menu button**, not the full row of words, because the Spanish words no longer fit in one row. Each menu use is 2 taps, where English and Hindi need 1.
- **A phone set to Spanish (or Hindi, Chinese, Vietnamese) shows an offer bar at the very top**: "¿Prefieres ver este sitio en español? Sí, en español / No, gracias". One tap switches. A phone set to English shows nothing, and the visitor has to find the globe button, which reads only "EN" (2 taps).
- **Language leftovers:** every visible block on all six pages was compared with the English text in Spanish and in Hindi. What stays in English is names (Wise Acres, The GreenHouse, addresses, emails, the pizza names, the tomato and basil variety names), the two newspaper headlines under "In the news" (the links go to English articles), and one hidden line, "Preview example only. These spots are not real.", which is in the table of spots left (hidden today; it would show if that table is switched on). Nothing else is untranslated (a block that mixes both, such as "The GreenHouse, justo al lado", is fine: the name stays).
- The booking site (the Reserve button leads there) and the school sign-up form are other websites. The site never says whether they work in Spanish or Hindi.

## Fixed after the first run

Five fixes, all made with words the site already had (no new fact, price, hour or rule). The four translated questions and buttons are listed in the hand-over note for a native-speaker read. The measured effort is from the same visitor script, on a phone and a desktop.

| What was wrong | What changed | Before | After |
|---|---|---|---|
| The home page had no answer to "Where do I park?" | A home FAQ item, "Where do I park?", with the First-visit guide's own sentence, and buttons to the Farm map and the First-visit guide | Ctrl+F "parking" on the home page: 6 matches | 7 matches, the new FAQ item among them; phone 3 taps / 4 scrolls / 15 s, desktop 3 / 2 / 12 s |
| "Stroller" and "wheelchair" were not on the home page at all | A home FAQ item, "Can I bring a stroller or wheelchair?", with the First-visit guide's own sentence, an Email us button and a First-visit guide button | Ctrl+F "stroller": 0 matches; "wheelchair": 0 | "stroller": 2 matches, the answer is match 2; "wheelchair": 2 matches, the answer is match 2; phone 3 / 4 / 18 s, desktop 3 / 2 / 16 s. The answer itself is unchanged: "please email us before you come" |
| What to bring was only on the First-visit guide | A home FAQ item, "What should we bring?", with the six items of the checklist (the pets line is left out on purpose: see contradiction 3) | Ctrl+F "shoes": no answer on the home page | "shoes": 1 match, the answer; phone 3 / 4 / 12 s, desktop 3 / 2 / 9 s |
| The First-visit "Changes and rain" box never said a cancelled booking is refunded | The box now has the same three lines as the home FAQ, including "If you cancel by then, we refund the cost of your reservation, minus the 3% credit card processing fee" | The refund line was only in a closed FAQ box | Visible on the First-visit guide: phone 2 taps / 2 scrolls / 12 s, desktop 2 / 1 / 11 s (one scroll more than before, because the box is longer) |
| The school page was linked only from the footer | An "About school field trips" button in the School tours tab of the Groups area | Phone: 1 tap + about 76 scrolls (about 101 s); desktop: about 51 scrolls (about 71 s) | Phone: 3 taps / 2 scrolls / 15 s; desktop: 3 / 1 / 14 s |

Not done, and why:

- **The word "Language" next to the globe button.** It does not fit. At 320 px wide the header has only about 17 px free between the farm name and the globe, and the word needs about 60 px. On phones under 420 px wide the button already shows only the globe. A one-line label would change the layout, so it was left out. A phone set to Spanish, Hindi, Chinese or Vietnamese already gets the offer bar at the top.
- **Everything that needs an answer** from the farm or a decision: the Fall tab against the pizza days, the GreenHouse 10 to 8 against 4 to 8, service animals, the Corporate draft prices and the day-of phone number. These are written as owner questions (the dashboard list d51, d09, d42, d02 and d04 already covers all five).
- **Strawberry page rain answer** (no 3% fee line): already dashboard question d41.

## The top 15 gaps and confusions

Ranked by how many of the six visitors hit them (the number after the title), then by how badly it blocks a decision. "Fix" is a proposal for the lead; "Ask the farm" is the new fact needed before any new words go on the site. Question numbers refer to `docs/QUESTIONS_FOR_THE_FARM.md`.

### 1. Parking (5 of 6: P1 P2 P3 P4 P5)

- What they see: "We are in a neighborhood on Hartis Road with limited parking. Vehicles are not allowed in the fields, barn or garden areas." Not said: where, free or paid, how many cars, a drop-off place, where a school bus or a party goes. The farm map has a "Parking" picture, but no words.
- **Fixed in part:** the home FAQ now has "Where do I park?" with the same sentence. The facts are still missing.
- Fix: a short Parking box on the First-visit guide and under "Head to the farm" on the home page, with the farm's answers (lead decision which words).
- Ask the farm: Is parking free? Where do cars enter Hartis Road and park (questions 34 and 42)? Is there a drop-off near the gate for people who cannot walk far? Where do school buses park, and where do 20 party guests park? Is there overflow parking?

### 2. Rain and money back on the day (4 of 6: P1 P3 P4 P6)

- What they see: "a little rain doesn't close the farm"; change free until 11:59 PM the night before; "If you cancel by then, we refund the cost of your reservation, minus the 3% credit card processing fee"; "If severe weather forces us to close ... full refund". The refund line is inside a closed FAQ box on the home page, and the First-visit guide does not say that a cancelled booking is refunded. Nothing at all for school tours or parties.
- **Fixed in part:** the First-visit guide's "Changes and rain" box now has the refund and 3% line. School tours, parties and the same-day case are still open.
- Fix: one "Rain and refunds" box that lists the cases (a little rain; cancelling by 11:59 PM; severe weather; school tour; party), shown on the First-visit guide and in the school and party panels.
- Ask the farm: Can a family cancel on the morning of the visit when the forecast is bad, and what do they get back? Is the 3% fee kept on every cancellation? What is the rain plan for a school tour and for a party (a covered place)?

### 3. Reaching a person on the day (4 of 6: P2 P3 P5 P6)

- What they see: Contact lists four email addresses and no phone. The only phone number on the site, "Day-of emergencies: call or text 704-207-6347", sits in the photographer-pass box under Flowers & photos. The phone bottom bar offers Reserve, Directions and Email, not Call.
- Fix: a line "Running late or lost on the day? Call or text ..." in Contact, in the First-visit guide and on the phone bar (lead decision).
- Ask the farm: Which number may every visitor use on the day, who answers, and from what time to what time? Is it fine to show 704-207-6347 to everyone (today it is labelled for photographers)? (Related: questions 3 and 41.)

### 4. Strollers, wheelchairs, paths, baby changing (2 of 6: P1 P2; the most serious for those two)

- What they see: only on the First-visit guide: "If you have questions about getting around with a stroller or wheelchair, please email us before you come." and "One toilet is accessible for people with disabilities." No yes or no, nothing about the ground, the wagon, ramps or the GreenHouse. Nothing about a place to change or feed a baby. The words stroller and wheelchair are not on the home page.
- **Fixed in part:** the home FAQ now has "Can I bring a stroller or wheelchair?" with the First-visit guide's own sentence (the words are now on the home page; the facts are still missing).
- Fix: a short "Getting around" card once the farm answers (4 plain lines).
- Ask the farm: questions 29 and 31 already ask about strollers and wheelchairs in the fields, the paths and a baby-changing place. New: can a wheelchair or stroller ride the wagon? Is there a smooth route from parking to the picnic patch, a playground and the accessible toilet? Is The GreenHouse level?

### 5. What a visit costs, worked out (2 of 6: P1 P6)

- What they see: "$31 base price", "Includes 2 Wise Pie pizzas, plus $3 per person (ages 3+).", "Children age 2 and younger are free." The family works out about $40 (31 + 3 x 3) but cannot tell whether the $31 already includes anyone.
- Fix: one worked example under the package cards, for example "2 adults + 2 children (one age 2) with pizza = $__" (lead decision once the farm confirms).
- Ask the farm: Does the $31 include anyone's admission? Is there tax, a booking fee or the 3% card fee added at checkout? (Related: question 44.)

### 6. How long a visit takes and when to arrive (2 of 6: P1 P2)

- What they see: nothing. The words "how long", "hours", "duration" and "arrive early" are not there; "Check in under the name on your reservation" is all there is.
- Fix: one line "Plan about __ hours" and an arrival line in the First-visit guide.
- Ask the farm: How long do most families stay? Is there a time limit per booking? How early should they arrive, and what if they are late?

### 7. When the farm is open (2 of 6: P2 P5)

- What they see: days (Thursday to Sunday; The GreenHouse Friday to Sunday, 10 am to 8 pm) but no opening and closing time for the u-pick farm. 10 am to 4 pm appears only as the pizza time at the farm. The Fall tab says "Thursday–Sunday reservations, with or without pizza" (contradiction 1).
- Fix: one small "Fall hours" table in Visit (farm, pizza at the farm, The GreenHouse, Wise Pie at The GreenHouse).
- Ask the farm: Confirm question 17: farm hours Thursday to Sunday; is it 10 am to 4 pm? Do time slots start on the hour?

### 8. Pizza at The GreenHouse: 10 to 8, or 4 to 8? (2 of 6: P4 P6, found but contradicted)

- What they see: the GreenHouse cards say "Fri–Sun, 10 am–8 pm" next to "Wise Pie pizza" and "Drop in any time"; the Contact card says "Pizza, ice cream and drinks. No reservation needed. Fri–Sun, 10 am–8 pm." The pizza section says first come first served from 4 to 8 pm, and pizza 10 to 4 only with a farm reservation. Someone who arrives at noon for pizza finds none.
- Fix: add "Pizza 4–8 pm" to the GreenHouse card and the Contact card (words exist in the pizza section; confirm with question 17).
- Ask the farm: Is pizza at The GreenHouse only 4 to 8 pm, Friday to Sunday?

### 9. Food, water and lunch rules (2 of 6: P4 P5)

- What they see: "Water and a snack for the shady picnic spots", "Bring cake and snacks for your guests" (parties), "Snacks, beer, hard cider and wine, local goods and NC pumpkins" with "Prices coming soon". No rule on outside food or coolers, nothing on water, nothing on where 100 children eat in rain.
- Fix: an "Eating and drinking" line in the First-visit guide plus a FAQ item.
- Ask the farm: May guests bring their own food, drinks and coolers? Is water sold or free? Prices for snacks and drinks (question 19)? Where do school groups eat when it rains?

### 10. "Prices coming soon" and the quiet months (2 of 6: P1 P5)

- What they see: "U-pick pumpkins: Prices coming soon", "NC pumpkins: Prices coming soon", and the same for concessions, ice cream, beer, wine, cider and trees. Winter means the tree season only ("Friday after Thanksgiving to early December"); January to April is not mentioned.
- Fix: none until the farm answers; the site already says so honestly.
- Ask the farm: pumpkin prices and the other "coming soon" prices (question 19); what a visitor should expect from January to April (question 37).

### 11. School tour for a class of 40 (1 of 6: P3; five of its tasks come back partial or empty)

- What they see: "Minimum group size: 100 students" (and in the FAQ "for a traditional fall school tour"). Nothing for a smaller class, nothing on how long the tour is, what time, which dates are open, whether teachers or bus drivers pay, where buses park, or paying by invoice or purchase order. "Home School Day ... sign-ups opened on Sep 29" has no link, and the school page sends you to "our main page", which has no link either. The school page is not in the menu.
- **Fixed in part:** the School tours tab now has an "About school field trips" button to the school page.
- Fix: add a "Smaller classes" line, a tour length and time line, a bus parking line and a payment line (lead decision after the answers).
- Ask the farm: Do you take a class under 100 (another day, or a normal reservation with a school price)? Tour length, start and end time, open dates? Are teachers, aides and bus drivers free, and how many adults per child? Where do buses park? Can a school pay by invoice, purchase order or check? Where is the Home School Day sign-up? (Related: question 2.)

### 12. Birthday party details (1 of 6: P4; the party tab says nothing about days, times, deposit, rain or pizza)

- What they see: "$300 per party", "Up to 50 guests", "2.5 hours", "Bring cake and snacks", "Please do not bring your own alcohol". "Book a party" opens the same booking page as a normal visit. The Parties tab is not the tab shown first, so it needs 3 or 4 taps and is invisible to find-in-page until opened.
- Fix: add a "Plan your party" line for days, times and deposit once answered; say which choice to pick on the booking page.
- Ask the farm: Which days and time slots can a party have? Deposit, and when is it paid? Rain plan? Can pizza be added to a party, and at what price (the Corporate tab says "ask us about adding Wise Pie pizza", the Parties tab is silent)? May guests bring other food? Is the normal booking page the right place (question 22)?

### 13. Getting there without a car, and a car seat (1 of 6: P5)

- What they see: nothing. Searching Uber, Lyft, taxi, rideshare, bus, shuttle, airport, car seat, booster finds nothing relevant. There is a Get directions button and Apple Maps and Waze links.
- Fix: a "Coming without a car" line.
- Ask the farm: Can a rideshare drop off at the gate? Do you know of a bus or shuttle? Do you lend car seats? (If the answer is no, the site can say so in one line.)

### 14. A Spanish-speaking family (1 of 6: P6)

- What they see: the language switch works (1 tap with a Spanish phone, 2 otherwise), but nothing says whether the booking page and the school form are in Spanish, or whether anyone at the farm reads Spanish. A hidden line on the email-list form says the page language is noted "so we can write back in it".
- Fix: a "Write to us in Spanish" line near Contact, if true.
- Ask the farm: Does anyone read and answer Spanish email, or answer the phone in Spanish? Can the booking page and the school form be set to Spanish?

### 15. Allergies (1 of 6: P4)

- What they see: "Vegan cheese and gluten-free crust available", the extra prices, and an ingredient list inside a closed "Ingredients & sources" box. No allergen words (nuts, dairy, wheat, cross-contact).
- Fix: an allergen line near the menu, once the farm gives the wording.
- Ask the farm: question 45.

## Contradictions: the same fact with two answers

1. **Pizza days.** "Thursday–Sunday reservations, with or without pizza" (home page, Seasons, Fall tab) against "Yes pizza ... Friday, Saturday & Sunday" (Choose your package) and "Reservations with Wise Pie pizza are available Friday through Sunday." (`pumpkin-patch.html`, FAQ).
2. **Pizza at The GreenHouse.** "Pizza, ice cream and drinks. No reservation needed. Fri–Sun, 10 am–8 pm." (Contact) and "Drop in any time. No farm access" next to "Wise Pie pizza" (GreenHouse card) against "Wise Pie pizza is first come, first served from 4 to 8 pm" and "Pizza is available from 10 to 4 by farm reservation only" (GreenHouse hours).
3. **Service animals.** "Service animals are welcome" (FAQ, First-visit guide, What to bring) and "No dogs / Service animals only" (GreenHouse card) against "Animals are not permitted on the farm. If you have a registered service dog, please contact us in advance" (Flowers & photos, "Farm & property guidelines", inside a closed box).
4. **GreenHouse hours.** A fixed "Fri–Sun, 10 am–8 pm" and the chip "Open now, until 8 pm" against "hours vary with the weather" (FAQ) and "may close suddenly in bad weather. Please check Instagram" (GreenHouse). The chip has no such warning.
5. **Cancelling.** "You can change your reservation at no charge until 11:59 PM the night before" (First-visit guide, strawberry FAQ, home FAQ) against the home FAQ's "we refund the cost of your reservation, minus the 3% credit card processing fee". The First-visit guide did not say a cancelled booking is refunded (**Fixed**: it now has the same three lines as the home FAQ). The strawberry page's rain answer still lacks the 3% line (dashboard question d41).
6. **Home School Day.** The school page: "Information and reservation sign-ups are on our main page" (button "Current dates"). The main page: "Information and reservation sign-ups opened on Sep 29." with no link. A loop, not a contradiction, but the same dead end.
7. **Pizza reservations.** The top of the home page says "Next pizza reservations open in 3 days 6 hours" while the schedule box says "Open now: pizza reservations for Oct 2 & 3". Both are true (different weekends), but a family that wants pizza today reads the first line first.

## Easy to miss

- **Answers only inside a closed FAQ box:** the rain refund and the 3% fee; paying by card; dogs; the accessible toilet; "Can I visit without a reservation?" (the answer is The GreenHouse); when reservations open; the ingredient list; "Farm & property guidelines" (service dogs: contact us in advance); "Additional notes".
- **A tab that is not selected by default:** Groups opens on School tours, so Parties and Corporate events need a tap and are invisible to find-in-page until opened (14 of 19 "party" matches are hidden). The address `index.html#parties` opens the Parties tab.
- **The Corporate events tab shows "Draft pricing — confirm before publishing"** (a dashed label) with $750 and $1,400 to anyone who taps it. This is the draft the farm has not confirmed (question 1).
- **Text on pictures:** four gallery photos carry words inside the picture (Happy Easter!, Father's Day, "We've been waiting all summer long to see you!", "Plenty of organic strawberries & blueberries now available! Morning & evening reservations."), and the tomato sign photo has prices that are not readable in text. The words reach screen readers only through the picture descriptions. These are out of season in October (question 40).
- **The only phone number** is in the photographer-pass box.
- **The language button** shows a globe and "EN", not the word Language; the full language list is in the footer, 66 screens down on a phone.
- **Every Reserve button leaves the site** (to the booking website, in a new tab). Nothing says what it asks for or what language it is in.
- **Pages only in the footer:** strawberry picking (the school page now also has a button in the School tours tab). The Wise Pie page is in the footer and on the pumpkin-patch page, and the pumpkin-patch page is in the footer and behind one home-page button.
- **The home page had no FAQ line** for parking, strollers, wheelchairs or what to bring. **Fixed**: the three items were added.
- **The bottom bar on a phone** has Email and no Call.

## No new facts needed (words that already exist)

These can be done by the lead without asking the farm:

1. Add FAQ items on the home page for "Where do I park?", "Can I bring a stroller or wheelchair?" and "What should we bring?" using the First-visit guide's own words, with a link to it. **Done.**
2. Link the School field trips page from the Groups section of the home page. **Done.**
3. Say in the First-visit guide's "Changes and rain" box that a cancelled booking is refunded minus the 3% fee, as the home FAQ already says. **Done.**
4. Fix contradiction 1 and the GreenHouse cards in contradiction 2 once question 17 is answered. Waiting for the answer (dashboard d51 and d09).
5. Decide what to do with the Corporate events tab until question 1 is answered. Waiting (dashboard d02).
6. Add the word "Language" next to the globe button. **Not done**: it does not fit at 320 px.

## Ask the farm (new questions; some repeat questions already on the list)

1. Is parking free? Where do cars enter and park? Is there a drop-off near the gate? Where do school buses and party guests park? (questions 34 and 42, plus new)
2. Can a family cancel on the morning of the visit for bad weather, and what do they get back? Is the 3% fee kept on every cancellation? What is the rain plan for school tours and parties?
3. Which phone number may every visitor use on the day, who answers, and when? Is 704-207-6347 fine for everyone? (questions 3 and 41)
4. Strollers and wheelchairs in the fields, the paths, a baby-changing place (questions 29 and 31); new: the wagon, a smooth route from parking, The GreenHouse.
5. Does the $31 base include anyone? Any tax or fee at checkout?
6. How long do families stay? Is there a time limit? How early should they arrive?
7. Farm opening and closing times, Thursday to Sunday (question 17 asks you to confirm the hours; this test shows visitors cannot find the farm's times).
8. Is pizza at The GreenHouse only 4 to 8 pm, Friday to Sunday? (question 17)
9. May guests bring food, drinks and coolers? Is water sold or free? Snack prices. Where do school groups eat in the rain?
10. Pumpkin and other "coming soon" prices; what visitors should expect January to April. (questions 19 and 37)
11. School tours: classes under 100; tour length, times and dates; teachers, aides and bus drivers; chaperone numbers; bus parking; payment by invoice, purchase order or check; the Home School Day sign-up.
12. Parties: days and time slots; deposit; rain plan; adding pizza and its price; other food; the right booking page. (question 22)
13. Rideshare drop-off, a bus or shuttle, car seats.
14. Spanish: does anyone read or answer in Spanish? Can the booking page and the school form be set to Spanish?
15. Allergens near the menu. (question 45)
16. Service dogs: welcome, or contact in advance? Which is right?

## What I did not do

- No file on the site was changed. This is the only file added.
- The booking website, the school form and the maps were not opened. Whether "for 4" is a number on the booking page, and what language it is in, is not known.
- Times are estimates. Real visitors are slower and many give up sooner than a scripted visitor.
- Only the fall 2026 state of the site was tested (the season picker was off). In spring or summer the home page shows other texts, and the answers above may differ.
