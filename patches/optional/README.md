# Optional patches

Each `.patch` file here is an open decision of the farm, ready to apply. Nothing in this folder is applied. Read the header at the top of a file (what it does, which question it answers, what it conflicts with, which host, what to run after), apply with `git apply patches/optional/<file>.patch`, then run the rebuild commands from its `After:` line.

`docs/OPTION_PATCHES.md` is the table (apply order, hosts, rebuild commands, what the combinations were tested with). `python3 tools/option_matrix.py` tries the combinations on throw-away copies. `node tests/run-all.mjs option-patches` checks that every file here still applies.
