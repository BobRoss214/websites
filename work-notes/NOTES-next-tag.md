# Notes: the "Next" tag on the season buttons (helper next-tag)

What changed
- `js/season.js`: `W.seasons.upcoming(now)` = the season that starts next and is not on (the same pick as the countdown, the top bar and the "Next up" line of What's on the farm; those three still have their own copy of the expression in js/live.js and js/main.js).
- `js/hero.js`: `markTags()` draws `.ss-now` (the season that is on) and `.ss-next` (upcoming) from today's date; it runs at the start, on `wa:lang` and on `wa:day` (a page left open past midnight, and the tour's pretend days). No clock that can be read: no tags.
- `css/hero.css`, `css/extras.css`: `.ss-next` has every rule of `.ss-now` (same place and size), in `--berry` blue with white words (6 to 1). Layout fixes that the longer words and the new pixel checks showed up (the old Now tag had some too): a row gap of 18 px where the buttons wrap (Vietnamese at 768 px, big text); compact tags on phones (padding .3em, 10 px at 360 px and under, a 320 px rule: on a narrow button such as Verano or Mùa hè the long words reached the tag of the button before); a phone on its side (the tags were cut off at the top: 14 px more room); the Hindi words for summer and winter (tall tops) 0.12em lower.
- `lang/src/{es,hi,vi,zh}.json` (js): "next" = siguiente, अगला, tiếp theo, 接下来 (stored lowercase like "now"; the CSS shows capitals).
- Tour: `ch2-tags` (order 203, with the season walk) and `ch2-chips` (order 207), see docs/TOUR.md (eleven walks now) and tests/tour-seasons.test.mjs (11 expected).

Text to put in tests/README.md (main applies it)
- `hero`: add "its little Now and Next tags (every kind of day, a page left open past midnight, five languages, eight sizes, no cut-off tag and no covered letter)".
- `live`: add "the Next tag agrees with the countdown, also after midnight".
- `i18n-a11y`: "the \"now\" tag" becomes "the \"now\" and \"next\" tags".
- `tour-seasons`: the walk count is 11 (it was 10).

Browser-support table: nothing new (the test passes without an entry).
