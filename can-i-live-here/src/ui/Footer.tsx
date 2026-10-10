import { href } from '../state/router';

export function Footer() {
  return (
    <footer className="wrap footer">
      <p>
        <strong>This is an estimate, not a loan approval or financial advice.</strong> Real lenders look at more than math, and
        every number here comes with a tap-to-see source or is labeled as an estimate.
      </p>
      <p>
        Free. No ads, no accounts, no tracking. What you type stays in your browser.{' '}
        <a href={href('/about')}>How this works and where the data comes from</a> · <a href={href('/privacy')}>Privacy</a>
      </p>
    </footer>
  );
}
