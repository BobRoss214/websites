# Have a friend check a language

One page for the farm owner. A friend who reads Spanish, Hindi, Chinese or Vietnamese checks the words of the site in a spreadsheet. They need no skills with websites. You change no code. You need Python 3.8 or newer on the computer that holds the site folder. There is nothing to install.

Why: the four translations were written with AI help, and no native speaker has read them. This is the dashboard question d37. The lines that matter most are the ones about money, rain, pets, allergies and safety, so the sheet puts those first.

Who reads which sheet, in which order, and what happens to the corrections: `docs/READER_HANDOUT.md`.

If somebody already made the sheets for you (four `.xlsx` files, one for each language, with a small text file for each e-mail), start at step 2.

## Step 1. Make the sheets

Open a command window in the site folder. On Windows type `python` or `py -3` where this page says `python3` (README, "Commands on Windows, Mac and Linux"). Then type:

`python3 tools/review_sheet.py export all`

For one language only, use `es`, `hi`, `zh` or `vi` instead of `all`. It takes a few seconds and puts five files per language into the folder `review/`:

- `review/es.xlsx` is the sheet to send. It opens in Excel, Numbers, Google Sheets and LibreOffice.
- `review/es-message.txt` is the e-mail to send with it, in your friend's language and in English.
- `review/es.csv` is the same table, for a program that cannot open `.xlsx`.
- `review/es.html` is the same table to read or print, with the one-page instructions first.
- `review/es-instructions.html` is the one page of instructions alone. Print it, or attach it if your friend wants it on paper.

Make the sheets after you have put in any translation change you want, because the sheet shows the words the site has today. The folder `review/` is not uploaded and not kept with the project.

## Step 2. Send the file

E-mail the `.xlsx` file for that language to your friend. Paste the text of the e-mail file (`review/es-message.txt`) as your e-mail, and add your own greeting.

Tell your friend that 20 minutes is enough. In the sheet, the rows marked 1 in the **priority** column come first. They are the 150 texts that matter most: what visitors see first, every price, the lines about refunds, rain, pets, allergies and safety, and the words on the printed QR signs. Rows marked 2 are the next 450 (about an hour). Rows marked 3 are the rest. Any amount of help is welcome.

The file opens on a page called "Read me first". It explains the work in your friend's language and in English. It says what to change and how to send the file back. It also says what not to change: names, numbers, prices, times, and the `{n}` and `< >` marks that the page fills in.

Some rows have a question for your friend in the **question for you** column. These are our doubts about a word, lines we changed after a check, and lines where the translation differs from the English on purpose.

## Step 3. Get it back and check it

Save the file your friend sends into the folder `review/`. Any name will do, for example `es.back.xlsx`. Look before you change anything:

`python3 tools/review_sheet.py import es review/es.back.xlsx --dry-run`

This writes nothing. It shows each good correction in plain words (the English, before, after and what changed). It also lists each row it will not use, with the row number, the id and the reason. A row is refused when a number, a price, a time, a day, a name, an e-mail address, a `{word}` or a `< >` mark is not the same as in the English. Excel can also turn something like `9/29` into a date. The tool notices this and says so.

If your friend typed the better text over the old text, or in the wrong column, the tool lists those rows too. Only the **correction** and **note** columns are read. Copy the text into **correction** yourself and run the command again, or ask your friend.

If you are happy with the list, run the same command without `--dry-run`. Only the lines that were corrected change in `lang/src/es.json`. English never changes. A refused row is never written. Add `--strict` to write nothing at all when any row is refused.

A correction to a line you changed by hand after making the sheet replaces your newer words. Did the site change after you gave out a sheet? A friend who already did the first one does not need a new full sheet. Run `python3 tools/review_sheet.py changes es FILE` with the file you gave out. It makes a short sheet of only what changed. See `docs/READER_HANDOUT.md`. The report warns you about each such line, so read it first.

## Step 4. Publish

The tool prints the commands to run next. It runs none of them. They are:

1. `python3 tools/i18n.py build`
2. `python3 tools/i18n.py missing es` (it must say 0)
3. `node tests/run-all.mjs consistency` (it checks every number, price and day against the English)

If the QR sign words changed, also run `python3 tools/make_qr.py` and reprint those signs. Then open `index.html?lang=es` in a browser and look at the page. When it looks right, put the site online as usual (see "3. The steps, in order" in `docs/LAUNCH_CHECKLIST.md`).

## If something goes wrong

| What you see | What to do |
|---|---|
| "looks like Excel changed this" | Ask your friend to type that line again. Excel turned it into a date or a number. The sheet is set up so this should be rare. |
| "does not belong to the Spanish file" | The sheet is for another language, or the translations changed a lot after the sheet was made. Make a fresh sheet and ask again. |
| "This is a LibreOffice / OpenDocument (.ods) file" | Ask your friend to save it again as Excel (`.xlsx`). |
| "not saved as UTF-8" | Ask your friend to save it as "CSV UTF-8", or send the `.xlsx` file. |
| Your friend answers in an e-mail, not in the sheet | Type the better lines into the **correction** column yourself, then import. |
| You want a fresh sheet but the old one has corrections | `export` will not overwrite it. Import it first, or add `--force` to throw it away. |

For the people who edit the site: the tool is `tools/review_sheet.py` and its test is `review-sheet` (see `tests/README.md`). The instructions that travel with the sheet are in `tools/review_instructions.json`. The questions and the list of lines for priority 1 are in `tools/review_notes.json`.
