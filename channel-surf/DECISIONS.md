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

## Look direction (step 2)

- **Era: 1995 to 2005 cable and satellite menus**, per your note. My first pass
  (an 80s wood console and a 1994 cable box) was too old, so those were dropped
  (still in git history).
- **No fake TV cabinet.** On a laptop plugged into a TV, the real TV is the frame.
  The picture gets the whole screen, and the nostalgia lives in the menus,
  banners, guide, idents and cards.
- **The banner "squeeze".** Because nothing may cover the YouTube player, every
  banner, number entry or volume display briefly shrinks the picture to make room,
  then lets it go back to full screen. Each mockup does this differently:
  - Look 1: picture shrinks to the top center, navy frame around it.
  - Look 2: picture tucks into the top-left corner, L-shaped panel.
  - Look 3: picture slides right, channel list on the left.
- **The on-screen remote sits beside the screen, never on top of it**, and can be
  hidden. The same buttons work in every look.
- **The guide channel is channel 1**, and the GUIDE button tunes there. In the
  guide, the arrow keys move around the grid; CH ▲▼ and LAST leave it. The
  little picture in the guide shows the channel you came from.
- **The MENU button opens a set-top box style menu** (Guide, Favorites,
  Settings, Setup with PIN). The live picture keeps playing in a window inside
  the menu instead of being covered.
- **The viewer's FAV button jumps to the next favorite channel.** Picking
  favorites happens in Setup, so there's nothing for the viewer to mess up.

## Channel Surf Plus (step 2 onward)

- **A separate folder, `channel-surf-plus/`**, per your note. The mockups stay in
  `channel-surf/mockups/`.
- **The look: Look 1 (1997 cable box)**, my recommended pick, with Look 2's
  "Loading program guide… please wait" start-up screen. You said "that's good, but expand it"
  without naming one. It also has the biggest, easiest-to-read text. The code
  keeps every color and size in one stylesheet, so switching looks later is a contained job.
- **"Everything YouTube can do", the TV way:** Search (on-screen keyboard plus
  filters), results, video pages, channel pages, playlists, comments (read only),
  On Demand (popular now, topics, live now, new from followed channels), and My
  Stuff (watch later, history with resume, liked, followed, favorite channels).
  Playback speed, captions, pause, skip ±, next/previous in a list.
- **Filters shape the TV:** Lineup Filters (length, how new, captions only) change
  every channel's schedule at once. Each channel can have its own filters, and any
  search, topic, channel or playlist can become a numbered TV channel.
- **Not included at first:** a recommendation feed, Google sign-in, posting
  comments, and real YouTube likes and subscriptions. See RESEARCH.md section 9 for
  YouTube's "don't be a substitute" rule. Likes and follows were kept on this computer.
  (Sign-in, likes, subscriptions and comments were added later, on request. See "Connected to YouTube" below.)
- **Setup can switch the extras off** for the simple 75-year-old version.
- **Demo mode** (practice channels) until a key is added, so everything can be tried first.
- **Menus show live TV in a window**, the way 2000s cable boxes did, instead of
  covering or hiding the picture. Setup screens pause it (no sound without a picture).
- **The on-screen remote** appears when the mouse moves or the screen is touched,
  and sits beside the picture (it shrinks to make room), never on top.
- **Errors:** player errors 2/100/101/150 mean skip and never schedule again; 5 means retry once;
  153 means "start it with tv.py". No picture after 12 seconds means one retry, then skip
  (for 6 hours). Three stalls in a row means "No Signal", which retries by itself.
- **Start-up:** `python3 tv.py` serves on `http://localhost:8642` and opens Chrome
  (or Firefox) in kiosk mode with its own profile. `--install-shortcut` makes a desktop
  icon. Closing the window stops it.
- **Tests:** `tests/run-tests.js` drives the real app in a browser against a pretend
  YouTube that answers with real response shapes and real error formats (47 checks).
  This sandbox can't reach youtube.com, so the real service hasn't been tried here yet.

## Connected to YouTube (step 3)

You asked for it to "actually connect to YouTube" with every YouTube ability that
fits the TV vibe. That changed two earlier "not included" decisions:

- **Optional Google sign-in, done once in Setup (behind the PIN).** The viewer never
  sees a sign-in. Without it, everything works as before, with likes and follows
  kept on the computer.
- **How the sign-in is kept safe.** `tv.py` does the Google sign-in as a "Desktop
  app" with PKCE, and keeps the lasting sign-in in a private file
  (`~/.config/channel-surf/`, readable only by you). The browser page only gets
  hour-long passes from `tv.py`, so nothing lasting is ever in the browser. `tv.py`
  only answers requests from its own page: it checks the address, the origin and a
  special header, and never allows other sites in.
- **One permission:** `youtube.force-ssl`, the smallest one that covers likes,
  subscriptions, playlists and comments.
- **What it adds:**
  - Like and dislike.
  - Subscribe and unsubscribe (unsubscribing asks first).
  - Save to your playlists, or a new private one.
  - Comments and replies. They're typed on an on-screen keyboard, and always shown
    back with "Post this on YouTube?" before posting, because comments are public.
  - A **Your YouTube** menu: subscriptions, new from subscriptions, your playlists,
    liked videos, and "make a TV channel from your subscriptions".
  - Importing subscriptions straight from the account.
- **Other YouTube abilities added:**
  - Chapters (from the description, by YouTube's own rules).
  - A channel's Most popular, Live streams and Shorts lists.
  - Caption language.
  - "Watch on your phone" (a QR code, made on the computer).
  - Setup → **Check everything**.
- **Still left out, on purpose:**
  - YouTube's own recommendation feed and Watch Later list. The API doesn't offer
    them anymore.
  - Uploading, editing videos and deleting comments. They don't fit a TV, and
    they're risky for the viewer.
- **The remote's OK button sends the same key as Enter.** So on the on-screen
  keyboards, Enter only finishes straight after real typing. Otherwise OK presses
  the highlighted letter.
- **Four helper reviews, all applied.** An audit of every API call against
  YouTube's published definitions, a player audit, a bug hunt (18 confirmed bugs,
  all fixed, most with a test), and a usability pass.
  - One suggestion was not applied: making the player ignore clicks. That would
    also block clicks on ads, which YouTube's rules don't allow. Instead, live TV
    simply starts playing again if a click pauses it.

## Open

- A pass with your real key, your channels and your Google account, on your
  Ubuntu machine. youtube.com is blocked in this sandbox, so the real player and
  real sign-in haven't run here. Everything else ran against the pretend YouTube,
  which answers in YouTube's real formats, including its error messages.
