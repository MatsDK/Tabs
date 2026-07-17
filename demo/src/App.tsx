import { useEffect, useState } from 'react';
import ExamplesPage from './pages/ExamplesPage.js';
import DocsPage from './pages/DocsPage.js';

type Page = 'examples' | 'docs';

function pageFromHash(): Page {
  return window.location.hash.startsWith('#docs') ? 'docs' : 'examples';
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash());

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Page) => {
    window.location.hash = next === 'docs' ? 'docs' : '';
    setPage(next);
  };

  return (
    <div className="demo-root">
      <header className="demo-header">
        <div className="demo-header-logo">
          <span>⬡</span> react-tabstack
        </div>
        <nav className="page-nav" role="tablist" aria-label="Page">
          <button role="tab" aria-selected={page === 'examples'} data-active={page === 'examples' ? '' : undefined} onClick={() => navigate('examples')}>
            Examples
          </button>
          <button role="tab" aria-selected={page === 'docs'} data-active={page === 'docs' ? '' : undefined} onClick={() => navigate('docs')}>
            Docs
          </button>
        </nav>
        <span className="demo-header-desc">Headless, composable Chrome-style tab bars</span>
      </header>
      <main className="demo-body">
        {page === 'examples' ? <ExamplesPage /> : <DocsPage />}
      </main>
    </div>
  );
}
