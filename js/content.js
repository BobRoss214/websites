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
 * SEASON SWITCHER
 * ---------------
 * The first screen automatically shows whatever season is happening at the farm
 * today (see js/season.js for the dates). While the site is being previewed, a
 * "See the farm in…" switcher lets visitors click between seasons. Set
 * `seasonPicker` to false when the site should simply follow the calendar.
 */
window.WISE_ACRES = {
  seasonPicker: true,
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
