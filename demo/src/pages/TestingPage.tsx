import MarpleExample from '../examples/marple/MarpleExample.js';
import MarpleInlineExample from '../examples/marple-inline/MarpleInlineExample.js';

export default function TestingPage() {
  return (
    <div className="showcase-body">
      <section className="showcase-section">
        <div className="showcase-section-body">
          <div className="showcase-marple-frame">
            <MarpleExample />
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-section-body">
          <div className="showcase-marple-frame">
            <MarpleInlineExample />
          </div>
        </div>
      </section>
    </div>
  );
}
