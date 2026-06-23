import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { holdAppBoot, releaseAppBootBeforePaint } from '../utils/appBoot.js';

const allowedRoutes = new Set([
  '/',
  '/collection',
  '/products/Catalogue',
  '/products/catalogue',
  '/products/detail',
  '/inspiration/references',
  '/for-professionals',
  '/about-us/brand-story',
  '/about-us/contact',
  '/about-us/points-sale'
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
    return document.head.querySelector(`[data-legacy-key="${CSS.escape(key)}"]`);
  }

  const clone = node.cloneNode(true);
  if (key) {
    clone.setAttribute('data-legacy-key', key);
  }
  document.head.appendChild(clone);
  return clone;
}

function isStylesheetReady(node) {
  try {
    if (!node.sheet) {
      return false;
    }

    void node.sheet.cssRules;
    return true;
  } catch {
    return false;
  }
}

function waitForStylesheet(node) {
  if (node.tagName !== 'LINK' || !node.href || node.rel.toLowerCase() !== 'stylesheet') {
    return Promise.resolve();
  }

  const stylesheetUrl = new URL(node.href, window.location.href);
  if (stylesheetUrl.origin !== window.location.origin) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    function done() {
      if (!settled) {
        settled = true;
        window.clearInterval(poll);
        node.removeEventListener('load', done);
        node.removeEventListener('error', done);
        resolve();
      }
    }

    const poll = window.setInterval(() => {
      if (isStylesheetReady(node)) {
        done();
      }
    }, 50);

    if (isStylesheetReady(node)) {
      done();
      return;
    }

    node.addEventListener('load', done, { once: true });
    node.addEventListener('error', done, { once: true });
  });
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

function getSliderContainers(text = '') {
  return Array.from(text.matchAll(/container:\s*['"`]([^'"`]+)['"`]/g), (match) => match[1]);
}

function needsSliderInit(selector) {
  const element = document.querySelector(selector);
  return Boolean(element && !element.classList.contains('tns-slider') && !element.closest('.tns-outer'));
}

function scheduleDeferredSliders(scripts) {
  const sliderScripts = scripts
    .filter((script) => !script.src && script.textContent?.includes('tinySlider('))
    .map((script) => ({
      text: script.textContent,
      containers: getSliderContainers(script.textContent)
    }));

  if (!sliderScripts.length) {
    return;
  }

  let attempts = 0;

  function runPending() {
    attempts += 1;

    if (typeof window.tinySlider !== 'function') {
      if (attempts < 20) {
        window.setTimeout(runPending, 100);
      }
      return;
    }

    sliderScripts.forEach(({ text, containers }) => {
      if (!containers.length || containers.some(needsSliderInit)) {
        appendInlineScript(text);
      }
    });

    if (attempts < 5 && sliderScripts.some(({ containers }) => containers.some(needsSliderInit))) {
      window.setTimeout(runPending, 150);
    }
  }

  runPending();
}

function replayLegacyLoadEvents() {
  window.dispatchEvent(new Event('load'));
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('scroll'));
}

export default function LegacyPage({ source }) {
  const [markup, setMarkup] = useState('');
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const cacheKey = useMemo(() => `${source}?react=${Date.now()}`, [source]);

  useLayoutEffect(() => {
    holdAppBoot();
    setIsReady(false);
  }, [source]);

  useLayoutEffect(() => {
    if (!isReady && !error) {
      return undefined;
    }

    return releaseAppBootBeforePaint();
  }, [error, isReady]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      holdAppBoot();
      setError('');
      setMarkup('');
      setIsReady(false);

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
        const styleNodes = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"], style'), addHeadNode).filter(Boolean);
        await Promise.all(styleNodes.map(waitForStylesheet));

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
              scheduleDeferredSliders(scripts);
              replayLegacyLoadEvents();
              setIsReady(true);
            }
          }, 0);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
          setIsReady(true);
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
