# Channel Surf Plus: how to set it up

Channel Surf turns YouTube into old-fashioned cable TV. You press POWER and a
show is already on. You flip channels up and down, and channel 1 is the TV
guide. This "Plus" version also has Search, On Demand, My Stuff, comments,
chapters, "watch on your phone" and "make this a TV channel", all in the same
TV-style menus. If you sign in (optional), likes, subscriptions, playlists and
comments go to your real YouTube account. You can switch the extras off for a
simpler TV.

This page is for **whoever sets it up**. The viewer only needs the last section,
"Using the remote".

---

## What you need

- An Ubuntu computer (a laptop is fine). It can be plugged into a TV with an HDMI cable.
- Internet.
- A web browser. Ubuntu comes with Firefox, which works. **Google Chrome** works best (step 1, optional).
- A free YouTube key (step 3 below, about 5 minutes).

No Terminal and no typing commands. Everything is clicking.

---

## 1. Install Channel Surf (once)

1. On the Ubuntu computer, download the installer file **`channel-surf_1.0.0_all.deb`**. Either:
   - go to **https://github.com/BobRoss214/websites/blob/claude/friendly-thompson-rgqo95/channel-surf-plus/dist/channel-surf_1.0.0_all.deb** and click the **Download** button (the arrow pointing down, at the right of the file), or
   - use the copy that was sent in the Claude app.
2. Open the **Files** app, go to **Downloads**, and **double-click** `channel-surf_1.0.0_all.deb`.
3. **App Center** opens and shows Channel Surf. Click **Install** and type your computer password when it asks.
   - If double-clicking opens something else instead, **right-click** the file, choose **Open With…**, pick **App Center**, and click **Install**.
4. Done. **Channel Surf** is now in your apps (press the Windows/Super key and type `channel`).

**Optional but recommended: Google Chrome.** It handles YouTube, sound and full
screen best. Go to **https://www.google.com/chrome**, click **Download Chrome**,
pick **64 bit .deb (For Debian/Ubuntu)**, then double-click the downloaded file
and click **Install**, just like above. Channel Surf uses Chrome automatically
when it's there, and Firefox otherwise.

## 2. Turn the TV on

**Click the Channel Surf icon.** The first time, it also puts itself in the dock
on the left of the screen, so next time it's one click there.

The TV opens full screen. Press the big red button (or any key) to turn it on.
At first you'll see **practice channels**, which are pretend shows so you can
try everything before you connect YouTube.

- **To turn the TV off and close it:** press `Alt` + `F4`.
- **To set things up in a normal window** (easier with a mouse): right-click the Channel Surf icon in the dock and choose **Open in a window (for setting up)**.
- **To take it out of the dock:** right-click the icon and choose **Unpin**. It stays in your apps.

## 3. Get your free YouTube key (once)

Channel Surf uses YouTube's official service. Google gives you a free key for
it. You don't need a credit card, and nothing about you is shared with the viewer.

1. On any computer, go to **https://console.cloud.google.com/** and sign in with a Google account.
2. If it asks you to agree to terms, tick the box and click **Agree and continue**.
3. At the top left, click the **project picker** (it may say "Select a project"), then **New Project**. Name it `Channel Surf` and click **Create**. Wait a few seconds, then make sure the picker shows **Channel Surf**.
4. In the search bar at the top, type **YouTube Data API v3**, click it, then click the blue **Enable** button.
5. In the left menu, click **Credentials**, then **+ Create credentials**, then **API key**.
6. Click **Edit API key** (or click the key's name):
   - **Application restrictions:** choose **Websites**, click **Add**, and type exactly `http://localhost:8642/*`, then **Done**.
   - **API restrictions:** choose **Restrict key**, then tick only **YouTube Data API v3**.
   - Click **Save**.
7. Copy the key (it starts with `AIza`). A new key can take up to 5 minutes to start working.

## 4. Connect it

1. Turn the TV on. Press **MENU** (the green button on the remote, or the `Home` key on a keyboard).
2. Go down to **Setup** and press OK.
3. The first time, it asks you to **choose a 4-digit PIN**. Type it twice. This keeps the viewer out of Setup.
4. On the **YouTube connection** tab, paste your key and click **Save and test the key**.
   If it works, the TV restarts with real YouTube and an empty lineup, ready for your channels.
5. Pick the **Country** (for "popular" videos and what's allowed to play there).

If the test fails, the message says why in plain words. The usual fixes:
- *"key isn't valid"*: copy it again from Google Cloud. The whole thing starts with `AIza`.
- *"refused the key from this address"*: the key's Websites list needs exactly `http://localhost:8642/*`.
- *"isn't switched on"*: step 3.4 again (Enable YouTube Data API v3), and tick it in step 3.6.

## 5. Add channels

In **Setup → Channels**:

- **+ Add a channel.** Give it a name and a number, then add what it plays. You can add:
  - **YouTube channels:** paste links or @handles, one per line. Several in one TV channel **take turns**, so "Woodworking" can be 4 woodworking channels.
  - **A search:** words like `bob ross painting`, with length/date filters.
  - **A playlist link** (anything with `list=` in it).
  - **A topic:** YouTube's popular videos in Music, Travel, How-to and so on.
- **Import YouTube subscriptions or links:**
  1. Go to **https://takeout.google.com**. Click **Deselect all**, tick only **YouTube and YouTube Music**, then **All YouTube data included**: untick everything except **subscriptions**. Click **Next step**, then **Create export**.
  2. Google emails you a download link. Download and unzip it. Inside is `subscriptions.csv`.
  3. In Setup, choose the file. Untick any you don't want, then pick **Make each one its own TV channel**, or **Combine** them into one channel with a name.
- Use **▲ ▼** to change the order, **☆ Fav** for favorites (the FAV button jumps between them), **Edit** to rename or renumber, and **Number them 2, 3, 4…** to tidy up.

Channel 1 is always the guide. Each channel gets its newest videos from
YouTube about once a day, all by itself.

**What never goes on the schedule:** Shorts, livestreams, premieres that
haven't aired, age-restricted videos, and videos whose owners don't allow
playing outside YouTube. Shows shorter than 3 minutes or longer than 3 hours
are left out too; you can change that in **Setup → What the viewer sees → House rules**.

If you're signed in to YouTube (step 8), the import page also has **Get my
subscriptions from YouTube**, which skips Takeout altogether.

## 6. Make it simple for the viewer (optional)

**Setup → What the viewer sees.** Untick **Search YouTube** and **On Demand and
My Stuff** for a plain cable TV: channels, the guide, favorites, settings. You
can also stop the viewer from making new channels. If you've signed in (step 8),
you can also switch off the YouTube account features, or just comment writing.

## 7. Hook it up to the TV

1. Plug the laptop into the TV with an HDMI cable and pick that HDMI input on the TV.
2. **Sound through the TV:** Ubuntu **Settings → Sound → Output Device**, then choose the HDMI / TV one.
3. **Picture on the TV only:** **Settings → Displays**, then choose **Single Display** (the TV), or **Mirror**.
4. **Don't let it fall asleep:** **Settings → Power → Screen Blank: Never**, and turn off **Automatic Suspend** while plugged in.
5. A cheap USB TV-style remote ("air mouse" remote) works. Its arrows, OK, Back, number and volume buttons all do the right thing.

## 8. Sign in to YouTube (optional)

Without this, likes, "Watch Later" and follows are kept on the TV computer only.
With it, they happen on your real YouTube account, and the menu gets a
**Your YouTube** section: your subscriptions, new videos from them, your
playlists, and videos you liked. You can also write comments and replies.

It takes about 10 minutes, once. You make a "sign-in client" in the same
Google Cloud project as your key (step 3). It's free.

1. Go to **https://console.cloud.google.com/auth/overview** and make sure the project picker at the top says **Channel Surf**. Click **Get started**.
2. **App name:** `Channel Surf`. **User support email:** your email. Click **Next**.
3. **Audience:** choose **External**, then **Next**. **Contact information:** your email, then **Next**. Tick the box to agree, then **Continue** and **Create**.
4. In the left menu, click **Audience**. Under **Test users**, click **+ Add users**, type the Google account you use for YouTube, and click **Save**.
5. In the left menu, click **Clients**, then **+ Create client**.
   - **Application type:** choose **Desktop app**.
   - **Name:** `Channel Surf TV`. Click **Create**.
6. A box shows a **Client ID** (ends with `.apps.googleusercontent.com`) and a **Client secret** (starts with `GOCSPX-`). Keep it open.
7. On the TV: **MENU → Setup → YouTube connection**. In the **YouTube account** box, paste the client ID and the client secret, then click **Save**.
8. Click **Sign in with Google**. Pick your account.
   - Google says **"Google hasn't verified this app"**. That's expected: it's your own app. Click **Continue**.
   - Tick the box that lets Channel Surf **manage your YouTube account**, then **Continue**.
9. You come back to the TV and it says **Signed in to YouTube ✓**.

**Every 7 days Google asks you to sign in again.** That's Google's rule while an
app is in "Testing". Just click **Sign in with Google** in Setup again. To stop
that, go back to the **Audience** page and click **Publish app**. It's still only
for you; Google just shows the "hasn't verified" screen when you sign in.

Where the sign-in is kept: in a private file on this computer
(`~/.config/channel-surf/`), never in the browser and never sent anywhere except
Google. **Sign out** is on the same Setup page.

What it can do, in the TV's menus:
- **Like** or **dislike** a video, **subscribe** or unsubscribe (it asks first), **save to a playlist** (yours, or a new private one).
- **Write a comment** or **reply** with the on-screen keyboard (or a real one). It always shows you the comment and asks before posting, because comments are public.
- **Your YouTube** menu: subscriptions, new videos from them, your playlists, liked videos, and **Make a TV channel from your subscriptions**.

---

## Using the remote (for the viewer)

| Button | What it does |
|---|---|
| **POWER** (or any button when it's off) | Turn the TV on or off |
| **CH ▲ ▼** or **▲ ▼** | Change channel |
| **Numbers** then wait (or OK) | Go straight to a channel |
| **LAST** / **BACK** | Back to the channel you were just on |
| **GUIDE** | The TV guide (channel 1). Arrows look around, OK watches |
| **INFO** or **OK** | Show what's on, and how long is left |
| **VOL + −**, **MUTE** | Volume (the TV's own remote works too) |
| **CC** | Captions on and off |
| **FAV** | Jump to the next favorite channel |
| **MENU** | Search, On Demand, My Stuff, Your YouTube, Lineup Filters, Settings |
| **SEARCH**, **ON DEMAND**, **LIVE TV** | Straight to those |
| **EXIT** | Close menus and go back to watching |

**Watching something On Demand:** OK pauses and plays. ◀ goes back 10 seconds,
▶ skips ahead 30. CH ▲ ▼ go to the next or previous video in the list. BACK goes
to the list (the video keeps playing in the little window). EXIT or LIVE TV goes
back to regular channels. If you stop partway, it picks up where you left off next time.

**On a video's page:** **Chapters** jumps to a part of the video (when the
YouTuber marked them). **Watch on your phone** shows a square code: point a
phone's camera at it and the video opens on the phone, right where you are.
**Comments** shows what people are saying. If you're signed in, you can write one too.

**Typing** (search, comments, playlist names): move with the arrows and press OK
on each letter, or just type on a keyboard. **DONE** or **NEXT** finishes.

**Settings** (in the menu): captions, **caption language**, bigger text, static, sounds.

**Lineup Filters** (in the menu) change every channel at once, for example
"only shows under 20 minutes" or "only from the past week". The guide changes too.

On a keyboard: arrows, `Enter` = OK, `Backspace` = BACK, `Home` = MENU, `G` guide,
`I` info, `M` mute, `+`/`−` volume, `C` captions, `F` favorites, `S` search,
`P` power, `Page Up`/`Page Down` = channel. In Search, just type.

---

## When something's wrong

**First, try Setup → Check everything.** It tests each part and says what to fix.

| You see | What it means / what to do |
|---|---|
| **Please Stand By** for a moment | A video wouldn't play. The TV skips it and moves on by itself. |
| **No Signal: checking the cable** | The internet is down. It keeps trying by itself. Check the Wi-Fi. |
| **Off the Air** | That channel has nothing to show right now (or its YouTube channel is empty). Try another channel, or check it in Setup. |
| **Press MUTE to turn the sound on** | The browser started without sound. Press MUTE once. |
| **Player setup problem** | It was opened as a file. Start it with the Channel Surf icon instead. |
| **Daily limit used up** (when searching) | YouTube allows about 90 searches a day on a free key. Searching works again after midnight Pacific time. Channels keep playing. |
| Banner says channels are **"not loaded yet"** in Setup | Wait a minute after adding them, or click **Refresh all channels now**. |
| **Signed out of YouTube** | Google ended the sign-in (it does every 7 days in Testing mode). Setup → YouTube connection → **Sign in with Google**. |
| **"doesn't have a YouTube channel yet"** | Comments and playlists need a YouTube channel on that Google account. Make one on youtube.com (free), then try again. |
| Sign-in page says **"Access blocked"** or **"not a test user"** | Step 8.4: add that Google account as a test user. |

**Forgot the Setup PIN?** Right-click the Channel Surf icon in the dock and choose
**Forgot the Setup PIN**, then click **Clear the PIN**. Channels and settings stay.

**Moving to another computer, or keeping a backup:** **Setup → Backup and PIN → Save setup to a file.**
On the other computer, use **Load setup from a file**. (The YouTube key comes along.
Add `http://localhost:8642/*` to the key's Websites list if it's a new computer; it already is.)

**Updating to a newer version:** download the newer `.deb` file and double-click it,
just like the first time. App Center replaces the old version, and your channels
and settings stay.

**Removing it:** open **App Center**, click **Manage** (or search for Channel
Surf), and click **Uninstall**.

---

## Privacy

- The viewer never has to sign in to anything. Nothing is sent to anyone except YouTube itself (and Google, if you sign in).
- The player is YouTube's privacy-enhanced one (`youtube-nocookie.com`). Because of that, the YouTube Premium "no ads" perk doesn't apply here, so ads can appear like on normal YouTube. Channel Surf never blocks or skips them.
- Watch Later, History and Follows are kept **on this computer only**. Likes are too, unless you've signed in (step 8); then they go to your YouTube account.
- Signing in is optional. The sign-in is kept in a private file on this computer, never in the browser. Signing out deletes it. You can also remove Channel Surf's access from your Google account any time at **https://myaccount.google.com/permissions**.
- Channel Surf uses YouTube API Services, so YouTube's Terms of Service (https://www.youtube.com/t/terms) and Google's Privacy Policy (https://policies.google.com/privacy) apply.
- No tracking or analytics of any kind.

## Checking it works

**MENU → Setup → Check everything** tests each part on this computer and says
what to fix, in plain words.

For programmers: there are automatic tests that run the app against a pretend
YouTube (see README.md).
