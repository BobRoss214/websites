# Turning the owner's answers into file changes

This page is for whoever keeps the site: Claude or a helper. It is not for the farm owner.

The farm owner answers questions on the dashboard (one answer for each question, d01 and so on). Someone then has to turn each answer into the exact file changes, test them and publish. `tools/apply_answers.py` does the turning and the testing. It follows the steps in `docs/DECISION_PLAYBOOK.md` (the same steps that `tools/rehearse_answers.py` tries, see `docs/ANSWER_REHEARSAL.md`). You still read the report and you still publish.

It decides nothing. It only does what the playbook says for the answer the owner chose. With no answers it does nothing at all.

## The short way

1. Get the answers out of the dashboard as one JSON file (the whole database, the `decisions` documents, or a folder with one file for each decision). A short file also works: `{"d16": "Any two pizzas", "d49": "B"}`.
2. See what each answer would do. Nothing is copied and nothing is changed:

   ```
   python3 tools/apply_answers.py answers.json --plan
   ```

3. Try it for real. The tool copies the site to a temporary folder, makes the changes there, rebuilds the pages and the translations, runs every check, and writes the report and a patch:

   ```
   python3 tools/apply_answers.py answers.json --out answers-today
   ```

4. Read the report, APPLY_REPORT.md in that folder. If it is all green, put the patch into the site folder:

   ```
   git apply answers-today/answers.patch
   ```

   or let the tool do it, with the same checks first: `python3 tools/apply_answers.py answers.json --in-place --yes`. It refuses when the site folder has changes that are not saved, when an answer failed, or when a check is red. It never commits and never uploads.

5. Write the real translations for the new sentences (the report lists them), fix the notes the report names, run `node tests/run-all.mjs` as usual, and publish.

The tool never changes the site folder unless you say `--in-place --yes`. Everything else happens in a temporary copy that is removed at the end (`--keep DIR` keeps it).

## What it does with each answer

For each answered decision the tool finds the playbook option the owner chose. The dashboard saves the words of the option, not its letter. So the tool compares the words:

- the same words, or the same words without a bracket, count at once;
- a close wording (80 percent alike and clearly closer than any other option) counts too, and the report says so;
- the page words that the playbook words differently are listed in `tools/apply_answers_rules.json` under `aliases` (today: d04 and d67);
- when the export carries the page's own list of options, the place in that list can decide, but only when both lists are equally long and nothing in the other options says the order is different;
- a letter works too (`B`, `Option B`, `d16=B`);
- when none of this is sure, the tool says so in plain words, shows the closest option and applies nothing. Give the letter (for example `d16=B`) and run again.

Then it puts the answer in one of these groups:

| Group | What it means | What the tool does |
|---|---|---|
| Applied | The playbook has file steps for the answer and nothing is missing. | Applies them to the copy. |
| Nothing to change | The answer leaves the site as it is. | Lists it as decided. |
| The owner still has to send something | The answer says "I will send ..." (hours, a price, a link, her own words), or the steps need a value only she knows. | Prints exactly what is missing. Applies nothing. |
| She has not decided yet | "Not sure", "I will ask my adviser", "I will decide in December". | Applies nothing. Ask again later. |
| Needs a person who knows the code | The playbook says only a helper can make this change, or the patch it names is not on disk. | Says so. Applies nothing. |
| Held back | She wrote a note with the option, or the choice of patch needs another answer first (d30 needs d05, the host). | Says why. Applies nothing. A note is never put on the site by this tool. After you have read it, `--ok-note d16` applies the answer as chosen. |
| Refused | Two answers contradict each other, or the steps of two answers cannot both be done. | Says which two and why. Applies neither. |
| No steps written yet | The playbook has no entry for the question, or no recipe for the option. | Prints her answer so it is not lost. A helper writes the recipe first. |
| Failed | A step did not find its place (usually because an earlier answer changed it). | Rolls that answer back completely, names the step, goes on with the others. |

### Values only the owner knows

Some recipes in `tools/rehearse_answers.json` type a made-up value, because the rehearsal had to type something (a price of $800, a review link, an oven at 800 degrees). The tool never types a made-up value. `tools/apply_answers_rules.json` lists each one under `inputs`, with the question to ask her. Until the value is given, the answer is "the owner still has to send ...". Give the values like this (a file, or in the answer itself):

```
{"d02": {"price_1": "$900", "price_2": "$1,600"}, "d16": {"price": "$36"}}
python3 tools/apply_answers.py answers.json --values values.json
```

Each value is checked before it goes into a file: a price looks like `$45` or `$4.50`, a link starts with `https://`, a date is year-month-day. A value with a quote mark, a `<` or `>`, a backslash or a hidden character is refused (the owner's words are not trusted: type those by hand). A `&` is written the HTML way in a page. The oven's Celsius number is worked out from the Fahrenheit one.

Some recipes are only a model: the steps show which files change, but the words must be hers (d37 and d71 need the native reader's sheet, d43, d44 C, d45 B, d50 B, d51 B, d54 A, d55, d56 B, d57 A and C, d63 A, d03 B, d21 B). They are listed under `manual` in the rules file, and the tool prints what the owner still has to send.

### Answers that are really a fact change

A price, a phone number, an email or hours is a fact change, and the site has a separate tool for those: change_fact.py in the tools folder. When the site has it and the rules file names the answer under `fact_change`, the runner hands the change to that tool (`change_fact.py KIND OLD NEW --yes`, with the owner's checked value) instead of following the recipe's own steps. The tool lists the same places, copies the old translations and swaps the old price or address in them, so the new sentences need no stand-in translation. The runner never has a second copy of that logic: one small function, `apply_fact_change` in `tools/apply_answers.py`, calls it. When the site has no change_fact.py, the recipe's steps run as before.

Today four answers are switched over: d16 C and d47 B and d48 D (prices) and d52 B (the email). Each was tried end to end on a copy: the same pages and scripts change as with the recipe, the checks are green except the notes test, and no sentence is left as a stand-in. d52 B no longer changes README (the tool leaves README and docs alone), so the README lines that name the old address are a follow-up for whoever keeps the notes. To switch another answer over, check what its command lists first (the tool lists the places when you leave out `--yes`; `--only WORDS` tells two meanings of one price apart, as d48 D does with "per pound"), then add it to `fact_change`.

### The order, and answers that do not go together

The tool applies optional patches first (in the order of their headers), then the recipes. Inside a group it goes by urgency (1 blocks launch, 2 wrong or risky, 3 nice to have) and then by the number. The table "Which answers change other answers" of the playbook is turned into `after` rules in the rules file: for example d16 before d17, d19, d20, d21 and d45, d05 before d30. A circle in these rules is an error.

It refuses a pair in these cases, with the reason in plain words:

- the rules file says so (`refuse`): d38 B with d30 A (redirects to the old address make no sense on a new one), d61 B with d13 C or d31 B (a credit for a photo that is removed), d10 D with d62 B;
- the headers of two optional patches say they conflict (winter-A with winter-B: d01 B with d24 B);
- the rules file says the steps of one do not expect the change of the other (`unsupported`): d07 A with d48 B, d19 A with d54 B, d26 B with d54 B (the last one was found by a random bundle: d54 B deletes the price-list line that d26 B rewords);
- two recipes look for the same words in the same file.

When the steps of one answer are already part of a bigger one (d32 C removes the four photos that d13 B removes), the smaller one is reported as "already included" and is not done twice.

### Optional patches

Answers that choose an optional patch (`patches/optional/`, see `docs/OPTION_PATCHES.md`) are listed under `patches` in the rules file. The tool checks each one with `git apply --check` first and says plainly if it no longer applies (it never forces one). The host decides between `redirects-A` (Cloudflare Pages, Netlify) and `redirects-B` (another host): the tool reads d05, or you say `--host cloudflare|netlify|other`. Three more answers choose a patch: d65 C (`qr-one-address-line`), d65 D (both QR patches) and d68 A (`games-B-pick-snips-sunflowers`). The phone patch (`phone-number-shown`) is not used for d04 A: the playbook's own steps for d04 A do the same and more.

## The checks

After the answers are applied to the copy the tool runs the standard steps of the playbook (`python3 tools/pages.py`, `python3 tools/i18n.py extract` and `jsstrings`, stand-in translations, `build`, `missing` must say 0 for es, hi, zh and vi) and then every check without a browser: docs, validity, consistency, files-audit, plain-lint (strict), launch-check and public-site. Anything a recipe names (a command, a test) is added. When the answers put the Cloudflare patch in (`clean-addresses-C`: the pages are named without .html), the plain launch-check test cannot work, because its server has no Cloudflare address rules. The runner then asks the option matrix's own host check instead (`tools/option_matrix.py`: it makes the upload folder, starts a pretend copy of the host and runs `tools/launch_check.py` against it; with a redirects patch it also checks the old addresses are forwarded). The host comes from the answer to d05 (A Cloudflare Pages, B Netlify, C another host) or from `--host`. `--gate quick` uses the playbook's own shorter rule (validity only when a page or style file changed, launch-check only when an answer says so). `--skip launch-check,validity` leaves checks out. `--browser` also runs the browser tests the answers name, one at a time, from port 48195.

If a check goes red the tool looks for the answer that made it red: it tries the first half of the answers, then half again, and the report says "the first red check turned red when d16=C was added".

The notes test (docs) is different. After many answers it is red on purpose: the notes name a sentence id or a README row that the answer changed. That is a follow-up for whoever keeps the notes (the report lists the notes to fix) and the exit code is 4. `--in-place` needs `--allow-follow-ups` for it.

### New sentences and stand-in translations

An answer that changes a sentence makes a new sentence to translate in four languages. The tool puts the English words in as a stand-in so the build passes, and lists every such sentence in the report. Until a native reader or the helper writes the real translation, es, hi, zh and vi show English for that sentence. Some recipes bring a translation of their own (the oven, the address); those still need a native read.

## The report and the patch

The report (APPLY_REPORT.md) says, in plain words: what was applied (with the files changed and the note of the recipe), what failed, what was refused and why, what the owner still has to send, what needs a person, what needs no change, the test results, the sentences to translate, and the notes to fix. `answers.patch` is made with `git diff --binary`, so it holds the rebuilt pages and the translation files too. Use `git apply` (the plain `patch -p1` program cannot remove picture files). If the site changed since the copy was made and the patch no longer applies, do not merge `lang/*.js` or the generated pages by hand: run the tool again on the new site folder.

Exit codes: 0 all good or nothing to do; 1 an answer failed or a check is red; 2 a problem with the input or with `--in-place`; 3 some answers were refused (the rest was applied); 4 only the notes test is red.

## When the playbook grows

The tool reads `tools/rehearse_answers.json`, `docs/DECISION_PLAYBOOK.md` and `tools/apply_answers_rules.json` of the site folder it runs on, so a new recipe works without a change to the tool. One thing is asked for each new recipe: someone must say whether it types a value that only the owner knows. A recipe that is in none of `inputs`, `manual` and `ready` in the rules file is not applied; the tool says a helper has to look at it. A recipe can say it itself: `"checked": true` (nothing from the owner is needed), `"owner_values": [...]` (the same lists as `inputs`) or `"model": "what the owner still has to send"`. `tools/test_apply_answers.py` fails when a recipe is in none of the lists, and when a made-up value named in the rules is no longer in its recipe.

## How it was tried

`python3 tools/simulate_answers.py` pretends the owner answered, writing the answers the way the dashboard does:

```
python3 tools/simulate_answers.py plan-all --out sim-results --decisions DIR        every option of every decision
python3 tools/simulate_answers.py singles --out sim-results --jobs 3 --gate quick   every answer that has steps, one by one, compared with tools/rehearse_answers.py
python3 tools/simulate_answers.py bundle --out sim-results --size 20 --seed 3        a random bundle, all at once, with every check
python3 tools/simulate_answers.py contradict --out sim-results                       answers that contradict each other
python3 tools/simulate_answers.py willsend --out sim-results                         every "I will send ..." answer
```

`--decisions DIR` is a folder with one file (d01.json and so on) for each decision as the dashboard keeps them (without it the playbook's words are used). Run these again after you change a recipe or the rules.

## What it cannot do

- It does not read free text. A typed answer that is not one of the options is "not clear" and a person reads it.
- It does not write translations, prose in the notes, or the words only the owner has.
- It cannot judge whether an answer is a good idea. A note from the owner holds an answer back until a person has read it.
- The recipes are the playbook's steps as rehearsed on one version of the site. When the site moves on, a step may no longer find its place: the tool says which step of which answer, and `python3 tools/rehearse_answers.py --steps-only --all` shows the same for all answers at once.
