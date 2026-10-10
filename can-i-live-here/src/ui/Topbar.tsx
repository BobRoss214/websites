import { route, href } from '../state/router';
import { theme, cycleTheme } from '../state/theme';

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--pine)" />
      <path d="M12 40c8-10 14-14 20-14s12 4 20 14" fill="none" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 48c6-6 9-8 14-8s8 2 14 8" fill="none" stroke="var(--straw)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="18" r="5" fill="var(--bg)" />
    </svg>
  );
}

export function Topbar() {
  const r = route.value;
  const is = (p: string) => (r === p || (p !== '/' && r.startsWith(p)) ? 'page' : undefined);
  const label = theme.value === 'system' ? 'Theme: auto' : theme.value === 'light' ? 'Theme: light' : 'Theme: dark';
  return (
    <header className="wrap topbar">
      <a className="brand" href={href('/')} aria-label="Can I Live Here? home">
        <Logo />
        <span>Can I Live Here?</span>
      </a>
      <nav className="nav" aria-label="Main">
        <a href={href('/ask')} aria-current={is('/ask')}>Questions</a>
        <a href={href('/results')} aria-current={is('/results')}>Results</a>
        <a href={href('/check')} aria-current={is('/check')}><span className="long">Check a listing</span><span className="short">Listing</span></a>
        <button type="button" className="theme-btn" onClick={cycleTheme} aria-label={`${label}. Switch theme`} title={label}>
          {theme.value === 'dark' ? '☾' : theme.value === 'light' ? '☀' : '◐'}
        </button>
      </nav>
    </header>
  );
}
