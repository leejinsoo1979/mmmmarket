import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const allowedRoutes = new Set([
  '/',
  '/collection',
  '/products/Catalogue',
  '/products/catalogue',
  '/products/detail',
  '/inspiration/references',
  '/for-professionals'
]);

function normalizePath(pathname) {
  return pathname.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
}

function resolveRoute(pathname, search = '') {
  const path = normalizePath(pathname);
  const lower = path.toLowerCase();

  if (allowedRoutes.has(path)) {
    return path === '/products/catalogue' ? `/products/Catalogue${search}` : `${path}${search}`;
  }

  if (lower.startsWith('/collection/')) {
    return '/collection';
  }

  if (lower.startsWith('/products/catalogue/')) {
    return `/products/Catalogue${search}`;
  }

  if (lower.startsWith('/products/detail/')) {
    return `${path}${search}`;
  }

  if (lower.startsWith('/inspiration/')) {
    return '/inspiration/references';
  }

  if (lower.startsWith('/for-professionals/')) {
    return '/for-professionals';
  }

  return null;
}

function addHeadNode(node) {
  const key =
    node.tagName === 'LINK'
      ? `link:${node.getAttribute('rel')}:${node.getAttribute('href')}`
      : node.tagName === 'STYLE'
        ? `style:${node.textContent?.slice(0, 80)}`
        : null;

  if (key && document.head.querySelector(`[data-legacy-key="${CSS.escape(key)}"]`)) {
    return;
  }

  const clone = node.cloneNode(true);
  if (key) {
    clone.setAttribute('data-legacy-key', key);
  }
  document.head.appendChild(clone);
}

function addMetaNode(node) {
  const key =
    node.getAttribute('name') ||
    node.getAttribute('property') ||
    node.getAttribute('http-equiv') ||
    node.getAttribute('charset');

  if (!key) {
    return;
  }

  const selector = node.getAttribute('charset')
    ? 'meta[charset]'
    : `meta[name="${CSS.escape(key)}"], meta[property="${CSS.escape(key)}"], meta[http-equiv="${CSS.escape(key)}"]`;

  const existing = document.head.querySelector(selector);
  if (existing) {
    existing.replaceWith(node.cloneNode(true));
  } else {
    document.head.appendChild(node.cloneNode(true));
  }
}

function appendInlineScript(text) {
  const clone = document.createElement('script');
  clone.setAttribute('data-legacy-script', 'true');
  clone.textContent = text;
  document.body.appendChild(clone);
}

function runScript(script) {
  return new Promise((resolve) => {
    const clone = document.createElement('script');

    for (const attribute of script.attributes) {
      if (attribute.name !== 'defer' && attribute.name !== 'async') {
        clone.setAttribute(attribute.name, attribute.value);
      }
    }

    if (script.src) {
      clone.setAttribute('data-legacy-script', 'true');
      clone.onload = resolve;
      clone.onerror = resolve;
      clone.src = script.src;
    } else {
      appendInlineScript(script.textContent);
      resolve();
    }

    if (script.src) {
      document.body.appendChild(clone);
    }
  });
}

function rerunDeferredSliders(scripts) {
  if (typeof window.tinySlider !== 'function') {
    return;
  }

  scripts
    .filter((script) => !script.src && script.textContent?.includes('tinySlider('))
    .forEach((script) => appendInlineScript(script.textContent));
}

function replayLegacyLoadEvents() {
  window.dispatchEvent(new Event('load'));
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('scroll'));
}

export default function LegacyPage({ source }) {
  const [markup, setMarkup] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const cacheKey = useMemo(() => `${source}?react=${Date.now()}`, [source]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setError('');
      setMarkup('');

      try {
        const response = await fetch(cacheKey);
        if (!response.ok) {
          throw new Error(`Failed to load ${source}: ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const scripts = [
          ...Array.from(doc.head.querySelectorAll('script')),
          ...Array.from(doc.body.querySelectorAll('script'))
        ];

        document.title = doc.title || 'FORMANI React Mirror';
        doc.head.querySelectorAll('meta').forEach(addMetaNode);
        doc.head.querySelectorAll('link[rel="stylesheet"], style').forEach(addHeadNode);

        scripts.forEach((script) => script.remove());

        if (!cancelled) {
          setMarkup(doc.body.innerHTML);
          window.scrollTo(0, 0);

          setTimeout(async () => {
            for (const script of scripts) {
              if (cancelled) {
                return;
              }
              await runScript(script);
            }
            if (!cancelled) {
              rerunDeferredSliders(scripts);
              replayLegacyLoadEvents();
            }
          }, 0);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, source]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    function handleClick(event) {
      const link = event.target.closest('a[href]');
      if (!link) {
        return;
      }

      const href = link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const url = new URL(href, window.location.origin);
      const localRoute = url.origin === window.location.origin ? resolveRoute(url.pathname, url.search) : null;

      event.preventDefault();

      if (localRoute) {
        navigate(localRoute);
      }
    }

    function handleProductCardClick(event) {
      const productTarget = event.target.closest('[data-product-id]');
      const productId = productTarget?.getAttribute('data-product-id');

      if (!productId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      navigate(`/products/detail/${encodeURIComponent(productId)}`);
    }

    container.addEventListener('click', handleClick, true);
    container.addEventListener('click', handleProductCardClick, true);
    return () => {
      container.removeEventListener('click', handleClick, true);
      container.removeEventListener('click', handleProductCardClick, true);
    };
  }, [navigate, markup]);

  if (error) {
    return (
      <main className="react-error">
        <h1>Page failed to load</h1>
        <p>{error}</p>
      </main>
    );
  }

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: markup }} />;
}
