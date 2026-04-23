import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme';
import { formatTime } from '../utils/format';
import type { TimelineEntry } from '../types/api';

interface Props {
  now: number;
}

export function AgentTimeline({ now }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [visible, setVisible] = useState(false);

  const fetchTimeline = useCallback(() => {
    fetch('http://localhost:3001/api/timeline')
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;
    fetchTimeline();
    const iv = setInterval(fetchTimeline, 5000);
    return () => clearInterval(iv);
  }, [visible, fetchTimeline]);

  if (!visible) {
    return (
      <div style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface }}>
        <div onClick={() => setVisible(true)} style={{
          padding: '8px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: T.textSecond, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Timeline
          </span>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>Click to expand</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface }}>
        <div onClick={() => setVisible(false)} style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: T.textSecond, textTransform: 'uppercase', letterSpacing: 0.8 }}>Timeline</span>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>Click to collapse</span>
        </div>
        <div style={{ padding: '12px 16px', fontFamily: T.sans, fontSize: 12, color: T.textDim, textAlign: 'center' }}>
          No timeline data yet
        </div>
      </div>
    );
  }

  const minTime = Math.min(...entries.map((e) => e.startTime));
  const maxTime = Math.max(now, ...entries.map((e) => e.endTime || now));
  const totalDuration = maxTime - minTime || 1;

  const agentGroups: Record<string, TimelineEntry[]> = {};
  entries.forEach((e) => {
    if (!agentGroups[e.agent]) agentGroups[e.agent] = [];
    agentGroups[e.agent].push(e);
  });
  const agents = Object.keys(agentGroups).sort();

  const ROW_H = 22;
  const LABEL_W = 140;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface }}>
      <div onClick={() => setVisible(false)} style={{
        padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: T.green, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Timeline
        </span>
        <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>
          {formatTime(totalDuration)} span &middot; {entries.length} events &middot; Click to collapse
        </span>
      </div>

      <div style={{ position: 'relative', height: 16, marginLeft: LABEL_W, marginRight: 8 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <span key={pct} style={{
            position: 'absolute', left: `${pct * 100}%`, transform: 'translateX(-50%)',
            fontFamily: T.mono, fontSize: 9, color: T.textDim, whiteSpace: 'nowrap',
          }}>
            {formatTime((maxTime - minTime) * pct)}
          </span>
        ))}
      </div>

      <div style={{ padding: '4px 8px 8px', maxHeight: 340, overflowY: 'auto' }}>
        {agents.map((agentName) => (
          <div key={agentName} style={{ display: 'flex', alignItems: 'center', height: ROW_H, gap: 0 }}>
            <span style={{
              width: LABEL_W, flexShrink: 0, fontFamily: T.mono, fontSize: 10,
              color: T.textSecond, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              paddingRight: 8,
            }}>
              {agentName}
            </span>
            <div style={{ flex: 1, position: 'relative', height: 14, backgroundColor: T.bgOverlay, borderRadius: 3 }}>
              {agentGroups[agentName].map((entry) => {
                const start = entry.startTime - minTime;
                const end = (entry.endTime || now) - minTime;
                const left = (start / totalDuration) * 100;
                const width = Math.max(((end - start) / totalDuration) * 100, 0.5);
                const color = entry.status === 'error' ? T.red : entry.status === 'completed' ? T.blue : T.green;
                const isActive = !entry.endTime;
                return (
                  <div
                    key={entry.id}
                    title={`${agentName}: ${entry.task || 'task'} (${formatTime(end - start)})`}
                    style={{
                      position: 'absolute', top: 2, bottom: 2,
                      left: `${left}%`, width: `${width}%`, minWidth: 3,
                      backgroundColor: color, borderRadius: 2, opacity: 0.85,
                      animation: isActive ? 'pipPulse 2s ease-in-out infinite' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
