import { useLayoutEffect, useState } from 'react';
import './BrandStoryFrame.css';
import { holdAppBoot, releaseAppBootBeforePaint } from '../utils/appBoot.js';

export default function BrandStoryFrame() {
  const [isLoaded, setIsLoaded] = useState(false);

  useLayoutEffect(() => {
    holdAppBoot();
  }, []);

  useLayoutEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    return releaseAppBootBeforePaint();
  }, [isLoaded]);

  // The embedded brand-story page is a Next.js app: its <Link> intercepts clicks
  // and routes inside the iframe. To make the header logo go to the main site,
  // attach a capture-phase listener (runs before Next's handler) that navigates
  // the top window to home instead.
  const handleLoad = (e) => {
    try {
      const doc = e.target.contentDocument;
      if (!doc) return;
      // Delegate on the document (capture phase) so it survives any
      // hydration/re-render that replaces the <a class="brandmark"> node.
      doc.addEventListener(
        'click',
        (ev) => {
          const a = ev.target.closest && ev.target.closest('a.brandmark');
          if (!a) return;
          ev.preventDefault();
          ev.stopPropagation();
          window.location.assign('/');
        },
        true
      );
    } catch (_) {
      /* cross-origin or not ready — ignore */
    }

    setIsLoaded(true);
  };

  return (
    <main className="brand-story-frame">
      <iframe
        src="/brand-story/index.html"
        title="made make material brand story"
        onLoad={handleLoad}
      />
    </main>
  );
}
