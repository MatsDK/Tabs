import PillThemeExample from '../examples/pill-theme/PillThemeExample.js';
import PillThemeInlineExample from '../examples/pill-theme-inline/PillThemeInlineExample.js';

export default function TestingPage() {
  return (
    <div className="showcase-body">
      <section className="showcase-section">
        <div className="showcase-section-body">
          <div className="showcase-theme-frame">
            <PillThemeExample />
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-section-body">
          <div className="showcase-theme-frame">
            <PillThemeInlineExample />
          </div>
        </div>
      </section>
    </div>
  );
}
