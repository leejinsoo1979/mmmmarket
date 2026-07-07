import { useState } from 'react';
import {
  ORDER_STATUSES,
  formatWon,
  getOrders,
  orderStatusLabel,
  saveOrders
} from './adminStore.js';

export default function AdminOrders() {
  const [orders, setOrders] = useState(getOrders);
  const [openNo, setOpenNo] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  function update(next) {
    saveOrders(next);
    setOrders(next);
  }

  function setStatus(no, status) {
    update(orders.map((o) => (o.no === no ? { ...o, status } : o)));
  }

  function remove(no) {
    if (!confirm(`주문 ${no} 기록을 삭제할까요?`)) return;
    update(orders.filter((o) => o.no !== no));
  }

  const visible = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  return (
    <div className="admin-page">
      <div className="page-head">
        <h1>주문 관리</h1>
        <div className="page-actions">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">전체 상태</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.length === 0 && (
        <p className="muted">
          아직 접수된 견적 주문이 없습니다. 고객이 카탈로그 페이지에서 견적을 담고 "주문하기"를
          누르면 이곳에 기록됩니다.
        </p>
      )}

      {visible.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>접수 일시</th>
              <th className="num">품목</th>
              <th className="num">공급가액</th>
              <th className="num">합계 (VAT 포함)</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <OrderRow
                key={o.no}
                order={o}
                open={openNo === o.no}
                onToggle={() => setOpenNo(openNo === o.no ? null : o.no)}
                onStatus={(status) => setStatus(o.no, status)}
                onRemove={() => remove(o.no)}
              />
            ))}
          </tbody>
        </table>
      )}

      {orders.length > 0 && visible.length === 0 && (
        <p className="muted">"{orderStatusLabel(statusFilter)}" 상태의 주문이 없습니다.</p>
      )}
    </div>
  );
}

function OrderRow({ order, open, onToggle, onStatus, onRemove }) {
  return (
    <>
      <tr className="order-row" onClick={onToggle}>
        <td className="mono">{order.no}</td>
        <td>{new Date(order.date).toLocaleString('ko-KR')}</td>
        <td className="num">{order.items?.length ?? 0}</td>
        <td className="num">{formatWon(order.net || 0)}</td>
        <td className="num">{formatWon(order.gross || 0)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          <select
            className={`status-select status-${order.status}`}
            value={order.status}
            onChange={(e) => onStatus(e.target.value)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </td>
        <td className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onToggle}>
            {open ? '닫기' : '상세'}
          </button>
          <button type="button" className="danger" onClick={onRemove}>
            삭제
          </button>
        </td>
      </tr>
      {open && (
        <tr className="order-detail">
          <td colSpan={7}>
            <table className="admin-table inner">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>상품명</th>
                  <th>분류 / 마감</th>
                  <th className="num">수량</th>
                  <th className="num">단가</th>
                  <th className="num">금액</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it) => (
                  <tr key={it.id}>
                    <td className="mono">{it.id}</td>
                    <td>{it.n}</td>
                    <td>
                      {it.c}
                      {it.f ? ` / ${it.f}` : ''}
                    </td>
                    <td className="num">{it.qty}</td>
                    <td className="num">{formatWon(it.unit || 0)}</td>
                    <td className="num">{formatWon((it.unit || 0) * (it.qty || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
