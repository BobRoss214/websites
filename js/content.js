/*
 * THE FARM'S CONTROL PANEL
 * ========================
 * You change words, dates and numbers in this file, and the website follows. You do not need to know how to program.
 *
 * HOW TO EDIT THIS FILE (please read this once)
 * ---------------------------------------------
 *   1. Open it in a plain text program: Notepad on Windows, TextEdit on a Mac (Format > Make Plain Text), or a code editor.
 *      Do NOT use Word, Pages or Google Docs. They turn the straight quote marks into curly ones, and then the page stops working.
 *   2. Before you start, make a copy of this file and keep it somewhere safe. If anything goes wrong, put the copy back.
 *   3. Change only what is between the quote marks, and the numbers and dates. Leave the quote marks, the brackets { } [ ] and the comma
 *      at the end of each line exactly where they are.
 *   4. Write dates as year-month-day, two digits each:  '2026-10-04'  means October 4, 2026. Not 10/4/2026 and not 2026-10-4.
 *   5. An apostrophe inside 'single quotes' breaks the whole file. Put double quotes around the text instead:
 *          notice: "We're closed Saturday for rain.",
 *      (Another way is a backslash in front of the apostrophe:  'We\'re closed Saturday.' )
 *   6. Anything after // on a line is a note for you, and the computer skips it. To switch a line off, put // in front of it.
 *   7. Save the file and look at the website: double-click index.html (or refresh the live page). If a yellow box called "Site check"
 *      shows at the bottom of the page, it says what to fix. If the page looks broken, press Undo (Ctrl+Z, or Cmd+Z on a Mac)
 *      until it works again, or put your copy back. See "Check your changes" in README.md.
 *   8. Saving the file on your computer does not change the live website. Publish the changed file the way you publish the site.
 *      Browsers can keep the old file for up to an hour, so give it a little while (a hard refresh, Ctrl+F5 or Cmd+Shift+R, shows
 *      the new version at once on your own screen).
 *
 * PHOTOS
 * ------
 * The "Photo gallery" section shows every photo listed in `photos` at the bottom of this file. Tap a photo to enlarge it.
 *   1. Put the picture in the folder assets/photos/. Shrink big phone photos first, or the page gets slow.
 *   2. Add one line inside photos: [ ... ], like this:
 *        { src: "assets/photos/strawberry-field.jpg", alt: "Rows of ripe strawberries", caption: "Spring picking" },
 *   `src` must match the file name exactly (capital letters, no spaces). `alt` is a short description for people who cannot see the
 *   picture (a screen reader reads it aloud): write one for every photo. `caption` is optional.
 *   Other languages show your alt and caption in English until Claude adds translations.
 *
 * OPEN-NOW BADGES, CLOSURES AND THE NOTICE BAR
 * --------------------------------------------
 * `hours` drives the green "Open now" badges. Times are Eastern Time on a 24-hour clock: '10:00' is 10 am, '16:00' is 4 pm, '20:00' is 8 pm.
 * `days` are numbers: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday.
 * For `farm` you list the days with reserved visits for each season (spring, summer, fall, winter). A season you leave out shows no farm badge.
 *
 * `closures` is one list of dates when the farm, The GreenHouse and Wise Pie are all shown as closed, or as having no visits (rain, a holiday):
 *       closures: ['2026-10-04', '2026-10-11'],
 *   It does not change Bookeo, so also close those times there. Dates that have passed can stay in the list.
 *
 * `notice` is the yellow bar at the top of every page. '' (two quote marks, nothing between) hides it.
 *       notice: 'Closed Saturday for rain.',
 *       noticeUntil: '2026-10-05',      // optional: the bar disappears after this day by itself
 *   The bar shows in English in every language. To give each language its own words, write:
 *       notice: { en: 'Closed Saturday for rain.', es: 'Cerrado el sábado por la lluvia.', hi: '...', zh: '...', vi: '...' },
 *   A language you leave out shows the English. The Site check box does not check hours, closures or the notice: look at the page yourself.
 *
 * REVIEWS
 * -------
 * The quote cards in the "What families say" section stay hidden until you add one here. The buttons to Google, Tripadvisor and Yelp
 * are always there. Only add words a reviewer really wrote (copy them exactly, or ask first), and say where they were posted:
 *       reviews: [
 *         { quote: "Best strawberries we have ever picked.", name: "Sarah M.", source: "Google", url: "https://...", date: "May 2026" },
 *       ],
 * `quote` and `name` are required (a review without both is skipped). `source`, `url` (a link to the post) and `date` are optional.
 * Add  lang: "es"  to a review that was written in Spanish, so it is never machine-translated.
 *
 * ANALYTICS
 * ---------
 * Off. When it is on, it counts visits and button taps without cookies, and never for visitors who have "Do Not Track" switched on.
 * To turn it on you first sign up with one service (Plausible, GoatCounter, Umami or Cloudflare Web Analytics), then paste what they give you
 * into `analytics` below. The exact lines are at the top of js/analytics.js. Ask Claude to do the pasting.
 *
 * THIS WEEK AT THE FARM  (the light green "This week at the farm" box, just under the first screen of the home page)
 * ---------------------------------------------------------------------------------------------------------------
 * You do not have to do anything: the box fills itself from today's date and lists what is usually in season, and what usually starts
 * in the next three weeks. Those are typical dates. The real dates depend on the weather.
 * When you know better, tell visitors. Find the line  week: {},  near the bottom of this file and replace it with the example below.
 * IT IS ONLY AN EXAMPLE: change every word and date, and delete the lines you do not need.
 *
 *   week: {
 *     updated: '2026-10-01',     // TODAY's date. Required. Change it every time you edit. Everything below disappears 14 days after it.
 *     note: 'Tomatoes are ripe this weekend. Bring a bucket!',     // one short message for families
 *     crops: { tomatoes: 'peak', pumpkins: 'starting', flowers: 'ending' },
 *         // Crop names:  strawberries, blueberries, sunflowers, flowers, pumpkins, tomatoes, trees
 *         // What each word shows:  soon = "Coming soon",  starting = "Just starting",  peak = "Peak picking",
 *         //                        ending = "Winding down",  off = hide that crop
 *         // A crop you do not mention keeps its typical dates.
 *     days: [                    // the "Spots left" table. One line per day. Only today and the next 14 days show.
 *       { date: '2026-10-02', farm: 'few',  pizza: 'open', note: 'Rain possible' },
 *       { date: '2026-10-03', farm: 'full', pizza: 'full' },
 *     ],
 *         // farm = visits without pizza (the "No pizza" column).   pizza = visits with pizza (the "With pizza" column).
 *         // For each:  open = "Spots open",  few = "A few spots left",  full = "Full",  closed = "Closed".  Leave it out to show a dash.
 *         // Buttons: if either column has spots (open or few) the day gets a "Reserve" button. If a day is Full and nothing is open,
 *         // it gets an "Email us to join the waitlist" button. If the farm is closed and pizza is closed or left out, there is no button.
 *     waitlistEmail: 'cathy@wiseacresorganic.com',   // that button opens an email to this address. The family still has to press Send.
 *   },
 *
 *   Only use "full" if someone will read and answer the waitlist emails. Spots are typed in by hand: the page cannot see Bookeo.
 *   To show a note in each language, write it like the notice:  note: { en: '...', es: '...', hi: '...', zh: '...', vi: '...' }
 *   If part of week does not show, the Site check box says why. There is also an advanced option called `feed` that a web developer can
 *   use to connect live Bookeo numbers later. Leave it out.
 *
 * EMAIL SIGNUP (Mailchimp)
 * ------------------------
 * Until this is connected, visitors see a plain "Join the email list" button. After it is connected they see a form: an email box and
 * checkboxes for what they want to hear about (strawberries, blueberries, flowers, pumpkins, tomatoes & basil, Christmas trees, pizza, events).
 * Easiest: in Mailchimp copy ALL the code of your embedded form, paste it to Claude and say "set up the signup form".
 * To do it yourself:
 *   1. In Mailchimp go to Audience, then Signup forms, then Embedded forms. (Mailchimp changes its menus now and then. If you cannot find
 *      them, search Mailchimp Help for "embedded form".)
 *   2. A box of code appears. Find  <form action="  and copy only the long web address between the quote marks after it.
 *      It starts with https:// and has list-manage.com in it. It is fine if it contains &amp;.
 *   3. Paste it between the quote marks:    signup: { action: 'PASTE IT HERE', interests: {}, tags: '' },
 *   4. Save, refresh, and sign up once with your own email address. Mailchimp should send you a confirmation email. After you confirm it,
 *      your address appears in Mailchimp under Audience, then All contacts. If the signup form does not appear, or the Site check box
 *      complains, the address you pasted is wrong.
 *   5. The page tells people "Check your email to confirm your signup". That is only true while Mailchimp asks people to confirm
 *      (Mailchimp calls this "double opt-in"; search Mailchimp Help for it). If you switch it off, tell Claude so the message can be changed.
 * The checkboxes only do something if Mailchimp has a matching group for each. Without that the form still collects email addresses,
 * but the boxes people tick are thrown away. To use them: in Mailchimp create one group (type: checkboxes) for each choice you want to keep,
 * copy the embedded form code again, and find the group lines, which look like  name="group[12345][1]".  Match each choice on the form to its line:
 *       interests: { pumpkins: 'group[12345][1]', trees: 'group[12345][2]' },
 * The choice names you can use: strawberries, blueberries, flowers, pumpkins, tomatoes, trees, pizza, events. A choice you leave out is not sent.
 * If you would rather not use the checkboxes at all, ask Claude to hide them. Leave  tags: ''  empty.
 *
 * GOOGLE REVIEW LINK
 * ------------------
 * `reviewUrl` is where every "Leave a Google review" button goes. Until you set it, those buttons only open the farm on Google Maps
 * (and the printed QR review sign is not made).
 *   1. Sign in to Google with the account that manages the farm's Google Business Profile (business.google.com).
 *   2. Open the farm's profile and choose "Ask for reviews" (it may be called "Get more reviews" or "Share review form").
 *   3. Choose "Copy link". It looks like  https://g.page/r/.../review
 *   4. Paste it between the quote marks:    reviewUrl: 'PASTE IT HERE',
 *   5. Save, refresh, tap "Leave a Google review" on your phone. It should open a box where you can pick stars.
 * If you cannot find the button, ask Claude to build the link for you. The link must start with https:// (the Site check box tells you if it does not).
 *
 * VISITOR PHOTOS
 * --------------
 * `community` is the "From families who visit" row in the photo gallery. Add a photo only after the person who took it said yes in writing
 * (a message or a comment is fine: keep a screenshot).
 *   1. Save the photo in the folder assets/photos/visitors/. It must be a file on this website, not a link to another site.
 *   2. Add one line:
 *        { src: 'assets/photos/visitors/pumpkin-day.jpg', alt: 'A girl holding a big pumpkin', by: '@name on Instagram', url: 'https://...' },
 *      `alt` (required) describes the picture. `by` is the credit people read. `url` (optional, starts with https://) links to their post.
 *   A photo missing its src or alt is skipped, and the Site check box says so. These words are not translated.
 *
 * ENTRANCE PHOTO
 * --------------
 * `entrancePhoto` is the picture on the First-visit page that shows where to park and check in. It stays hidden until you fill it in.
 * Change  entrancePhoto: null,  to the line below, with your own file and words:
 *       entrancePhoto: { src: 'assets/photos/entrance.jpg', alt: 'What the photo shows', caption: 'A short line that helps people find the entrance' },
 * `alt` is required. Describe only what is really in the picture. `alt` and `caption` can also be written { en: '...', es: '...' } like the notice.
 *
 * DRIVE TIME FROM A VISITOR'S ADDRESS
 * -----------------------------------
 * The "Drive time" box in the Contact section lets a visitor type an address and see the miles and minutes to the farm.
 * It finds the farm by its address with the free OpenStreetMap search. Optional: give the exact spot instead, so the farm is never searched for.
 * On Google Maps, right-click the farm and click the two numbers at the top of the menu to copy them. Then change  farmPoint: null,  to
 *       farmPoint: { lat: 00.0000, lon: -00.0000 },     (your own two numbers, not these)
 * The visitor's address is sent to OpenStreetMap only when they press the button, and this website does not keep it.
 *
 * SEASON SWITCHER
 * ---------------
 * The first screen shows whatever season is happening at the farm today (the dates are in js/season.js; ask Claude to change them).
 * While the site is being previewed, a "See the farm in..." switcher lets people click between seasons. Set `seasonPicker` to false
 * when the site should simply follow the calendar.
 */
window.WISE_ACRES = {
  seasonPicker: true,
  reviews: [],
  analytics: { provider: 'none' },
  notice: '',
  noticeUntil: '',
  closures: [],
  hours: {
    greenhouse: { days: [5, 6, 0], open: '10:00', close: '20:00' },   // Fri-Sun, 10 am-8 pm
    pizza:      { days: [5, 6, 0], open: '16:00', close: '20:00' },   // Wise Pie at The GreenHouse, 4-8 pm
    farm:       { fall: [4, 5, 6, 0] },                               // reserved visits Thu-Sun in fall
  },
  week: {},
  signup: { action: '', interests: {}, tags: '' },
  reviewUrl: '',
  community: [],
  farmPoint: null,   // optional exact spot of the farm for the Drive time box; see DRIVE TIME above
  entrancePhoto: null,   // example: { src: 'assets/photos/entrance.jpg', alt: 'What the photo shows', caption: 'A short line that helps people find the entrance' }
  photos: [
    { src: "assets/photos/family-sunflower-field.webp",
      alt: "The Wise Acres family hugging and smiling in a field of sunflowers",
      caption: "The Wise Acres family in the sunflower field" },
    { src: "assets/photos/family-strawberry-field-red-barn.webp",
      alt: "A family kneeling in a strawberry field holding fresh berries, with the red farm barn and an orange tractor behind them",
      caption: "Strawberry season at the farm" },
    { src: "assets/photos/wildflower-field-cosmos.webp",
      alt: "A wildflower field of pink cosmos, yellow sunflowers and orange marigolds",
      caption: "The wildflower field" },
    { src: "assets/photos/zinnia-and-sunflower-fields.webp",
      alt: "Rows of colorful zinnias in front of a big field of sunflowers under a blue sky",
      caption: "Zinnias and sunflowers" },
    { src: "assets/photos/sunflowers-closeup.webp",
      alt: "Bright yellow-orange sunflowers in bloom on a cloudy evening",
      caption: "Sunflowers" },
    { src: "assets/photos/poppies-and-larkspur-field.webp",
      alt: "Red poppies and purple larkspur blooming in a wildflower field",
      caption: "Poppies & larkspur" },
    { src: "assets/photos/sunflower-bouquets-be-kind-sign.webp",
      alt: "Buckets of fresh-cut sunflowers and mixed flowers in front of a sign that says be kind",
      caption: "Fresh-cut bouquets" },
    { src: "assets/photos/strawberries-in-pink-bucket.webp",
      alt: "A pink bucket piled high with fresh-picked strawberries",
      caption: "Fresh-picked strawberries" },
    { src: "assets/photos/strawberries-and-blueberries-in-pints.webp",
      alt: "Two green pint boxes, one of strawberries and one of blueberries",
      caption: "Strawberries & blueberries" },
    { src: "assets/photos/sunflowers-and-bowl-of-blueberries.webp",
      alt: "A sunflower field at dusk with a bowl of fresh blueberries in the foreground",
      caption: "Blueberries & sunflowers" },
    { src: "assets/photos/sunflower-field-chairs-and-blueberries.webp",
      alt: "Two white chairs facing a sunflower field at dusk, with a bowl of blueberries and a sunflower on a table",
      caption: "Sunflower field at dusk" },
    { src: "assets/photos/sunflowers-and-pumpkins-by-the-fire.webp",
      alt: "A bucket of sunflowers and two pumpkins beside a crackling fire pit",
      caption: "Pumpkins by the fire" },
    { src: "assets/photos/mums-and-red-shed.webp",
      alt: "Rows of pink, orange and yellow mums in pots beside a little red shed",
      caption: "Fall mums" },
    { src: "assets/photos/wise-pie-pizza-and-drinks.webp",
      alt: "A pepperoni pizza in a box with local drinks on a picnic table, with the farm and playground behind",
      caption: "Pizza, drinks and the playground" },
    { src: "assets/photos/black-goat-cucumber.webp",
      alt: "A black goat nibbling a cucumber through the fence",
      caption: "Snack time" },
    { src: "assets/photos/goats-rubs-sign.webp",
      alt: "Goats behind a hand-painted sign reading rubs make us happy, corn makes us sick",
      caption: "Rubs make us happy" },
    { src: "assets/photos/baby-goat-under-heat-lamp.webp",
      alt: "A sleepy baby goat resting in straw under a heat lamp",
      caption: "Baby goat" },
    { src: "assets/photos/goat-with-pumpkins.webp",
      alt: "A baby goat sniffing small pumpkins in the grass",
      caption: "Goat meets pumpkins" },
  ],
};
