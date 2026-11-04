# The live-table protocol (version 1)

Status: **a written-down seam, not a running service.** Every live table in GiveSpin today is a simulation in your own browser
(`js/live.js`): the other players are bots, the pot is pretend and nothing is sent anywhere. This page describes the messages a real table
server and the page would one day exchange, and `js/transport.js` is the code for them (checked by `tests/transport.test.js`).
Nothing here makes real tables exist; it only means that when someone builds a server, the page already knows what to expect.

In plain words: a table is a **room**. People (or bots) **join** it, put a stake on a charity (**bet**), and chat. The table announces its
**state** as the round goes on, **locks** the pot when bets close, and publishes the **result**. That is seven message types, one envelope.

## The envelope

Every message is one JSON object with exactly these keys and no others:

| Key | What it is |
| --- | --- |
| `v` | The protocol version. Always `1` for now. A reader that does not know the version drops the message. |
| `type` | `join`, `leave`, `bet`, `chat`, `state`, `lock` or `result`. |
| `room` | The table, a lower-case name such as `plinko25` (1 to 40 characters, letters, digits and `-`, starting with a letter). These are the same table ids `js/live.js` uses. |
| `seq` | A whole number the **room** counts up for every message it publishes (1, 2, 3 ...). A reader that sees a gap knows it missed something. |
| `ts` | When the room published it, in whole milliseconds since 1970. |
| `from` | Who sent it: `{ kind, id, name }` (below). |
| `body` | The message itself. An object; its keys depend on `type` (below). |

A sender does **not** choose `seq`, `ts` or `from`: the room (or, here, the local transport) fills them in. A message that arrives with
somebody else's `from` is refused.

### `from`

| Key | Rule |
| --- | --- |
| `kind` | `bot`, `player` or `table`. **Every bot must say `bot`** and a screen must show the **BOT** tag for it, as the live tables do today. `table` is the room itself (it sends `state`, `lock` and `result`). |
| `id` | 1 to 40 letters, digits, `-` or `_`. |
| `name` | 1 to 20 characters, no control characters, no `<` or `>`. Whatever is shown must still be escaped by the screen. |

Rule: `state`, `lock` and `result` can only come from `kind: "table"`, and a `table` can send nothing else. A player or a bot can send only
`join`, `leave`, `bet` and `chat`. So nobody at the table can announce a result.

(The brief for this feature named two kinds, `bot` and `player`. A third, `table`, is added for the room's own announcements, because calling
a server a "bot" or a "player" would be untrue.)

## The seven messages

All amounts are whole **dollars** (the live tables work in whole-dollar tickets). `charityId` is a charity id from the roster
(`[a-z0-9-]`, up to 64 characters). `commit` and the other hashes are 64 lower-case hex characters.

| `type` | Sent by | `body` |
| --- | --- | --- |
| `join` | a player or bot, when it connects | `{}` |
| `leave` | a player or bot, when it closes | `{}` |
| `bet` | a player or bot | `{ round, charityId, dollars, action }`, `dollars` from 1 to 1,000, `action` is `"place"` or `"cancel"` (taking a stake back, only while bets are open) |
| `chat` | a player or bot | `{ text }`, 1 to 200 characters, no control characters |
| `state` | the table | `{ round, phase, msLeft, pot, players, bots, seats, commit }`: `phase` is `open`, `locked`, `playing` or `result`; `seats` is a list of `[charityId, dollars]` (at most 64); `commit` is the hash of the round's sealed seed, or `null` if the browser cannot hash; `bots` can never be more than `players` |
| `lock` | the table, when bets close | `{ round, commit, pot, weights }`: `weights` is the frozen pot, a list of `[charityId, tickets]` sorted by charity id, one entry per charity; `pot` must equal the tickets added up |
| `result` | the table | `{ round, winnerId, pot, winShare, players, bots, fair }`: `winShare` is 0 to 1; `fair` is the reveal (next section) or `null` |

`players` counts everyone, bots included, and `bots` says how many of them are bots, so a screen can always say "the other players are bots".

## Fairness: the same commit and reveal as today

The draw is the one in `js/fair.js`, unchanged. Nothing new is invented for the protocol; its fields are the ones a live round already stores:

1. **Open.** The table makes a secret seed and publishes only its SHA-256 hash: `commit` in every `state` message (and in `lock`).
2. **Lock.** Bets close. The pot is frozen into `weights` (one ticket per dollar, in charity-id order) and published in `lock`. After this nobody can change the pot.
3. **Draw.** The table works out the winning ticket: HMAC-SHA256 of the seed with a client seed and the round number, with the same no-bias sampling as every other draw.
4. **Result.** The `result` message carries `fair`, the full reveal:
   `{ roundSeed, serverHash, clientSeed, nonce, poolHash, ticket, weights, winners }`.
   `nonce` is the round number, `poolHash` is the hash of the frozen weights, `ticket` is the winning ticket number, and `winners` names the one winning charity.

Anyone can then check it. `checkFair(lock, result)` in `js/transport.js` confirms the fields agree (same round, the revealed seed belongs to the
published commit, the pot did not change, the winner is the one named). `GS.fair.verifyWeighted(result.fair)` (the Verify button) redoes the
hashing and the draw. A reader should treat a result whose check fails as not verified, however it looks.

**Honest limit, same as today:** with the simulation, the secret is made on the visitor's own device, so this shows how a draw works, not that an
outside party ran it. A real table needs the seed made and kept on a server the players do not control.

## Limits

* The whole encoded message is at most **8,192 bytes** (UTF-8). A reader checks the size **before** parsing the text.
* At most **64** charities on a `state` or `lock`; chat at most **200** characters; names at most **20**.
* Unknown keys, a missing key, a wrong type or a number out of range: the message is dropped, never repaired.
* Plain `decode(text)` and `validateMessage(msg)` in `js/transport.js` say why in one short sentence; they never throw.

What a **server** would also have to do (the local stand-in does not, because nobody is on the other end): rate-limit each sender (for
example one chat line every two seconds and a few bets a minute), check that a stake is allowed for that player, keep chat clean, and drop
a connection that keeps sending bad messages.

## The interface

```js
var t = GS.transport.createLocalTransport({ role: 'player', name: 'You' });   // or any object with these four calls
t.connect('plinko25').then(function (r) { /* r.ok, r.seq, r.you */ });
var off = t.on('state', function (msg) { /* a valid message, a copy you may keep */ });   // 'bet', 'chat', 'lock', 'result' ... or '*'
t.send({ type: 'bet', body: { round: 3, charityId: 'oxfam', dollars: 20, action: 'place' } });   // { ok, msg } or { ok: false, reason, message }
t.close();
```

* `connect(room)` never rejects; it resolves to `{ ok: false, reason, message }` instead. It also announces a `join` (players and bots), and `close()` announces a `leave`.
* You hear your own messages too, so a screen can draw everything from the one stream.
* `send` returns at once with `{ ok }` for "accepted for sending". A real transport may answer later (for example with an error message); the screens must not assume a bet is in until they see it in a `state`.
* The local transport (`createLocalTransport`) is an in-memory publish and subscribe. Its clock can be seeded (`createClock({ seed })`), so tests and demos get the same times every run. Clients that share a `hub` (`createHub()`) are in the same rooms.
* `attachLive(GS.live, GS.bus)` listens to the live engine and publishes what it does as protocol messages in a hub (a stake becomes a `bet`, a round opening or the pot changing becomes a `state`, bets closing a `lock`, the pot going out a `result`). It changes nothing in the engine and is **not switched on** by the site. Checked against the real engine in end-to-end section 29b.

## What is not done

* There is no server, no WebSocket and no real player. Nothing in the page reads a transport yet: the live screens still read the engine directly (`js/ui/live.js`). Swapping them to a transport is the next step after a server exists.
* Who supplies the **client seed** at a real table is an open design question. In the simulation it is the visitor's own lucky number, which is fine for one person. At a shared table it has to be fixed before the lock and be something no single player can pick after seeing the commit (for example mixed from every player's contribution). Decide this before any real table.
* Identity: a real room needs a way to know who a player is (an account, a sign-in), which the page does not have. `from.id` is only a label today.
* Reconnecting and catching up: the local room keeps the last 100 messages, and `seq` lets a reader spot a gap. A real server would need a rule for what to resend.
* Anything about money. The protocol carries dollar amounts as numbers so the screens can show a pot; moving real money would need a payment provider and the steps in `docs/make-it-real.md`.
