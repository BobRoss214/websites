/*
 * Editable site content.
 *
 * PHOTOS
 * ------
 * Drop image files into assets/photos/ and list them here. As soon as this list
 * has at least one entry, a "Photo gallery" section appears on the page (with a
 * click-to-enlarge viewer) and a "Photos" link is added to the navigation.
 *
 *   { src: "assets/photos/strawberry-field.jpg", alt: "Rows of ripe strawberries", caption: "Spring picking" }
 *
 * `alt` is required (it is read aloud by screen readers); `caption` is optional.
 *
 * OPEN-NOW BADGES, CLOSURES AND THE NOTICE BAR
 * ---------------------------------------------
 * `hours` drives the green "Open now" badges (times are Eastern Time).
 * days: 0 = Sunday ... 6 = Saturday. open/close are 24-hour "HH:MM".
 * `closures` lists dates (YYYY-MM-DD) when a place is closed, for example for rain.
 * `notice` shows a yellow bar under the top bar on every page. Leave it empty
 * ('') to hide it. Add `noticeUntil: '2026-10-05'` to hide it automatically after that date.
 *
 * REVIEWS
 * -------
 * Quotes appear in the "What families say" section once you add them here. Only add words a
 * reviewer really wrote (copy them exactly, or ask first), with where they were posted:
 *
 *   { quote: "Best strawberries we have ever picked.", name: "Sarah M.", source: "Google",
 *     url: "https://...", date: "May 2026" }
 *
 * `lang` is optional (use "es" for a review written in Spanish) so it is never machine-translated.
 *
 * ANALYTICS
 * ---------
 * Off by default. See the top of js/analytics.js for the four supported providers.
 * Nothing is sent until `provider` is set, and never for visitors who opt out.
 *
 * THIS WEEK AT THE FARM  (the green "This week at the farm" box under the top of the page)
 * ---------------------------------------------------------------------------------------
 * It fills itself from today's date (what is normally in season, and what starts soon). To add a
 * note, mark how things are going, or show spots left, fill in `week` below. Everything in `week`
 * stops showing 14 days after `updated`, so old news never lingers. Delete the lines you do not use.
 *
 *   week: {
 *     updated: '2026-10-01',                       // the day you last checked (required)
 *     note: 'Tomatoes are at their best. Bring a bucket!',   // or { en: '...', es: '...' } to write it in each language
 *     crops: { tomatoes: 'peak', pumpkins: 'starting', flowers: 'ending' },
 *               // crop names: strawberries, blueberries, sunflowers, flowers, pumpkins, tomatoes, trees
 *               // how it is going: soon | starting | peak | ending | off   (off hides it)
 *     days: [                                      // "Spots left" table. Only today and the next 14 days show.
 *       { date: '2026-10-02', farm: 'few',  pizza: 'open', note: 'Rain possible' },
 *       { date: '2026-10-03', farm: 'full', pizza: 'full' },
 *     ],                                            // farm and pizza: open | few | full | closed
 *     waitlistEmail: 'cathy@wiseacresorganic.com',  // "Join the waitlist" emails this address
 *     feed: '',                                     // optional: a web address that returns this same shape as JSON
 *   }
 *
 * EMAIL SIGNUP WITH INTERESTS
 * ---------------------------
 * The signup form on the page stays hidden (the old "Join the email list" button shows instead) until you
 * paste your Mailchimp form address into `signup.action`. In Mailchimp: Audience > Signup forms > Embedded forms.
 * Copy the address inside  <form action="...">  . For the interest choices, add the group names from the same
 * embed code, e.g.  interests: { strawberries: 'group[12345][1]', pumpkins: 'group[12345][2]' }.
 *
 * GOOGLE REVIEW LINK
 * ------------------
 * `reviewUrl` is where every "Leave a Google review" button goes. In your Google Business Profile choose
 * "Ask for reviews" (or "Get more reviews") and copy the review link (it looks like https://g.page/r/.../review).
 * Until it is set, the buttons open the farm on Google Maps.
 *
 * VISITOR PHOTOS, ENTRANCE PHOTO
 * ------------------------------
 * `community` fills the "From families who visit" strip in the photo gallery. Only add a photo after the
 * person who took it said yes in writing. `by` is how you credit them; `url` (optional) links to their post.
 *   { src: 'assets/photos/visitors/pumpkin-day.jpg', alt: 'A girl holding a big pumpkin', by: '@name on Instagram', url: 'https://...' }
 * `entrancePhoto` is the picture on the First-visit page that shows where to park and check in.
 *
 * SEASON SWITCHER
 * ---------------
 * The first screen automatically shows whatever season is happening at the farm
 * today (see js/season.js for the dates). While the site is being previewed, a
 * "See the farm in…" switcher lets visitors click between seasons. Set
 * `seasonPicker` to false when the site should simply follow the calendar.
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
  entrancePhoto: null,   // { src: 'assets/photos/entrance.jpg', alt: 'The farm gate and parking on Hartis Road', caption: 'Look for this gate.' }
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
