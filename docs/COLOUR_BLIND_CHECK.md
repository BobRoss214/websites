# Colour-blind check

Checked on Oct 3 2026, on the home page at 1280 px wide (fall, the test date Oct 2 2026). About 1 man in 12 sees colours differently.
This note says what was checked, what was found, the three small fixes, and two ideas the owner can choose.

## In short

- Almost every place where colour means something also has words or a shape, so nobody misses the meaning.
- Three places used colour alone. Each now also has a dark ring or line. No words were added and nothing moves.
- Two ideas are left to the owner. They would change how the "spots" pills and the open/closed dot look.

## How it was checked

Chrome can show a page the way people with colour blindness see it. Five ways were used:

- protanopia (no red cones) and deuteranopia (no green cones): red and green look alike. These are the common ones.
- tritanopia (no blue cones): blue and yellow look alike. Rare.
- achromatopsia (no colour at all, only light and dark). Very rare, but the hardest test.
- blurred vision (not colour blindness, but common).

For each pair of looks (for example "chosen" and "not chosen") the page was photographed in each of the five ways and the
colours of the two looks were compared with two numbers:

- **Colour difference (CIEDE2000).** Under 5: the two look the same. 5 to 10: hard to tell apart. 10 or more: clearly different.
- **Light-dark contrast (the WCAG ratio).** 3 or more means one is clearly lighter than the other, which still works without colour.

The rule used is the one in the web accessibility guidelines (WCAG 1.4.1, "Use of Color"): colour may help, but it must not be the
only way to tell. Words, a shape (a ring, a line, a tick, an underline, a lift), or a clear light-dark difference (3 or more) count.

## What was found

| What | The two looks | Without colour, what still tells them apart | Result |
| --- | --- | --- | --- |
| Open / opens soon / closed badge | green, yellow and grey dot | the words next to it ("Open now", "Closed for now") | fine; the dots alone look the same with no colour (difference 2.4) |
| Week strip (open and closed days) | yellow day with a dark ring, white day with a pale ring | the ring: contrast 8 in all four colour-blind views | fine |
| Week strip, today | | an extra red ring round today (a shape) | fine |
| "Spots" pills (open, a few left, full, closed) | green, orange, pink, grey | the words in each pill | fine; the colours alone are lost for red-green colour blindness (difference 0.8) — owner idea 1 |
| "What is ripe" pills | red, green, orange, cream | the words in each pill; "coming soon" also has a dashed edge | fine |
| Season tabs, group tabs, "What's on the farm" season buttons | yellow / white | the chosen one is lifted on a deeper shadow and its picture tilts | fine |
| "Happening now" season | | the words "Happening now" / "Now" | fine |
| Tomato variety filter | red / white | lifted, and contrast 4 to 7 | fine |
| Farm map list | yellow / white | the chosen place has a dark edge (contrast 14) | fine |
| Footer language links | yellow / white | the others are underlined, the current one is not | fine |
| **Language menu (top right)** | yellow / white | **nothing** (contrast 1.5 to 1.7) | **fixed: a dark ring round the current language** |
| **"See the farm in" season buttons above the hero** | yellow / white | **nothing**: both had the same shadow and edge (contrast 1.2 to 1.7) | **fixed: the chosen one has a thicker dark edge** |
| **"What's on the farm" table, the chosen season's column** | yellow / pale | **nothing in the table** (cells: difference 0.8 with no colour) | **fixed: a thick line under the chosen season's name** |
| "What's on the farm" table, yes / no | green tick / grey dash | a tick and a dash are different shapes | fine |
| Signup message, done / mistake | green tick / red "!" | the tick or "!" and the words | fine |
| Email field marked wrong | red edge / dark edge | the message under it says what is wrong | fine; the red edge alone is weak for protanopia (contrast 1.9) |
| Required fields | | no field is marked as required with a colour or a star (the signup email is the only required field) | nothing to check |
| Drive time box: answer / problem | both in dark red bold | the words ("About ... minutes" or what went wrong); "please wait" has a dashed edge | fine |
| Drive time box: which place you drive to | yellow / cream | a filled radio dot in the chosen one | fine |
| Pizza reservation box (open / not open yet) | pale green / white | its heading and buttons say which | fine |
| Pizza chip ("Next pizza reservations ...") and signup "interest" chips | | words; a chosen interest chip turns dark and gets a tick | fine |
| Site check box (owner only) | yellow / green | its heading says "N things to fix" or "nothing is broken" | fine |
| Farm calendar "today" line | red line on white | contrast 4 to 7, and the "Today" label | fine |
| Winter game: lit / dark trees | bright bulbs and a glow / faint bulbs | the glow is a light-dark change; the count in the game card goes up | fine (judged on the pictures) |
| Sunflowers snipped, strawberries and blueberries picked | | the picked one disappears (a shape change), the count goes up | fine |
| Achievements | | a card with words | fine |
| Links inside running text | | all 16 on the home page are underlined; the "#wiseacresorganic" tag is a yellow pill | fine |
| Keyboard focus ring | blue ring (pale yellow on the red band and in the footer) | contrast 4.2 to 13 against the colour next to it, in all four colour-blind views | fine |

## What was fixed (no new words, nothing moves)

1. **Language menu.** The current language had only a yellow background. It now also has a dark ring, the same ring the top menu
   already uses for the section you are in. In the colour-blind views the edge now differs by contrast 14 (it was 1.5 to 1.7).
2. **"See the farm in" buttons above the hero.** The chosen season had only a yellow background. It now has a thicker dark edge.
   Edge contrast 14 in every view (it was 1.2 to 1.3).
3. **"What's on the farm" table.** The chosen season's column was only tinted yellow. A thick dark line now sits under its name.
   Contrast 13.5 or more in every view (it was 1.4 to 1.6).

The changes are in `css/extras.css`, `css/hero.css` and `css/styles.css` (one line each). The text contrast check was run again
after the change: no text got harder to read.

The test `tests/colour-blind.test.mjs` photographs these three and two older shapes (the week strip ring and the map list edge) in
the four colour-blind views, checks every link in running text is underlined, and first proves it catches a mistake. It takes
about 75 seconds on a busy computer.

## Ideas for the owner (each changes the look)

1. **"Spots" pills.** With red-green colour blindness "Spots open" (green) and "A few spots left" (orange) are the same colour, and
   with no colour all four are the same grey. The words still say it, so nothing is broken. If you want the colours to help
   everyone: a small mark in each pill (a tick, "!", a cross, a dash). The pills get a little wider.
2. **The open / closed dot.** With no colour, the green, yellow and grey dots look the same. The words next to the dot still say it.
   If you want the dot itself to say it: a full dot for open, a half dot for "opens soon", a hollow dot for closed.

Before and after pictures for each fix and each idea (usual colours and four colour-blind views) were made with this check.
