import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          yuque1
        </Link>
        <span className="badge">M0</span>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
