# Crate: research notes

Checked 1 October 2026. Plain-English summary of what still works, what doesn't, and what that means for the build.

**A word on how this was checked.** The cloud computer I'm building on isn't allowed to reach music services or YouTube directly (its network is locked down). So these findings come from official docs, the services' own source code on GitHub, and bug reports from other developers dated March to September 2026. I could install and inspect the tools themselves (yt-dlp, Deno, ytmusicapi and others) but not make live calls. Anything I couldn't confirm is marked *(unconfirmed)*. Everything gets re-checked for real on your machine before I call a step done.

---

## 1. Music data services

### Spotify: skip it
- In November 2024 Spotify switched off, for new apps, the features we'd want: song recommendations, "related artists", audio features (energy, danceability) and the 30-second previews.
- In February 2026 it went further. A developer app now needs a **paid Premium account**, search returns at most 10 results, and popularity, ISRC codes and artist top tracks were removed.
- **Verdict:** nothing left that Crate needs. Not used.

### Deezer: main search and preview source
- **Status:** the public catalogue API still works with **no account and no key**, confirmed by projects using it in April and September 2026. Deezer has stopped letting people register *new* apps, but that only matters for logging into a Deezer account, which Crate doesn't do.
- **Gives us:**
  - Song search with 30-second MP3 previews, album art up to 1000 px, and album and year.
  - The ISRC code, a worldwide ID for a recording, from a full track lookup. This lets us link a Deezer song to MusicBrainz exactly.
  - Similar artists, an artist's top tracks, and an "artist radio" list.
- **Catches:**
  - Preview links are signed and **expire after about 15 minutes**. Crate fetches a fresh one each time you press play and never stores it.
  - Deezer's audio server doesn't allow browser cross-site requests. Crate passes the preview through its own local server so it plays everywhere, including Firefox.
  - Deezer has no "similar *songs*" feature, only similar artists.
- **Rate limit:** about **50 requests per 5 seconds**. When you go over, it answers "Quota limit exceeded" (often with a normal-looking response), so Crate checks for that.

### iTunes Search API: backup previews and art
- **Status:** working, no key.
- **Gives us:** 30-second previews (AAC) and album art up to about 3000 px; change `100x100` in the art link to `1200x1200`.
- **Rate limit:** about **20 searches per minute**. When throttled it returns an empty "403 Forbidden", which must not be mistaken for "no preview".
- **Use:** preview fallback when Deezer has none, and an art fallback.

### Last.fm: the "more like this" brain
- **Status:** active in 2026. The **API key is free and issued instantly**.
- **Gives us:**
  - `track.getSimilar` (similar songs), `artist.getSimilar` (similar artists).
  - `tag.getTopTracks` (top songs for a tag such as "rainy day" or "90s hip hop"), and tags for songs and artists.
- **Catches:**
  - Similar-songs works well for known songs but is often empty for obscure ones. Then Crate falls back to similar *artists* and their best songs.
  - Tags are written by listeners, so they are noisy. Crate only uses strong ones.
- **Rate limit:** no more than **5 requests per second**, averaged over 5 minutes. Non-commercial personal use is allowed.

### ListenBrainz: second opinion on "similar", and vibe radio
- **Status:** open data from the MusicBrainz people.
- **No key needed:** the "similar artists" and "similar recordings" lookups.
- **Free token needed:** LB Radio. You give it a prompt such as `tag:(trip hop, dreampop)` and it returns a playlist of real songs. It started requiring a token in 2025 "because of AI scrapers". The token takes 30 seconds to get from your ListenBrainz settings page.
- **Rate limit:** about 1 request per second as a rule of thumb. LB Radio allows 5 calls per 5 seconds. The service reports limits in its replies, and Crate obeys them.

### MusicBrainz + Cover Art Archive: the source of truth for tags
- **Status:** the open music encyclopedia. No key.
- **Gives us:**
  - The proper title, artist, album, year and track number.
  - Genres.
  - A unique ID for every recording, used to confirm that each song is real.
  - The Cover Art Archive supplies album art at 500 or 1200 px.
- **Picking "the" album for a song** (a hit can appear on dozens of compilations): prefer the official original studio album, then the single or EP, then the earliest release date. MusicBrainz also publishes its own "canonical version" list that does roughly this.
- **Rate limit:** **1 request per second** on average. If you go faster, *every* request fails for a while. It also requires the app to identify itself (name, version and a contact). Crate queues all MusicBrainz calls one per second and caches the answers.

### AcoustID: the audio fingerprint check
- **Status:** **free for personal, non-commercial use.**
- **How it works:** a small program (`fpcalc`) "listens" to a downloaded file and makes a fingerprint. AcoustID says which MusicBrainz recording that fingerprint belongs to, with a confidence score from 0 to 1.
- **Rate limit:** **3 requests per second.**
- **Catch:** after you log in, the site shows a "user key". That's the wrong one. You must register an "application" to get the right key (steps below).

### Others I looked at
- **SoundCloud:** closed to new developers. Not usable.
- **Apple Music API:** needs a paid developer account, and offers nothing iTunes Search doesn't give for free.
- **Discogs:** good for fine-grained styles ("shoegaze", "deep house") but needs a token and is slow (25 to 60 requests per minute). **Not needed for now**, and easy to add later if genre tags feel thin.
- **TheAudioDB:** moods and styles per artist, but the free tier is limited. **Not used.**

---

## 2. Can a local AI on your laptop do vibe search?

**Short answer: yes, if it's used the right way.**

**What doesn't work:** asking a small AI model "give me 20 songs for a rainy night drive." Research from 2025 and 2026 (including Spotify's own papers and academic studies) agrees:
- Small models **invent songs** or pin songs on the wrong artist.
- The deeper the cut, the worse it gets.
- Even big cloud models do this sometimes.

**What works**, and what Spotify and others actually do: the AI *understands the request*, and real music databases *supply the songs*.
1. The local model turns your vibe into a structured description: genres, decade range, moods, energy from 0 to 1, a few listener tags, and 5 to 10 well-known seed artists. Small models are good at this, because it's understanding words, not remembering obscure facts.
2. Crate pulls real songs from Last.fm tags, the seed artists' best songs and their similar artists, ListenBrainz radio, and Deezer.
3. Every song is checked against Deezer and MusicBrainz. Anything that can't be confirmed is dropped. **Nothing unconfirmed is ever shown.**
4. Optionally, the local model re-ranks about 60 confirmed songs and picks the best 20. It can only choose from the list it's given, so it can't make things up.
5. Variety rules: at most 2 songs per artist, no duplicate versions of the same song, and a mix of hits and deeper cuts.
6. If the list comes back thin, Crate loosens the search (for example, widens the decades) and tries again. If it's still weak, it tells you honestly instead of padding the list.

**Which model:**
- **Default: Qwen 3.5, 9B size** (`qwen3.5:9b`, about a 6 GB download). Its "thinking" mode is turned off, which speeds it up.
  - With a graphics card that has 8 GB or more of memory, a vibe takes a couple of seconds.
  - On the processor only, it's closer to a minute.
- **Lighter fallback:** `qwen3.5:4b` (about 3.4 GB), for laptops without a good graphics card. It's about twice as fast on the processor.
- **Automatic choice:** the setup script checks your laptop's memory and graphics card and picks one. You can switch in settings.
- **Ollama version:** needs **0.34.4 or newer**. Older versions had a bug where certain settings broke the structured answer.

Speed and size figures for these new models come from third-party benchmarks *(roughly ±30%)*. I'll time it on your machine.

**Paid AI?** Not needed. A paid model (for example Claude Haiku, about 1 cent per vibe) knows more obscure music and would help most with very niche requests ("deep 70s Ethio-jazz"). But the verification step, not the model, is what keeps lists honest. **Plan:** local only. I'll leave a switched-off option to add a paid model later if vibe lists ever feel too mainstream. That decision would be yours.

---

## 3. yt-dlp and YouTube right now

**Versions and recent breakage:**
- Newest stable version: **2026.08.19** (released 19 August 2026). A nightly build comes out almost daily.
- It breaks often. Most recently, on 17 August 2026 one of its methods ("android_vr") started failing, and a fix shipped 2 days later. Crate has to cope with this routinely.

**What it needs today:**
- **A JavaScript helper.** Since late 2025 YouTube makes downloaders solve a puzzle, and yt-dlp needs a small program (Deno) to solve it.
  - Good news, which I tested: Deno and the puzzle scripts install automatically with `pip install "yt-dlp[default,deno]"`. No extra setup, no admin rights.
- **ffmpeg**, to convert to MP3. This is one `sudo apt install`.

**Without logging in** (which is how you want it):
- yt-dlp's default method ("visionos") works logged-out and doesn't need the extra "proof of origin" tokens. Audio downloads work this way.
- Add-ons that generate those tokens exist. They're not needed today, and are kept as a backup plan.

**The real risk is your VPN.**
- YouTube sometimes answers "Sign in to confirm you're not a bot". This happens much more often on VPN and datacenter addresses. The only official fix is logging in, which you've ruled out.
- What Crate will do:
  - Download slowly.
  - Detect that message, then pause downloads and **tell you plainly on screen**.
  - Suggest switching VPN servers or letting YouTube bypass the VPN (most VPN apps call this "split tunneling").

**Keeping it updated:**
- Ubuntu's own yt-dlp package is months or years old. Don't use it.
- Crate keeps its own copy and updates it to the newest nightly build (the channel yt-dlp's developers recommend for regular users) at most once a day, when it starts. The version and last-update time are shown in settings.

**Audio quality:**
- Without a Premium login, YouTube's best audio is **Opus at about 130 to 160 kbps**. There's also an AAC stream at 128 kbps. Nothing higher is available logged-out.
- Converting that to a 320 kbps MP3 just wastes space; it can't add back quality that isn't there.
- **Choice: MP3 "V0" variable bitrate** (about 220 to 260 kbps). It's the highest LAME quality setting and transparent for this source.
  - yt-dlp's *default* is a much lower quality (about 130 kbps), so Crate sets this explicitly.

**Being polite:**
- yt-dlp's documented limit for logged-out use is about **300 videos per hour**. Going over gets you temporarily blocked.
- Crate will:
  - Download **2 songs at a time**.
  - Wait **10 to 20 seconds between songs**, plus short pauses between requests.
  - Stop at about **100 songs per hour**.
- In practice, a 50-song "Download all" takes about 20 to 30 minutes in the background.

---

## 4. Picking the right YouTube upload, and checking it

**Best source: YouTube Music "Topic" uploads.**
- Channels named "Artist - Topic" are created automatically from the record label's files. Their descriptions start with "Provided to YouTube by…".
- They contain the exact studio audio, with the real album length and no music-video intro or outro.

**How Crate finds them:**
- Crate searches YouTube Music's "Songs" section using **ytmusicapi**, a library maintained through September 2026 that works without logging in. Each result says whether it's an official audio track (a "Topic" upload) or an official music video.
- Order of preference:
  1. Official audio ("Topic").
  2. The official artist channel or VEVO.
  3. Everything else, only if nothing better exists.

**Checks before saving:**
1. **Length:** within 3 seconds of the real track length from MusicBrainz (5 seconds for a music video).
2. **Name match:** the title and artist closely match, ignoring "(Official Video)", "Remastered" and similar extras.
3. **Red-flag words:** reject *live, cover, remix, sped up, slowed, nightcore, lyrics, karaoke, instrumental, 8D, reverb, acoustic, 1 hour*. The exception is when that word is in the song you picked; if you picked a live version, live is right.
4. **Fingerprint:** after downloading, `fpcalc` plus AcoustID confirms the audio really is that MusicBrainz recording (confidence 0.8 or above).
5. **If anything is borderline:** Crate does **not** save the file. It shows you the top 2 or 3 YouTube matches (with channel, length and a play button) and you pick.
   - This also covers songs where YouTube only has live versions or covers. You'll see that plainly and can choose one or skip.

---

## 5. Tagging: beets or not?

**beets** is excellent and actively maintained (version 2.14.1, September 2026). But it's built to manage a whole library through its own database and command line, and to import albums. Crate saves one song at a time from code. Putting beets in the middle would add a second database and its own rules for moving files, which works against "never touch my existing music".

**Decision:** tag directly with **mutagen**, the library beets itself uses, using MusicBrainz data.
- **Written to every file:**
  - Title, artist, album artist, album, year, genre, track number and disc number.
  - Embedded album art (from the Cover Art Archive, about 1000 px).
  - The MusicBrainz IDs.
- **Why the IDs matter:** if you ever use beets or MusicBrainz Picard later, they'll recognise Crate's files instantly.

**Tag format:** ID3 **version 2.3**, the most compatible. It's read correctly by Rhythmbox, Strawberry, Lollypop, VLC, phones and car stereos.

The old Python MusicBrainz library (`musicbrainzngs`) hasn't been updated since 2020, so Crate talks to MusicBrainz directly.

---

## 6. Playlists

`.m3u8` files:
- UTF-8 text, starting with `#EXTM3U`.
- Each song gets a `#EXTINF:` line (length plus "Artist - Title") followed by its file path.
- Paths are written **relative to the playlist file**, and playlists are saved inside your music folder, so they keep working if the folder moves or you copy it to a phone.

VLC, Rhythmbox, Strawberry and Lollypop all read this format *(how each handles relative paths is from user reports; I'll test with the ones you use)*.

---

## 7. Rate limits at a glance

| Service | Limit | Key? | What Crate uses it for |
|---|---|---|---|
| Deezer | ~50 requests / 5 s | No | Search, previews, art, similar artists |
| iTunes Search | ~20 / minute | No | Backup previews and art |
| Last.fm | 5 / s (averaged) | Free key | Similar songs and artists, vibe tags |
| ListenBrainz | ~1 / s; radio 5 per 5 s | Free token (radio only) | Similar data, vibe radio |
| MusicBrainz | 1 / s (strict) | No (must identify itself) | Verifying songs, proper tags |
| Cover Art Archive | Polite use | No | Album art for tags |
| AcoustID | 3 / s | Free key | Fingerprint check |
| YouTube (yt-dlp) | ~300 videos / hour logged-out | No (and never your account) | The audio |
| Ollama | Your laptop | No | Understanding vibes |

---

## 8. Free keys: how to get each one

You'll paste these into a file called `.env` inside the Crate folder. I'll give you that file with blanks to fill in. Each key takes about 2 minutes, and none needs a credit card.

### Last.fm (needed for "more like this" and vibes)
1. Go to https://www.last.fm/join and make a free account, or log in.
2. Go to https://www.last.fm/api/account/create
3. Fill in:
   - **Contact email:** yours.
   - **Application name:** `Crate`.
   - **Application description:** `Personal music finder`.
   - Leave **Callback URL** and **Application homepage** blank.
4. Press **Submit**.
5. Copy the line labelled **API key**, a long string of letters and numbers. You don't need the "Shared secret".
6. You can always see it again at https://www.last.fm/api/accounts

### AcoustID (needed for the fingerprint check)
1. Go to https://acoustid.org and click **Sign in**. Use **MusicBrainz** (make a free account at https://musicbrainz.org/register first) or Google.
2. After signing in you'll see an "API key". **Ignore this one**; it's your *user* key and won't work.
3. Go to https://acoustid.org/new-application (or click **Your applications**, then **Register a new application**).
4. Fill in:
   - **Name:** `Crate`.
   - **Version:** `1.0`.
   - **Website:** leave blank, or put `http://localhost`.
5. Copy the **API key** shown for the application, about 10 characters.

### ListenBrainz (optional, makes vibe lists better)
1. Go to https://listenbrainz.org and click **Sign in**. It uses the same MusicBrainz account as above.
2. Click your name (top right), then **Settings**.
3. Copy the **User token**.

### MusicBrainz, Deezer, iTunes
No key needed.
