import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme';
import { formatDate, formatTime, formatTokens, formatCost } from '../utils/format';
import { SectionHeader } from '../components/Primitives';
import { PageNav } from '../components/PageNav';
import type { Session } from '../types/api';

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(() => {
    fetch('http://localhost:3001/api/sessions')
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, color: T.textPrimary, fontFamily: T.sans }}>
      <PageNav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: T.textPrimary, marginBottom: 16 }}>
          Session History
        </h1>
        <SectionHeader label="Archived Sessions" right={`${sessions.length} total`} />
        {sessions.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontFamily: T.sans, fontSize: 13, color: T.textDim }}>
            No archived sessions yet. Use the Archive button on the dashboard to save sessions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sessions.map((s) => (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                gap: 12, padding: '12px 16px',
                borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface,
              }}>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>When</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textSecond }}>{formatDate(s.startTime)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textSecond }}>{formatTime(s.endTime - s.startTime)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.blue }}>{formatTokens(s.totalTokens)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cost</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.amber }}>{formatCost(s.totalCost)}</div>
                </div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.purple }}>{s.completedTasks}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
