/* made make material — 관리자 데이터 계층
   백엔드 없이 동작한다:
   - 원본 상품 데이터는 /zl/quote-products.json, /zl/products.json 에서 읽는다
   - 관리자의 수정/추가/삭제는 localStorage 오버레이(mmm_admin_overlay)에 쌓이고,
     "내보내기"로 병합된 JSON을 내려받아 formani.com/zl/ 파일을 교체하면 영구 반영된다
   - 견적 주문(mmm_quote_orders)과 사이트 설정(mmm_site_settings)은 quote-widget.js 와 공유한다 */

const OVERLAY_KEY = 'mmm_admin_overlay';
const ORDERS_KEY = 'mmm_quote_orders';
const SETTINGS_KEY = 'mmm_site_settings';
const AUTH_KEY = 'mmm_admin_auth';

export const DEFAULT_PASSWORD = 'mmm1234';
export const DEFAULT_RATE = 1500;
export const DEFAULT_ORDER_EMAIL = 'contact@mmm.com';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- 설정 ---------- */

export function getSettings() {
  const s = readJson(SETTINGS_KEY, {});
  return {
    rate: Number(s.rate) > 0 ? Number(s.rate) : DEFAULT_RATE,
    orderEmail: s.orderEmail || DEFAULT_ORDER_EMAIL,
    notice: s.notice || '',
    adminPassword: s.adminPassword || DEFAULT_PASSWORD
  };
}

export function saveSettings(patch) {
  writeJson(SETTINGS_KEY, { ...getSettings(), ...patch });
}

/* ---------- 로그인 ---------- */

export function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

export function login(password) {
  if (password === getSettings().adminPassword) {
    sessionStorage.setItem(AUTH_KEY, '1');
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY);
}

/* ---------- 상품 ---------- */

let productCache = null;

export async function loadBaseProducts() {
  if (productCache) return productCache;

  const [quote, full] = await Promise.all([
    fetch('/zl/quote-products.json').then((r) => r.json()),
    fetch('/zl/products.json').then((r) => r.json()).catch(() => [])
  ]);

  const images = {};
  full.forEach((p) => {
    if (p.product_id && p.product_image) images[p.product_id] = p.product_image;
  });

  productCache = { quote, full, images };
  return productCache;
}

export function getOverlay() {
  const ov = readJson(OVERLAY_KEY, {});
  return {
    edits: ov.edits || {},
    deleted: ov.deleted || [],
    added: ov.added || []
  };
}

export function saveOverlay(overlay) {
  writeJson(OVERLAY_KEY, overlay);
}

export function resetOverlay() {
  localStorage.removeItem(OVERLAY_KEY);
}

export function overlayCount(overlay = getOverlay()) {
  return Object.keys(overlay.edits).length + overlay.deleted.length + overlay.added.length;
}

/* 오버레이를 적용한 견적 인덱스(관리자 화면과 사이트 위젯이 보는 최종 상태) */
export function applyOverlay(quote, overlay = getOverlay()) {
  const deleted = new Set(overlay.deleted);
  const merged = quote
    .filter((p) => !deleted.has(p.id))
    .map((p) => (overlay.edits[p.id] ? { ...p, ...overlay.edits[p.id] } : p));
  return merged.concat(overlay.added.map((a) => ({ ...a })));
}

/* ---------- 내보내기 ---------- */

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* products.json(전체 필드) 쪽에도 수정사항을 반영해 내보낸다 */
export function buildFullExport(full, overlay = getOverlay()) {
  const deleted = new Set(overlay.deleted);
  const out = full
    .filter((p) => !deleted.has(p.product_id))
    .map((p) => {
      const e = overlay.edits[p.product_id];
      if (!e) return p;
      const next = { ...p };
      if (e.n != null) {
        next.internal_type = e.n;
        next.id_distinct = e.n;
      }
      if (e.f != null) next.finish_prio1_en = e.f;
      if (e.c != null) next.productgroup_en_filter_1 = e.c;
      if (e.img != null && e.img !== '') next.product_image = e.img;
      return next;
    });

  overlay.added.forEach((a) => {
    out.push({
      product_id: a.id,
      id_distinct: a.n,
      internal_type: a.n,
      finish_prio1_en: a.f || '',
      productgroup_en_filter_1: a.c || '',
      product_image: a.img || ''
    });
  });

  return out;
}

/* ---------- 주문(견적 요청) ---------- */

export const ORDER_STATUSES = [
  { value: 'new', label: '신규' },
  { value: 'confirmed', label: '확인됨' },
  { value: 'processing', label: '처리중' },
  { value: 'done', label: '완료' },
  { value: 'canceled', label: '취소' }
];

export function orderStatusLabel(value) {
  const found = ORDER_STATUSES.find((s) => s.value === value);
  return found ? found.label : value;
}

export function getOrders() {
  return readJson(ORDERS_KEY, []);
}

export function saveOrders(orders) {
  writeJson(ORDERS_KEY, orders);
}

/* ---------- 공통 ---------- */

export function formatWon(value) {
  return '₩' + Math.round(value).toLocaleString('ko-KR');
}

/* 원본 데이터에 개행 등이 섞여 있어("window\nhardware") 표시/그룹핑 전에 정규화한다 */
export function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

/* 견적 인덱스의 기준 단가(p) → 원화 공급가 */
export function toWon(basePrice, rate = getSettings().rate) {
  return Math.round((Number(basePrice) || 0) * rate);
}

/* 원화 공급가 → 기준 단가(p). pi(부가세 포함 기준가)는 p × 1.21 관례를 따른다 */
export function fromWon(won, rate = getSettings().rate) {
  const p = Math.round(((Number(won) || 0) / rate) * 100) / 100;
  return { p, pi: Math.round(p * 1.21 * 100) / 100 };
}
