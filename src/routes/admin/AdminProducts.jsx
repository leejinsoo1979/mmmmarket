import { useEffect, useMemo, useState } from 'react';
import {
  applyOverlay,
  buildFullExport,
  downloadJson,
  formatWon,
  fromWon,
  getOverlay,
  getSettings,
  loadBaseProducts,
  normalizeText,
  overlayCount,
  resetOverlay,
  saveOverlay,
  toWon
} from './adminStore.js';

const PAGE_SIZE = 50;

function emptyDraft() {
  return { id: '', n: '', f: '', c: '', img: '', won: '' };
}

export default function AdminProducts() {
  const [base, setBase] = useState(null); // { quote, full, images }
  const [overlay, setOverlay] = useState(getOverlay);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState(null); // { mode: 'new' | 'edit', ...fields }
  const settings = useMemo(() => getSettings(), []);

  useEffect(() => {
    let alive = true;
    loadBaseProducts().then((data) => {
      if (alive) setBase(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const products = useMemo(() => {
    if (!base) return [];
    return applyOverlay(base.quote, overlay);
  }, [base, overlay]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      const c = normalizeText(p.c);
      if (c) set.add(c);
    });
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (category && normalizeText(p.c) !== category) return false;
      if (!tokens.length) return true;
      const hay = `${p.id} ${p.n} ${p.f} ${p.c}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [products, search, category]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const addedIds = useMemo(() => new Set(overlay.added.map((a) => a.id)), [overlay]);
  const changeCount = overlayCount(overlay);

  function updateOverlay(next) {
    saveOverlay(next);
    setOverlay(next);
  }

  function openEdit(product) {
    setDraft({
      mode: 'edit',
      id: product.id,
      n: product.n || '',
      f: product.f || '',
      c: product.c || '',
      img: product.img || (base?.images[product.id] ?? ''),
      won: String(toWon(product.p, settings.rate))
    });
  }

  function openNew() {
    setDraft({ mode: 'new', ...emptyDraft() });
  }

  function saveDraft(event) {
    event.preventDefault();
    const id = draft.id.trim();
    const name = draft.n.trim();
    if (!id || !name) {
      alert('상품 코드와 상품명은 필수입니다.');
      return;
    }

    const { p, pi } = fromWon(draft.won, settings.rate);
    const record = {
      id,
      n: name,
      f: draft.f.trim(),
      c: draft.c.trim(),
      p,
      pi,
      img: draft.img.trim()
    };

    const next = {
      edits: { ...overlay.edits },
      deleted: [...overlay.deleted],
      added: [...overlay.added]
    };

    if (draft.mode === 'new') {
      if (products.some((x) => x.id === id)) {
        alert(`이미 존재하는 상품 코드입니다: ${id}`);
        return;
      }
      next.added.push(record);
    } else if (addedIds.has(id)) {
      next.added = next.added.map((a) => (a.id === id ? record : a));
    } else {
      next.edits[id] = record;
    }

    updateOverlay(next);
    setDraft(null);
  }

  function removeProduct(product) {
    if (!confirm(`"${product.n || product.id}" 상품을 삭제할까요?`)) return;
    const next = {
      edits: { ...overlay.edits },
      deleted: [...overlay.deleted],
      added: [...overlay.added]
    };
    if (addedIds.has(product.id)) {
      next.added = next.added.filter((a) => a.id !== product.id);
    } else {
      delete next.edits[product.id];
      if (!next.deleted.includes(product.id)) next.deleted.push(product.id);
    }
    updateOverlay(next);
  }

  function revertEdit(product) {
    if (!overlay.edits[product.id]) return;
    const next = { ...overlay, edits: { ...overlay.edits } };
    delete next.edits[product.id];
    updateOverlay(next);
  }

  function exportFiles() {
    if (!base) return;
    downloadJson('quote-products.json', applyOverlay(base.quote, overlay));
    downloadJson('products.json', buildFullExport(base.full, overlay));
    alert(
      '두 파일이 다운로드됩니다.\n\n영구 반영하려면 프로젝트의 formani.com/zl/ 폴더에 있는 같은 이름의 파일을 다운로드한 파일로 교체한 뒤 커밋하세요.'
    );
  }

  function resetChanges() {
    if (!confirm(`저장하지 않은 변경 ${changeCount}건을 모두 되돌릴까요?`)) return;
    resetOverlay();
    setOverlay(getOverlay());
  }

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>상품 관리</h1>
        <div className="page-actions">
          <button type="button" className="primary" onClick={openNew}>
            + 새 상품
          </button>
          <button type="button" onClick={exportFiles} disabled={!base}>
            JSON 내보내기{changeCount > 0 ? ` (변경 ${changeCount}건)` : ''}
          </button>
          {changeCount > 0 && (
            <button type="button" className="danger" onClick={resetChanges}>
              변경 초기화
            </button>
          )}
        </div>
      </div>

      {changeCount > 0 && (
        <p className="notice-bar">
          내보내지 않은 변경이 {changeCount}건 있습니다. 이 변경은 현재 브라우저에서만 적용된
          상태이며, "JSON 내보내기" 후 <code>formani.com/zl/</code>의 파일을 교체해야 사이트에
          영구 반영됩니다.
        </p>
      )}

      <div className="filter-row">
        <input
          type="search"
          placeholder="상품명 · 코드 · 마감 · 카테고리 검색…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="muted">{filtered.length.toLocaleString('ko-KR')}개</span>
      </div>

      {!base && <p className="muted">상품 데이터를 불러오는 중…</p>}

      {base && (
        <>
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th></th>
                <th>코드</th>
                <th>상품명</th>
                <th>마감</th>
                <th>카테고리</th>
                <th className="num">공급가</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const img = p.img || base.images[p.id] || '';
                const isEdited = Boolean(overlay.edits[p.id]);
                const isAdded = addedIds.has(p.id);
                return (
                  <tr key={p.id}>
                    <td className="thumb-cell">
                      {img ? <img src={img} alt="" loading="lazy" /> : <span className="no-img" />}
                    </td>
                    <td className="mono">{p.id}</td>
                    <td>
                      {p.n}
                      {isAdded && <span className="badge badge-new">추가됨</span>}
                      {isEdited && <span className="badge badge-edit">수정됨</span>}
                    </td>
                    <td>{p.f}</td>
                    <td>{p.c}</td>
                    <td className="num">{formatWon(toWon(p.p, settings.rate))}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => openEdit(p)}>
                        수정
                      </button>
                      {isEdited && (
                        <button type="button" onClick={() => revertEdit(p)}>
                          되돌리기
                        </button>
                      )}
                      <button type="button" className="danger" onClick={() => removeProduct(p)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted center">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pager">
            <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              ← 이전
            </button>
            <span>
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              다음 →
            </button>
          </div>
        </>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveDraft}>
            <h2>{draft.mode === 'new' ? '새 상품 추가' : '상품 수정'}</h2>
            <label>
              상품 코드
              <input
                type="text"
                value={draft.id}
                readOnly={draft.mode === 'edit'}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                placeholder="예: 30BR21Z002INXX0"
              />
            </label>
            <label>
              상품명
              <input
                type="text"
                value={draft.n}
                onChange={(e) => setDraft({ ...draft, n: e.target.value })}
              />
            </label>
            <label>
              마감(finish)
              <input
                type="text"
                value={draft.f}
                onChange={(e) => setDraft({ ...draft, f: e.target.value })}
                placeholder="예: satin stainless steel"
              />
            </label>
            <label>
              카테고리
              <input
                type="text"
                list="admin-category-list"
                value={draft.c}
                onChange={(e) => setDraft({ ...draft, c: e.target.value })}
              />
              <datalist id="admin-category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              공급가 (₩, VAT 별도)
              <input
                type="number"
                min="0"
                step="1"
                value={draft.won}
                onChange={(e) => setDraft({ ...draft, won: e.target.value })}
              />
            </label>
            <label>
              이미지 URL
              <input
                type="url"
                value={draft.img}
                onChange={(e) => setDraft({ ...draft, img: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setDraft(null)}>
                취소
              </button>
              <button type="submit" className="primary">
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
