# Making GiveSpin real: the owner's checklist

This is the plain-words version of what would have to happen before GiveSpin handled a single real dollar. The visitor-facing short version is the
**Make it real** page (`#make-it-real`, linked from the footer and from Help).

**Where things stand today: all of it is pretend.** The credit is play money, every receipt is stamped DEMO, no payment is taken, no gift is made, and the
other players at live tables are bots. Nothing in this project can take money, and nothing in this document changes that: it is a list of
things to decide and do, mostly outside the code. **Of the seven steps below, none has been started.**

Nothing here is legal or tax advice. It is a list of questions to take to the people who can answer them.

## The short version

1. The code already has one switch (`mode` in `js/config.js`) that can send a visitor to a charity's own checkout page instead of pretending.
   That is the whole "technical" part, and it is small.
2. The hard part is everything around it: a payment provider that will work with a site like this, agreements with charities, legal and tax advice, a privacy policy and a plan for when something goes wrong.
3. Live tables with real people are a bigger, separate project: they need a server (see `docs/live-protocol.md`). Do the single-player giving first, if ever.

## Rough order

Do them roughly in this order. Steps 1 and 2 decide whether the rest is possible, so do not spend money on the later ones until they are answered.

| # | Step | Who to talk to | Started? |
| --- | --- | --- | --- |
| 1 | Legal and tax review (including the casino styling, below) | A lawyer who knows charity fundraising law where your visitors live; an accountant | Not started |
| 2 | A payment provider | The provider's sales or onboarding team; ask them the casino-styling question first | Not started |
| 3 | Written agreements with charities (or a platform that already pays charities out) | Each charity's fundraising or partnerships team, or a donation platform | Not started |
| 4 | Receipts from the provider | The provider (and the charities, for tax receipts) | Not started |
| 5 | A privacy policy | A lawyer; the provider, for what they keep | Not started |
| 6 | Fraud and refund handling | The provider; whoever answers your support email | Not started |
| 7 | A server for real tables (only if you want real multiplayer) | A developer; this one is optional | Not started |

## The steps

### 1. Legal and tax review

**What it is.** Collecting money for charities, or passing it on, can need registration, a licence or special wording, and the rules differ by country and
by state or region. Whether the site counts as a fundraiser, a seller or something else is a question for a lawyer, not a developer.

**Ask them:**

* Do we have to register or follow fundraising rules where our visitors live, and where the charities are?
* Is a casino-styled site that gives to charity acceptable, or does the styling (tables, "jackpot"-style names, slot machines) cause a problem with gambling or prize-draw rules even though nobody wins anything?
* Do we need an age limit, since the theme looks like gambling?
* What must the site say about how much of a gift reaches a charity, and who is the "seller" for tax purposes?
* What wording is forbidden or required (for example, we say "Triple Threat", "House edge: 0%", "the house is a charity")? Are any of those lines misleading once real money is involved?

**In this demo:** nothing to review, because no money moves. The README has a "Please read before launching" list, and the wording rules in `docs/voice.md` already ban anything that suggests a visitor can win money.

**Not done:** all of it.

### 2. A payment provider

**What it is.** A regulated company that takes the card, handles the money and is legally responsible for it. GiveSpin is built so that it **never sees a card
number and never holds funds**: in `redirect` mode the visitor is sent to the provider's own checkout page.

**Ask them (before anything else):**

* Will you onboard a site with a casino-style look that gives to charity? Some providers have rules about gambling-style businesses; get the answer in writing.
* Can you pay out to many registered charities, or do we need an agreement with each one? What do you charge, and is it taken from the gift or added on top? Who shows the visitor the fee?
* Can you produce a link per charity and per amount (a "checkout link"), and do you have a test mode?
* What do you need to know about us (a business entity, a bank account, identity checks)?

**In this demo:** the hand-off is written and tested. In `js/config.js`, `checkout.url(charity, cents, opts)` is where a provider's link format goes. `js/payments.js` accepts only `https://` links and drops anything else.

**Not done:** no provider is chosen or connected. There are no keys and no provider code in the project, on purpose.

### 3. Written agreements with each charity

**What it is.** The site lists 500 charities. Their names are used only to identify them, and the footer says GiveSpin is not affiliated with or endorsed by any of them.
For real giving each charity (or a donation platform that already represents it) has to agree to be listed and to receive gifts this way, and to the use of its name and logo.

**Ask them:**

* Do you agree to be listed, and under what name and logo? Who is the contact if something is wrong?
* How do gifts reach you, how fast, and what receipt do donors get?
* What are your rules for a site like this (some charities have brand rules or will not take part in anything that looks like gambling)?

**In this demo:** the charities appear with a plain description and a "not affiliated" note. `docs/roster-sources.json` and `docs/logo-sources.md` record where each description and logo came from.

**Not done:** no charity has been asked or has agreed to anything. Expect some to say no; the list can be shortened to those that say yes. Check each logo: it is the charity's trademark.

### 4. Receipts from the provider

**What it is.** The receipt that matters (for the donor's tax, if it applies) comes from the provider or the charity, not from GiveSpin.

**In this demo:** every receipt is stamped DEMO, says it is simulated and is not a tax document. In `redirect` mode the site records a round as "sent to checkout", because it cannot know whether the visitor finished.

**Not done:** no real receipt exists. If you want the site to show "your gift went through", the provider has to tell it (for example with a confirmation link or message), which is a separate piece of work.

### 5. A privacy policy

**What it is.** A real policy, read by a lawyer, covering what is kept, where, for how long, and what the provider keeps.

**In this demo:** Help has a plain answer to "What do you store about me?": nothing leaves your browser, no trackers, no ads. The waitlist note and reminder switch (Live tables page) also stay on the device. That is a plain note, not a legal policy.

**Not done:** the legal policy. Note that the picture changes the moment the site talks to a provider or keeps accounts on a server: the "nothing leaves your browser" sentence would no longer be true, and the pages must be updated before launch.

### 6. Fraud and refund handling

**What it is.** A written plan for stolen cards, chargebacks, mistaken gifts, and a person who answers when something goes wrong, with an email address on the site.

**In this demo:** a pretend stake is handed back if you cancel or close a table. Nothing is charged, so nothing can be refunded.

**Not done:** all of it. Ask the provider what they handle and what is left to you.

### 7. A server for real tables (optional)

**What it is.** Live tables today are a simulation in the visitor's browser. Real shared tables need a server that runs the rooms, makes and keeps the secret seeds for the fair draws, checks every player and handles chat.

**In this demo:** the message format a server would use is written down in `docs/live-protocol.md`, and `js/transport.js` is the code for it (with tests). The live screens still read the simulation directly.

**Not done:** there is no server, no real player and no sign-in. Also open: who supplies the client seed at a real table, and how players are identified. Real tables would also have to keep the "other players" honest: only real, signed-in people could be shown as players, and bots would still need their label.

## The switch, step by step

Only do this once steps 1 to 4 are answered.

1. Open `js/config.js`.
2. Set `mode: 'redirect'`.
3. Fill in `checkout.url(charity, cents, opts)` so it returns the provider's `https://` link for that charity and amount (or `null` for a charity with no link). Add whatever the link needs (for example a `slug`) to the charities in `js/data.js`.
4. Open the site and play a round. The receipt should now show a **Donate** button per charity that opens the provider's page in a new tab.
5. Test it with the provider's test mode first, with a very small amount, before any real card.

What changes for visitors in `redirect` mode: the demo credit, the DEMO banner and stamps, the live tables, the bots and the simulated ticker are switched off; the receipt says the gift is finished on another website; the Giving Club counts "sent to checkout". What does **not** change: the accounts and saved-card screens are still a preview that does nothing real (see "Optional account (preview)" in the README), and the fair-play draw still happens on the visitor's own device, so it shows how a draw works, not that an outside party ran it.

## What this project will not do on its own

* It will not take payments, hold money, store a card number or send anything to a server. The test suite checks that the site contacts no other host.
* It will not turn itself real: `mode` is `'demo'` in the shipped file, and a test checks that the settings file still says so.
* It will not call anyone a real player. Every other player is a bot and is labelled BOT, and the copy about real tables says they are not switched on.

## A checklist you can copy

- [ ] Lawyer and accountant consulted; written answers on registration, the casino styling and an age limit
- [ ] Provider chosen, and in writing that the site is acceptable to them
- [ ] Each charity (or a platform for them) has agreed in writing; logos and names cleared; list shortened to those who agreed
- [ ] Provider's test mode working end to end with `mode: 'redirect'`
- [ ] Receipt and "thank you" wording agreed with the provider and charities
- [ ] Privacy policy written and linked; "nothing leaves your browser" copy updated to match what is true then
- [ ] Refund and fraud plan written; a support email on the site
- [ ] Pages re-read for any line that no longer fits ("play money", "pretend", "bots") before the switch is flipped
- [ ] Decided what to do about real tables (leave them off, or start the server project)
