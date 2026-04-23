import { T } from '../theme';
import { formatDate, formatTime, formatTokens } from '../utils/format';
import type { Session } from '../types/api';

interface Props {
  sessions: Session[];
}

export function SessionHistory({ sessions }: Props) {
  if (!sessions || sessions.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <span style={{ fontFamily: T.sans, fontSize: 12, color: T.textDim }}>No archived sessions</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {sessions.map((s) => (
        <div key={s.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 8, padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
          animation: 'fadeSlideIn 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>When</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textSecond }}>{formatDate(s.startTime)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textSecond }}>{formatTime(s.endTime - s.startTime)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.blue }}>{formatTokens(s.totalTokens)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.purple }}>{s.completedTasks}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
