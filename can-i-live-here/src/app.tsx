import { route, match } from './state/router';
import { Topbar } from './ui/Topbar';
import { Footer } from './ui/Footer';
import { Welcome } from './ui/Welcome';
import { Ask } from './ui/Ask';
import { Results } from './ui/Results';
import { Place } from './ui/Place';
import { Check } from './ui/Check';
import { About } from './ui/About';

export function App() {
  const r = route.value;
  let page;
  const placeM = match(r, '/place/:id');
  if (r === '/') page = <Welcome />;
  else if (r.startsWith('/ask')) page = <Ask />;
  else if (r.startsWith('/results')) page = <Results />;
  else if (placeM) page = <Place id={placeM.id!} />;
  else if (r.startsWith('/check')) page = <Check />;
  else if (r.startsWith('/about') || r.startsWith('/privacy')) page = <About />;
  else page = <main id="main" className="wrap"><h1>That page doesn't exist</h1><p><a href="#/">Back to the start</a></p></main>;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Topbar />
      {page}
      <Footer />
    </>
  );
}
