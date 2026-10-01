# Crate: decisions log

Newest at the bottom. Each entry says what was decided and why. Anything marked **(ask)** waits on your answer.

## 2026-10-01: Setup and plan

1. **Where the code lives.** Crate is built in a `crate/` folder in this repo, on the branch this session was given, and kept completely separate from the farm website files.
   - **(ask)** This repo is **public on GitHub**, so the code would be visible to anyone. No keys, personal paths or music ever go into git: `.env` and the local data folder are git-ignored.
   - The folder can move to its own private repo at any time.

2. **App shape.** A small Python web server (FastAPI) on your laptop, plus one web page in plain HTML, CSS and JavaScript.
   - No build tools, no Node app, no Docker. That means fewer moving parts to break, and it's easy to start with one command.

3. **Local data.** One SQLite file holds history, the cache of music lookups, download jobs, and the "already have it" index. It lives in `~/.local/share/crate/`, never in git.

4. **Access.** The server answers only devices on your home network: your laptop, plus your phone on home Wi-Fi.
   - It refuses any request that doesn't come from a private home-network address.
   - It never opens anything to the internet. It doesn't touch your router, and doesn't use UPnP.

5. **Music data sources.** Search and previews: Deezer, then iTunes. Truth and tags: MusicBrainz plus the Cover Art Archive. "More like this": Last.fm, ListenBrainz and Deezer combined. Spotify isn't used; see RESEARCH.md §1.

6. **Every song is checked before it's shown.**
   - A song from Deezer or iTunes is a real release by definition.
   - A song coming from Last.fm, ListenBrainz or the AI must be matched to a Deezer or MusicBrainz record, or it's dropped.

7. **Previews.**
   - Order of sources:
     1. Deezer, with a fresh link fetched on every press of play.
     2. iTunes.
     3. A 30-second clip from the chosen YouTube match.
   - All previews go through the local server (needed for Deezer, and keeps things consistent).
   - Only one plays at a time.

8. **Vibe search.** Uses a local Ollama model (`qwen3.5:9b` by default, `qwen3.5:4b` on lighter laptops, picked automatically).
   - The AI only *describes* the vibe and suggests seed artists; real services supply the songs.
   - Requires Ollama 0.34.4 or newer.
   - No paid AI.

9. **YouTube matching.**
   - YouTube Music "Songs" search (ytmusicapi), with official "Topic" audio first, then the official artist channel or VEVO, then the rest.
   - Checks before saving: length within 3 seconds (5 for a video), name match, red-flag words, and an AcoustID fingerprint.
   - Anything borderline means **you pick from the top 3; nothing is saved silently.**

10. **Audio format.** MP3 V0 VBR (about 245 kbps average) from the best audio YouTube offers logged-out (Opus at about 160 kbps). 320 CBR would only waste space.

11. **Tagging.**
    - Mutagen directly, with MusicBrainz data. Not beets; see RESEARCH.md §5.
    - ID3 v2.3, with embedded art at about 1000 px and the MusicBrainz IDs.

12. **Choosing the album for a song.** Prefer the official original studio album. If there isn't one, use the single or EP. Among several candidates, pick the earliest release.

13. **Politeness.**
    - YouTube: 2 downloads at a time, 10 to 20 seconds between songs, at most about 100 songs per hour.
    - MusicBrainz: 1 request per second.
    - Every other service: kept under its published limit, with caching.

14. **yt-dlp updates.**
    - Crate keeps its own private copy, never Ubuntu's.
    - At most once a day, at startup, it updates to the newest nightly build.
    - If an update fails, Crate keeps the old copy and says so in settings.

15. **Failures are always shown.** Every failed download shows a plain sentence on that song, for example:
    - "YouTube is asking to confirm you're not a bot. This usually means the VPN server is flagged. Try another server."
    - "No official audio found."

    It also offers a retry button. Nothing fails silently.

16. **Your existing library is read-only.**
    - Crate only *reads* existing files, to build the "already have it" index.
    - It only ever *creates new* files and never overwrites one. If a file already exists at the target path, it skips and tells you.
    - Testing runs against a copy of your music folder first.

17. **Playlists.** `.m3u8` with paths relative to the playlist file, saved in a `Playlists/` folder inside your music folder.

18. **Mockups are shown as private web links.** I build on a cloud computer, so you can't open its "localhost". The 3 look mockups are published as private claude.ai pages that only you can see, and you click through them on your laptop or phone.

19. **Testing.** This cloud computer can't reach the music services or YouTube right now.
    - **(ask)** You can widen its network access so I can test lookups myself.
    - Real YouTube downloads also get a self-test script you run on your own machine, because cloud addresses are treated by YouTube even more harshly than VPNs.
