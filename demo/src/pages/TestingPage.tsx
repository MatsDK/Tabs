import MarpleExample from '../examples/marple/MarpleExample.js';
import MarpleInlineExample from '../examples/marple-inline/MarpleInlineExample.js';

export default function TestingPage() {
  return (
    <div className="showcase-body">
      <section className="showcase-section">
        <header className="showcase-section-header">
          <span className="showcase-eyebrow">Internal</span>
          <h2>Real app styling, dropdown groups</h2>
          <p>
            Colors, radius, spacing and font pulled directly from marple-insight's own tokens (not approximated). Same
            component as the "Custom visual theme" example on the Examples page — shown here again for side-by-side
            comparison with the inline version below.
          </p>
        </header>
        <div className="showcase-section-body">
          <div className="showcase-marple-frame">
            <MarpleExample />
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <header className="showcase-section-header">
          <span className="showcase-eyebrow">Internal</span>
          <h2>Real app styling, inline groups</h2>
          <p>
            Same real marple-insight tokens as above, but with the inline (Chrome-style) group expansion instead of a
            dropdown. A testing ground, not a curated example — kept off the main Examples page on purpose.
          </p>
        </header>
        <div className="showcase-section-body">
          <div className="showcase-marple-frame">
            <MarpleInlineExample />
          </div>
        </div>
      </section>
    </div>
  );
}
