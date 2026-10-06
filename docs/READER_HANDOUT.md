# Hand-out for the friends who read the translations

One page for the farm owner, and for whoever helps with the website. It says which friend reads which sheet, in which order, how the corrections come back and how they get into the site. The how-to for making the sheets is in `docs/CHECK_A_LANGUAGE.md`.

Why this is needed: the Spanish, Hindi, Chinese and Vietnamese texts were written with AI help, and no native speaker has read them. This is the dashboard question d37. A friend who reads the language can fix what sounds wrong, stiff or odd. Nobody needs to know anything about websites.

## Who reads what

Each language needs one friend. Each friend gets one main sheet. Two other kinds of sheet exist, and most friends never need them.

| Friend reads | Main sheet to give | Rows | First 20 minutes |
|---|---|---|---|
| Spanish | `es.xlsx` | about 1,400 | the 150 rows marked 1 |
| Hindi | `hi.xlsx` | about 1,400 | the 150 rows marked 1 |
| Chinese | `zh.xlsx` | about 1,400 | the 150 rows marked 1 |
| Vietnamese | `vi.xlsx` | about 1,400 | the 150 rows marked 1 |

Each row is one text of the website: the English, the words the site has now, and an empty box for a better version. The rows marked 1 are the ones that matter most: prices, refunds, rain, pets, allergies, safety, the QR signs and what visitors see first. Rows marked 2 take about an hour more. Rows marked 3 are the rest. Any amount of help is welcome.

## In which order

1. **The main sheet comes first.** Make it with `python3 tools/review_sheet.py export all` (on Windows `python` or `py -3` instead of `python3`), and give each friend the `.xlsx` file of their language. Send the text of the matching message file (`review/es-message.txt` for Spanish) as the e-mail. It is written in the friend's language and in English.
2. **The "changes since" sheet comes second, and only for a friend who already did a main sheet.** The site changes after a sheet is given out. This short sheet lists only the texts that are new or different since then. A friend who has not started yet needs only a main sheet made today, because it already has every change.
3. **An option sheet comes last, and only if the farm picks that option.** Some options in `docs/OPTION_PATCHES.md` add words that are not on the site yet. Nobody should read those words until the farm says yes to the option.

Keep a copy of every file you give out, in a folder of its own (for example `review-given-out`). A new `export` makes new files with the same names, and the "changes since" sheet is made by comparing with the file the friend really got.

### The "changes since" sheet

Make it with the sheet you gave out:

`python3 tools/review_sheet.py changes es review-given-out/es.csv`

It writes `review/es-changes.xlsx` (the file to send), the same table as `.csv` and `.html`, and `review/es-changes-message.txt` (the e-mail). Each row says in the **question for you** column what happened:

- **NEW**: a text that was not on the first sheet.
- **CHANGED**: a text whose words changed. The column also says what it said before.
- **REPLACES**: the same words under a new id. If the friend had corrected the old line, the correction goes on this row.
- **REMOVED**: a text that is not on the site any more. There is nothing to do for it.

A text that now has the correction your friend wrote is left out. If nothing changed, the command says so and writes nothing.

### The option sheets

Make them with `python3 tools/review_option_texts.py`. They go into `review/options/`. The file `review/options/INDEX.txt` says which sheet goes with which answer to which question, and how many texts it holds. It takes about 15 minutes, because it tries every option on a spare copy of the site.

On 4 October 2026 five options add words:

| Option | Question | New texts for each language |
|---|---|---|
| Visitor privacy page (`privacy-page`) | d89 | 68 |
| "This page has moved" pages for the old addresses (`redirects-B`) | d30 A | 10 |
| Fall booking hidden in winter (`winter-A`) | d01 A | 1 |
| Fall prices kept with a note (`winter-B`) | d01 B | 1 |
| Phone number in the footer (`phone-number-shown`) | d04 A | 1 |

The other options add no words, so there is nothing to read for them. Give a friend an option sheet only after the farm has chosen that option. Corrections to an option sheet are not imported, because the words are not in the site yet. Send them to Claude, who changes the translation lines inside that patch file.

## What the friend does

The friend opens the `.xlsx` file, reads the English next to the words the site has now, and types a better version in the **correction** column when something is wrong. The friend leaves a row empty when the words are fine. The friend does not change names, numbers, prices, times, e-mail addresses, or the marks `{n}` and `< >`. The file opens on a page called "Read me first" that says all of this in the friend's language and in English.

## How the corrections come back

The friend saves the file and sends it back by e-mail, as an attachment. An `.xlsx` file or a CSV file (a plain table that Excel and Google Sheets can save) both work. A friend who cannot use a spreadsheet can send the row id and the better line in an e-mail. Then you type it in the **correction** column yourself.

Save the file into the folder `review/` with a name that shows the language, for example `es.back.xlsx`.

## How the corrections get into the site

This part is for Claude, or for whoever edits the site. It changes only the lines the friend corrected, and it can be run as often as you like.

1. Look first: `python3 tools/review_sheet.py import es review/es.back.xlsx --dry-run`. It writes nothing. It shows each good correction (the English, before, after) and each refused row with its row number, its id and the reason.
2. Run it again without `--dry-run`. Only the good rows are written, to `lang/src/es.json`. English is never touched. The exit code is 1 when some row was refused. Add `--strict` to write nothing at all when any row is refused.
3. Rebuild and check: `python3 tools/i18n.py build`, then `python3 tools/i18n.py missing es` (it must say 0, also for the texts written by JavaScript), then `node tools/i18n_facts.mjs` (it must show 0 differences), then `node tests/run-all.mjs consistency`.
4. Open `index.html?lang=es` in a browser and look at the page.

A row is refused when a number, price, time, day, name, e-mail address, `{word}` or `< >` mark is not the same as in the English. Excel can also turn something like `9/29` into a date, and the tool notices that. A refused row is never written. Ask the friend to fix it, or fix it yourself in the sheet.

A friend may answer on a line that got a new id after the sheet was made. The report then says "The sheet has the old id of this text (te6cbae6c is t6fab8a7b now)". The line was changed to have a mark around its last sentence, so the correction is refused for the missing `<span>` mark. Put the correction on the row of the "changes since" sheet, where the mark is shown, or add the mark yourself. The pairs of old and new ids are under `renamed` in `tools/review_notes.json`.

## What was tried

The test `reader-roundtrip` does this whole path on a copy of the site, for all four languages. A sample friend sends back a corrected sheet with two good lines, a changed price, a lost `{placeholder}` and a correction on an old id. The check is that exactly the two good lines change in `lang/src/<code>.json`, English does not change, the refused rows say why, and then `i18n.py build`, `i18n.py missing` (0) and `i18n_facts.mjs` (0 differences) pass. It also tries the "changes since" sheet.

No native reader has checked the words yet. The first sheets that come back will be the first check.
