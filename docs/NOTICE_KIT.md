# Closing for a day: the command, the checklist and the words to paste

For the day the farm must close, open late, or is full. Rain is the usual reason. Work from the top and do not skip a step. It takes about 10 minutes.

## 1. One command for the website

Open a terminal in the website folder. On Windows type `python` or `py -3` where this page says `python3` (README, "Commands on Windows, Mac and Linux"). Then type one of these (add `--dry-run` at the end first, to see exactly what would change):

    python3 tools/close_today.py rain
    python3 tools/close_today.py wind
    python3 tools/close_today.py holiday
    python3 tools/close_today.py late-open 10:30
    python3 tools/close_today.py sold-out
    python3 tools/close_today.py custom "Closed for a private event."

- **For a day that is not today:** add `--date 2026-10-11`. **For several days:** add `--until 2026-10-13` (rain, wind and holiday only).
- **rain, wind, holiday** close the day: the badges for the farm, The GreenHouse and Wise Pie say closed. **late-open, sold-out and custom** only write the bar; nothing is closed on the site.
- The bar shows the sentence in English, Spanish, Hindi, Chinese and Vietnamese, and hides itself the morning after the last day. The sentences are in `tools/notice_phrases.json`. The Spanish, Hindi, Chinese and Vietnamese ones were written by an AI and no native speaker has read them yet; the file says so for each language.
- The tool changes only `closures:`, `notice:` and `noticeUntil:` in `js/content.js`. It keeps a copy of the old file **outside** the website folder and says where. Then it checks that the new file still runs. If anything looks wrong it writes nothing and says why in plain words.
- **Made a mistake?** `python3 tools/close_today.py --undo` puts the file back exactly as it was. If you changed the file by hand after the closure, it will not guess: it says so and shows where the old copy is.
- `python3 tools/close_today.py --check` only says what the file says now.
- **Then publish:** `python3 tools/make_deploy_folder.py`, and upload what is inside `deploy/` (`docs/LAUNCH_CHECKLIST.md`, step 3.2). Or add `--publish` to the first command and it makes the folder for you.

## 2. What the command cannot do

Do these yourself, in this order. Visitors' browsers may keep the old page for up to an hour, so the places people look first matter most.

1. **Instagram and Facebook.** Post the words in section 3. The site itself tells visitors to check Instagram for changes (the GreenHouse note).
2. **Bookeo.** Close that day's times, as you always do. The website cannot stop people booking. Then press Reserve on the site and look: no times for that day.
3. **Google Business Profile.** Add a post with the same words, or change the hours for the day.
4. **Look at the live site on your phone** after you upload. Press refresh twice. You should see the yellow bar and "Closed today".
5. **Answer the people.** Read the farm inbox: the waitlist and contact messages come to you.

## 3. Words to paste

Fill in the day. The tool also prints these with the day already filled in.

**Rain or strong wind**

- English: We are closed [Sunday, Oct 4] for rain. Thank you for understanding. If severe weather forces us to close, we’ll email you and give a full refund.
- Español: Estamos cerrados el [domingo 4 de octubre] por lluvia. Gracias por tu comprensión. Si el mal tiempo grave nos obliga a cerrar, te enviaremos un correo y te daremos un reembolso completo.

The last sentence of each is the rain policy that is already on the site (the home page and the first-visit page). Use it for rain and wind. Do not add any other promise (a different refund, a voucher) unless the farm has decided it.

**Holiday**

- English: We are closed [Thursday, Nov 26] for the holiday. Thank you for understanding. See you soon!
- Español: Estamos cerrados el [jueves 26 de noviembre] por el día festivo. Gracias por tu comprensión. ¡Nos vemos pronto!

**Opening late**

- English: We open late [Saturday, Oct 10]: at [10:30 AM]. Thank you for your patience.
- Español: El [sábado 10 de octubre] abrimos tarde: a las [10:30 a. m.]. Gracias por tu paciencia.

**Reservations are full**

- English: Reservations are full for [Saturday, Oct 10]. Please choose another day.
- Español: Las reservas están completas para el [sábado 10 de octubre]. Elige otro día.

**When you know the day you open again** (add it to any of the above)

- English: We plan to open again [Friday, Oct 9], weather permitting.
- Español: Planeamos abrir de nuevo el [viernes 9 de octubre], si el clima lo permite.

Type the day in `--reopen 2026-10-09` and the tool puts this sentence into the words it prints.

## 4. After the day

- The bar hides itself the morning after its last day. `?check` at the end of the address then shows a green box that reminds you to clear the old words. You may leave them or write `notice: ''`.
- A closed day can stay in `closures:` for ever. It only matters on its own day.
- If the weather changes and you open after all: run `python3 tools/close_today.py --undo`, publish again, and post the good news in the same places.
