/* made make material — Quote (견적서) widget
   Replaces the catalogue Search/Filters (Vue) left panel with a quote builder.
   Prices are shown in KRW (₩). Data fields: p = 공급가(VAT 별도), pi = VAT 포함가. */
(function () {
  'use strict';
  var ITEMS_KEY = 'mmm_quote_items';
  var ORDERS_KEY = 'mmm_quote_orders';
  var SETTINGS_KEY = 'mmm_site_settings';
  var OVERLAY_KEY = 'mmm_admin_overlay';

  /* 관리자 페이지(/admin)에서 저장한 설정이 있으면 우선 적용 */
  var SETTINGS = {};
  try { SETTINGS = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { SETTINGS = {}; }
  var RATE = Number(SETTINGS.rate) > 0 ? Number(SETTINGS.rate) : 1500;  // base price → ₩ multiplier
  var ORDER_EMAIL = SETTINGS.orderEmail || 'contact@mmm.com';
  var NOTICE = (SETTINGS.notice || '').trim();

  var PRODUCTS = [], BYID = {};
  var items = [];                    // [{id, qty}]
  var cartCaptureInstalled = false;

  try { items = JSON.parse(localStorage.getItem(ITEMS_KEY)) || []; } catch (e) { items = []; }

  function save() { localStorage.setItem(ITEMS_KEY, JSON.stringify(items)); }
  function won(v) { return Math.round(v * RATE); }                // ₩ (no currency symbol but ₩ shown)
  function fmt(n) { return '₩' + Math.round(n).toLocaleString('ko-KR'); }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function attrEsc(s) { return esc(s).replace(/'/g, '&#39;'); }

  /* 관리자 페이지에서 수정/추가/삭제한 상품(오버레이)을 원본 목록 위에 반영 */
  function applyAdminOverlay(list) {
    try {
      var ov = JSON.parse(localStorage.getItem(OVERLAY_KEY)) || {};
      var edits = ov.edits || {}, added = ov.added || [];
      var deleted = {};
      (ov.deleted || []).forEach(function (id) { deleted[id] = true; });
      var out = [];
      list.forEach(function (p) {
        if (deleted[p.id]) return;
        var e = edits[p.id];
        if (e) {
          var merged = {};
          for (var k in p) merged[k] = p[k];
          for (var j in e) if (e[j] != null && e[j] !== '') merged[j] = e[j];
          out.push(merged);
        } else {
          out.push(p);
        }
      });
      added.forEach(function (a) { out.push(a); });
      return out;
    } catch (e) { return list; }
  }

  fetch('/zl/quote-products.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { PRODUCTS = applyAdminOverlay(d); PRODUCTS.forEach(function (p) { BYID[p.id] = p; }); mount(); })
    .catch(function () { /* index missing — stay silent */ });

  function mount() {
    var tries = 0;
    var iv = setInterval(function () {
      var lp = document.querySelector('.collection-search-app__left-panel');
      if (lp) {
        clearInterval(iv);
        lp.classList.add('mmm-quote-host');
        ensureHost(lp);
        new MutationObserver(function () {
          if (!document.getElementById('mmm-quote')) ensureHost(lp);
        }).observe(lp, { childList: true });
      } else if (++tries > 60) {
        clearInterval(iv);
      }
    }, 250);
  }

  function ensureHost(lp) {
    if (document.getElementById('mmm-quote')) return;
    var host = document.createElement('div');
    host.id = 'mmm-quote';
    lp.appendChild(host);
    buildUI(host);
  }

  var els = {};
  function buildUI(host) {
    host.innerHTML =
      (NOTICE ? '<div class="q-notice">' + esc(NOTICE) + '</div>' : '') +
      '<div class="q-title">Estimate</div>' +
      '<div class="q-sub">제품을 검색해 담으면 수량·금액이 자동 계산됩니다. (VAT 포함, ₩)</div>' +
      '<div class="q-search"><input type="text" id="q-search" placeholder="제품명 · 코드 · 마감 검색…" autocomplete="off">' +
      '<div class="q-results" id="q-results"></div></div>' +
      '<div class="q-items" id="q-items"></div>' +
      '<div class="q-totals" id="q-totals"></div>' +
      '<div class="q-actions"><button class="q-order" id="q-order">주문하기</button></div>';

    els.search = host.querySelector('#q-search');
    els.results = host.querySelector('#q-results');
    els.items = host.querySelector('#q-items');
    els.totals = host.querySelector('#q-totals');

    els.search.addEventListener('input', function () { doSearch(els.search.value); });
    els.search.addEventListener('focus', function () { if (els.search.value) doSearch(els.search.value); });
    document.addEventListener('click', function (e) {
      if (!els.results.contains(e.target) && e.target !== els.search) els.results.classList.remove('open');
    });
    host.querySelector('#q-order').addEventListener('click', orderQuote);
    installCatalogueCartCapture();
    renderItems();
  }

  function doSearch(q) {
    q = clean(q).toLowerCase();
    if (!q) { els.results.classList.remove('open'); return; }
    var toks = q.split(' ').filter(Boolean);
    var out = [], i, p, hay, j, ok;
    for (i = 0; i < PRODUCTS.length && out.length < 40; i++) {
      p = PRODUCTS[i];
      hay = (p.id + ' ' + p.n + ' ' + p.f + ' ' + p.c).toLowerCase();
      ok = true;
      for (j = 0; j < toks.length; j++) { if (hay.indexOf(toks[j]) === -1) { ok = false; break; } }
      if (ok) out.push(p);
    }
    if (!out.length) { els.results.innerHTML = '<div class="q-empty">검색 결과가 없습니다</div>'; els.results.classList.add('open'); return; }
    els.results.innerHTML = out.map(function (p) {
      return '<div class="q-res" data-id="' + esc(p.id) + '">' +
        '<div><div class="q-res-n">' + esc(p.n || p.id) + '</div>' +
        '<div class="q-res-meta">' + esc(clean(p.c)) + (p.f ? ' · ' + esc(p.f) : '') + ' · ' + esc(p.id) + '</div></div>' +
        '<div class="q-res-p">' + fmt(won(p.p)) + '</div></div>';
    }).join('');
    els.results.classList.add('open');
    Array.prototype.forEach.call(els.results.querySelectorAll('.q-res'), function (r) {
      r.addEventListener('click', function () { addItem(r.getAttribute('data-id')); });
    });
  }

  function findProductCard(node) {
    if (node.closest) {
      var card = node.closest('.product-group__item');
      if (card && card.querySelector('a[data-product-id]')) return card;
    }

    while (node && node !== document) {
      if (node.querySelector && node.querySelector('a[data-product-id]')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function getProductImageFromCard(card) {
    var img = card && card.querySelector('a[data-product-id] img, img');
    if (!img) return '';
    return img.currentSrc || img.src || img.getAttribute('src') || '';
  }

  function installCatalogueCartCapture() {
    if (cartCaptureInstalled) return;
    cartCaptureInstalled = true;
    document.addEventListener('click', function (e) {
      var icon = e.target.closest && e.target.closest('.wishlist-item-icon');
      if (!icon || icon.classList.contains('wishlist-item-icon__detailpage')) return;

      var card = findProductCard(icon);
      var link = card && card.querySelector('a[data-product-id]');
      var id = link && link.getAttribute('data-product-id');
      if (!id || !BYID[id]) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      addItem(id, { img: getProductImageFromCard(card) });
    }, true);
  }

  function addItem(id, meta) {
    var ex = items.filter(function (it) { return it.id === id; })[0];
    if (ex) {
      ex.qty++;
      if (meta && meta.img && !ex.img) ex.img = meta.img;
    } else {
      items.push({ id: id, qty: 1, img: meta && meta.img ? meta.img : '' });
    }
    save();
    if (els.search) els.search.value = '';
    if (els.results) els.results.classList.remove('open');
    renderItems();
  }
  function setQty(id, q) {
    q = Math.max(1, parseInt(q, 10) || 1);
    items.forEach(function (it) { if (it.id === id) it.qty = q; });
    save(); renderItems();
  }
  function removeItem(id) { items = items.filter(function (it) { return it.id !== id; }); save(); renderItems(); }

  function totals() {
    var net = 0;
    items.forEach(function (it) {
      var p = BYID[it.id]; if (!p) return;
      net += won(p.p) * it.qty;        // 공급가 (₩, VAT 별도)
    });
    var vat = Math.round(net * 0.10);  // 한국 부가세 10%
    return { net: net, vat: vat, gross: net + vat };
  }

  function renderItems() {
    if (!items.length) {
      els.items.innerHTML = '<div class="q-none">담은 제품이 없습니다.<br>위에서 제품을 검색해 추가하세요.</div>';
      els.totals.innerHTML = '';
      return;
    }
    els.items.innerHTML = items.map(function (it) {
      var p = BYID[it.id]; if (!p) return '';
      var amt = won(p.p) * it.qty;
      var img = it.img || p.img || p.image || '';
      return '<div class="q-item" data-id="' + esc(it.id) + '">' +
        '<div class="q-i-img">' + (img ? '<img src="' + attrEsc(img) + '" alt="' + attrEsc(p.n || p.id) + '" loading="lazy">' : '') + '</div>' +
        '<div class="q-i-main">' +
        '<div class="q-i-n">' + esc(p.n || p.id) + '</div>' +
        '<div class="q-i-f">' + esc(clean(p.c)) + (p.f ? ' · ' + esc(p.f) : '') + ' · ' + esc(p.id) + '</div>' +
        '<div class="q-i-ctl"><div class="q-qty">' +
        '<button data-act="dec">−</button><input type="number" min="1" value="' + it.qty + '">' +
        '<button data-act="inc">+</button></div>' +
        '<button class="q-i-rm" data-act="rm">삭제</button>' +
        '<span class="q-i-amt">' + fmt(amt) + '</span></div></div></div>';
    }).join('');

    Array.prototype.forEach.call(els.items.querySelectorAll('.q-item'), function (row) {
      var id = row.getAttribute('data-id');
      var it = items.filter(function (x) { return x.id === id; })[0];
      row.querySelector('[data-act="dec"]').addEventListener('click', function () { setQty(id, it.qty - 1); });
      row.querySelector('[data-act="inc"]').addEventListener('click', function () { setQty(id, it.qty + 1); });
      row.querySelector('[data-act="rm"]').addEventListener('click', function () { removeItem(id); });
      row.querySelector('input').addEventListener('change', function (e) { setQty(id, e.target.value); });
    });

    var t = totals();
    els.totals.innerHTML =
      '<div class="q-row"><span>공급가액</span><span>' + fmt(t.net) + '</span></div>' +
      '<div class="q-row"><span>부가세 (VAT 10%)</span><span>' + fmt(t.vat) + '</span></div>' +
      '<div class="q-row q-grand"><span>합계</span><span>' + fmt(t.gross) + '</span></div>';
  }

  function recordOrder(t) {
    /* 관리자 페이지(/admin/orders)에서 조회할 수 있도록 주문 내역을 저장 */
    try {
      var orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
      orders.unshift({
        no: 'Q' + Date.now(),
        date: new Date().toISOString(),
        status: 'new',
        items: items.map(function (it) {
          var p = BYID[it.id] || {};
          return { id: it.id, n: p.n || it.id, f: p.f || '', c: p.c || '', qty: it.qty, unit: won(p.p || 0) };
        }),
        net: t.net, vat: t.vat, gross: t.gross
      });
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 500)));
    } catch (e) { /* storage unavailable — skip */ }
  }

  function orderQuote() {
    if (!items.length) { alert('담은 제품이 없습니다.'); return; }
    var t = totals();
    recordOrder(t);
    var lines = items.map(function (it) {
      var p = BYID[it.id]; if (!p) return '';
      return '- ' + clean(p.n || p.id) + ' / ' + clean(p.c) + (p.f ? ' / ' + p.f : '') + ' / ' + p.id + ' / 수량 ' + it.qty;
    }).filter(Boolean);
    var subject = encodeURIComponent('Estimate order request');
    var body = encodeURIComponent(lines.join('\n') + '\n\n합계(VAT 포함): ' + fmt(t.gross));
    window.location.href = 'mailto:' + ORDER_EMAIL + '?subject=' + subject + '&body=' + body;
  }

  function printQuote() {
    if (!items.length) { alert('담은 제품이 없습니다.'); return; }
    var t = totals();
    var d = new Date();
    var ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var no = 'Q' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    var rows = items.map(function (it, i) {
      var p = BYID[it.id]; if (!p) return '';
      var unit = won(p.p), amt = unit * it.qty;
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.n || p.id) + '</td>' +
        '<td>' + esc(clean(p.c)) + (p.f ? ' / ' + esc(p.f) : '') + '</td>' +
        '<td>' + esc(p.id) + '</td>' +
        '<td class="num">' + it.qty + '</td><td class="num">' + fmt(unit) + '</td>' +
        '<td class="num">' + fmt(amt) + '</td></tr>';
    }).join('');

    var box = document.getElementById('mmm-quote-print') || document.createElement('div');
    box.id = 'mmm-quote-print';
    box.innerHTML =
      '<h1>견적서 · QUOTATION</h1>' +
      '<div class="qp-brand">made make material</div>' +
      '<div class="qp-meta"><div>견적번호: ' + no + '</div><div>작성일: ' + ymd + '</div></div>' +
      '<table><thead><tr><th>No</th><th>제품명</th><th>분류 / 마감</th><th>코드</th>' +
      '<th class="num">수량</th><th class="num">단가</th><th class="num">금액</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot>' +
      '<tr><td colspan="6" class="num">공급가액</td><td class="num">' + fmt(t.net) + '</td></tr>' +
      '<tr><td colspan="6" class="num">부가세</td><td class="num">' + fmt(t.vat) + '</td></tr>' +
      '<tr class="qp-grand"><td colspan="6" class="num">합계 (VAT 포함)</td><td class="num">' + fmt(t.gross) + '</td></tr>' +
      '</tfoot></table>' +
      '<p style="margin-top:18px;font-size:11px;color:#666">※ 금액 단위: 원(₩), VAT 포함.</p>';
    if (!box.parentNode) document.body.appendChild(box);
    window.print();
  }
})();
