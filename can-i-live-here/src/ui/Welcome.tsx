import { href } from '../state/router';
import { Contours } from './Contours';

export function Welcome() {
  return (
    <main id="main" className="wrap">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <Contours stroke="var(--line-strong)" />
        </div>
        <h1>Where in the Carolinas can you actually afford to live?</h1>
        <p className="lede">
          Answer a few plain questions and get a straight answer: which counties, towns and ZIP codes fit your money, whether
          you want to rent, buy a house, or buy land and build.
        </p>
        <div className="btn-row">
          <a className="btn btn-lg" href={href('/ask')}>Let's find out</a>
          <a className="btn btn-lg btn-quiet" href={href('/results')}>Just show me the map</a>
        </div>
        <p className="small" style="margin-top:1rem">Takes about two minutes. Every question can be skipped. Nothing you type leaves your phone.</p>
      </section>

      <section className="three" aria-label="What you get">
        <div className="panel">
          <h3>A straight verdict</h3>
          <p>Yes, stretch, or not yet, with the one next step that changes it: pay off a card, save a bit longer, look one county east.</p>
        </div>
        <div className="panel">
          <h3>Real places, ranked</h3>
          <p>Every county, city, town and ZIP in North and South Carolina, shaded on a map by how well it fits you.</p>
        </div>
        <div className="panel">
          <h3>Land, taken seriously</h3>
          <p>Price per acre, land loans, septic, wells, driveways, power, and build costs, with soil, flood and wooded-land filters.</p>
        </div>
      </section>
    </main>
  );
}
