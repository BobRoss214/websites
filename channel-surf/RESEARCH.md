# Channel Surf: research notes

Plain-English notes on what YouTube allows, what works, and what the old cable TV
experience felt like. What I decided based on all this is in [DECISIONS.md](DECISIONS.md).

Checked October 2026. Sources are listed at the bottom.

---

## 1. The YouTube player (IFrame Player API)

This is YouTube's official way to put a video player on a web page and control it
with code: play, pause, jump to a time, change volume, load the next video.

**Starting mid-video works.** You can load a video and tell it where to start, in
seconds (`loadVideoById({videoId, startSeconds})`, or `start` when the player is
created). That's how "tuning in" will drop the viewer into the middle of a show.

**Autoplay with sound needs one click first.** Browsers (Chrome, Firefox, Safari)
block video that starts with sound until the person has clicked or tapped on the
page. After one click, the page counts as "activated" and can play with sound,
including inside the YouTube player, as long as the player is allowed to autoplay
(the YouTube script sets this up). **So the big POWER button is a real technical
requirement, not just decoration.** If someone reloads the page, the browser
forgets the click, so the power-on screen has to come back. That's fine, and it
feels like turning the TV on again.

**YouTube's own autoplay rules** (from "Required Minimum Functionality"):
- Don't start playback until the player is on screen and more than half of it is visible.
- Never have more than one YouTube player autoplaying at the same time on a screen.
- The player has to be at least **200 × 200 pixels**.

**Error codes.** When a video can't play, the player reports a number:

| Code | Meaning | What we do |
|---|---|---|
| 2 | Bad video ID | skip it, remember it's bad |
| 5 | The browser's player had a problem | try once more, then skip |
| 100 | Video deleted or made private | skip it, remember it's bad |
| 101 / 150 | Owner doesn't allow it to play on other sites | skip it, remember it's bad |
| 153 | Player couldn't tell which website it's on (missing "Referer") | this is a setup problem, see below |

**Error 153 is a trap.** If you open the app by double-clicking an `.html` file
(`file://...`), the browser doesn't tell YouTube which site the player is on, and
newer YouTube rejects it with error 153. **So the app must be served from a little
local web address like `http://localhost:8642`.** This is the main reason Channel
Surf comes with a tiny start-up program instead of a file you double-click.

**Videos can fail without an error.** On slow internet the player can sit loading
forever. We can't rely on error codes alone, so the app needs its own watchdog:
if nothing starts playing within a set time, show "Please Stand By", then move on.

**Captions.** Captions can be forced on when a video loads (`cc_load_policy=1`), and
the caption text size can be changed (`setOption('captions', 'fontSize', …)`).
Turning captions on and off mid-video isn't officially documented. The common
method (loading or unloading the captions module) works in practice. The fallback is
to reload the same video at the same spot with captions on or off. Not every video
has captions. Auto-generated ones usually exist for English.

**Privacy-enhanced mode.** Using `www.youtube-nocookie.com` as the player address
means YouTube doesn't store cookies for the viewer until they interact with the
player. It's officially supported (you set `host` when creating the player). Ads
can still play, but they aren't personalized. One side effect: **YouTube Premium
won't apply here**, because Premium works through a signed-in cookie. A viewer
with Premium may see ads in Channel Surf that they wouldn't see on youtube.com.

**Settings that changed over the years**, so I don't rely on them:
- `modestbranding` doesn't do anything anymore (removed in 2023).
- `rel=0` no longer turns off "related videos". It just limits them to the same channel.
- `showinfo` is gone.
- `controls=0` still hides the control bar, and that's allowed.
- `disablekb=1` turns off YouTube's own keyboard shortcuts, so our remote keys don't fight with them.
- `iv_load_policy=3` hides old-style annotations.

**End screens.** When a video ends, YouTube shows a grid of other videos. That's
exactly the "wall of thumbnails" we're trying to get away from. The moment a video
ends, we swap the player out for our own channel bumper, so the grid never shows.
That's allowed: we're hiding our own player, not covering it.

**Ads.** YouTube may play ads before or during videos. **We must not block, skip
or hide them.** Ads also mean a show can run a bit longer than the clock says. The
schedule is built to absorb that (see DECISIONS.md).

**Keyboard focus.** If someone clicks the video itself, the keyboard "goes into" the
YouTube player and the page stops hearing remote key presses. The fix is to notice
that and quietly hand the keyboard back to the page. That doesn't block anything in
the player.

---

## 2. Where the channel lineups come from

We need, for each YouTube channel: its recent videos, **how long each one is**
(to build a schedule), and whether each is a Short, a livestream, or can't be embedded.

### Option A: YouTube Data API v3 (official, free key) ✅ chosen

- Free. You get **10,000 "quota units" per day** with a free API key from Google.
- Every channel has a hidden **"uploads" playlist**. Listing it costs **1 unit for up to 50 videos**.
- Getting details (length, embeddable, live or not, age-restricted) costs **1 unit for up to 50 videos**.
- Looking up a channel from its `@handle` or ID costs **1 unit**.
- **Search is the expensive one: 100 units per call.** We never use it for regular refreshes.
  The only time it might be used is to look up an old-style `/c/name` link, which
  can't be found any other way.

**Budget:** refreshing one channel each day costs about 2 to 3 units. **200
subscriptions ≈ 600 units a day, about 6% of the free allowance.** Importing 200
channels from Takeout costs about 4 units.

The key is only used by the browser on the TV computer. It's restricted to the
YouTube Data API and to `http://localhost:8642`, so if anyone found it, it would be
useless to them.

### Option B: channel RSS feeds (no key) ❌ not chosen

`youtube.com/feeds/videos.xml?channel_id=…` gives a channel's latest videos with no key. But:
- **Only the last 15 videos.**
- **No video lengths**, so we can't build a schedule without a second source.
- No embeddable, Shorts or live flags.
- Browsers block reading it directly from another site (CORS), so it needs a local relay server.
- **It's been unreliable lately.** From December 2025 into 2026, the feeds returned
  random "404 not found" errors for days at a time, and RSS reader apps filed bug
  reports about it.

RSS is fine for a news reader, but not good enough for a TV schedule. The Data API
is free, official, gives lengths, and costs very little quota if used carefully.

### What we don't do

No downloading videos, no scraping YouTube web pages (for example, poking
`youtube.com/shorts/ID` to see if it redirects), no unofficial "Invidious" mirrors.
All of those break YouTube's terms.

---

## 3. YouTube's rules about what we put around the player

From the API Terms of Service, Developer Policies and Required Minimum Functionality:

**Not allowed:**
- **Anything in front of the player**: overlays, frames, banners, effects, or anything else covering any part of it, including its controls.
- Changing, blocking or rebuilding parts of the player, including ads.
- Hiding the player while sound keeps playing ("background play"), or separating sound from picture.
- Putting the player inside nested frames to disguise where it's used.
- Charging people to watch, or making them do something other than press play.
- Downloading, saving or caching the videos themselves.
- Keeping YouTube data (titles, channel names) longer than 30 days without refreshing it. We refresh daily, and delete data for removed channels.

**Allowed:**
- Our own design **around** the player: a TV cabinet or bezel, a banner **next to** the picture, guide grids, menus.
- **Resizing** the player, for example shrinking the picture to make room for the channel banner, like a broadcast "squeeze" during credits. It just has to stay at least 200×200.
- Swapping the player out for our own screens (static, "Please Stand By", bumpers, the guide) **when no video is playing**.
- Choosing which videos play and when (that's what the API's load and seek commands are for).
- Our own volume, mute and caption buttons that call the player's official commands.

**What this means for the design:**
- **No fake scanlines, curved glass or static over the video itself.** Those effects
  go on the TV frame, the banner, the guide, and our own full-screen cards only.
- **Static between channels goes *instead of* the video, not over it.** Old video
  stops, static plays in the empty screen, new video is loaded behind the scenes,
  then it's shown and starts playing.
- **The channel banner and volume bars sit outside the picture.** Either in a strip
  of the TV frame, or by briefly shrinking the picture to make room.
- Shows the YouTube logo and links inside the player, as normal. We also say
  "Programs from YouTube" in the guide footer.

---

## 4. Telling Shorts, livestreams and premieres apart

**Every channel has hidden playlists that already sort this out.** A channel ID
starts with `UC…`. Swap the first two letters and you get:

| Prefix | What's in it |
|---|---|
| `UU…` | all uploads (videos + Shorts + livestreams) |
| `UULF…` | **regular videos only** (no Shorts, no livestreams) |
| `UUSH…` | Shorts only |
| `UULV…` | livestreams only |

These aren't officially documented by YouTube, but they've worked for years and
are widely used. **The plan is to use `UULF` as the main source**, with these extra checks:

- **Live right now, or coming up** (scheduled livestreams and premieres that haven't aired yet):
  the video's `liveBroadcastContent` says `live` or `upcoming`. Skipped.
- **Already-aired premieres** are just normal videos once they've aired, so they stay in.
- **Past livestream recordings** are in `UULV`, not `UULF`, so they're already left out.
- **Shorts** can now be up to 3 minutes long, so length alone doesn't identify them.
  `UULF` handles it. As a backup, anything under the "shortest show" setting
  (default 3 minutes) is skipped.
- **Very long videos** (over a "longest show" setting, default 3 hours) are skipped.
  These are usually old stream recordings.
- **Not embeddable**, **age-restricted** (age-restricted videos can't play in embedded
  players), **private**, or **still processing**: all skipped before they reach the schedule.

**Backup plan:** if YouTube ever removes `UULF`, the app falls back to the full
`UU` uploads list and filters with the checks above. It's slightly less accurate,
but it keeps working.

---

## 5. Importing subscriptions

Google Takeout → YouTube → "subscriptions" gives a file called `subscriptions.csv`
with three columns: **Channel Id, Channel Url, Channel Title**. We read that file
right in the browser (it never leaves the computer) and look up all the channels
in batches of 50.

Channel links people might paste, and how we handle each one:

| Example | How we look it up | Cost |
|---|---|---|
| `youtube.com/@handle` or `@handle` | channel by handle | 1 unit |
| `youtube.com/channel/UC…` | channel by ID | 1 unit |
| `youtube.com/user/name` | channel by old username | 1 unit |
| `youtube.com/watch?v=…` (a video link) | find the video's channel | 2 units |
| `youtube.com/c/name` (old custom links) | search, used only for this | 100 units |

---

## 6. What old cable TV actually looked and felt like

What I'm drawing on, era by era. All the designs will be original. No real network
logos, guide brand names or real cable-company names.

**On-screen channel number (80s and 90s TVs).** Big, blocky, glowing numbers in a
corner, usually bright green or white with a dark outline, built from chunky
"pixels" because TVs drew text with simple character chips. A number appeared the
moment you pressed a button, sat there for about 3 seconds, then vanished. Typing
"1" showed `1-` while the TV waited for the second digit. The volume showed as a
row of green bars.

**The cable box itself.** Before on-screen menus, the box on top of the TV had a
**red LED number display** and a row of chunky buttons, or a slider with a click
for each channel. In the 80s, people still had TVs with a **clicking rotary dial**
(VHF 2 to 13, plus a UHF dial), and changing channels meant a satisfying *thunk*.

**The scrolling guide channel (late 80s and 90s).** A whole channel just for
listings. The **top half** showed promos, the weather or a still slide. The
**bottom half** was a grid that **scrolled up slowly and endlessly** and couldn't be
controlled. Each row was a channel number and short call letters on the left, then
program titles in boxes for the next 90 minutes. In the early 90s it moved from
white text on black to an **embossed navy-blue grid** with arrows on shows that
started earlier or ran later. People waited for their channel to scroll by. Very
specific memory, and very familiar.

**Interactive guides on digital cable boxes (late 90s and 2000s).** You could
finally move around the grid with arrow keys. **Dark blue and translucent panels,
glossy gradients, a yellow highlight box**, rounded corners, a mini picture of the
current channel in a corner, a clock, and an **info banner** at the bottom on every
channel change: number, title, time slot, a progress bar, a short description. Menus
had **Guide, Favorites, Settings and Parental Controls** in big chunky tiles.

**"Please Stand By" cards.** When something broke on air, the station showed a
still card, often a cartoon or a TV-with-a-wrench, saying "Please Stand By",
"Technical Difficulties" or "We'll Return Shortly", sometimes over **color bars**
with a steady tone. Color bars are a public broadcast test signal, not anyone's
trademark, so we can use them.

**CRT power on and off.** **On:** a quiet click, a high-pitched whine, a thin bright
line or glow that opens up into the picture over about a second, sometimes with a
color wobble from the "degauss" (*bwong*). **Off:** the picture collapses into a
thin horizontal line, then a bright dot in the middle that fades over a second or
two. Everyone remembers the dot.

**Static ("snow").** Black-and-white speckle with a loud hiss, seen between channels
on older sets or on channels you didn't get. Later cable boxes showed blue or black
screens instead. A short burst between channels is the classic flip feel.

**The remote.** Big rubbery buttons. **CH ▲▼ and VOL +/− rockers** in the middle,
a **number pad**, **ENTER**, **MUTE**, a **LAST / RECALL / PREV CH** button to
jump back, **GUIDE**, **INFO / DISPLAY**, **FAV**, and a red **POWER** button
at the top. The 80s ones were wedge-shaped and chunky. The 2000s ones were long and
silver with a round arrow pad and an OK button in the middle.

**Idents and bumpers.** Short 5 to 15 second clips between shows: the channel logo
animating, "Coming Up Next", "We'll be right back". These are where we can be
original and have some fun.

---

## 7. Running it on a TV later (Fire Stick, smart TVs)

Not building this now, but making sure we don't block it:
- **Fire Stick / Android TV:** the remote's arrows send arrow keys, the middle
  button sends Enter, and Back is the browser "back" action. Some remotes send
  "ChannelUp"/"ChannelDown" and media keys. We'll handle all of these.
  Everything will be reachable with just arrows, Enter and Back, with no mouse
  hover needed.
- App wrappers on TVs sometimes hit **error 152/153** if they load the page without
  a real web address. Keeping the app as normal web files served from a real
  address (localhost now, maybe a private web host later) avoids that.
- Settings live on each device. An **export/import setup file** lets you copy a
  setup from your computer to the TV box.

---

## 8. Getting your free API key (step by step)

You'll need this before we try real channels, at build step 3. It's free and takes
about 5 minutes. You don't need a credit card, and you don't need to send the key
to me: you'll paste it into Channel Surf's setup screen yourself.

1. On your computer, open **https://console.cloud.google.com/** and sign in with any Google account (yours is fine).
2. If it asks you to agree to terms, tick the box and click **Agree and continue**.
3. At the top left, next to "Google Cloud", click the **project picker** (it may say "Select a project"), then **New Project**.
   - Project name: `Channel Surf`. Leave everything else. Click **Create**.
   - Wait a few seconds, then make sure the project picker now says **Channel Surf**.
4. In the search bar at the top, type **YouTube Data API v3** and click it in the results.
5. Click the blue **Enable** button. Wait until the page changes.
6. In the left menu, click **Credentials** (or go to "APIs & Services" → "Credentials").
7. Click **+ Create credentials** → **API key**. A box shows a long key starting with `AIza…`.
8. Click **Edit API key** (or the key's name in the list) to lock it down:
   - **Name:** `Channel Surf TV`
   - Under **Application restrictions**, pick **Websites**, click **Add**, and type: `http://localhost:8642/*` → **Done**.
   - Under **API restrictions**, pick **Restrict key**, then tick only **YouTube Data API v3** in the list.
   - Click **Save**.
9. Copy the key (the copy icon next to it). Keep it somewhere private, like a note on your computer. We'll paste it into Channel Surf's setup screen when we get there.

It's normal for a new key to take up to 5 minutes before it starts working.

---

## Sources

- YouTube IFrame Player API reference: https://developers.google.com/youtube/iframe_api_reference
- YouTube embedded player parameters: https://developers.google.com/youtube/player_parameters
- YouTube API Services, Required Minimum Functionality: https://developers.google.com/youtube/terms/required-minimum-functionality
- YouTube API Services, Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- Data API quota costs: https://developers.google.com/youtube/v3/determine_quota_cost
- PlaylistItems: list: https://developers.google.com/youtube/v3/docs/playlistItems/list
- Videos resource (liveBroadcastContent, liveStreamingDetails, contentDetails): https://developers.google.com/youtube/v3/docs/videos
- Chrome autoplay policy: https://www.chromium.org/audio-video/autoplay/
- Error 153 write-ups: https://corsproxy.io/blog/fix-youtube-error-150-153-webview/, https://teamdynamix.umich.edu/TDClient/30/Portal/KB/ArticleDet?ID=14491
- Hidden channel playlists (UULF/UUSH/UULV): https://zegnat.bearblog.dev/the-rss-world-of-youtube/, https://blog.amen6.com/blog/2025/01/no-shorts-please-hidden-youtube-rss-feed-urls/, https://github.com/justinclayton/yourtube/issues/132
- RSS feed outages: https://github.com/FreshRSS/FreshRSS/issues/8808, https://github.com/miniflux/v2/issues/4261, https://community.n8n.io/t/youtube-rss-feed-endpoint-returns-404-errors/241692
- Takeout subscriptions.csv format: https://github.com/TeamNewPipe/NewPipeExtractor/pull/709, https://gist.github.com/hazycora/bc41e673aff4c9c7846d80e145574285
- Guide channel history: https://tedium.co/2016/03/29/cable-prevue-channel-secret-amiga/, https://en.wikipedia.org/wiki/Electronic_program_guide
- CRT behavior (power-off dot, degauss): https://www.repairfaq.org/sam/tvfaq.htm
