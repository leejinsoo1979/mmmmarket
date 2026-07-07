import { useState } from 'react';
import { formatWon, getSettings, saveSettings, toWon } from './adminStore.js';

export default function AdminSettings() {
  const [form, setForm] = useState(getSettings);
  const [saved, setSaved] = useState(false);

  function set(key, value) {
    setForm({ ...form, [key]: value });
    setSaved(false);
  }

  function submit(event) {
    event.preventDefault();
    const rate = Number(form.rate);
    if (!(rate > 0)) {
      alert('환산 배수는 0보다 큰 숫자여야 합니다.');
      return;
    }
    if (!form.adminPassword.trim()) {
      alert('관리자 비밀번호는 비울 수 없습니다.');
      return;
    }
    saveSettings({
      rate,
      orderEmail: form.orderEmail.trim(),
      notice: form.notice.trim(),
      adminPassword: form.adminPassword
    });
    setSaved(true);
  }

  return (
    <div className="admin-page">
      <h1>사이트 설정</h1>

      <form className="settings-form" onSubmit={submit}>
        <section>
          <h2>가격</h2>
          <label>
            원화 환산 배수 (기준 단가 × 배수 = 공급가 ₩)
            <input
              type="number"
              min="1"
              step="1"
              value={form.rate}
              onChange={(e) => set('rate', e.target.value)}
            />
          </label>
          <p className="muted small">
            예: 기준 단가 7.46 × {Number(form.rate) > 0 ? Number(form.rate).toLocaleString('ko-KR') : '?'} ={' '}
            {Number(form.rate) > 0 ? formatWon(toWon(7.46, Number(form.rate))) : '—'} (VAT 별도)
          </p>
        </section>

        <section>
          <h2>주문</h2>
          <label>
            주문 수신 이메일 (고객이 "주문하기"를 누르면 이 주소로 메일이 작성됩니다)
            <input
              type="email"
              value={form.orderEmail}
              onChange={(e) => set('orderEmail', e.target.value)}
            />
          </label>
        </section>

        <section>
          <h2>사이트 콘텐츠</h2>
          <label>
            공지 문구 (카탈로그 견적 패널 상단에 표시, 비우면 숨김)
            <textarea
              rows={2}
              value={form.notice}
              onChange={(e) => set('notice', e.target.value)}
              placeholder="예: 7월 한정 — 전 제품 무료 배송"
            />
          </label>
        </section>

        <section>
          <h2>보안</h2>
          <label>
            관리자 비밀번호
            <input
              type="text"
              value={form.adminPassword}
              onChange={(e) => set('adminPassword', e.target.value)}
            />
          </label>
        </section>

        <div className="settings-actions">
          <button type="submit" className="primary">
            저장
          </button>
          {saved && <span className="saved-msg">저장되었습니다.</span>}
        </div>
      </form>

      <p className="muted small">
        설정은 이 브라우저의 localStorage에 저장되며 사이트의 견적 위젯이 즉시 반영합니다. 다른
        컴퓨터에도 기본값으로 적용하려면 <code>formani.com/quote-widget.js</code>의 기본값을
        수정하세요.
      </p>
    </div>
  );
}
