# The GiveSpin voice

The joke, in one line: **a gambling website, but it is for charity.** A casino costume on something honest. The costume
is loud, the facts under it are plain. This page is the style guide for every word a visitor reads (lobby, receipts,
toasts, empty states, Help, the tour, the footer, and any new feature). Tests in `tests/sections/22-voice.mjs` check
the vocabulary below, so if you change a phrase on purpose, change the test with it.

## The 10 rules

1. **One joke, told straight.** The house is a charity, so the charity always wins. Say it deadpan, once per screen at most.
2. **Short.** A punchline, not a paragraph. If a line needs explaining, cut the joke and keep the fact.
3. **The costume is casino, the meaning is honest.** Casino words are parody. What they stand for must stay true.
4. **Clarity beats cleverness.** Anything that carries a fact (money, limits, errors, privacy, undo) says the plain thing first. The joke comes second, or not at all.
5. **Never real money.** It is demo credit and play-money. Nothing pays the player, there is no prize, no payout, no "winnings". The *charity* wins, never the visitor.
6. **Bots are bots.** Every other player is a clearly labelled bot or "simulated". Never write "real players".
7. **Never mean.** No jokes at the expense of players, charities or the people charities help. A charity is never the punchline.
8. **Warm, not shouty.** One exclamation mark at most. No ALL CAPS, except the existing TRIPLE THREAT banner and the DEMO stamp.
9. **No superlatives, no claims we cannot check.** No "best", "top", "most trusted". "House edge: 0%" is fine because it is true of the code: no player's money is skimmed, and in demo mode none moves at all.
10. **Plain words, "you".** Say "give", "gift", "charity". Match the page's spelling (it already mixes British and American). No jargon, no crypto words.

## Vocabulary

| Instead of | Say | Notes |
| --- | --- | --- |
| cash out / cashed out | **Give out** | Money only goes one way here: out, as gifts. Never promise a payout. The words "cash out" must not appear anywhere. |
| jackpot, progressive jackpot | **Triple Threat** | Three or more of the same charity on a machine. At live tables the rolling extra pot is the **Triple Threat pot**. Code may keep the name `jackpot`. |
| the operator, the site's cut | **The house** | The house is a charity. **House edge: 0%.** The house is a charity. |
| Give responsibly / monthly limit | **Responsible giving** | The corner where you set a monthly limit. Kind and clear: giving should feel good. |
| Giving Club page, ranks | **VIP lounge** | The Giving Club is the VIP lounge; levels and ranks are lounge membership. Nav and headings still say "Giving Club". Do not invent perks that do not exist. |
| Loading... | **Shuffling the charities...** / **Polishing the confetti...** | Keep the dots as three plain dots or an ellipsis. |
| empty page | a one-line joke plus the next step | "No gifts yet. The house is waiting." Always tell them what to do. |
| error | **Something went wrong. Nothing was charged.** | Keep the honest meaning every time. |
| profit, fees, how it is funded | **How we make money: we do not.** | Help answer `#help-money`, linked from the footer and the tour. |

Casino words that are fine as parody: house edge, VIP lounge, Triple Threat, high roller, croupier, table, deal, shuffle,
"the house always wins". Use "bet" only where live tables already say it.

## 15 example lines

- Lobby: **House edge: 0%. The house is a charity.**
- Welcome: **The house always wins. The house is a charity, so the charity always wins.**
- Receipt: **The house wins: the house is a charity.**
- Receipt, demo: **Simulated round: no money moved and nothing was charged.**
- Loading: **Shuffling the charities...**
- Loading: **Polishing the confetti...**
- No gifts yet: **No gifts yet. The house is waiting, and the house is a charity.**
- No cards yet: **No cards yet. Play any game and the house deals you the charity that wins.**
- No crew yet: **No crew yet. Every table needs a few friends.**
- Search found nothing: **Nothing matches “qqq”. Not even the house has that.**
- Error: **Something went wrong. Nothing was charged.**
- Responsible giving: **Set a monthly limit any time. Giving should feel good, and a limit helps it stay that way.**
- VIP lounge: **Welcome to the VIP lounge. The only way in is giving.**
- Triple Threat: **TRIPLE THREAT! Three of a kind, all for charity.**
- How we make money: **We do not. It is play money, no real money moves, and the house is a charity.**

## Shared lines and links (for code)

- `GS.ui.voice.houseStrip()` returns the "House edge: 0%. The house is a charity." strip (HTML). It is on the lobby, Fair Play and Help; put it on a new page only if the page is about trust.
- `GS.ui.voice.loading()` returns the next loading line ("Shuffling the charities…", "Polishing the confetti…", "Warming up the tables…").
- Links: `#help-money` (How we make money: we do not), `#help-limit` (Responsible giving), `#help-tour` (What is GiveSpin?).
- Do not repeat the house joke on the same screen: one per page is plenty. A new empty state needs its next step (a link or a button), not only a joke.

## Banned words and ideas (the owner's rules, enforced by tests)

- No crypto wording: `crypto` (except "cryptographic"), `bitcoin`, `ethereum`, `blockchain`, `wallet`, `NFT`/`NFTs`, `token`/`tokens`. No "coins" jokes (the game Coin Flip is fine).
- No "cash out" / "cashed out" / "cashing out". Say "give out" or leave it out.
- Nothing that says or implies real money moved or can be won in demo mode: no "winnings", "payout", "prize", "you won $".
- No superlatives about charities ("best", "greatest", "most trusted") and no claims that cannot be checked.
- Never "real players" for the bots. Never the standalone word "jackpot" for the visitor-facing name (use Triple Threat).
