import { T } from '../theme';

interface Props {
  filter: string;
  setFilter: (f: string) => void;
  counts: Record<string, number>;
}

export function FilterBar({ filter, setFilter, counts }: Props) {
  const buttons = [
    { key: 'all',       label: 'All',       color: T.textSecond },
    { key: 'running',   label: 'Running',   color: T.green },
    { key: 'error',     label: 'Error',     color: T.red },
    { key: 'completed', label: 'Done',      color: T.blue },
    { key: 'idle',      label: 'Idle',      color: T.slate },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 16px', backgroundColor: T.bgSurface,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
        Filter
      </span>
      {buttons.map((btn) => {
        const active = filter === btn.key;
        const count = btn.key === 'all' ? counts.all : (counts[btn.key] || 0);
        return (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99,
              border: `1px solid ${active ? btn.color + '40' : T.border}`,
              backgroundColor: active ? btn.color + '15' : 'transparent',
              color: active ? btn.color : T.textMuted,
              fontFamily: T.sans, fontSize: 11, fontWeight: active ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {btn.label}
            <span style={{ fontFamily: T.mono, fontSize: 10, opacity: 0.7 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
