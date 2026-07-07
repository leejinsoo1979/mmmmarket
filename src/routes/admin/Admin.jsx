import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './admin.css';
import { releaseAppBootBeforePaint } from '../../utils/appBoot.js';
import { isAuthed, login, logout } from './adminStore.js';
import AdminDashboard from './AdminDashboard.jsx';
import AdminProducts from './AdminProducts.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminSettings from './AdminSettings.jsx';

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function submit(event) {
    event.preventDefault();
    if (login(password)) {
      onLogin();
    } else {
      setError(true);
      setPassword('');
    }
  }

  return (
    <div className="mmm-admin mmm-admin-login">
      <form onSubmit={submit}>
        <h1>made make material</h1>
        <p>관리자 페이지</p>
        <input
          type="password"
          value={password}
          placeholder="비밀번호"
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
        />
        {error && <div className="login-error">비밀번호가 올바르지 않습니다.</div>}
        <button type="submit">입장</button>
      </form>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(isAuthed());

  useEffect(() => releaseAppBootBeforePaint(), []);
  useEffect(() => {
    document.title = authed ? '관리자 · made make material' : '관리자 로그인';
  }, [authed]);

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="mmm-admin">
      <header className="admin-header">
        <div className="admin-brand">
          <strong>made make material</strong>
          <span>관리자</span>
        </div>
        <nav>
          <NavLink to="/admin" end>대시보드</NavLink>
          <NavLink to="/admin/products">상품 관리</NavLink>
          <NavLink to="/admin/orders">주문 관리</NavLink>
          <NavLink to="/admin/settings">사이트 설정</NavLink>
        </nav>
        <div className="admin-header-actions">
          <a href="/" className="admin-site-link">사이트 보기</a>
          <button
            type="button"
            onClick={() => {
              logout();
              setAuthed(false);
            }}
          >
            로그아웃
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
