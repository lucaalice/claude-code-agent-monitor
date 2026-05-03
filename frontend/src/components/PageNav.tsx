import { NavLink } from 'react-router-dom';
import { T } from '../theme';

const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
  fontFamily: T.sans, fontSize: 11, fontWeight: isActive ? 600 : 400,
  color: isActive ? T.green : T.textMuted, textDecoration: 'none',
  padding: '4px 8px', borderRadius: 4,
  backgroundColor: isActive ? T.greenDim : 'transparent',
  transition: 'all 0.15s ease',
});

export function PageNav() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center',
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

        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <NavLink to="/" style={({ isActive }) => navLinkStyle(isActive)}>Dashboard</NavLink>
          <NavLink to="/sessions" style={({ isActive }) => navLinkStyle(isActive)}>Sessions</NavLink>
          <NavLink to="/analytics" style={({ isActive }) => navLinkStyle(isActive)}>Analytics</NavLink>
          <NavLink to="/workflow" style={({ isActive }) => navLinkStyle(isActive)}>Workflow</NavLink>
          <NavLink to="/settings" style={({ isActive }) => navLinkStyle(isActive)}>Settings</NavLink>
        </nav>
      </div>
    </header>
  );
}
