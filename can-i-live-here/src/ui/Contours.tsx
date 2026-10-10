/** Survey-map contour lines: the one decorative motif on the site. Pure SVG, no network. */
export function Contours({ className = '', stroke = 'currentColor' }: { className?: string; stroke?: string }) {
  const paths = [
    'M-20 120 C 120 60, 260 180, 420 110 S 700 40, 900 130',
    'M-20 160 C 140 100, 280 220, 440 150 S 720 80, 920 170',
    'M-20 200 C 160 140, 300 260, 460 190 S 740 120, 940 210',
    'M-20 240 C 180 180, 320 300, 480 230 S 760 160, 960 250',
    'M-20 280 C 200 220, 340 340, 500 270 S 780 200, 980 290',
    'M-20 320 C 220 260, 360 380, 520 310 S 800 240, 1000 330',
    'M-20 80 C 100 20, 240 140, 400 70 S 680 0, 880 90',
    'M-20 40 C 80 -20, 220 100, 380 30 S 660 -40, 860 50',
  ];
  return (
    <svg className={className} viewBox="0 0 900 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={i % 3 === 0 ? 1.6 : 0.9} strokeLinecap="round" />
      ))}
    </svg>
  );
}
