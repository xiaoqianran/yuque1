import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { KbListPage } from './pages/KbListPage';
import { KbWorkspacePage } from './pages/KbWorkspacePage';
import { LoginPage } from './pages/LoginPage';
import { SharePage } from './pages/SharePage';

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          yuque1
        </Link>
        <span className="badge">联调</span>
        <span className="header-spacer" />
        {user && <span className="muted header-user">{user.nickname}</span>}
      </header>
      <main className="main-fluid">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:token" element={<SharePage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <KbListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/kbs/:kbId"
          element={
            <RequireAuth>
              <KbWorkspacePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
