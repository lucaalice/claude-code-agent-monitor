import { NavLink } from 'react-router-dom';
import { T } from '../theme';
import { formatTime } from '../utils/format';

interface Props {
  connected: boolean;
  now: number;
  sessionStartTime: number;
  notifMuted: boolean;
  toggleMute: () => void;
  showSessions: boolean;
  setShowSessions: (v: boolean) => void;
  fetchSessions: () => void;
}

const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
  fontFamily: T.sans, fontSize: 11, fontWeight: isActive ? 600 : 400,
  color: isActive ? T.green : T.textMuted, textDecoration: 'none',
  padding: '4px 8px', borderRadius: 4,
  backgroundColor: isActive ? T.greenDim : 'transparent',
  transition: 'all 0.15s ease',
});

export function AppHeader({ connected, now, sessionStartTime, notifMuted, toggleMute, showSessions, setShowSessions, fetchSessions }: Props) {
  const sessionAge = formatTime(now - sessionStartTime);

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px', height: 48, backgroundColor: T.bgSurface,
      borderBottom: `1px solid ${T.border}`, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5,
          background: `linear-gradient(135deg, ${T.green}, ${T.teal})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: '#000' }}>A</span>
        </div>
        <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.2 }}>
          Agent Monitor
        </span>
        <span style={{ fontFamily: T.sans, fontSize: 11, color: T.textMuted, borderLeft: `1px solid ${T.border}`, paddingLeft: 10, marginLeft: 2 }}>
          Claude Code
        </span>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <NavLink to="/" style={({ isActive }) => navLinkStyle(isActive)}>Dashboard</NavLink>
          <NavLink to="/sessions" style={({ isActive }) => navLinkStyle(isActive)}>Sessions</NavLink>
          <NavLink to="/analytics" style={({ isActive }) => navLinkStyle(isActive)}>Analytics</NavLink>
          <NavLink to="/settings" style={({ isActive }) => navLinkStyle(isActive)}>Settings</NavLink>
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggleMute}
          title={notifMuted ? 'Notifications muted' : 'Notifications enabled'}
          style={{
            padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`,
            backgroundColor: 'transparent', cursor: 'pointer',
            fontFamily: T.sans, fontSize: 11, color: notifMuted ? T.textDim : T.amber,
            transition: 'all 0.15s ease',
          }}
        >
          {notifMuted ? 'Muted' : 'Alerts'}
        </button>

        <button
          onClick={() => { setShowSessions(!showSessions); if (!showSessions) fetchSessions(); }}
          style={{
            padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`,
            backgroundColor: showSessions ? T.bgOverlay : 'transparent', cursor: 'pointer',
            fontFamily: T.sans, fontSize: 11, color: T.textMuted, transition: 'all 0.15s ease',
          }}
        >
          History
        </button>

        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>up {sessionAge}</span>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          borderRadius: 99, backgroundColor: connected ? T.greenDim : T.slateDim,
          border: `1px solid ${connected ? T.green + '30' : T.border}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: connected ? T.green : T.slate,
            animation: connected ? 'connectBlink 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: connected ? T.green : T.slate }}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}
