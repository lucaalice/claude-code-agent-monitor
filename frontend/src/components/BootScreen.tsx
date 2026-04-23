import { useState, useEffect } from 'react';
import { T } from '../theme';

interface Props {
  connected: boolean;
}

export function BootScreen({ connected }: Props) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: T.sans, fontSize: 28, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
          Agent Monitor
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 13, color: T.textMuted, letterSpacing: 0.3 }}>
          Claude Code &middot; Real-time dashboard
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
        borderRadius: 8, backgroundColor: T.bgSurface, border: `1px solid ${T.border}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: connected ? T.green : T.amber,
          animation: 'connectBlink 1s ease-in-out infinite',
          boxShadow: `0 0 8px ${connected ? T.green : T.amber}`,
        }} />
        <span style={{ fontFamily: T.sans, fontSize: 13, color: connected ? T.green : T.amber, fontWeight: 500 }}>
          {connected ? `Waiting for data${dots}` : `Connecting${dots} (auto-reconnect enabled)`}
        </span>
      </div>
      {!connected && (
        <div style={{
          padding: '10px 16px', borderRadius: 6, backgroundColor: T.bgSurface,
          border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12, color: T.textSecond,
        }}>
          <span style={{ color: T.textDim }}>$ </span>node claude-dashboard-server.js
        </div>
      )}
    </div>
  );
}
