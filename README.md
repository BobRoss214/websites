# Wise Acres Organic Farm — website redesign

A colorful, illustrated, interactive redesign of the Wise Acres Organic Farm site (Indian Trail, NC).
Plain HTML + CSS + vanilla JavaScript — no build step, no dependencies, works offline.

```
index.html          the page (content + inline SVG illustration library)
css/styles.css      design system + layout
js/main.js          interactions (scroll effects, picking game, seasons, bouquet…)
js/content.js       editable content: the photo list (see below)
assets/fonts/       Fredoka, Nunito, Caveat (SIL Open Font License), self-hosted
assets/photos/      put farm photos here
assets/favicon.svg
```

Preview locally: open `index.html`, or run `python3 -m http.server` and visit http://localhost:8000.

## ⚠️ What still needs real content

This redesign was built in an environment whose network policy blocked `wiseacresorganic.com`
(and Facebook, Yelp, TripAdvisor, local directories), so **the original photos and exact wording
could not be copied**. Only web-search summaries were available. What that means:

| Area | Status |
| --- | --- |
| **Photos** | None yet. The page is illustrated instead. Add real photos via `js/content.js` (below). |
| **Address, phone, email, Instagram, seasons, pizza-reservation timing, GreenHouse** | Taken from search results of the official site/socials. Please proofread. |
| **Prices & hours** | Deliberately **left out** — third-party listings disagreed with each other. Add from the original site. |
| **Reserve button** | All "Reserve" buttons point to `https://www.wiseacresorganic.com/` as a placeholder. Search/replace that URL with the real booking link. |
| **Facebook link** | `facebook.com/wiseacresnc` — sources conflicted; confirm it is the official page. |
| **"More" links** (FAQ, Parties, Dining, Flowers, About) | Link to the existing pages on the original site. If this new site replaces that domain, build those pages or update the links. |
| **"Family owned since 2013"** | From a search summary; confirm. |

## Adding photos

1. Copy the images into `assets/photos/`.
2. List them in `js/content.js`:

   ```js
   photos: [
     { src: "assets/photos/strawberry-field.jpg", alt: "Rows of ripe strawberries", caption: "Spring picking" },
   ],
   ```

A **Photo gallery** section (with click-to-enlarge viewer) and a "Photos" nav link appear automatically
once the list has at least one entry. `alt` text is required for accessibility.

## What's interactive

- **Hero** — parallax hills, swaying sunflowers, drifting clouds, butterflies, a bee that follows the
  cursor (wanders on touch), and a strawberry field you can pick from (with a basket counter and a
  keyboard/touch-friendly "Pick a strawberry" button).
- **Growing vine** under the header shows scroll progress.
- **Plan your visit** — a tractor drives along a road as you scroll and checks off the three steps.
- **What's in season** — tabs (keyboard accessible) with animated scenes; the current season is
  detected from today's date and badged "Happening now" (dates are typical, weather dependent).
- **Flowers** — a build-your-own-bouquet toy.
- Goat you can tap, flowers/crops that grow along section edges, FAQ accordion.
- Mobile: hamburger menu and a sticky **Reserve / Call / Directions** bar.

Everything respects `prefers-reduced-motion`, works without JavaScript (content and links), and is
keyboard navigable.

## Notes

- Colors, fonts and spacing live in the `:root` tokens at the top of `css/styles.css`.
- Illustrations are an inline SVG sprite at the bottom of `index.html` (`<symbol id="strawberry">` etc.).
- The "USDA Certified Organic" chip is plain text, not the official USDA seal.
