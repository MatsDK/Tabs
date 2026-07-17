import MarpleInlineExample from '../examples/marple-inline/MarpleInlineExample.js';

export default function TestingPage() {
  return (
    <div className="showcase-body">
      <section className="showcase-section">
        <header className="showcase-section-header">
          <span className="showcase-eyebrow">Internal</span>
          <h2>Real app styling, inline groups</h2>
          <p>
            Colors, radius, spacing and font pulled directly from marple-insight's own tokens (not approximated) — the same
            visual theme as the "Custom visual theme" example, but with the inline (Chrome-style) group expansion instead of
            a dropdown. A testing ground, not a curated example — kept off the main Examples page on purpose.
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
