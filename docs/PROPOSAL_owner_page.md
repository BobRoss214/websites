# Proposal: an owner page and a facts table (not built)

Nothing here exists yet. It is a plan for the farm owner to say yes or no to. Written on 3 October 2026.

## The problem

To close for rain, change an hour or a price, the owner edits text files by hand. One missing comma or quote mark switches off every setting, and a price is written in about nine places and four translations. The "Site check" box now names the mistakes, but she still has to make the edits.

## Part 1: owner.html, a form that writes the settings

**What she would do.** Double-click owner.html in the site folder (it is never uploaded). Fill in boxes: the notice and its last day, closed days (a date picker and "a whole week"), the hours, the review link, the Mailchimp address, the farm's map point. Press "Show what will change", read the list, press "Save".

**What it would change.** Only `js/content.js`, and only between two marker lines (`// owner-page:begin` and `// owner-page:end`) that it adds once. Everything outside them, including the notes at the top, stays as it is. It never touches the pages or the translations.

**How it stays safe.**
- It uses the same rules as the Site check (times on the 24-hour clock, open before close, `https://` addresses, a farm point in the United States). A wrong value cannot be saved. The rules live in one shared file, so the form and the Site check cannot disagree.
- Before saving it shows the old and new lines side by side, and keeps `content.js.bak` next to the file.
- Chrome and Edge can save into the file directly after she picks it once. Firefox and Safari cannot, so there the form offers a downloaded `content.js` to put in the folder (one more step).
- Text goes in as plain text (quotes and apostrophes are written correctly for her), which removes the most common break.

**Cost.** About 2 to 3 days, one file of about 600 lines, plus a test that fills every box with good and bad values. Start smaller: notice plus closed days is one day and covers the most frequent edit.
**Risk.** Low for visitors (nothing they load changes). The risk is a second place that knows the setting names; the shared rules file removes it.

## Part 2: a facts table, so a price is typed once

**What changes.** A file facts.json holds each fact once: the per-person fee, the $31 package, the opening hours, the phone number, the emails. The pages and the translations carry a placeholder such as `{price_person}`, and `tools/pages.py` fills it in. The owner changes one value and runs the usual rebuild. Translations do not change when a price does, because they hold the placeholder too.

**Cost.** About 3 days. Every sentence that holds a fact is edited once, in English and in the four languages. The sentence ids (a code made from the English words) change, so the translations are re-keyed by a script. A check proves the built pages are word for word what they are today before anything else changes.
**Risk.** Medium, and only while it is done: it touches about 100 sentences in five languages. After that it lowers risk, because the facts check can no longer find two answers for one fact.

## What the owner decides

1. Build Part 1, and for which settings first (suggested: notice and closed days, then hours).
2. Is a Chrome or Edge only "Save" acceptable, with a download for other browsers?
3. Build Part 2, and which facts (suggested: prices and hours, the ones that change)?
4. Who tries each part before it is used (suggested: one person, with the Site check open).

Suggested order: Part 1 small, use it for a season, then decide on Part 2.
