import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { SessionsPage } from './pages/SessionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { GraphPage } from './pages/GraphPage';

// ─── Inject keyframes (once, globally) ───────────────────────────────────────
if (typeof document !== 'undefined' && !document.head.querySelector('[data-ccd-styles]')) {
  const style = document.createElement('style');
  style.setAttribute('data-ccd-styles', '1');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    @keyframes breatheGreen {
      0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0), 0 0 8px rgba(52,211,153,0.15); }
      50%       { box-shadow: 0 0 0 3px rgba(52,211,153,0.08), 0 0 18px rgba(52,211,153,0.25); }
    }
    @keyframes breatheAmber {
      0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0), 0 0 6px rgba(251,191,36,0.1); }
      50%       { box-shadow: 0 0 0 3px rgba(251,191,36,0.06), 0 0 14px rgba(251,191,36,0.2); }
    }
    @keyframes breatheRed {
      0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0), 0 0 6px rgba(248,113,113,0.1); }
      50%       { box-shadow: 0 0 0 3px rgba(248,113,113,0.06), 0 0 14px rgba(248,113,113,0.2); }
    }
    @keyframes pipPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes connectBlink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    @keyframes barMarch {
      0%   { border-left-color: rgba(52,211,153,0.6); }
      50%  { border-left-color: rgba(52,211,153,1); }
      100% { border-left-color: rgba(52,211,153,0.6); }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/workflow" element={<GraphPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
