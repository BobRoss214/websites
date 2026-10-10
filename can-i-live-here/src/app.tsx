import { route } from './state/router';
import { Topbar } from './ui/Topbar';
import { Footer } from './ui/Footer';
import { Welcome } from './ui/Welcome';
import { Ask } from './ui/Ask';

export function App() {
  const r = route.value;
  let page;
  if (r === '/') page = <Welcome />;
  else if (r.startsWith('/ask')) page = <Ask />;
  else page = <main id="main" className="wrap"><h1>Coming up</h1><p>This page is being built.</p></main>;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Topbar />
      {page}
      <Footer />
    </>
  );
}
