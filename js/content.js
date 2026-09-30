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
  ],
};
