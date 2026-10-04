# Translation fact audit: are the numbers, days, times and prices the same in every language?

Dated 3 October 2026. Reading and checking only: nothing on the live farm site was touched, and no English word was changed. A wrong number, day or price in one language is the worst translation mistake, so this audit looked for exactly that, by machine (every text, every language) and by reading (the 200 riskiest texts, in all four languages, translated back into English by me).

## The short answer

- **No wrong price, number, day of the week, clock time, date, age or group size was found in any translation.** Spanish, Hindi, Chinese and Vietnamese all say what the English says. The older check in `tests/consistency.test.mjs` already kept that true; the new check looks much deeper (see "What the machine reads").
- **Eight translations of five English texts were changed.** They were not wrong numbers. They were small words that carry a promise, left out or turned into a different promise: "only" (April flowers are for photos only), "usually" (the strawberry season is usually mid-April, not a promise), "a month or more at a time" (a block of dates, not "a month ahead"), "American football" (in Hindi "football" alone is soccer), and "family owned" (Hindi description line). The list is at the end, with the text before and after.
- **22 differences are meant** and are written down with their reason in `tools/i18n_facts_allow.json` (the 700 degree oven also in Celsius, "never walk-in" said as "walk-ins are not accepted", and so on).
- **A native reader is still needed.** I am not one. My read of Hindi, Chinese and Vietnamese is good for facts and for plain meaning, not for tone. A short list of doubts is below ("What still needs a native reader").
- The new check is a test (`tests/i18n-facts.test.mjs`, about 5 seconds, no browser) and a tool (`node tools/i18n_facts.mjs`). Any later translation that changes a number, a day, a price or a time of day fails the test, and the failure says which text, which language and what differs.

## What the machine reads

Every English text of the site (1,049 page texts, labels, picture descriptions and titles, and 303 texts written by JavaScript) is read next to its translation in Spanish, Hindi, Chinese and Vietnamese: 5,408 texts. Both sides are turned into the same plain facts first, so a fact written another way is still the same fact:

| Fact | How it is compared |
|---|---|
| Prices | every $ amount, and what it is for ($3 per person, per child, per student, per pound, per stem, per party) |
| Numbers | digits in any script (Devanagari digits too), numbers written out (six, seis, छह, 六, sáu), 1,500 and 1.500 and 4,50 |
| Number and unit | 45 minutes is not 45 hours; 2 weeks is not 2 months; ages 3 |
| Clock times | as a time of day: 4 pm = 16:00 = 下午 4 点 = 4 giờ chiều = शाम 4 बजे; am and pm matter; "10 to 4" with no am or pm is read as the two hours |
| Dates and months | Oct 6 = 6 de oct = 6 अक्टूबर = 10 月 6 日 = 6 thg 10; 9/29 and 29/9 are read in the local order; ranges |
| Early, mid, late | "late April through early May" keeps its late and its early (下旬 上旬, finales principios, cuối đầu) |
| Days of the week | a range written out ("Friday through Sunday" = viernes a domingo = 周五至周日) and a list are the same set of days |
| Ages and group sizes | "ages 3 and up" is not "and under"; "minimum 100" is not "up to 100" |
| Small promise words | free, only, always, never, no / not / without, weekend, about, usually, a dozen, half, one-third, the four seasons, Thanksgiving, Christmas, Easter, Father's Day |
| Names | Wise Acres, Wise Pie, The GreenHouse, Poplin Rd, Hartis Rd, Instagram, Google Maps, Waze, USDA, Charlotte, North Carolina and the people (a local spelling is allowed where the list says so) |
| Contacts | e-mail addresses, phone numbers, web addresses, @handles, #hashtags, {placeholders} |

Reading is by regular expressions and small tables per language (month names, day names, am and pm words, words for "free", "only", "never"), not by understanding. That is why the second half of this audit is a person reading.

The reader cannot quietly go blind. The test tries it on 48 wrong translations made on purpose (a changed price, weekday, am or pm, hour, month, number, unit, age limit, early or late, name, e-mail, phone, percent, "no" turned into "yes", a lost "only") and on 31 right translations written another way. It also copies the real language files into a temporary folder, changes one number, two weekdays, one price and two times of day there, and requires all six to be found. It also requires that the reader finds as many prices, times, dates, days and so on in each language as in the English, so a language that is read worse fails. When I changed a number in Spanish and a weekday in Chinese in a real copy of the tree, the test failed and named the text, the language and the difference.

## What the machine found

On the translations as they were (the tree this work started from), the reader showed 26 differences in 5,408 texts:

- **4 were real and are fixed** (2 English texts: one in three languages, one in one language; see the list at the end): April flowers "for photos only" lost the word "only" in Spanish, Chinese and Vietnamese; the Spanish page description of the strawberry season lost "usually".
- **22 are meant** and are on the allow list, each with its reason:
  - 8: the 700 degree oven also says 370 degrees Celsius in all four languages (two texts). The figure is right (700 °F is 371 °C) and helps readers outside the United States.
  - 3: "never walk-in" is said as "walk-ins are not accepted" in Hindi, Chinese and Vietnamese. Same rule.
  - 3: "not by the slice" is said as "sold whole only" in Hindi. Same rule.
  - 4: "serves about 2 to 3 adults" is written as a plain range in Chinese (the range already says it is a guide). Left for the native reader to judge.
  - 3: Chinese writes "we always ask first" as "we will certainly ask first", "always has the newest information" as "go by the newest information", and "cannot always post" as "may not be able to".
  - 1: "Both" is written "the two kinds" in Chinese.

The allow list cannot rot: an entry that matches nothing any more fails the test, and an entry needs a language, a kind of fact and a reason of at least 25 letters.

## What the reading found

I took the 100 riskiest English texts (hours, prices, refund and change rules, allergies and diet, safety, animals, rain and closing, booking, minimum group size, age rules) and read each one in Spanish, Hindi, Chinese and Vietnamese, translating it back to English in my head and comparing it with the English meaning. Then I did the same with the next 100 (the rest of the same topics). That is 200 texts and 800 translations. Many of them also carry facts the machine had checked (prices, ages, times); the reading is for the sentences that make a promise.

Meaning drift that the reading found and I fixed (3 English texts, 4 changes, see the list below):

1. **"Open a month or more at a time"** (the fall page: dates without pizza open in blocks of a month or more). Spanish said "with a month or more of notice" and Vietnamese "open one month or more ahead". That is a different promise (how far ahead a visitor can book). Fixed in both.
2. **"Football on the outdoor televisions"**: Hindi said "फ़ुटबॉल", which is soccer. Spanish, Chinese and Vietnamese said American football. Fixed in Hindi.
3. **"Family owned since 2013"** (the page description line): Hindi said "2013 से पारिवारिक" ("family since 2013"). Fixed to say family ownership.

The other 1,152 texts were read in a second round, see `docs/TRANSLATION_READ_THROUGH.md`. Everything else I read said what the English says, including every refund and change rule (until 11:59 PM the night before; a full refund if the farm closes for severe weather; the 3% card fee), the pet and service animal rules, the alcohol rule, what is and is not allowed in the fields, the pizza rules (farm reservation only until 4 PM; first come first served at The GreenHouse from 4 to 8 PM), the group tiers and the minimum of 100 students, the age and price lines, the berry care steps, the portable toilet and well water explanation, and the rain wording.

## What still needs a native reader

These are doubts, not errors. Each has the English meaning and my doubt, so the reader does not need the whole audit.

| Where | Language | English meaning | My doubt |
|---|---|---|---|
| "Service animals are welcome" (7 texts: no dogs / service animals only, pets stay home, the pet answers) | Chinese, Vietnamese | service animals (not only dogs) | Chinese writes 服务犬 and Vietnamese "chó phục vụ", both "service dog". The farm's own rule elsewhere says "registered service dog", so this may be right. Is a wider word wanted? |
| "Picking usually peaks from late April through early May" (4 texts about strawberry peak) | Hindi | the peak of picking: the most fruit, the busiest days | Hindi says "तोड़ने का सबसे अच्छा समय" ("the best time to pick"). Is that the same promise? |
| "serves about 2 to 3 adults" (4 texts) | Chinese | about 2 to 3 | The word for "about" is left out because the range is given. Allowed for now. |
| "The farm is not childproof" | Chinese | the farm is not made safe for small children | Chinese says it is "not designed for small children" (并不是为幼童设计的). Is that as strong? |
| "Wagon ride" and "barn" | Vietnamese | the tractor-pulled wagon ride; a farm barn | "xe kéo" (pulled cart) and "nhà kho" (storehouse). Natural, or is there a better word? |
| "Please do not bring your own alcohol" | Spanish | a polite request, plus the state rule that does not allow it | Spanish says "no se permite" (not allowed) for the request too. A little stronger. |
| Goats | Chinese | goats | Chinese often says 小山羊 (little goat) for goats. It is natural for baby goats; left as it is. |

One thing in the English, not in a translation, for the farm: the group tiers say "51–100 guests" and "100+ guests", so 100 guests is in both. The Spanish says "más de 100" and the Vietnamese "trên 100"; the Chinese and Hindi say "100 and more". If the tier is meant to start at 101, the English could say "101+". (I did not change English.)

## The strings that were changed

Eight translations (of five English texts), in `lang/src/es.json`, `lang/src/hi.json` and `lang/src/vi.json`, built with `python3 tools/i18n.py build`; every language has 0 missing after the build. The id is the text's id in `lang/en.json` (or the English words, for a text written by JavaScript). No new text was added, so no new text needs a native reader to approve beyond the ones below. All of them, and the doubts above, are for the native reader to confirm.

| Id | Language | Before | After | Why |
|---|---|---|---|---|
| t80fb1a73 | Spanish | Las flores de abril son más para fotos. Las mejores flores para cortar empiezan en mayo con el clima más cálido. | Las flores de abril son más bien solo para fotos. Las mejores flores para cortar empiezan en mayo con el clima más cálido. | English says April flowers are for photos ONLY; the Spanish left 'only' out, so it read as 'mostly for photos'. A visitor could expect to cut flowers in April. |
| t80fb1a73 | Chinese | 4 月的花更适合拍照。较好的切花要等天气转暖，从 5 月开始。 | 4 月的花更多只是用来拍照的。较好的切花要等天气转暖，从 5 月开始。 | English says April flowers are for photos ONLY; the Chinese left 'only' out (更适合拍照 = 'better suited to photos'). |
| t80fb1a73 | Vietnamese | Hoa tháng 4 chủ yếu để chụp ảnh. Hoa cắt đẹp hơn bắt đầu từ tháng 5 khi trời ấm hơn. | Hoa tháng 4 chủ yếu chỉ để chụp ảnh. Hoa cắt đẹp hơn bắt đầu từ tháng 5 khi trời ấm hơn. | English says April flowers are for photos ONLY; the Vietnamese left 'only' out (chủ yếu để chụp ảnh = 'mainly for photos'). |
| JavaScript text "U-pick USDA Certified Organic strawberries at Wise Acres ..." | Spanish | Fresas para recoger, con certificación orgánica del USDA, en Wise Acres, Indian Trail, NC. De mediados de abril a principios de junio. Se requiere reserva. | Fresas para recoger, con certificación orgánica del USDA, en Wise Acres, Indian Trail, NC. Temporada normalmente de mediados de abril a principios de junio. Se requiere reserva. | English says the season is USUALLY mid-April to early June (it depends on the weather); the Spanish dropped 'usually' and gave the dates as a promise. |
| te6cbae6c | Spanish | <strong>Otoño:</strong> las reservas sin pizza abren con un mes o más de anticipación. Las reservas con pizza abren todos los martes a las 5:00 p. m. para el fin de semana siguiente. Mira el <a1>calendario actual de otoño</a>. | <strong>Otoño:</strong> las reservas sin pizza abren por un mes o más cada vez. Las reservas con pizza abren todos los martes a las 5:00 p. m. para el fin de semana siguiente. Mira el <a1>calendario actual de otoño</a>. | English: dates without pizza open a month or more AT A TIME (a block of dates). The Spanish said 'with a month or more of notice', which is a different promise (how far ahead a visitor can book). |
| te6cbae6c | Vietnamese | <strong>Mùa thu:</strong> đặt chỗ không có pizza mở trước một tháng hoặc hơn. Đặt chỗ có pizza mở vào mỗi Thứ Ba lúc 5 giờ chiều cho cuối tuần sắp tới. Xem <a1>lịch mùa thu hiện tại</a>. | <strong>Mùa thu:</strong> đặt chỗ không có pizza mở cho một tháng hoặc hơn mỗi lần. Đặt chỗ có pizza mở vào mỗi Thứ Ba lúc 5 giờ chiều cho cuối tuần sắp tới. Xem <a1>lịch mùa thu hiện tại</a>. | English: dates without pizza open a month or more AT A TIME (a block of dates). The Vietnamese said 'open one month or more ahead', which is a different promise (how far ahead a visitor can book). |
| t8aa1a25f | Hindi | Wise Pie वुड-फ़ायर्ड पिज़्ज़ा, बीयर, वाइन और साइडर, Waxhaw Creamery आइसक्रीम और लोकल सामान के लिए आइए। बच्चों को प्लेग्राउंड में दौड़ना और बकरियों को सहलाना बहुत पसंद आएगा। बाहर के टीवी पर फ़ुटबॉल चलता है। | Wise Pie वुड-फ़ायर्ड पिज़्ज़ा, बीयर, वाइन और साइडर, Waxhaw Creamery आइसक्रीम और लोकल सामान के लिए आइए। बच्चों को प्लेग्राउंड में दौड़ना और बकरियों को सहलाना बहुत पसंद आएगा। बाहर के टीवी पर अमेरिकन फ़ुटबॉल चलता है। | English 'Football' means American football (the Spanish, Chinese and Vietnamese say so). In Hindi 'फ़ुटबॉल' alone means soccer. |
| JavaScript text "U-pick organic strawberries, blueberries, sunflowers and ..." | Hindi | यू-पिक ऑर्गेनिक स्ट्रॉबेरी, ब्लूबेरी, सूरजमुखी और कद्दू। वुड-फ़ायर्ड पिज़्ज़ा। स्कूल टूर, पार्टियाँ और आयोजन। 2013 से पारिवारिक। | यू-पिक ऑर्गेनिक स्ट्रॉबेरी, ब्लूबेरी, सूरजमुखी और कद्दू। वुड-फ़ायर्ड पिज़्ज़ा। स्कूल टूर, पार्टियाँ और आयोजन। 2013 से पारिवारिक स्वामित्व। | English says 'Family owned since 2013'. The Hindi 'पारिवारिक' alone ('family') left out that it is owned by a family; added 'स्वामित्व' (ownership). Written without a verb, as a page description. |

## Keeping it true

- Run the check any time: `node tools/i18n_facts.mjs` (all differences, with the English next to each), `node tools/i18n_facts.mjs --lang zh --kind days`, or `node tools/i18n_facts.mjs --show t1c41eab2` (what was read from one text in every language).
- The test `tests/i18n-facts.test.mjs` is in the no-browser group of `tests/run-all.mjs` and takes about 5 seconds.
- When a translation is meant to differ, add it to `tools/i18n_facts_allow.json` with the language, the id, the kind of fact and the reason.
- A tool that writes date lines into `lang/src` (the date phrase tool of the next wave) is read like any other text: its output has to carry the same month and day as the English. If it writes a form the reader does not know yet, the test names the text; add the form to the tables at the top of `tools/i18n_facts.mjs` (months, days, am and pm words), not to the allow list.
- A new text with a number in it needs no extra step: the pipeline's "missing" count and this test between them catch an untranslated or changed fact.
- Limits: no native reading, so tone and word choice are not judged; names in a local spelling (夏洛特, इंडियन ट्रेल, 美国农业部) are accepted from a short list, not from the dictionary.
