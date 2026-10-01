// Shared handles, filled in by main.js, so modules can reach each other
// without importing in circles.
export const app = { tv: null, screen: null, guide: null, pages: {} };

// Where the picture goes (the TV screen is laid out at 1600 x 900).
export const RECT = {
  full: { x: 0, y: 0, w: 1600, h: 900 },
  squeeze: { x: 200, y: 0, w: 1200, h: 675 },
  guide: { x: 1034, y: 78, w: 524, h: 300 },
  menu: { x: 960, y: 122, w: 600, h: 338 },
};
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
