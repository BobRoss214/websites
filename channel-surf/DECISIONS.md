# Channel Surf: decisions log

What I decided and why, newest at the bottom of each section. The research behind
these is in [RESEARCH.md](RESEARCH.md).

## How it's built

- **Lives in its own folder, `channel-surf/`.** This repo also holds the farm
  website. Keeping them separate means neither can break the other.
- **Plain web files (HTML, CSS, JavaScript), with no build step and nothing to
  install.** Anything that runs a modern browser can run it, which keeps the
  Fire Stick / smart TV option open.
- **A tiny start-up program, `tv.py`, in Python.** Ubuntu comes with Python, so
  there's nothing to install. It serves the app at `http://localhost:8642` and
  opens the browser full screen. It has to be served like this because YouTube
  rejects players opened straight from a file (error 153). Port 8642 is just an
  unusual number that's unlikely to clash with anything else.
- **Video lists come from the official YouTube Data API**, called directly from
  the browser with your free key. RSS was rejected: it has no video lengths, only
  15 videos, and was down on and off through 2026.
- **The key is restricted to `localhost:8642` and the YouTube Data API only.**
- **Data is stored only on the TV computer:** settings in the browser's local
  storage, video lists in its built-in database (IndexedDB). Nothing is sent
  anywhere except to YouTube itself.
- **A swappable "player" part.** The real one is the YouTube player. There's also a
  fake practice player that pretends to play videos and can be told to fail, stall
  or load slowly. It's used for mockups and automatic tests, and for building
  while this sandbox can't reach YouTube.
- **Every control works with arrows, Enter and Back alone**, with no mouse hover
  needed, so a Fire Stick remote could drive it later.

## YouTube rules we design around

- **Privacy-enhanced player (`youtube-nocookie.com`).** Side effect: YouTube
  Premium won't apply, so ads may show.
- **Nothing is ever drawn on top of the video.** Static, "Please Stand By" and
  bumpers replace the player while no video is playing. The banner and volume bars
  sit in the TV frame, or the picture shrinks a little to make room for them. No
  fake scanlines or curved glass over the video. Those effects go on our own
  screens only.
- **Ads are never blocked, skipped or hidden.**
- **Playback only starts once the player is on screen.** Static is shown, the next
  video loads quietly behind it, then the picture is revealed and starts playing.
- **No scraping and no downloads.** Only official API calls and the official player.

## Schedule ("what's on now")

- **The clock decides what's on.** Each channel has a stored lineup with exact
  start times. Tuning in = find the show airing now and start it at
  (now − start time). Reloading gives the same lineup because it's saved, and if
  the saved copy is ever lost, it's rebuilt the same way from a fixed "seed".
- **Shows run back to back, with a 5 to 8 second channel ident or "Coming Up
  Next" bumper in between.** Each show's slot is rounded up to the next whole
  minute, so the bumper soaks up a few seconds.
- **Ads make shows run late, and that's handled with "grace".** If a show finishes
  late (because of ads) and we're less than 90 seconds into the next one, the
  next show starts from the beginning. If we're later than that, we join it in
  progress, the way TV joined a show late after a ballgame ran over. Flipping
  away and back always snaps to the true clock.
- **The next 3 hours are locked.** A daily refresh only changes the lineup after
  that, so the guide never lies about what's next.
- **Which videos air.** Each YouTube channel brings its ~100 most recent regular
  videos. Newer videos air more often, recently aired ones rest, and in a combined
  channel (for example "Woodworking", made of 4 YouTubers) the creators take turns
  so no one hogs it. Videos uploaded in the last 3 days get a **NEW** tag in the guide.
- **Content filter:** use the channel's regular-videos-only list (`UULF`). Skip
  live or upcoming, not embeddable, age-restricted, private, still processing,
  shorter than 3 minutes, and longer than 3 hours. Both lengths can be changed in setup.
- **Refresh about once a day**, the first time the TV is turned on after 24 hours
  have passed, and in the background while it's on. Costs about 3 quota units per
  channel. Channels that fail to refresh keep their old lineup.

## When things go wrong

- **A video fails** (error codes 2, 100, 101, 150): it's marked as bad, and the
  channel immediately plays the next show at the right point. The bad video never
  gets scheduled again.
- **A video stalls** (no picture for 10 seconds): "Please Stand By" card, one
  retry, then skip.
- **A channel has no usable videos:** it stays in the lineup with a "Please
  Stand By / Off the Air" card and color bars, and the guide says "Off the Air".
  Channel up/down still works.
- **No internet:** a calm "Please Stand By. Checking the cable…" card that retries
  on its own. Nothing to click.

## Viewer vs. setup

- **Watch mode is all the viewer can reach.** Setup is behind a **MENU → Setup**
  button that asks for a 4-digit PIN, entered with the remote's number keys. You
  choose the PIN the first time you open setup.
- **First run with no channels goes straight to setup.**
- **Export / import a setup file**, so you can build the lineup on your own
  computer and load it on the TV computer.

## Your answers (step 1 questions)

- **Testing:** you're opening this environment's internet so I can test real
  YouTube here. Until it takes effect, I build and test with the practice player.
- **Controls: all of them.** A TV-style USB remote, a keyboard and mouse, and a
  touchscreen all have to work. So the on-screen remote has big touch-sized buttons,
  and every key a cheap media remote sends gets mapped (arrows, OK/Enter, Back,
  number keys, Page Up/Down for channel, media and volume keys).
- **Setup happens on the TV computer itself.** Export/import is kept as a small
  backup feature, not the main path.
- **No YouTube Premium:** keep the privacy-enhanced player. No standard-player switch.
- **Show timing: back to back** with a short ident in between (as above).

## Open, waiting on taste

- Overall look: three mockups coming in step 2.
