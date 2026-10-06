# Translation read-through, part two: everything that visitors see

Dated 3 October 2026. Reading only: nothing on the live farm site was touched and no English word was changed. This is the second half of the read-through that began in `docs/TRANSLATION_FACT_AUDIT.md`. That audit compared the facts (numbers, days, prices, times) of every text by machine, and read the 200 riskiest texts closely. This part reads **all the other 1,152 texts**, in Spanish, Hindi, Chinese and Vietnamese.

## The short answer

- **All 1,352 texts have now been read in each of the 4 languages** (1,352 times 4 = 5,408 translations). 200 of them were read closely, translated back into English in my head (the first audit). The other 1,152 were read once, line by line, against the English meaning, for tone, grammar, the sense of tricky English words and punctuation. That second reading is quicker, and I say so: it can miss a wrong shade of meaning that a close reading would catch.
- **One clear error was found and fixed**: a Hindi word that means "a local Indian variety" where the English says "heirloom" (one text). The 8 fixes of the first audit stay.
- **Nothing was wrong in the facts, the tone, the polite forms or the punctuation.** The Spanish says "tú" everywhere (one text, shouted by the wagon driver, says "ustedes"). The Hindi says "आप" everywhere. The Vietnamese says "bạn". The Chinese says "你" 96 times and "您" once. The Spanish has its ¿ ¡ marks wherever the English asks a question or shouts (the only exceptions are 4 picture descriptions that quote an English sign and one text that shows the address part ?check), and the Chinese has full-width punctuation.
- **14 doubts are left for a native reader** (below), each with the English meaning and a suggested word. None changes a fact. I did not change them, because the translation is understandable and I am not a native reader. Three more were added on 6 October ("Doubts added later", below).

## What was read, in what order

| Order | What | Texts |
|---|---|---|
| 1 | Home page: skip link, top menu, language and season buttons, hero words and buttons, "This week", "Visit" (hours, prices) | 99 |
| 1 | Words and messages of the hero games (picking, tractor, trees, scarecrow, achievements, countdowns) | 113 |
| 2 | FAQ questions and answers on the home page | 36 |
| 3 | First-visit page 77, school page 42, pumpkin page 42, strawberry page 42, Wise Pie page 30 | 233 |
| 4 | Reserve, contact and footer; messages of the drive-time box, signup, calendar, viewer, errors and empty states; picture descriptions | 38 + 177 |
| 5 | The rest of the home page: packages and prices, seasons, tomato list, pizza menu, GreenHouse, shop, flowers, photography, groups, parties, our story, reviews, gallery | 456 |
| Total | | 1,152 |

The 404 page is not translated (English for everyone, a question for the farm). The owner-only "Site check" texts were read, but not judged for tone.

## What was checked for each text

- Meaning against the English, in every language.
- Tone: friendly farm voice, nothing stiff or rude.
- Polite forms: Spanish tú (114 texts), Hindi आप (86), Vietnamese bạn (129), Chinese 你 (96). A scan found no stray usted, तुम, quý khách. The one Chinese 您 and the one Spanish "ustedes" are in the doubt list.
- Grammar slips, awkward machine-sounding wording, truncated placeholders ({time}, {url}, {n} and the like: all kept).
- The sense of English words that can mean two things: pick (choose / pluck: Hindi uses तोड़ें for fruit and चुनें for choosing, Spanish recoger and escoger), patch (field, picnic area, party area), stem (basil stem: tallo, डंठल, 枝, cành), row, party (a party or a group), tour, bar, ride, wagon, barn, trail, spots (places / reservation places), concessions, hard cider, slicers, heirloom.
- Punctuation: Spanish ¿ ¡, Chinese full-width, Hindi.
- Words used the same way everywhere (a count of the words for reservation, wagon ride, corn pit, bathroom, check-in, pumpkin, barn and so on in each language).

## What was found

One clear error, fixed:

| Id | Language | Before | After | Why |
|---|---|---|---|---|
| t62bd89f9 | Hindi | लाल पुरानी देसी किस्म, मीठी और फलों से लदी। पुराने बगीचे जैसा स्वाद। | लाल पारंपरिक (हेयरलूम) किस्म, मीठी और फलों से लदी। पुराने बगीचे जैसा स्वाद। | English 'heirloom' (an old, saved-seed variety). Hindi 'देसी' means a local Indian variety, which is a different idea; 'पारंपरिक (हेयरलूम)' says old traditional variety. |

Everything else was right or a doubt for a native reader.

## Doubts for a native reader

The English meaning is in the third column and the suggested word in the last, so a reader does not need the whole audit. Earlier doubts (service dog, peak picking, "about" before a range, "not childproof", wagon ride and barn in Vietnamese, "no se permite" for alcohol, little goat in Chinese) are in `docs/TRANSLATION_FACT_AUDIT.md`.

| Where | Id | Language | English meaning | My doubt | Suggested |
|---|---|---|---|---|---|
| Home page, hero and menu | tcf782409 (and 5 more places: the visit page title, meta lines) | Spanish | The u-pick farm (a card title: the farm where you pick the fruit yourself) | "La granja donde tú recoges" is long and reads as made by a machine, especially as a title. | "La granja de recolección", or "La granja (cosecha tú mismo)" |
| Menu | t7c9a8664 | Hindi | Visit (a menu word, the section about visiting) | "आइए" means "please come" (a verb), not the noun "Visit". | "विज़िट", as in "पहली विज़िट की गाइड" |
| Hero calendar | js: Peak picking | Spanish | Peak picking (the days with the most fruit and the biggest crowds) | "Mejor momento para recoger" says "best time to pick". Same doubt as the Hindi in the first audit. | "Pico de la cosecha" |
| Waitlist e-mail | js: Hi! Please add me to the waitlist | Chinese | The first line of the e-mail a visitor sends to the farm | It says 您好 (formal you); the rest of the site says 你 (96 times, 您 once). Right for a mail to a business, but not the same register. | Keep, or 你好 |
| Farm answers | t509f686c, te54f5820, tbed86e1f | Hindi | "We rotate our crops, plant cover crops and keep detailed records. Outside inspectors check us." | The sentence is stiff: it reads "the farm, which includes crop rotation, cover crops ... and inspection" instead of "we do". | "हम फ़सल चक्र अपनाते हैं, कवर क्रॉप लगाते हैं, विस्तृत रिकॉर्ड रखते हैं और बाहरी एजेंसी हमारी नियमित जाँच करती है।" |
| Tomato list | t9bf53880 | Hindi | "The gourmet cherry" (for people who like fine food) | "चेरी टमाटरों में सबसे शाही" means "the most royal of the cherry tomatoes". | "चेरी टमाटरों में खाने के शौक़ीनों की पसंद" |
| Photo and page text | t4f6c5f3e, t65ba07a6, ta41cbda2, tab37486a ("chuồng trại") and t7f553727, tf7ddcce0 ("nhà kho") | Vietnamese | barn (the red farm building) | The same English word is "chuồng trại" (animal pen) in some places and "nhà kho" (storehouse) in others, and both appear in "Barn or shed". One word should be used for the barn. | Choose one (for example "nhà kho nông trại" for barn, "chuồng" only for animals) |
| Farm page | t0b5eaa9e, t46f6aa3b, t49c35609, t4b6d3990, tb2ff1037, tb89adc3c, td6ecd1d8 | Chinese | haunted trail (a spooky walk in the dark on the farm) | "鬼屋小径" is "haunted house path". A trail is not a house. | "闹鬼小径" or "鬼影小径" |
| Reviews heading | tff70a484 | Chinese | "Kind words" (a quiet heading above reviews) | "好评如潮" means "praise pouring in": stronger than the English. | "暖心评价" |
| Tractor voice | js: Hold on tight! | Spanish | What the wagon driver says to everyone on the ride | "¡Agárrense fuerte!" is plural; every other text says tú. Right for a group, but it is the only plural. | "¡Agárrate fuerte!" (if tú is wanted everywhere) |
| Reservations | tc8317201, t87550955, t5f6e51f7, js: Spots open | Spanish | Spots left (open reservation places) | "Lugares disponibles" is understood, but "lugares" also means "places" in the same page ("dos lugares" for the farm and The GreenHouse). | "Cupos disponibles" |
| Flower page | t0f061e4c | Hindi | The Instagram page "gives a general idea of what is blooming" | "आमतौर पर कौन-से फूल खिले हैं" says "which flowers are usually blooming", a small shift. | "…इसका मोटा अंदाज़ा देता है कि कौन-से फूल खिले हैं" |
| Footer, quick bar | t82b6bfe1 | Hindi | "Quick actions" (a hidden label for the buttons at the bottom) | "क्विक एक्शन" is English letters in Hindi. | "त्वरित कार्य" |
| Corn and pumpkin words | tca08d18d (corn pit), t6498fda1 (wagon, corn pit) | Vietnamese | corn, pumpkin | "bắp" (corn, southern word) is used with "bí ngô" (pumpkin, northern word). Both are understood everywhere. | Keep, or "ngô" for corn if the reader is in the north |
| Spanish word choice | all | Spanish | berries, stroller, bucket, snack | Mexican and US words almost everywhere (botana, balde, pays, estacionamiento), but "bayas" and "cochecito" are common in Spain too. | "frutos rojos", "carriola" |

## Doubts added later

Added on 6 October 2026. A helper walked the site as a visitor in Spanish, Hindi, Chinese and Vietnamese, on five dates and in six time zones. Every date, weekday, time and count was right. These three are about words the page builds out of pieces, so a reader sees the whole line only on the page. None changes a fact. I did not change any translation, because I am not a native reader. They are also in the question column of the review sheet (`tools/review_notes.json`), like the doubts above.

| Where | Id | Language | English meaning | My doubt | Suggested |
|---|---|---|---|---|---|
| Home page, the pizza chip in the top picture ("Next pizza reservations open in ...") | js: Next pizza reservations open in {time} (jf70f159a) | Hindi | "Next pizza reservations open in 4 days 1 hour". The page fills in the days and hours itself. | The browser writes one hour as "घंटा". Before "में" that is the wrong form, so the page code now changes it to "घंटे": "अगले पिज़्ज़ा रिज़र्वेशन 4 दिन 1 घंटे में खुलेंगे", not "... 1 घंटा में खुलेंगे" (`js/live.js` at `const end = (s) =>`). I am fairly sure "घंटे में" is right, but a reader should confirm the form and read the whole line with 1 day, 2 days and 1 hour 30 minutes. | Keep "1 घंटे में", or "एक घंटे में" |
| Home page, the "Next up" box and the line in the top bar, in spring, summer and fall | js: mid-April (jda15f6da), mid-June (j7a9c89f1), mid-September (j4079a441), and the two lines they go into: Next up (j8a39af68 and j7cc0082e) | Chinese | "Usually starts mid-April" (when the next season usually starts) | "4 月中旬" has a space after the 4, so the page shows "通常4 月中旬开始" and "通常4 月中旬": no space after 通常, one after 4. Elsewhere the site puts a space on both sides of a number ("通常 4 月中旬至 6 月上旬"), and the dates the page writes itself have none ("10月13日"). Which spacing is right? The winter text ("感恩节后的周五") has no number and is fine. | "4月中旬", "6月中旬", "9月中旬" (change the three words in `lang/src/zh.json` at `"mid-April"`, `"mid-June"` and `"mid-September"`). Or keep the spaces and add one after 通常 in the two lines, which also needs a small change in the page code, because the space belongs only before a number. |
| Home page, the green "Open now" badges for The GreenHouse and the pizza, and the "Next reserved day" line of the farm badge | js: Opens {day} at {time} (jc998c430) | Spanish | "Opens Friday at 10 am", "Opens tomorrow at 10 am", "Opens Fri, Oct 23 at 10 am" | "Abre viernes a las 10 a. m." has no "el" before the weekday, and "Abre vie, 23 oct a las 10 a. m." none before the date. The fixed text of the page says "Abre el martes, 5 p. m.". "Mañana" needs no "el". Also "a las" fits 10, 4 and 8 o'clock, but one o'clock would need "a la" (the farm has no hour like that today). | "Abre el viernes a las 10 a. m.", "Abre mañana a las 10 a. m.". The text is in `lang/src/es.json` at `"Opens {day} at {time}"`, but a new text alone is not enough: the page code has to put "el " before a weekday or a date in Spanish only. That is in `js/live.js` at `const whenLabel` and `t('Opens {day} at {time}'` (2 places: the second one passes the weekday by itself). The "Next reserved day" line uses `const whenLabel` too, so it follows. |

When a reader has answered, the person who edits the site changes the strings in `lang/src/` (and the code for the Spanish "el" and the Chinese spaces, if the reader asks for it), then runs the steps of `docs/CHECK_A_LANGUAGE.md`, step 4. Then delete or change the entry in `tools/review_notes.json` (its "ask" list), so the sheet does not ask again.

## Limits

I am not a native reader of Hindi, Chinese or Vietnamese, and I read Spanish as a second-language reader. The second round was one reading, not a back-translation of each text. I cannot hear tone, and I did not check that every Vietnamese accent mark is exactly right. The facts (numbers, days, prices, times) were compared by machine in the first audit (`tools/i18n_facts.mjs`), not by eye.
