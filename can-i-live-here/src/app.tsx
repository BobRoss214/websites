import { route, match } from './state/router';
import { Topbar } from './ui/Topbar';
import { Footer } from './ui/Footer';
import { Welcome } from './ui/Welcome';
import { Ask } from './ui/Ask';
import { Results } from './ui/Results';
import { Place } from './ui/Place';

export function App() {
  const r = route.value;
  let page;
  const placeM = match(r, '/place/:id');
  if (r === '/') page = <Welcome />;
  else if (r.startsWith('/ask')) page = <Ask />;
  else if (r.startsWith('/results')) page = <Results />;
  else if (placeM) page = <Place id={placeM.id!} />;
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
