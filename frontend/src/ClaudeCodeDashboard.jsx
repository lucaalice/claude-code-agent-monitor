import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Inject keyframes ─────────────────────────────────────────────────────────
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  @keyframes breatheGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0), 0 0 8px rgba(52,211,153,0.15); }
    50%       { box-shadow: 0 0 0 3px rgba(52,211,153,0.08), 0 0 18px rgba(52,211,153,0.25); }
  }
  @keyframes breatheAmber {
    0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0), 0 0 6px rgba(251,191,36,0.1); }
    50%       { box-shadow: 0 0 0 3px rgba(251,191,36,0.06), 0 0 14px rgba(251,191,36,0.2); }
  }
  @keyframes breatheRed {
    0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0), 0 0 6px rgba(248,113,113,0.1); }
    50%       { box-shadow: 0 0 0 3px rgba(248,113,113,0.06), 0 0 14px rgba(248,113,113,0.2); }
  }
  @keyframes pipPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes connectBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  @keyframes barMarch {
    0%   { border-left-color: rgba(52,211,153,0.6); }
    50%  { border-left-color: rgba(52,211,153,1); }
    100% { border-left-color: rgba(52,211,153,0.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`;
if (!document.head.querySelector('[data-ccd-styles]')) {
  styleSheet.setAttribute('data-ccd-styles', '1');
  document.head.appendChild(styleSheet);
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          '#111318',
  bgSurface:   '#181b22',
  bgSurfaceHi: '#1e2230',
  bgOverlay:   '#242838',
  border:      'rgba(255,255,255,0.06)',
  borderMed:   'rgba(255,255,255,0.10)',
  borderBright:'rgba(255,255,255,0.16)',
  green:       '#34d399',
  greenDim:    'rgba(52,211,153,0.15)',
  greenGlow:   'rgba(52,211,153,0.25)',
  teal:        '#22d3ee',
  blue:        '#60a5fa',
  blueDim:     'rgba(96,165,250,0.15)',
  amber:       '#fbbf24',
  amberDim:    'rgba(251,191,36,0.12)',
  slate:       '#64748b',
  slateDim:    'rgba(100,116,139,0.12)',
  purple:      '#a78bfa',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.12)',
  textPrimary: '#f1f5f9',
  textSecond:  '#94a3b8',
  textMuted:   '#475569',
  textDim:     '#334155',
  sans: '"Inter", "system-ui", "-apple-system", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", "Consolas", monospace',
};

// ─── Utility formatters ───────────────────────────────────────────────────────
const formatCost   = (c) => `$${c.toFixed(4)}`;
const formatTokens = (t) => {
  if (t > 1_000_000) return (t / 1_000_000).toFixed(2) + 'M';
  if (t > 1_000)     return (t / 1_000).toFixed(1) + 'K';
  return t.toString();
};
const formatTime = (ms) => {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};
const pad2 = (n) => String(n).padStart(2, '0');
const ts = (t) => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const formatDate = (t) => {
  const d = new Date(t);
  return `${d.getMonth()+1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META = {
  running:   { color: T.green,  dim: T.greenDim,  label: 'Running',   dot: T.green  },
  completed: { color: T.blue,   dim: T.blueDim,   label: 'Done',      dot: T.blue   },
  waiting:   { color: T.amber,  dim: T.amberDim,  label: 'Waiting',   dot: T.amber  },
  error:     { color: T.red,    dim: T.redDim,    label: 'Error',     dot: T.red    },
  idle:      { color: T.slate,  dim: T.slateDim,  label: 'Idle',      dot: T.slate  },
};
const getStatus = (s) => STATUS_META[s] || STATUS_META.idle;

// ─── Micro-components ─────────────────────────────────────────────────────────

function StatusDot({ status, size = 8 }) {
  const m = getStatus(status);
  const isRunning = status === 'running';
  return (
    <span style={{
      display:         'inline-block',
      width:           size,
      height:          size,
      borderRadius:    '50%',
      backgroundColor: m.color,
      boxShadow:       isRunning ? `0 0 0 2px ${T.greenGlow}` : 'none',
      animation:       isRunning ? 'pipPulse 2s ease-in-out infinite' : 'none',
      flexShrink:      0,
      transition:      'background-color 0.3s ease',
    }} aria-label={m.label} />
  );
}

function StatusBadge({ status }) {
  const m = getStatus(status);
  return (
    <span style={{
      display:         'inline-flex',
      alignItems:      'center',
      gap:             5,
      padding:         '2px 8px',
      borderRadius:    99,
      backgroundColor: m.dim,
      border:          `1px solid ${m.color}33`,
      fontFamily:      T.sans,
      fontSize:        11,
      fontWeight:      500,
      color:           m.color,
      letterSpacing:   0.2,
      whiteSpace:      'nowrap',
    }}>
      <StatusDot status={status} size={6} />
      {m.label}
    </span>
  );
}

function ActivityBar({ active }) {
  if (!active) return null;
  return (
    <div style={{
      height:     2,
      borderRadius: 1,
      background: `linear-gradient(90deg, transparent 0%, ${T.green} 50%, transparent 100%)`,
      backgroundSize: '200% 100%',
      animation:  'shimmer 1.8s ease-in-out infinite',
      marginTop:  4,
      opacity:    0.7,
    }} aria-hidden="true" />
  );
}

function Divider({ vertical = false }) {
  return (
    <div style={vertical ? {
      width:           1,
      alignSelf:       'stretch',
      backgroundColor: T.border,
      flexShrink:      0,
    } : {
      height:          1,
      backgroundColor: T.border,
      width:           '100%',
    }} />
  );
}

function SectionHeader({ label, right, accent = false }) {
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '8px 16px',
      backgroundColor: T.bgSurface,
      borderBottom:    `1px solid ${T.border}`,
      minHeight:       36,
    }}>
      <span style={{
        fontFamily:    T.sans,
        fontSize:      11,
        fontWeight:    600,
        color:         accent ? T.green : T.textSecond,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}>
        {label}
      </span>
      {right && (
        <span style={{
          fontFamily:  T.mono,
          fontSize:    10,
          color:       T.textMuted,
          letterSpacing: 0.3,
        }}>
          {right}
        </span>
      )}
    </div>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────────
function FilterBar({ filter, setFilter, counts }) {
  const buttons = [
    { key: 'all',       label: 'All',       color: T.textSecond },
    { key: 'running',   label: 'Running',   color: T.green },
    { key: 'error',     label: 'Error',     color: T.red },
    { key: 'completed', label: 'Done',      color: T.blue },
    { key: 'idle',      label: 'Idle',      color: T.slate },
  ];

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             6,
      padding:         '6px 16px',
      backgroundColor: T.bgSurface,
      borderBottom:    `1px solid ${T.border}`,
    }}>
      <span style={{
        fontFamily:    T.sans,
        fontSize:      10,
        color:         T.textDim,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginRight:   4,
      }}>
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
              display:         'inline-flex',
              alignItems:      'center',
              gap:             4,
              padding:         '3px 10px',
              borderRadius:    99,
              border:          `1px solid ${active ? btn.color + '40' : T.border}`,
              backgroundColor: active ? btn.color + '15' : 'transparent',
              color:           active ? btn.color : T.textMuted,
              fontFamily:      T.sans,
              fontSize:        11,
              fontWeight:      active ? 600 : 400,
              cursor:          'pointer',
              transition:      'all 0.15s ease',
            }}
          >
            {btn.label}
            <span style={{
              fontFamily: T.mono,
              fontSize:   10,
              opacity:    0.7,
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Metrics strip ────────────────────────────────────────────────────────────
function MetricStrip({ metrics, activeAgentCount, now, onArchive }) {
  const items = [
    { key: 'Active Agents', value: activeAgentCount, unit: activeAgentCount === 1 ? 'agent' : 'agents', color: T.green, dim: T.greenDim },
    { key: 'Tokens Used', value: formatTokens(metrics.totalTokens), unit: 'total', color: T.blue, dim: T.blueDim },
    { key: 'Est. Cost', value: formatCost(metrics.totalCost), unit: 'USD', color: T.amber, dim: T.amberDim },
    { key: 'Tasks Done', value: metrics.completedTasks, unit: 'completed', color: T.purple, dim: 'rgba(167,139,250,0.12)' },
    { key: 'Session', value: formatTime(now - metrics.sessionStartTime), unit: 'elapsed', color: T.textSecond, dim: 'rgba(148,163,184,0.08)' },
  ];

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 && <Divider vertical />}
          <div style={{
            flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 3,
            backgroundColor: T.bgSurface, transition: 'background-color 0.2s ease',
          }}>
            <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
              {item.key}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
              {item.value}
            </span>
            <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>
              {item.unit}
            </span>
          </div>
        </React.Fragment>
      ))}
      {/* Archive button */}
      <Divider vertical />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px', backgroundColor: T.bgSurface,
      }}>
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

// ─── Team Lead card ───────────────────────────────────────────────────────────
function TeamLeadCard({ agent, elapsedTime }) {
  const isRunning = agent.status === 'running';
  return (
    <div style={{
      margin: '12px 14px', borderRadius: 8,
      border: `1px solid ${isRunning ? T.green + '40' : T.border}`,
      backgroundColor: T.bgSurfaceHi, overflow: 'hidden',
      animation: isRunning ? 'breatheGreen 3s ease-in-out infinite' : 'none',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: `1px solid ${T.border}`,
        backgroundColor: isRunning ? 'rgba(52,211,153,0.04)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: isRunning ? T.green : T.textPrimary, letterSpacing: 0.3 }}>
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
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 600 }}>
              {elapsedTime}
            </span>
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
          <span style={{ fontFamily: T.sans, fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>
            No active task
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Sub-orchestrator card (seo-manager) ────────────────────────────────────
function SubOrchestratorCard({ agent, childCount }) {
  const isRunning = agent.status === 'running';
  return (
    <div style={{
      margin: '10px 14px 4px', borderRadius: 8,
      border: `1px solid ${isRunning ? T.green + '35' : T.border}`,
      backgroundColor: T.bgSurfaceHi, overflow: 'hidden',
      animation: isRunning ? 'breatheGreen 3s ease-in-out infinite' : 'none',
      transition: 'border-color 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', backgroundColor: isRunning ? 'rgba(52,211,153,0.04)' : 'transparent',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: isRunning ? T.green : T.textDim }}>&#9507;</span>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: isRunning ? T.green : T.textPrimary, letterSpacing: 0.3 }}>
            seo-manager
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: 10, color: T.textMuted,
            backgroundColor: T.bgOverlay, border: `1px solid ${T.border}`,
            padding: '1px 7px', borderRadius: 4,
          }}>
            opus
          </span>
          <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textMuted }}>
            {childCount} specialists
          </span>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      {agent.currentTask ? (
        <div style={{ padding: '8px 12px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Current task
          </span>
          <p style={{ margin: '3px 0 0', fontFamily: T.mono, fontSize: 11, color: T.textSecond, lineHeight: 1.5 }}>
            {agent.currentTask}
          </p>
          <ActivityBar active={isRunning} />
        </div>
      ) : (
        <div style={{ padding: '8px 12px' }}>
          <span style={{ fontFamily: T.sans, fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>
            No active task
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Specialist card (grid item) ─────────────────────────────────────────────
function SpecialistCard({ agent, index, compact, now }) {
  const [showLog, setShowLog] = useState(false);
  const isRunning = agent.status === 'running';
  const isWaiting = agent.status === 'waiting';
  const isError   = agent.status === 'error';
  const m = getStatus(agent.status);
  const elapsed = isRunning && agent.startTime ? formatTime(now - agent.startTime) : null;

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
      {/* Card top: name + status */}
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
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, fontWeight: 600 }}>
              {elapsed}
            </span>
          )}
          <StatusBadge status={agent.status} />
        </div>
      </div>

      {/* Card body: task + stats */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{
          margin: 0, fontFamily: T.mono, fontSize: 11,
          color: isRunning ? T.textSecond : T.textMuted, lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.8em',
        }}>
          {agent.currentTask || (isRunning ? 'Processing...' : 'No active task')}
        </p>

        {isRunning && <ActivityBar active />}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.textSecond }}>{agent.taskCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: agent.tokensUsed ? T.blue : T.textDim }}>
              {agent.tokensUsed ? formatTokens(agent.tokensUsed) : '—'}
            </span>
          </div>
          {/* Log toggle */}
          {agent.lastOutput && (
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

        {/* Log output viewer */}
        {showLog && agent.lastOutput && (
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

// ─── Task queue ───────────────────────────────────────────────────────────────
function TaskQueue({ tasks }) {
  const slice = tasks.slice(-25).reverse();
  const statusColor = (s) => s === 'completed' ? T.blue : s === 'error' ? T.red : T.green;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {slice.map((task, i) => (
        <div key={task.id || i} style={{
          display: 'grid', gridTemplateColumns: '48px 1fr', gap: 0,
          padding: '7px 14px',
          borderBottom: i < slice.length - 1 ? `1px solid ${T.border}` : 'none',
          animation: `fadeSlideIn ${0.05 + i * 0.03}s ease-out`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMuted, letterSpacing: 0.3, lineHeight: 1.3 }}>
              {ts(task.timestamp)}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.agent || 'sys'}
            </span>
          </div>
          <span style={{
            fontFamily: T.sans, fontSize: 11,
            color: task.status === 'completed' ? T.blue : task.status === 'error' ? T.red : T.textSecond,
            lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            paddingLeft: 8, borderLeft: `2px solid ${statusColor(task.status)}`,
          }}>
            {task.task}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Session history panel ───────────────────────────────────────────────────
function SessionHistory({ sessions, onClose }) {
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

// ─── Boot / disconnected screen ───────────────────────────────────────────────
function BootScreen({ connected }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: T.sans, fontSize: 28, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
          Agent Monitor
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 13, color: T.textMuted, letterSpacing: 0.3 }}>
          Claude Code · Real-time dashboard
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
        borderRadius: 8, backgroundColor: T.bgSurface, border: `1px solid ${T.border}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: connected ? T.green : T.amber,
          animation: 'connectBlink 1s ease-in-out infinite',
          boxShadow: `0 0 8px ${connected ? T.green : T.amber}`,
        }} />
        <span style={{ fontFamily: T.sans, fontSize: 13, color: connected ? T.green : T.amber, fontWeight: 500 }}>
          {connected ? `Waiting for data${dots}` : `Connecting${dots} (auto-reconnect enabled)`}
        </span>
      </div>
      {!connected && (
        <div style={{
          padding: '10px 16px', borderRadius: 6, backgroundColor: T.bgSurface,
          border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12, color: T.textSecond,
        }}>
          <span style={{ color: T.textDim }}>$ </span>node claude-dashboard-server.js
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClaudeCodeDashboard() {
  const [agentState, setAgentState]     = useState(null);
  const [connected, setConnected]       = useState(false);
  const [now, setNow]                   = useState(Date.now());
  const [statusFilter, setStatusFilter] = useState('all');
  const [sessions, setSessions]         = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [notifMuted, setNotifMuted]     = useState(() => localStorage.getItem('dashboard-notif-muted') === 'true');
  const prevStateRef = useRef(null);

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Desktop notifications — diff previous vs current agent state
  useEffect(() => {
    if (!agentState || notifMuted || !('Notification' in window) || Notification.permission !== 'granted') {
      prevStateRef.current = agentState;
      return;
    }
    const prev = prevStateRef.current;
    if (prev && prev.specialists) {
      const prevSpecs = prev.specialists;
      const newSpecs  = agentState.specialists;
      for (const name of Object.keys(newSpecs)) {
        const prevStatus = prevSpecs[name]?.status;
        const newStatus  = newSpecs[name]?.status;
        if (prevStatus === 'running' && newStatus === 'completed') {
          new Notification('Agent completed', { body: `${name} finished task`, tag: `complete-${name}`, silent: false });
        }
        if (prevStatus === 'running' && newStatus === 'error') {
          new Notification('Agent error', { body: `${name} encountered an error`, tag: `error-${name}`, silent: false });
        }
      }
    }
    prevStateRef.current = agentState;
  }, [agentState, notifMuted]);

  // Toggle notification mute
  const toggleMute = useCallback(() => {
    setNotifMuted((m) => {
      const next = !m;
      localStorage.setItem('dashboard-notif-muted', String(next));
      return next;
    });
  }, []);

  // Fetch session history
  const fetchSessions = useCallback(() => {
    fetch('http://localhost:3001/api/sessions')
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {});
  }, []);

  // Archive current session
  const archiveSession = useCallback(() => {
    fetch('http://localhost:3001/api/session/archive', { method: 'POST' })
      .then((r) => r.json())
      .then(() => fetchSessions())
      .catch(() => {});
  }, [fetchSessions]);

  // Load sessions on mount
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl      = `${wsProtocol}//localhost:3001/ws`;
    let socket       = null;
    let reconnectDelay = 1000;
    let reconnectTimer = null;
    let intentionalClose = false;

    function connect() {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => { setConnected(true); reconnectDelay = 1000; };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'state_update') setAgentState(message.payload);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!intentionalClose) {
          reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 15000);
            connect();
          }, reconnectDelay);
        }
      };
      socket.onerror = () => {};
    }

    connect();
    return () => {
      intentionalClose = true;
      clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, []);

  if (!agentState) return <BootScreen connected={connected} />;

  const specialists  = Object.values(agentState.specialists);
  const runningCount = specialists.filter((a) => a.status === 'running').length;

  const elapsedTime =
    agentState.teamLead.startTime && agentState.teamLead.status === 'running'
      ? formatTime(now - agentState.teamLead.startTime) : null;

  const sessionAge = formatTime(now - agentState.globalMetrics.sessionStartTime);

  // Status counts for filter bar
  const statusCounts = { all: specialists.length, running: 0, error: 0, completed: 0, idle: 0 };
  specialists.forEach((a) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  const statusSort = (a, b) => {
    const order = { running: 0, error: 1, waiting: 2, completed: 3, idle: 4 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  };

  const applyFilter = (agents) =>
    statusFilter === 'all' ? agents : agents.filter((a) => a.status === statusFilter);

  // Split agents into hierarchy
  const seoSpecialistNames = ['seo-technical', 'seo-content', 'seo-schema', 'seo-sitemap', 'seo-geo', 'seo-performance', 'seo-visual'];
  const seoManager    = specialists.find((a) => a.name === 'seo-manager') || null;
  const seoAgents     = specialists.filter((a) => seoSpecialistNames.includes(a.name));
  const directReports = specialists.filter((a) => a.name !== 'seo-manager' && !seoSpecialistNames.includes(a.name));

  const filteredDirect = applyFilter([...directReports]).sort(statusSort);
  const filteredSeo    = applyFilter([...seoAgents]).sort(statusSort);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.bg, fontFamily: T.sans,
      color: T.textPrimary, display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Notification mute toggle */}
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

          {/* Session history toggle */}
          <button
            onClick={() => { setShowSessions(!showSessions); if (!showSessions) fetchSessions(); }}
            style={{
              padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`,
              backgroundColor: showSessions ? T.bgOverlay : 'transparent', cursor: 'pointer',
              fontFamily: T.sans, fontSize: 11, color: T.textMuted,
              transition: 'all 0.15s ease',
            }}
          >
            History
          </button>

          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>
            up {sessionAge}
          </span>

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

      {/* ── Metrics strip ─────────────────────────────────────────────────────── */}
      <MetricStrip
        metrics={agentState.globalMetrics}
        activeAgentCount={runningCount}
        now={now}
        onArchive={archiveSession}
      />

      {/* ── Filter bar ────────────────────────────────────────────────────────── */}
      <FilterBar filter={statusFilter} setFilter={setStatusFilter} counts={statusCounts} />

      {/* ── Session history (collapsible) ─────────────────────────────────────── */}
      {showSessions && (
        <div style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface }}>
          <SectionHeader label="Session History" right={`${sessions.length} sessions`} />
          <SessionHistory sessions={sessions} />
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px',
        minHeight: 0, overflow: 'hidden',
      }}>

        {/* LEFT: orchestrator + specialist grid */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${T.border}`, overflowY: 'auto',
        }}>

          {/* Team lead section */}
          <div style={{ borderBottom: `1px solid ${T.border}` }}>
            <SectionHeader label="Orchestrator" right="team-lead" accent />
            <TeamLeadCard agent={agentState.teamLead} elapsedTime={elapsedTime} />
          </div>

          {/* Direct reports section */}
          <div style={{ borderBottom: `1px solid ${T.border}` }}>
            <SectionHeader
              label="Direct Reports"
              right={`${directReports.filter(a => a.status === 'running').length} running · ${directReports.length} agents`}
            />
            {filteredDirect.length > 0 ? (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 10, padding: '12px 14px',
              }}>
                {filteredDirect.map((agent, i) => (
                  <SpecialistCard key={agent.name} agent={agent} index={i} now={now} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: T.sans, fontSize: 12, color: T.textDim }}>
                No {statusFilter} agents
              </div>
            )}
          </div>

          {/* SEO Team section */}
          <div style={{ flex: 1 }}>
            <SectionHeader
              label="SEO Team"
              right={`${seoAgents.filter(a => a.status === 'running').length} running · ${seoAgents.length + 1} agents`}
            />
            {seoManager && <SubOrchestratorCard agent={seoManager} childCount={seoAgents.length} />}
            {filteredSeo.length > 0 ? (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 10, padding: '8px 14px 12px 28px', marginLeft: 14,
                borderLeft: `2px solid ${seoManager && seoManager.status === 'running' ? T.green + '40' : T.border}`,
                transition: 'border-color 0.3s ease',
              }}>
                {filteredSeo.map((agent, i) => (
                  <SpecialistCard key={agent.name} agent={agent} index={i} compact now={now} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 28px', marginLeft: 14, borderLeft: `2px solid ${T.border}`, fontFamily: T.sans, fontSize: 12, color: T.textDim }}>
                No {statusFilter} agents
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: task queue */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <SectionHeader label="Task Queue" right={`${agentState.taskQueue.length} events`} />
          {agentState.taskQueue.length > 0 ? (
            <TaskQueue tasks={agentState.taskQueue} />
          ) : (
            <div style={{ padding: '24px 16px', fontFamily: T.sans, fontSize: 12, color: T.textDim, textAlign: 'center' }}>
              No events yet
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────────── */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 32, backgroundColor: T.bgSurface,
        borderTop: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
          ws://localhost:3001/ws
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
          {new Date().toLocaleTimeString('en-GB')}
        </span>
        <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>
          Claude Code Agent Dashboard
        </span>
      </footer>
    </div>
  );
}
