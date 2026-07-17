import { useEffect, useState } from 'react';
import ExamplesPage from './pages/ExamplesPage.js';
import DocsPage from './pages/DocsPage.js';
import TestingPage from './pages/TestingPage.js';

type Page = 'examples' | 'docs' | 'testing';

const Logomark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="6" width="4" height="3" rx="1" fill="currentColor" opacity="0.35" />
    <rect x="6" y="3" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="11" y="6" width="4" height="3" rx="1" fill="currentColor" opacity="0.35" />
  </svg>
);

function pageFromHash(): Page {
  const hash = window.location.hash;
  if (hash.startsWith('#docs')) return 'docs';
  if (hash.startsWith('#examples')) return 'examples';
  return 'testing';
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash());

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Page) => {
    window.location.hash = next === 'testing' ? '' : next;
    setPage(next);
  };

  return (
    <div className="demo-root">
      <header className="demo-header">
        <div className="demo-header-logo">
          <Logomark /> react-tabstack
        </div>
        <nav className="page-nav" role="tablist" aria-label="Page">
          <button role="tab" aria-selected={page === 'testing'} data-active={page === 'testing' ? '' : undefined} onClick={() => navigate('testing')}>
            Testing
          </button>
          <button role="tab" aria-selected={page === 'examples'} data-active={page === 'examples' ? '' : undefined} onClick={() => navigate('examples')}>
            Examples
          </button>
          <button role="tab" aria-selected={page === 'docs'} data-active={page === 'docs' ? '' : undefined} onClick={() => navigate('docs')}>
            Docs
          </button>
        </nav>
        <span className="demo-header-desc">Headless tab bars for React</span>
      </header>
      <main className="demo-body">
        {page === 'examples' ? <ExamplesPage /> : page === 'docs' ? <DocsPage /> : <TestingPage />}
      </main>
    </div>
  );
}
