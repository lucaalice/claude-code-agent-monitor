import { T } from '../theme';
import { PageNav } from '../components/PageNav';

export function SettingsPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, color: T.textPrimary, fontFamily: T.sans }}>
      <PageNav />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>
          Settings
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: 13, color: T.textMuted, marginBottom: 24 }}>
          Dashboard configuration.
        </p>

        <div style={{
          borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: T.bgSurface, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>Server URL</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 4 }}>http://localhost:3001</div>
          </div>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>WebSocket</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 4 }}>ws://localhost:3001/ws</div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>Database</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, marginTop: 4 }}>dashboard.db (SQLite, WAL mode)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
