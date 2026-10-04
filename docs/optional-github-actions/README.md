# Checks that run by themselves (optional, switched off)

GitHub can run this site's checks for you, so nobody has to remember to. Two ready-made files are in this folder:

| File | When it runs | What it does |
|---|---|---|
| `checks.yml` | after every push and every pull request | the checks that need no browser, and a fixed set of fast browser tests. A red cross next to a commit means something broke. |
| `weekly-health.yml` | every Monday morning, and when you press "Run workflow" | the site doctor and `python3 tools/upcoming_dates.py`: what changes or runs out in the next 14 days. It turns red, and GitHub emails you, when the doctor is red or when something runs out within 7 days. |

**Nothing runs while the files sit in this folder.** GitHub only reads files in `.github/workflows/`, and that folder does not exist in this project on purpose. Nothing here changes the website or the files of the project, and no password or key is needed.

## Switch it on

1. Open the project folder in a terminal (or ask Claude to do steps 1 to 3).
2. Make the folder GitHub reads and copy the two files into it:
   ```
   mkdir -p .github/workflows
   cp docs/optional-github-actions/checks.yml docs/optional-github-actions/weekly-health.yml .github/workflows/
   ```
3. Commit and push them like any other change (`git add .github && git commit -m "Switch on the automatic checks" && git push`).
   Without a terminal: on github.com press "Add file", "Create new file", type `.github/workflows/checks.yml` as the name, paste the file's text, and press "Commit changes"; then do the same for `weekly-health.yml`.
4. Open the **Actions** tab of the repository on github.com. `Site checks` starts by itself on that push. For `Weekly health`, press it in the left list, then "Run workflow", to see it work at once instead of waiting for Monday.
5. The emails: GitHub emails the person whose account **last changed the `cron:` line** of `weekly-health.yml` (so the owner should be the one who commits it, or edit that line once). In GitHub, "Settings", "Notifications", "Actions" decides how: "Send notifications for failed workflows only" is the right choice.

To switch it off again, delete the two files from `.github/workflows/` and push. The copies in this folder stay.

## What you will see

- **Site checks** (`checks.yml`) has four parts that run side by side: "No browser" (twice: on the oldest Python the tools support, 3.8, and on a recent one), and "Browser tests 1/2" and "2/2". Each part is expected to take about 2 minutes ("No browser") and about 7 minutes ("Browser tests") on GitHub's own computers: an estimate, measured here on a slow, busy computer and scaled. The first real run shows the true times, under the run's name on the Actions tab. A green tick: everything passed. A red cross: click it, click the red part, and open the step called "Run the checks..."; the last lines say which check failed and what it saw. The same text is kept as a download ("test-logs") on the run's page for 14 days.
- **Weekly health** (`weekly-health.yml`): open the run, then "Summary". It shows the doctor's report and the list from `tools/upcoming_dates.py`. The list says, in plain words and with the file to look in, what changes or runs out: a notice or a line that hides itself, the "This week at the farm" box, the last pizza weekend in the schedule, closed days, the start and end of each season. Items under "Needs you" are what made the run red. Most of them need nothing but a look; to keep a line longer, change its date.
- A run that is **red every week** only because lines hide themselves on purpose is noise. In `weekly-health.yml` change `FAIL_ON: 'expires,runs-out'` to `FAIL_ON: 'runs-out'` (red only when the "This week" box or the last pizza weekend runs out), or lower `FAIL_WITHIN`.

You can try the dates list on your own computer at any time: `python3 tools/upcoming_dates.py` (add `--today 2026-11-02` to see it for another day).

## What it costs

- A **public** repository: nothing. GitHub does not charge for the minutes.
- A **private** repository: each run uses minutes from the monthly free allowance of the plan (2,000 minutes a month on the free plan, counted per part and rounded up per part). One push uses the sum of the four parts of `checks.yml`: about 20 to 30 minutes (an estimate: about 2 + 2 + 7 + 7). The weekly check uses about 1 minute. If the allowance matters, remove the `push:` and `pull_request:` lines from `checks.yml` and keep only `workflow_dispatch:` (the "Run workflow" button): the checks then run only when you press it.

## Good to know

- In a **public** repository GitHub stops scheduled runs when nobody has touched the repository for 60 days. A notice appears on the Actions tab; press "Enable workflow" to start it again. A push counts as touching it. (Private repositories are not stopped.)
- GitHub may start the Monday run a few minutes late.
- The slow browser tests (the season hero, the drive-time box, the upload-folder test, the weekly box and the other long ones; the list is at the top of `checks.yml`) are left out to keep the run short. Run `node tests/run-all.mjs` on your own computer before a big change. When `tests/run-all.mjs` has the options `--quick` and `--shard`, two comments in `checks.yml` ("SWITCH TO") show the one-line replacements.
- `weekly-health.yml` uses `tools/doctor.py` when it exists in the project, and otherwise the two checks it is made of (`tools/check_facts.py` and `python3 tools/make_deploy_folder.py --check`).
- These files were checked with a workflow linter (actionlint) and every command in them was run on a fresh copy of the project, but they have **not been run on GitHub itself yet**. The first real run may need a small fix; send the red step's text to Claude.
