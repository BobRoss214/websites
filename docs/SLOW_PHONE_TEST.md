# How the site does on a slow old phone

Many visitors have a cheap or old Android phone. This page says what was measured on a pretend phone like that, what the numbers are, what slows it down,
what was changed and what was left alone (and why). The numbers are from 3 October 2026. To measure again, see "Measure it yourself" at the end.

## The pretend phone

- A screen of 360 by 640, twice as sharp, touched with a finger (a small Android phone).
- A processor 4 times slower than this computer's (a cheap phone of the last few years) or 6 times slower (a very cheap or very old one). This is Chrome's own
  slow-down switch, so it is a model of a slow phone and not a real one.
- A line like **Slow 4G** (150 ms before each answer, 1.6 Mbit/s) or **Fast 3G** (560 ms before each answer, 1.5 Mbit/s). These are the numbers Lighthouse uses
  for a slow mobile line (the Constants file in its `lantern` folder, read on the day of the test).
- A **first visit** (nothing kept on the phone) and a **second visit** (the browser has kept the files).
- The pages are served the way the real host does it: text compressed with brotli, the caching rules of `_headers`, HTTP/2.
- Pages: the home page, First visit and Pumpkin patch, in English and in Hindi (Hindi text is bigger and needs one more file).
- Only Chromium was available, so only Chromium was measured, with software graphics, not a phone's graphics chip.
- **This computer was busy** with other jobs while the tests ran (it was running 20 to 55 jobs at once on 4 cores). Every time below is longer than a free computer would
  give and jumps from run to run (the middle of 2 or 3 runs is shown). To compare two versions of the site the tool counts the processor time the page uses, which
  does not depend on how busy the computer is, and turns it into what a phone 4 or 6 times slower would feel ("projected").

## How long a visit takes

Measured before the calm mode and the link names were added (loading is the same since: see the next part).

| page | language | line | phone | visit | first words (s) | page jumped | blocked (s) | picture drawn (s) | menu answers (s) | files | KB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| index | English | Slow 4G | 4x | first | 1.9 | 0.000 | 8.2 | 6.6 | 4.7 | 21 | 360 |
| index | English | Slow 4G | 4x | second | 1.9 | 0.000 | 4.5 | 4.8 | 4.7 | 21 | 0 |
| index | English | Slow 4G | 6x | first | 2.1 | 0.000 | 5.4 | 3.6 | 4.9 | 21 | 360 |
| index | English | Slow 4G | 6x | second | 1.9 | 0.000 | 4.4 | 5.3 | 5.1 | 21 | 0 |
| index | English | Fast 3G | 4x | first | 3.3 | 0.000 | 4.8 | 6.2 | 6.2 | 21 | 360 |
| index | English | Fast 3G | 4x | second | 1.3 | 0.000 | 4.9 | 3.2 | 4.2 | 21 | 0 |
| index | English | Fast 3G | 6x | first | 3.1 | 0.000 | 5.5 | 6.5 | 7.7 | 21 | 360 |
| index | English | Fast 3G | 6x | second | 1.5 | 0.000 | 4.6 | 4.4 | 4.8 | 21 | 0 |
| index | Hindi | Slow 4G | 4x | first | 2.3 | 0.000 | 4.2 | 3.5 | 5.5 | 21 | 350 |
| index | Hindi | Slow 4G | 4x | second | 1.7 | 0.000 | 5.9 | 4.4 | 3.9 | 21 | 0 |
| first-visit | English | Slow 4G | 4x | first | 1.8 | 0.000 | 0.5 | - | 1.9 | 21 | 300 |
| first-visit | English | Slow 4G | 4x | second | 0.8 | 0.000 | 0.3 | - | 1.1 | 21 | 0 |
| first-visit | English | Fast 3G | 6x | first | 2.8 | 0.000 | 1.1 | - | 3.3 | 21 | 300 |
| first-visit | English | Fast 3G | 6x | second | 1.0 | 0.000 | 0.7 | - | 1.4 | 21 | 0 |
| first-visit | Hindi | Slow 4G | 4x | first | 2.6 | 0.000 | 0.5 | - | 2.8 | 21 | 290 |
| first-visit | Hindi | Slow 4G | 4x | second | 0.7 | 0.000 | 1.2 | - | 1.5 | 21 | 0 |
| pumpkin-patch | English | Slow 4G | 4x | first | 1.8 | 0.000 | 0.0 | - | 1.9 | 19 | 277 |
| pumpkin-patch | English | Slow 4G | 4x | second | 0.8 | 0.000 | 0.0 | - | 0.9 | 19 | 0 |

"First words" is when the first text appears (also the biggest thing painted: the farm picture is drawn by a script and does not count). "Page jumped" is how
much the page shifted while loading (0 is none). "Blocked" is how long the phone was too busy to answer a touch. "Picture drawn" is when the farm scene
appears (the other pages have none). "Menu answers" is the first moment a tap on the menu button opens the menu. These are wall-clock seconds on a busy
computer; "blocked" in particular is two to three times what the projection below says.

- **The first words come after about 2 to 3 seconds** on a first visit and in under 2 seconds on a second one. The slow processor, not the line, is most of it (Hindi: 2.3 s against 1.9 s in English on Slow 4G).
- **Buttons answer after 4 to 8 seconds on the home page**; the farm picture is drawn after 3 to 7 seconds. First visit and Pumpkin patch answer after 1 to 3 seconds.
- **Nothing jumps**, also while scrolling the whole home page (31 more files and 2.0 MB of pictures come in on the way).
- **The download is small:** the home page is 21 files and about 360 KB with the text compressed (1.0 MB unpacked); the other pages 19 to 21 files and 280 to 300 KB.
  A second visit downloads nothing but a check of the page's own address (a few hundred bytes at most).
- In memory: 2.2 MB of script data (JS heap) on the home page, and 36,411 nodes (7,378 elements, plus the copy each of the 880 small drawings makes).

## How much work the phone has to do

Processor time of the main thread (the one that draws the page and answers touches) on this computer with no slow-down, and what a phone 4 or 6 times slower
would be blocked (a task over 50 ms on the phone is a freeze; "blocked" is the part over 50 ms of all of them):

| page | processor time until the first words (ms) | until loaded (ms) | 4x phone: freezes | 4x blocked (s) | longest freeze, 4x (s) | 6x blocked (s) |
| --- | --- | --- | --- | --- | --- | --- |
| Home page, English | 202 | 821 | 26 | 2.5 | 0.5 | 4.5 |
| Home page, Hindi | 481 | 1341 | 23 | 2.8 | 0.6 | 4.9 |
| First visit, English | 109 | 160 | 3 | 0.4 | 0.5 | 0.7 |
| First visit, Hindi | 203 | 244 | 4 | 0.5 | 0.5 | 0.9 |
| Pumpkin patch, English | 103 | 130 | 0 | 0.0 | 0.0 | 0.0 |
| Pumpkin patch, Hindi | 164 | 189 | 1 | 0.0 | 0.1 | 0.0 |

Most of it is drawing, not scripts: on the home page 580 of the 820 ms before it has loaded are style, layout and paint; scripts are about 100.

## How smooth is the farm picture

When something asks the page for a frame (scrolling, a tap, any script: up to 60 times a second) and the farm picture is on the screen, one frame costs this much
of the main thread, and a phone could make this many frames a second:

| season | endless animations running | one frame (this computer) | frames a second, 4x phone | 6x phone |
| --- | --- | --- | --- | --- |
| spring | 48 | 25 ms (paint 15, layers 10) | 10 | 7 |
| summer | 69 | 17 ms (paint 8, layers 6) | 15 | 10 |
| fall | 65 | 11 ms (paint 5, layers 4) | 22 | 15 |
| winter | 98 | 8 ms (paint 3, layers 1) | 33 | 22 |

Standing still, with nobody asking for frames, the picture costs little: 0.1% of the main thread in winter, 1 to 5% in the other seasons (4 to 6 times that on a phone).

**When nobody can see it, nothing runs.** Scrolled away from the picture, in a hidden tab, or with "reduce motion" on, 0 of the 119 endless animations run, no frame is drawn
and the main thread is 0.0 to 0.1% busy. The picture in view is drawn about 50 times a second by the graphics side and asks the main thread for 1 to 2 frames a second.

**The calm mode** (added after the first numbers; `js/main.js`) does what the numbers above ask for. Measured on a 4x and a 6x phone, spring and fall:

| state | one frame | endless animations running |
| --- | --- | --- |
| as it comes (spring / fall) | 25.6 ms / 10.3 ms | 48 / 65 |
| the visitor pressed "Pause animations" | 0.3 ms / 0.4 ms | 0 / 0 |
| the page's own switch, first step ("light": the bee and small decorations rest) | not measured / 10.9 ms | not measured / 33 |
| the page's own switch, second step ("most") | 1.0 ms / 0.9 ms | 2 / 3 |

The page looks at the picture by itself after it has loaded; on a 4x or 6x phone it made the first step within 1 to 4 seconds of the phone being slowed, and went on to the second (it needs two bad 2-second looks for each step).
The first step alone does not help in fall (the frame still costs 11 ms): the parts that cost most are not among the small decorations, the second step is the one that matters.
A browser run by a program never switches by itself (the tool turns that off to be able to see it).

## Where the time goes

1. **Drawing the page** is most of it. The home page is 7,378 elements and 880 small drawings, so the browser holds 36,411 nodes. Before the page has loaded the processor spends
   about 820 ms on it (3.3 s on a 4x phone): about 290 ms working out styles, 110 layout, 70 paint, 65 layers. No single script is heavy; it is the sum.
2. **The moving parts of the picture repaint the whole picture.** In this Chromium an endless animation of a part that sits inside another group of the drawing runs on the main thread
   and repaints the whole layer on each frame (a part that is a direct child of the drawing is moved by the graphics side and costs nothing; a small test page showed the difference).
   Every season except winter has such parts. Pausing only these takes a frame from 31 ms to 1 ms, pausing the others changes nothing. This is why the calm mode helps so much.
3. **A font that was asked for too late.** The font for the Vietnamese letters (13 KB, used for "Tiếng Việt" in the language list) was only asked for when the footer's language list was built,
   about 2.7 s into the load. When it arrived the browser worked out the whole page again: 13,270 elements marked at once, one task of about 40 ms of processor time (160 ms on a 4x phone). Fixed, see below.
4. **Hindi costs 60% more than English** before the page has loaded (1.3 to 1.4 s of processor time against 0.82): 760 blocks of text to swap in, text that is taller and harder to lay out
   (+360 ms of style and layout), and a words file of 195 KB (42 KB sent) that the page waits for before the first words appear. On a 4x phone the Hindi page is blocked for 2.8 s against 2.5 s
   in this count.
5. **The farm map on First visit** is drawn when the browser is idle after loading and takes about a second of processor time in one go (a freeze of 0.5 s on a 4x phone).
   It is drawn late on purpose, so that the page loads first.

## What was changed

One line in the head of every page (`index.html`; `tools/pages.py` copies it into the other pages): the font for the Vietnamese letters is now asked for at the start with the other fonts,
at low priority so that it does not slow down the style sheets and scripts (with normal priority the style sheets arrived 0.1 s later on Fast 3G).

Home page, English, the two versions loaded in turns, middle of 8 (processor time first, then the Fast 3G line with no processor slow-down):

| | before | after |
| --- | --- | --- |
| processor time until the first words | 240 ms | 187 ms |
| processor time until loaded | 959 ms | 843 ms |
| processor time in all (8 seconds of the page) | 1,452 ms | 1,403 ms |
| blocked on a 4x phone (from processor time) | 2.6 s | 2.5 s |
| first words (Fast 3G) | 2.5 s | 2.5 s |
| page loaded | 6.8 s | 5.2 s |
| blocked | 4.4 s | 3.0 s |
| menu answers | 5.2 s | 4.5 s |

The same line was counted in four other comparisons: processor time until loaded came out 110 to 300 ms lower each time and the first words were never later. A busy computer
makes single runs jump, so take the processor-time rows as the sure part. The other pages carry the same one line; the files and bytes they download are unchanged.

The look is the same: full-page pictures of the home page (390 wide in English, 820 wide in Spanish), First visit in Hindi and Pumpkin patch, before and after, are the same
byte for byte, and none of the 765 to 7,684 boxes on each page moved. Nothing else was changed.

## What was not changed, and why

These would change how the page looks or behaves, or carry a risk, so they are for the owner to decide.

- **Draw only the sections near the screen** (`content-visibility`). The biggest saving found: processor time until loaded 880 ms down to 340 ms (-61%), 4x phone blocked time 2.8 s down to 1.1 s.
  An earlier version of the site had it and it was taken out again (the page could jump when a section was drawn, and a link to a section could land in the wrong place). Not applied.
- **Start the sections far down already resting.** 95 ms less processor time on its own (11%), about 300 ms less together with the font line. But a section that happens to be on the screen when the page
  opens would only start moving a moment later, and the pages would need a class on each section. Not applied.
- **Redraw the farm picture so that every moving part is a direct child of its drawing** (reason 2 above). A frame would cost what winter's does (8 ms) in every season. It means rewriting the drawing
  code in `js/hero.js`; the calm mode already gets most of the benefit on a phone that struggles.
- **The handwriting font** (51 KB, 14% of what the home page downloads) could be cut to the letters in use; the text would have to be checked again whenever a word is changed.
- **Asking for the Hindi words file earlier** (a hint from the first script) was tried: in a test run the browser still did not start it earlier, so there is no gain.

## Measure it yourself

- `node tests/run-all.mjs slow-phone` (about a minute, needs a browser): the steady part. It fails if the home page, First visit or Pumpkin patch download more files or bytes than the limits in the test, if the page
  holds more nodes, if something jumps while loading, if the menu does not answer a tap, if the Vietnamese font is asked for late again, if a second visit downloads more than the page itself, or if something loops with "reduce motion".
  It never measures seconds, so a busy computer does not fail it. If the page grew on purpose, raise the limit in the test and say so here.
- `node tools/slow_phone.mjs` (a few minutes) makes the tables above. `--mode cpu` counts processor time, `--mode framecost` the cost of a frame per season (with `--calm off,all,auto`),
  `--mode ab --roots A,B` compares two copies of the site in turns, `--mode trace` and `--mode profile` show where the time goes. `node tools/slow_phone.mjs --help` lists everything.
- Seconds depend on the computer that measures. Use a quiet computer, look at the middle of three runs, and compare two versions with `--mode ab`.
