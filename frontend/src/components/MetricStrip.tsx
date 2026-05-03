import React from 'react';
import { T } from '../theme';
import { Divider } from './Primitives';
import { RollingDigits } from './RollingDigits';
import { formatCost, formatTokens, formatTime } from '../utils/format';
import type { GlobalMetrics } from '../types/api';

interface Props {
  metrics: GlobalMetrics;
  activeAgentCount: number;
  now: number;
  onArchive: () => void;
}

export function MetricStrip({ metrics, activeAgentCount, now, onArchive }: Props) {
  const items = [
    { key: 'Active Agents', value: activeAgentCount, sub: null as string | null, unit: activeAgentCount === 1 ? 'agent' : 'agents', color: T.green, roll: true },
    { key: 'Tokens Used', value: formatTokens(metrics.totalTokens), sub: metrics.sessionTokens > 0 ? `session: ${formatTokens(metrics.sessionTokens)}` : null, unit: 'all time', color: T.blue, roll: true },
    { key: 'Est. Cost', value: formatCost(metrics.totalCost), sub: metrics.sessionCost > 0 ? `session: ${formatCost(metrics.sessionCost)}` : null, unit: 'all time', color: T.amber, roll: true },
    { key: 'Tasks Done', value: metrics.completedTasks, sub: metrics.sessionCompleted > 0 ? `session: ${metrics.sessionCompleted}` : null, unit: 'all time', color: T.purple, roll: true },
    { key: 'Session', value: formatTime(now - metrics.sessionStartTime), sub: null, unit: 'elapsed', color: T.textSecond, roll: false },
  ];

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 && <Divider vertical />}
          <div style={{
            flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 3,
            backgroundColor: 'rgba(24,27,34,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', transition: 'background-color 0.2s ease',
          }}>
            <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
              {item.key}
            </span>
            {item.roll ? (
              <RollingDigits
                value={item.value}
                color={item.color}
                fontSize={20}
                fontFamily={T.mono}
                fontWeight={700}
              />
            ) : (
              <span style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {item.value}
              </span>
            )}
            <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>{item.unit}</span>
            {item.sub && (
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMuted, marginTop: 1 }}>{item.sub}</span>
            )}
          </div>
        </React.Fragment>
      ))}
      <Divider vertical />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', backgroundColor: 'rgba(24,27,34,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <button
          onClick={onArchive}
          title="Archive current session and start fresh"
          style={{
            padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${T.border}`, backgroundColor: T.bgOverlay,
            color: T.textSecond, fontFamily: T.sans, fontSize: 11, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
          }}
        >
          Archive
        </button>
      </div>
    </div>
  );
}
