import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('root element missing');
}

// BASE_URL 与 vite.config base 一致（code-server /absproxy/5173/ 时路由需同前缀）
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
