import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyOverlay,
  formatWon,
  getOrders,
  getOverlay,
  getSettings,
  loadBaseProducts,
  normalizeText,
  orderStatusLabel,
  toWon
} from './adminStore.js';

export default function AdminDashboard() {
  const [products, setProducts] = useState(null);
  const orders = useMemo(() => getOrders(), []);
  const overlay = useMemo(() => getOverlay(), []);
  const settings = useMemo(() => getSettings(), []);

  useEffect(() => {
    let alive = true;
    loadBaseProducts().then(({ quote }) => {
      if (alive) setProducts(applyOverlay(quote, overlay));
    });
    return () => {
      alive = false;
    };
  }, [overlay]);

  const categoryStats = useMemo(() => {
    if (!products) return [];
    const counts = new Map();
    products.forEach((p) => {
      const key = normalizeText(p.c) || '(미분류)';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [products]);

  const orderStats = useMemo(() => {
    const byStatus = new Map();
    let gross = 0;
    orders.forEach((o) => {
      byStatus.set(o.status, (byStatus.get(o.status) || 0) + 1);
      gross += o.gross || 0;
    });
    return { byStatus, gross };
  }, [orders]);

  const pendingChanges =
    Object.keys(overlay.edits).length + overlay.deleted.length + overlay.added.length;

  return (
    <div className="admin-page">
      <h1>대시보드</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">전체 상품</div>
          <div className="stat-value">
            {products ? products.length.toLocaleString('ko-KR') : '…'}
          </div>
          <Link to="/admin/products">상품 관리 →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-label">견적 주문</div>
          <div className="stat-value">{orders.length.toLocaleString('ko-KR')}</div>
          <Link to="/admin/orders">주문 관리 →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-label">누적 견적액 (VAT 포함)</div>
          <div className="stat-value">{formatWon(orderStats.gross)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">내보내지 않은 상품 변경</div>
          <div className="stat-value">{pendingChanges}</div>
          {pendingChanges > 0 && <Link to="/admin/products">내보내기 필요 →</Link>}
        </div>
      </div>

      <div className="dash-columns">
        <section>
          <h2>카테고리별 상품 수</h2>
          {!products && <p className="muted">불러오는 중…</p>}
          {products && (
            <table className="admin-table">
              <tbody>
                {categoryStats.map(([name, count]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{count.toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2>최근 견적 주문</h2>
          {orders.length === 0 && (
            <p className="muted">
              아직 접수된 견적 주문이 없습니다. 고객이 카탈로그에서 견적을 담아 주문하면 여기에
              표시됩니다.
            </p>
          )}
          {orders.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>일시</th>
                  <th className="num">품목</th>
                  <th className="num">합계</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.no}>
                    <td>{o.no}</td>
                    <td>{new Date(o.date).toLocaleString('ko-KR')}</td>
                    <td className="num">{o.items?.length ?? 0}</td>
                    <td className="num">{formatWon(o.gross || 0)}</td>
                    <td>
                      <span className={`status status-${o.status}`}>
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <p className="muted small">
        현재 환산 배수 1 : {settings.rate.toLocaleString('ko-KR')} · 기준 단가 1.00 ={' '}
        {formatWon(toWon(1, settings.rate))} · 주문 수신 이메일 {settings.orderEmail}
      </p>
    </div>
  );
}
