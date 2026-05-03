import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme';
import { StatusBadge } from './StatusBadge';
import { ActivityBar } from './Primitives';
import { formatTime, formatTokens, formatTimestamp } from '../utils/format';
import type { Agent } from '../types/api';

// ─── Log entry type from /api/logs/:agent ────────────────────────────────────

interface LogEntry {
  id: number;
  agent: string;
  timestamp: number;
  output: string;
  event_type: string;
}

// ─── Error Detail Panel ──────────────────────────────────────────────────────

function ErrorDetailPanel({ agent, onDismiss }: { agent: Agent; onDismiss: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    fetch(`http://localhost:3001/api/logs/${encodeURIComponent(agent.name)}`)
      .then(r => r.json())
      .then((data: LogEntry[]) => { setLogs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agent.name]);

  const errorLogs = logs.filter(l => l.event_type === 'error');

  return (
    <div style={{
      marginTop: 6, borderRadius: 5, overflow: 'hidden',
      border: `1px solid ${T.red}30`,
      backgroundColor: 'rgba(248,113,113,0.04)',
    }}>
      {/* Red accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${T.red}, ${T.red}80, transparent)` }} />

      {/* Error header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px',
        borderBottom: `1px solid ${T.red}15`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Error
          </span>
          {agent.currentTask && (
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMuted }}>
              {agent.currentTask.length > 50 ? agent.currentTask.slice(0, 47) + '...' : agent.currentTask}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory && logs.length === 0) fetchLogs(); }}
            style={{
              padding: '2px 7px', borderRadius: 3,
              border: `1px solid ${T.red}25`, backgroundColor: showHistory ? `${T.red}12` : 'transparent',
              color: T.red, fontFamily: T.mono, fontSize: 9, cursor: 'pointer',
              transition: 'all 0.15s ease', opacity: 0.8,
            }}
          >
            {showHistory ? 'Hide history' : 'History'}
          </button>
          <button
            onClick={onDismiss}
            title="Dismiss error panel"
            style={{
              padding: '2px 7px', borderRadius: 3,
              border: `1px solid ${T.border}`, backgroundColor: 'transparent',
              color: T.textMuted, fontFamily: T.mono, fontSize: 9, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Latest error output (auto-shown) */}
      {agent.lastOutput && (
        <div style={{
          padding: '8px 10px', maxHeight: 200, overflowY: 'auto',
          borderBottom: showHistory ? `1px solid ${T.red}10` : 'none',
        }}>
          <pre style={{
            margin: 0, fontFamily: T.mono, fontSize: 10, color: T.red,
            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            opacity: 0.9,
          }}>
            {agent.lastOutput}
          </pre>
        </div>
      )}

      {!agent.lastOutput && (
        <div style={{ padding: '8px 10px' }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, fontStyle: 'italic' }}>
            No error output captured
          </span>
        </div>
      )}

      {/* Error history (fetched on demand) */}
      {showHistory && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '10px', textAlign: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>Loading...</span>
            </div>
          ) : errorLogs.length === 0 ? (
            <div style={{ padding: '10px', textAlign: 'center' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>
                {logs.length > 0 ? 'No previous errors in log' : 'No log history'}
              </span>
            </div>
          ) : (
            errorLogs.map((log) => (
              <div key={log.id} style={{
                padding: '6px 10px',
                borderTop: `1px solid ${T.red}08`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: T.mono, fontSize: 8, fontWeight: 600, color: T.red,
                    padding: '1px 4px', borderRadius: 2, backgroundColor: `${T.red}12`,
                    textTransform: 'uppercase',
                  }}>
                    err
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMuted }}>
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <pre style={{
                  margin: 0, fontFamily: T.mono, fontSize: 9, color: T.red,
                  lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  opacity: 0.7, maxHeight: 80, overflow: 'hidden',
                }}>
                  {log.output.length > 300 ? log.output.slice(0, 297) + '...' : log.output}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Team Lead card ───────────────────────────────────────────────────────────

interface TeamLeadCardProps {
  agent: Agent;
  elapsedTime: string | null;
}

export function TeamLeadCard({ agent, elapsedTime }: TeamLeadCardProps) {
  const [errorDismissed, setErrorDismissed] = useState(false);
  const isRunning = agent.status === 'running';
  const isError = agent.status === 'error';

  // Re-show error panel if agent errors again (status cycles away and back)
  useEffect(() => { if (!isError) setErrorDismissed(false); }, [isError]);
  return (
    <div style={{
      margin: '12px 14px', borderRadius: 8,
      border: `1px solid ${isError ? T.red + '40' : isRunning ? T.green + '40' : T.border}`,
      backgroundColor: T.bgSurfaceHi, overflow: 'hidden',
      animation: isError ? 'breatheRed 3s ease-in-out infinite' : isRunning ? 'breatheGreen 3s ease-in-out infinite' : 'none',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
        backgroundColor: isError ? 'rgba(248,113,113,0.04)' : isRunning ? 'rgba(52,211,153,0.04)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: isError ? T.red : isRunning ? T.green : T.textPrimary, letterSpacing: 0.3 }}>
            team-lead
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: 10, color: T.textMuted,
            backgroundColor: T.bgOverlay, border: `1px solid ${T.border}`,
            padding: '1px 7px', borderRadius: 4,
          }}>
            {agent.model}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {elapsedTime && (
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 600 }}>{elapsedTime}</span>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>
      {agent.currentTask ? (
        <div style={{ padding: '10px 14px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Current task
          </span>
          <p style={{ margin: '4px 0 0', fontFamily: T.mono, fontSize: 12, color: T.textSecond, lineHeight: 1.6 }}>
            {agent.currentTask}
          </p>
          <ActivityBar active={isRunning} />
        </div>
      ) : (
        <div style={{ padding: '10px 14px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>No active task</span>
        </div>
      )}
      {isError && !errorDismissed && (
        <div style={{ padding: '0 14px 10px' }}>
          <ErrorDetailPanel agent={agent} onDismiss={() => setErrorDismissed(true)} />
        </div>
      )}
    </div>
  );
}

// ─── Sub-orchestrator card (seo-manager) ────────────────────────────────────

interface SubOrchestratorCardProps {
  agent: Agent;
  childCount: number;
}

export function SubOrchestratorCard({ agent, childCount }: SubOrchestratorCardProps) {
  const [errorDismissed, setErrorDismissed] = useState(false);
  const isRunning = agent.status === 'running';
  const isError = agent.status === 'error';

  useEffect(() => { if (!isError) setErrorDismissed(false); }, [isError]);
  return (
    <div style={{
      margin: '10px 14px 4px', borderRadius: 8,
      border: `1px solid ${isError ? T.red + '35' : isRunning ? T.green + '35' : T.border}`,
      backgroundColor: T.bgSurfaceHi, overflow: 'hidden',
      animation: isError ? 'breatheRed 3s ease-in-out infinite' : isRunning ? 'breatheGreen 3s ease-in-out infinite' : 'none',
      transition: 'border-color 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', backgroundColor: isError ? 'rgba(248,113,113,0.04)' : isRunning ? 'rgba(52,211,153,0.04)' : 'transparent',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: isError ? T.red : isRunning ? T.green : T.textDim }}>&#9507;</span>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: isError ? T.red : isRunning ? T.green : T.textPrimary, letterSpacing: 0.3 }}>
            seo-manager
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: 10, color: T.textMuted,
            backgroundColor: T.bgOverlay, border: `1px solid ${T.border}`,
            padding: '1px 7px', borderRadius: 4,
          }}>
            {agent.model}
          </span>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textMuted }}>{childCount} specialists</span>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      {agent.currentTask ? (
        <div style={{ padding: '8px 12px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current task</span>
          <p style={{ margin: '3px 0 0', fontFamily: T.mono, fontSize: 11, color: T.textSecond, lineHeight: 1.5 }}>{agent.currentTask}</p>
          <ActivityBar active={isRunning} />
        </div>
      ) : (
        <div style={{ padding: '8px 12px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>No active task</span>
        </div>
      )}
      {isError && !errorDismissed && (
        <div style={{ padding: '0 12px 8px' }}>
          <ErrorDetailPanel agent={agent} onDismiss={() => setErrorDismissed(true)} />
        </div>
      )}
    </div>
  );
}

// ─── Specialist card (grid item) ─────────────────────────────────────────────

interface SpecialistCardProps {
  agent: Agent;
  index: number;
  compact?: boolean;
  now: number;
}

export function SpecialistCard({ agent, index, now }: SpecialistCardProps) {
  const [showLog, setShowLog] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const isRunning = agent.status === 'running';
  const isWaiting = agent.status === 'waiting';
  const isError   = agent.status === 'error';
  const elapsed = isRunning && agent.startTime ? formatTime(now - agent.startTime) : null;

  // Auto-collapse normal log when entering error state; re-show on new error
  useEffect(() => {
    if (isError) { setShowLog(false); setErrorDismissed(false); }
  }, [isError]);

  return (
    <div style={{
      borderRadius: 7,
      border: `1px solid ${isError ? T.red + '35' : isRunning ? T.green + '35' : isWaiting ? T.amber + '25' : T.border}`,
      backgroundColor: T.bgSurfaceHi, overflow: 'hidden',
      animation: isError
        ? 'breatheRed 3s ease-in-out infinite, fadeSlideIn 0.25s ease-out'
        : isRunning
        ? 'breatheGreen 3s ease-in-out infinite, fadeSlideIn 0.25s ease-out'
        : isWaiting
        ? 'breatheAmber 4s ease-in-out infinite, fadeSlideIn 0.25s ease-out'
        : 'fadeSlideIn 0.25s ease-out',
      transition: 'border-color 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: `1px solid ${T.border}`,
        backgroundColor: isError ? 'rgba(248,113,113,0.04)' : isRunning ? 'rgba(52,211,153,0.04)' : isWaiting ? 'rgba(251,191,36,0.04)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim, fontWeight: 500, flexShrink: 0 }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: 12, fontWeight: isRunning || isError ? 700 : 500,
            color: isError ? T.red : isRunning ? T.green : isWaiting ? T.amber : T.textSecond,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 0.2,
          }}>
            {agent.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {elapsed && (
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, fontWeight: 600 }}>{elapsed}</span>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!isError && (
          <p style={{
            margin: 0, fontFamily: T.mono, fontSize: 11,
            color: isRunning ? T.textSecond : T.textMuted, lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.8em',
          }}>
            {agent.currentTask || (isRunning ? 'Processing...' : 'No active task')}
          </p>
        )}

        {isRunning && <ActivityBar active />}

        {/* Error detail panel — auto-shown when in error state */}
        {isError && !errorDismissed && <ErrorDetailPanel agent={agent} onDismiss={() => setErrorDismissed(true)} />}

        <div style={{ display: 'flex', gap: 12, paddingTop: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.textSecond }}>{agent.allTimeTasks || agent.taskCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: (agent.allTimeTokens || agent.tokensUsed) ? T.blue : T.textDim }}>
              {(agent.allTimeTokens || agent.tokensUsed) ? formatTokens(agent.allTimeTokens || agent.tokensUsed) : '\u2014'}
            </span>
          </div>
          {!isError && agent.lastOutput && (
            <button
              onClick={() => setShowLog(!showLog)}
              style={{
                marginLeft: 'auto', padding: '2px 8px', borderRadius: 4,
                border: `1px solid ${T.border}`, backgroundColor: showLog ? T.bgOverlay : 'transparent',
                color: T.textMuted, fontFamily: T.mono, fontSize: 10, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {showLog ? 'Hide log' : 'Log'}
            </button>
          )}
        </div>

        {showLog && !isError && agent.lastOutput && (
          <div style={{
            marginTop: 4, padding: '8px 10px', borderRadius: 4,
            backgroundColor: '#0d1117', border: `1px solid ${T.border}`,
            maxHeight: 160, overflowY: 'auto',
          }}>
            <pre style={{
              margin: 0, fontFamily: T.mono, fontSize: 10, color: T.textSecond,
              lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {agent.lastOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
