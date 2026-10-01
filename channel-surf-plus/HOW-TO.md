# Channel Surf Plus: how to set it up

Channel Surf turns YouTube into old-fashioned cable TV. You press POWER and a
show is already on. You flip channels up and down, and channel 1 is the TV
guide. This "Plus" version also has Search, On Demand, My Stuff, comments, and
"make this a TV channel", all in the same TV-style menus. You can switch those
extras off for a simpler TV.

This page is for **whoever sets it up**. The viewer only needs the last section,
"Using the remote".

---

## What you need

- An Ubuntu computer (a laptop is fine). It can be plugged into a TV with an HDMI cable.
- Internet.
- **Google Chrome** (best) or Firefox. Ubuntu comes with Firefox already.
- A free YouTube key (step 3 below, about 5 minutes).

---

## 1. Put Channel Surf on the computer (once)

Open **Terminal** (press the Windows/Super key, type `terminal`, press Enter), then
copy and paste these lines one at a time, pressing Enter after each:

```
sudo apt update
sudo apt install -y git python3
cd ~
git clone --branch claude/friendly-thompson-rgqo95 https://github.com/bobross214/websites.git
```

If it asks for a GitHub username and password, the project is private. Do this
instead: on GitHub, open the `bobross214/websites` page, pick the branch
`claude/friendly-thompson-rgqo95`, click the green **Code** button, then
**Download ZIP**. Then run:

```
cd ~/Downloads
unzip websites-claude-friendly-thompson-rgqo95.zip
mv websites-claude-friendly-thompson-rgqo95 ~/websites
```

**Optional but recommended: install Google Chrome.** It handles YouTube and full
screen best:

```
cd ~/Downloads
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
```

## 2. Turn the TV on

This is the one command:

```
python3 ~/websites/channel-surf-plus/tv.py
```

The TV opens full screen. Press the big red button (or any key) to turn it on.
At first you'll see **practice channels**, which are pretend shows so you can
try everything before you connect YouTube.

**To get out of full screen:** press `Alt` + `F4`. That closes the TV and stops
the program too.

**Make a desktop icon** so nobody needs the Terminal again:

```
python3 ~/websites/channel-surf-plus/tv.py --install-shortcut
```

A **Channel Surf** icon appears on the desktop and in the app list. If the
desktop icon shows a little warning, right-click it and choose **Allow Launching**.

Other ways to start it:
- `python3 ~/websites/channel-surf-plus/tv.py --window` opens it in a normal window (handy while setting up).
- `python3 ~/websites/channel-surf-plus/tv.py --no-browser` just starts it. Then open `http://localhost:8642` yourself.

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

## 6. Make it simple for the viewer (optional)

**Setup → What the viewer sees.** Untick **Search YouTube** and **On Demand and
My Stuff** for a plain cable TV: channels, the guide, favorites, settings. You
can also stop the viewer from making new channels.

## 7. Hook it up to the TV

1. Plug the laptop into the TV with an HDMI cable and pick that HDMI input on the TV.
2. **Sound through the TV:** Ubuntu **Settings → Sound → Output Device**, then choose the HDMI / TV one.
3. **Picture on the TV only:** **Settings → Displays**, then choose **Single Display** (the TV), or **Mirror**.
4. **Don't let it fall asleep:** **Settings → Power → Screen Blank: Never**, and turn off **Automatic Suspend** while plugged in.
5. A cheap USB TV-style remote ("air mouse" remote) works. Its arrows, OK, Back, number and volume buttons all do the right thing.

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
| **MENU** | Search, On Demand, My Stuff, Lineup Filters, Settings |
| **SEARCH**, **ON DEMAND**, **LIVE TV** | Straight to those |
| **EXIT** | Close menus and go back to watching |

**Watching something On Demand:** OK pauses and plays. ◀ goes back 10 seconds,
▶ skips ahead 30. CH ▲ ▼ go to the next or previous video in the list. BACK goes
to the list (the video keeps playing in the little window). EXIT or LIVE TV goes
back to regular channels. If you stop partway, it picks up where you left off next time.

**Lineup Filters** (in the menu) change every channel at once, for example
"only shows under 20 minutes" or "only from the past week". The guide changes too.

On a keyboard: arrows, `Enter` = OK, `Backspace` = BACK, `Home` = MENU, `G` guide,
`I` info, `M` mute, `+`/`−` volume, `C` captions, `F` favorites, `S` search,
`P` power, `Page Up`/`Page Down` = channel. In Search, just type.

---

## When something's wrong

| You see | What it means / what to do |
|---|---|
| **Please Stand By** for a moment | A video wouldn't play. The TV skips it and moves on by itself. |
| **No Signal: checking the cable** | The internet is down. It keeps trying by itself. Check the Wi-Fi. |
| **Off the Air** | That channel has nothing to show right now (or its YouTube channel is empty). Try another channel, or check it in Setup. |
| **Press MUTE to turn the sound on** | The browser started without sound. Press MUTE once. |
| **Player setup problem** | It was opened as a file. Start it with the command in step 2 (or the desktop icon). |
| **Daily limit used up** (when searching) | YouTube allows about 90 searches a day on a free key. Searching works again after midnight Pacific time. Channels keep playing. |
| Banner says channels are **"not loaded yet"** in Setup | Wait a minute after adding them, or click **Refresh all channels now**. |

**Forgot the Setup PIN?** With the TV running, open `http://localhost:8642/reset-pin.html`
in the browser and click **Clear the PIN**. Channels and settings stay.

**Moving to another computer, or keeping a backup:** **Setup → Backup and PIN → Save setup to a file.**
On the other computer, use **Load setup from a file**. (The YouTube key comes along.
Add `http://localhost:8642/*` to the key's Websites list if it's a new computer; it already is.)

**Updating to a newer version** (if it was installed with git):

```
cd ~/websites && git pull
```

---

## Privacy

- No sign-in for the viewer. Nothing is sent to anyone except YouTube itself.
- The player is YouTube's privacy-enhanced one (`youtube-nocookie.com`).
- Watch Later, History, Likes and Follows are kept **on this computer only**.
  They don't change anything on anyone's YouTube account. Because of that, the
  YouTube Premium "no ads" perk doesn't apply here, so ads can appear like on
  normal YouTube. Channel Surf never blocks or skips them.
- No tracking or analytics of any kind.

## For the curious: checking it works

There's a set of automatic tests that runs the app against a pretend YouTube
(no internet needed). If you have Node.js and Playwright installed:

```
cd ~/websites/channel-surf-plus
node tests/run-tests.js
```
