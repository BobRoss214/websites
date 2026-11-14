# PUSH_PLAN: the real website (11 Nov 2026). NOTHING IS PUSHED. The builder says when.

## 1. What the real website is
- Default branch `claude/wise-acres-redesign-w9m4bi` in /home/user/websites. Tip `02ffa32` (3 Nov); GitHub says the same.
- `integ` (1eb9015) is 337 commits ahead. One push puts ALL their website changes live, not only winter and the Store (files mix: it cannot be split by topic).
- docs/LAUNCH_CHECKLIST.md says the host is Cloudflare Pages with drag-and-drop of the folder from `python3 tools/make_deploy_folder.py`. If that is still true,
  a push changes nothing for visitors until that folder is uploaded. Ask the builder which way it goes live.

## 2. What goes live (26 website files change; the host gets the same 113 files as now: no new file, none gone)
- 6 pages (index, first-visit, pumpkin-patch, school-field-trips, strawberry-picking, wise-pie), css/{extras,features,hero,sections,styles}.css,
  js/{content,features,footer-art,hero,i18n,live,main,season}.js, lang/{es,hi,vi,zh}.js, and the 3 hidden demo pages made again (new header and footer).
- In plain words: the 7-drop-down top menu; the Store in two columns, tighter boxes, new group Beer, cider & wine (16 drinks at $6); more kids in the spring
  picture, friend button, snippable sunflowers, calmer leaves, bee and butterfly fixes; wagon ride free for ages 3 and younger; "small" out of the maze name;
  tomatoes end 8 Nov; a "Next" tag; the winter rule (trees only the last weekend of November and the first of December, 2026: 28-29 Nov and 5-6 Dec),
  winter words in five languages, GreenHouse pizza 11-8 with "Not official yet"; bigger winter trees; link and button names that say what you see.
- Repo only, not on the host: lang/en.json, lang/src, pages/, tools/ (13), tests/ (40 changed, 2 new), docs/ (14), work-notes/ (28), patches/ (5), README.md.

## 3. What must NOT go: 9 files (A also leaves out 2 newer demo files, section 4), and the lines that load them
- Tour: js/tour.js, js/tour-steps.js, -b, -c, css/tour.css. Store pretend lists: js/shop-sample.js. Dormant pop-up: js/shop-pop.js, js/shop-pop-box.js, css/shop-pop.css.
- Lines: index.html (integ lines 3931-3934 when the CSP review was made) loads demo-header, tour, shop-pop, shop-sample; each other page (generated from index.html's footer by tools/pages.py)
  loads demo-header + tour. The branch keeps only `<script src="js/demo-header.js">`, exactly like the tip. The script takes the lines out of index.html and the pipeline remakes the pages.
- Why: with js/tour.js on a public page, any visitor who adds `?tour` or `#tour` gets the tour and the site writes `wa-tour` into the browser. That breaks
  docs/WHAT_THE_SITE_STORES.md (it lists only wa.lang, wa.offer, wa.checklist). The pretend lists must not be public until the farm gives real ones.
- Leave them out of the BRANCH, not only out of the pages. tools/make_deploy_folder.py (lines 72 and 252) uploads EVERY file of js/ and css/ and every top-level .html,
  so a preview file left in the branch would be uploaded. Recommended: out of the branch (the script does it; the deploy tool then lists none of them).
  Not recommended: adding them to LEFT_OUT_* in make_deploy_folder.py (the host may serve the repo itself, and one more tool edit to keep).
- Dormant pop-up (js/shop-pop*.js, css/shop-pop.css): RECOMMENDED out too. Without the lists it does nothing, and the loader is one more file and about 1.1 KB on a
  page that is already over budget (section 5). Put it back with the real lists (it stays in integ). The hover rules in css/extras.css match nothing without it (441 bytes).
- One static test line is added to the real branch only (tests/code-rules.test.mjs): no page names js/tour*, css/tour*, js/shop-sample, js/shop-pop*, and none of
  those files is in js/ or css/. It was tried on a bad sample first. integ does not get it (it loads them on purpose).
- Tests of these features (tour*, shop-pop, account-event, kitchen-*, demo-alerts, demo-desk-*, demo-kitchen, demo-live), their README rows and docs/TOUR.md stay in
  integ only: the runner test fails on a test whose `covers:` file is missing, and the docs test fails on a note that names a missing file.

## 4. The demo that is ALREADY on the real tip (hidden unless `?demo`): A or B
- A (default, `DEMO=tip`): the tip's 28 demo files stay byte for byte (js/demo-*.js, css/demo*.css, 3 page sources, docs/ACCOUNT_DEMO.md, 2 tests); only the 3 built
  pages are made again. integ's newer demo (js/demo-live.js, css/demo-visits.css, new desk and kitchen) stays out. Cost: 2 red tests. demo-data: the old demo says the
  wagon is free for ages 2 and younger, the site says 3. browser-support: the old js/demo-store.js:329 uses `notify`.
- B (`DEMO=integ`): integ's newer demo: 40 files differ from A, all demo files. Host: 114 files, 6,708 KB instead of 6,278 KB (+css/demo-visits.css, +js/demo-live.js,
  -js/demo-view-year.js). All 22 quick tests pass; account-event is left out (it reads the tour file).
- Either way the demo writes `wa-demo-v1` and `wa-demo-user` in the browser once `?demo` is used. tests/privacy.test.mjs allows it by name; WHAT_THE_SITE_STORES.md does
  not list it. Taking the whole demo out is a third choice (not built; it needs two more test guards). The builder decides.

## 5. Speed budget (tests/slow-phone.test.mjs). The decision is the builder's; I changed no limit.
- Measured on the real set (6c5f790), demo A and demo B give the same: index.html 22 files / 429 KB (limits 24 files / 420 KB: OVER by 9 KB); pumpkin-patch 20 files /
  310 KB (limit 300: OVER by 10 KB); first-visit 22 / 333 KB (limit 400: ok); index in Hindi 425 KB (limit 440: ok); 39,724 nodes (limit 46,000: ok). The tip today: 404 / 293 KB.
- A or B does not matter for speed: js/demo-header.js (7,910 or 7,920 bytes) is the only demo file normal pages load, about 3 KB on the wire. With no demo at all it was
  426 / 307 KB: still over. Keeping the dormant pop-up loader would add one file and about 1.1 KB. Growth since the tip (realset, earlier commit): index.html +5.7 KB,
  js/main.js +5.5, css/extras.css +4.1, js/hero.js +2.9, js/season.js +2.1.
- Choices for the builder: (1) raise the two limits (to about 430 and 310 KB); (2) trim about 10 KB (the budget-options helper has numbers); (3) both.

## 6. Tests (in scratch clones of the real repo; a red one is run again on integ itself)
- At integ 1eb9015, quick tests with no browser: demo B 22 of 22 pass (907 checks). Demo A 18 of 20 pass; red: demo-data and browser-support (both pass on integ itself; section 4).
  docs, runner, seo and code-rules (with the new static check, 29 checks) pass in both.
- Browser, on A, one run each: deploy 38 checks pass, privacy 39 pass (the upload folder has none of the removed files; no new storage key). slow-phone: 20 pass, 2 fail (section 5).
- The hidden demo, looked at in a browser at 6c5f790 (its files have not changed): with `?demo` the person button shows, the sign-up makes the sample visit, desk and kitchen open,
  no page error, in A and B (picture: /tmp/helpers/push-plan/shots/out-A-account.png). option-patches (not in the quick set) was red on integ itself at 6c5f790; not re-run since.
- If the tour tests stay in the branch the runner test fails (their `covers:` files are missing) and they crash: that is why they are out (section 3).

## 7. Build it (safe to run twice; touches only <out-dir> and <out-dir>.info; never /home/user/websites; never pushes)
    sh /tmp/helpers/make_real_branch.sh <integ-ref> <out-dir>     e.g.  sh /tmp/helpers/make_real_branch.sh HEAD /tmp/helpers/push-plan/real-final-A   (ready-made: real-final-A and real-final-B, built at 1eb9015, tree-identical to the tested ones)
    flags: DEMO=integ (B)  KEEP_SHOP_LOADER=1  ONE_COMMIT=1  RUN_TESTS=0|all  PREVIEW_TESTS=keep.  A second run into the same folder rebuilds it; a foreign folder is refused.
  It clones the real tip, makes branch `real-update` (4 commits: everything to 9 Nov / Store / Winter / last fixes), takes the files out, runs pages.py, i18n.py extract,
  jsstrings, build (the 4th step is what tools/doctor.py runs; without it lang/js-strings.json keeps the pop-up's texts), checks `git status` is clean after a second run and
  the two trailers, builds the upload folder, checks none of the removed files is in it, prints the diffstat, the files with sizes and the quick tests. It works on any integ HEAD (milestones are found by subject, a missing one is skipped). Read the line "new on the host against the tip": for A it must be empty.
  Exit 0 fine; 3 real tip not in integ's history; 4 a preview file is left; 5 pipeline or deploy folder; 6 a page loads a removed file; 7 trailers; 8 demo; 9 a test fails only here.

## 8. Publish (described, NOT run). Only when the builder says "push".
    cd <out-dir>; git status --short                                  # prints nothing
    git ls-remote https://github.com/BobRoss214/websites refs/heads/claude/wise-acres-redesign-w9m4bi     # must say 02ffa325f09a0f8547ff10d5973e4b173820cbc9
    git push https://github.com/BobRoss214/websites real-update:claude/wise-acres-redesign-w9m4bi          # fast-forward, NO --force
  Safer first: push to the branch name `real-update`, look at GitHub's compare page, then the line above. The clone's own `git push` is off on purpose. Push credentials were not tested here.
  If the tip moved: do not force; read `git log 02ffa32..<new tip>`, bring those changes into integ, run the script again.

## 9. After, and undo
- main: `git -C /home/user/websites pull --ff-only`; upload `python3 tools/make_deploy_folder.py` (if drag-and-drop); `python3 tools/launch_check.py https://www.wiseacresorganic.com/`.
- So the next run sees the real tip in integ's history: `git -C /tmp/integ-clone fetch <out-dir> real-update && git -C /tmp/integ-clone merge -s ours --no-ff FETCH_HEAD`.
- Undo, no force: in the clone `git switch -c undo real-update; git read-tree -u --reset 02ffa32; git commit -m "Put the website back as at 02ffa32"`, push `undo` the same way.

## 10. Open decisions (the builder's): speed budget (raise or trim) / demo A, B or none / leave the dormant pop-up out (recommended) / push all 337 commits together.
