import { useState } from 'react';
import DefaultExample from './examples/default/DefaultExample.js';
import MarpleExample from './examples/marple/MarpleExample.js';

const EXAMPLES = {
  default: { label: 'Default', description: 'Headless-first styling, orientation toggle, full context menus', render: () => <DefaultExample /> },
  marple: { label: 'Marple Insight', description: 'Visual parity check against a real consumer app’s tab bar', render: () => <MarpleExample /> },
} as const;

type ExampleKey = keyof typeof EXAMPLES;

export default function App() {
  const [example, setExample] = useState<ExampleKey>('default');

  return (
    <div className="demo-root">
      <header className="demo-header">
        <div className="demo-header-logo">
          <span>⬡</span> react-tabstack
          <span className="demo-header-logo-badge">MVP</span>
        </div>
        <nav className="example-switcher" role="tablist" aria-label="Example">
          {(Object.keys(EXAMPLES) as ExampleKey[]).map((key) => (
            <button
              key={key} role="tab" aria-selected={example === key}
              className="example-switcher-btn" data-active={example === key ? '' : undefined}
              onClick={() => setExample(key)}
            >
              {EXAMPLES[key].label}
            </button>
          ))}
        </nav>
        <span className="demo-header-desc">{EXAMPLES[example].description}</span>
      </header>
      <main className="demo-body">
        {EXAMPLES[example].render()}
      </main>
    </div>
  );
}
