import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';
import './styles/tokens.css';
import './styles/workspace.css';
import './styles/document-tree.css';
import './styles/editor.css';
import './styles/dialogs.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('root element missing');
}

// BASE_URL 与 vite.config base 一致（code-server /proxy/5173/ 时路由需同前缀）
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
