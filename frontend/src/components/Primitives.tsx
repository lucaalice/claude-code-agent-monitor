import { T } from '../theme';

export function ActivityBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{
      height: 2, borderRadius: 1,
      background: `linear-gradient(90deg, transparent 0%, ${T.green} 50%, transparent 100%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite',
      marginTop: 4, opacity: 0.7,
    }} aria-hidden="true" />
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <div style={vertical ? {
      width: 1, alignSelf: 'stretch', backgroundColor: T.border, flexShrink: 0,
    } : {
      height: 1, backgroundColor: T.border, width: '100%',
    }} />
  );
}

interface SectionHeaderProps {
  label: string;
  right?: React.ReactNode;
  accent?: boolean;
}

export function SectionHeader({ label, right, accent = false }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', backgroundColor: T.bgSurface,
      borderBottom: `1px solid ${T.border}`, minHeight: 36,
    }}>
      <span style={{
        fontFamily: T.sans, fontSize: 11, fontWeight: 600,
        color: accent ? T.green : T.textSecond,
        textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        {label}
      </span>
      {right && (
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, letterSpacing: 0.3 }}>
          {right}
        </span>
      )}
    </div>
  );
}
